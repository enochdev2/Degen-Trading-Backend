import { LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";

import { Connection, PublicKey, clusterApiUrl,Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as splToken from "@solana/spl-token";
import { connectDB } from "../lib/db.js";

// import { createTokenIfNotExists } from "../utils/index";
// Define the network cluster (use devnet for your testing purposes)
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed'); // 'confirmed' ensures transactions are confirmed
const programWallet = Keypair.generate(); // You can also load it from a secret key file or environment variable

export const swapsolana = async (req, res) => {
  const { userPublicKey, solAmount, targetTokenMint, priceFeed } = req.body;

  try {
    const userWallet = new PublicKey(userPublicKey);

    // Fetch price feed for the pair
    const tokenPair = `SOL/${targetTokenMint}`;
    const tokenPrice = priceFeed[tokenPair];
    if (!tokenPrice) {
      return res.status(400).json({ error: "Token pair not supported" });
    }

    // Calculate target token amount based on SOL amount and price feed
    const targetTokenAmount = solAmount * tokenPrice;

    // Get the token mint and ensure it exists
    const mintAuthority = Keypair.generate(); // Mint authority for initial minting
    const tokenMint = await createTokenIfNotExists(
      targetTokenMint,
      mintAuthority,
      1000000000
    ); // Initial supply of 1B tokens for example

    // Ensure the user has an associated token account
    const userTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(
      userWallet
    );

    // Program's associated token account (the source of tokens to transfer from)
    const programTokenAccount =
      await tokenMint.getOrCreateAssociatedAccountInfo(programWallet.publicKey);

    // Transfer tokens from the program's account to the user's account
    const transferInstruction = splToken.Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      programTokenAccount.address, // Program's token account
      userTokenAccount.address, // User's token account
      programWallet.publicKey, // Program's wallet as the owner
      [], // No multisig signers
      targetTokenAmount * 1e9 // Transfer amount (9 decimals)
    );

    // Add the transfer instruction to a transaction
    const transaction = new Transaction().add(transferInstruction);

    // Create a transfer SOL transaction from the user to the program wallet (optional)
    const solTransferInstruction = SystemProgram.transfer({
      fromPubkey: userWallet,
      toPubkey: programWallet.publicKey,
      lamports: solAmount * LAMPORTS_PER_SOL,
    });
    transaction.add(solTransferInstruction);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });
    const transactionBase64 = serializedTransaction.toString("base64");

    // Return the transaction to the frontend for the user to sign
    res.json({
        transaction: transactionBase64,
        tokenMintAddress: tokenMint.publicKey.toBase58(), // Token mint address
        targetTokenAmount: targetTokenAmount, // Target token amount calculated
        message: `Successfully prepared swap for ${solAmount} SOL to ${targetTokenAmount} ${targetTokenMint}`,
     });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Swap transaction preparation failed" });
  }
};

export const swapothers = async (req, res) => {
  const {
    userPublicKey,
    targetTokenAmount,
    targetTokenMint,
    devSolMint,
    priceFeed,
  } = req.body;

  try {
    const userWallet = new PublicKey(userPublicKey);

    // Get the conversion rate from the price feed (e.g., USDC -> DeVSol)
    const tokenPair = `${targetTokenMint}/DeVSol`;
    const conversionRate = priceFeed[tokenPair]; // e.g., 1 USDC = 0.04 DeVSol (example rate)

    if (!conversionRate) {
      throw new Error(`Conversion rate for ${tokenPair} not found.`);
    }

    // Calculate the amount of DeVSol the user will receive
    const devSolAmount = targetTokenAmount * conversionRate;

    // Ensure the user has an associated token account for the target token (e.g., USDC)
    const targetTokenAccount =
      await splToken.Token.getOrCreateAssociatedAccountInfo(
        connection,
        targetTokenMint,
        userWallet
      );

    // Ensure the program has an associated token account for DeVSol
    const devSolTokenAccount =
      await splToken.Token.getOrCreateAssociatedAccountInfo(
        connection,
        devSolMint,
        programWallet.publicKey
      );

    // Transfer the target tokens (e.g., USDC) from the user to the program wallet
    const transferInstruction = splToken.Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      targetTokenAccount.address, // User's target token account (e.g., USDC)
      programWallet.publicKey, // Program wallet to receive target tokens
      userWallet, // User's wallet
      [], // No multisig signers
      targetTokenAmount * 1e6 // Amount to transfer (assuming 6 decimals for USDC)
    );

    // Mint DeVSol to the user’s associated token account
    const userDevSolTokenAccount =
      await splToken.Token.getOrCreateAssociatedAccountInfo(
        connection,
        devSolMint,
        userWallet
      );

    const mintToInstruction = splToken.Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      devSolMint, // Mint address of DeVSol
      userDevSolTokenAccount.address, // User's DeVSol token account
      programWallet.publicKey, // Program wallet (as mint authority)
      [], // No multisig signers
      devSolAmount * 1e9 // Amount of DeVSol to mint (assuming 9 decimals)
    );

    // Add both instructions (transfer and mint) to a transaction
    const transaction = new Transaction().add(
      transferInstruction,
      mintToInstruction
    );

    // Send the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [programWallet]
    );

    console.log(
      `Converted ${targetTokenAmount} ${targetTokenMint} to ${devSolAmount} DeVSol.`
    );

    res.json({
        success: true,
        transactionSignature: signature,
        targetTokenAmount: targetTokenAmount, // Amount of original token converted
        devSolAmount: devSolAmount, // Amount of DeVSol received
        message: `Successfully converted ${targetTokenAmount} tokens to ${devSolAmount} DeVSol.`,
        timestamp: new Date(),
     });
     
  } catch (err) {
    res.status(500).json({ error: "Swap transaction preparation failed" });
    throw err;
  }
};



const createTokenIfNotExists = async (tokenName, mintAuthority, initialSupply) => {
  // Check if the token has already been minted
  // const existingToken = mintedTokens.find(token => token.name === tokenName);

  connectDB();

  // Check if the token exists in the database
  const existingToken = await Token.findOne({ tokenName });

  if (existingToken) {
    console.log(
      `${tokenName} already exists with mint address: ${existingToken.mintAddress}`
    );
    return new PublicKey(existingToken.mintAddress);
  }

  // Mint a new token if it doesn't exist
  const tokenMint = await splToken.Token.createMint(
    connection,
    programWallet, // Program wallet or admin wallet
    mintAuthority.publicKey, // Mint authority
    null, // Freeze authority
    9, // Decimals
    TOKEN_PROGRAM_ID
  );

  // Store the token name and mint address in the array
  mintedTokens.push({
    name: tokenName,
    mintAddress: tokenMint.publicKey.toBase58(),
  });

  // Store the token name and mint address in the database
  await Token.insertOne({
    tokenName: tokenName,
    mintAddress: tokenMint.publicKey.toBase58(),
    createdAt: new Date(), // Optional: You can store the date the token was created
  });

  console.log(
    `Minted new token ${tokenName} with mint address: ${tokenMint.publicKey.toBase58()}`
  );

  // Get the program's associated token account for this mint
  const programTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(
    programWallet.publicKey
  );

  // Mint the initial supply of tokens to the program's token account
  await tokenMint.mintTo(
    programTokenAccount.address, // Program's token account
    mintAuthority.publicKey, // Mint authority
    [], // No multisig signers
    initialSupply * 1e9 // Initial supply (assuming 9 decimals)
  );

  console.log(
    `Minted initial supply of ${initialSupply} ${tokenName} tokens to the program wallet`
  );
  return tokenMint;
  // return tokenMint.publicKey.toBase58();
};
