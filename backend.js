import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, TransactionSignature } from '@solana/web3.js';
import { FC, useCallback } from 'react';
import { notify } from "../utils/notifications";
import useUserSOLBalanceStore from '../stores/useUserSOLBalanceStore';

import { Connection, PublicKey, clusterApiUrl, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

// MongoDB setup
const { MongoClient } = require('mongodb');
const mongoUri = "mongodb://localhost:27017"; // Use your actual MongoDB URI
const client = new MongoClient(mongoUri);
let tokensCollection;

    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const { getUserSOLBalance } = useUserSOLBalanceStore();

///////////////////////////////////////////////////////////////////////////////////////////////////////
//?         AIRDROP FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////////////////////

const onClick = useCallback(async () => {
    if (!publicKey) {
        console.log('error', 'Wallet not connected!');
        notify({ type: 'error', message: 'error', description: 'Wallet not connected!' });
        return;
    }

    let signature = '';

    try {
        signature = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);

        // Get the lates block hash to use on our transaction and confirmation
        let latestBlockhash = await connection.getLatestBlockhash()
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

        notify({ type: 'success', message: 'Airdrop successful!', txid: signature });

        getUserSOLBalance(publicKey, connection);
    } catch (error: any) {
        notify({ type: 'error', message: `Airdrop failed!`, description: error?.message, txid: signature });
        console.log('error', `Airdrop failed! ${error?.message}`, signature);
    }
}, [publicKey, connection, getUserSOLBalance]);



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//?                  MINT TOKEN FUNCTION
////________________________________________________________________________________________________________________


async function connectToDatabase() {
    try {
        await client.connect();
        const database = client.db('solana_dex');
        tokensCollection = database.collection('tokens');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Database connection error:', err);
    }
}

connectToDatabase();




// SOLANA_NETWORK can be 'devnet', 'testnet', or 'mainnet-beta'
const SOLANA_NETWORK = 'devnet';


  // Function to mint token
const mintToken = async (walletAddress) => {

    try {
      const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), 'confirmed');
      
      // Create a Keypair (you can replace this with your already created Keypair for the mint)
      const mintAuthority = Keypair.generate();

      // Create new token mint
      const mint = await createMint(
        connection,
        mintAuthority,   // The mint authority keypair (private key needed to mint new tokens)
        mintAuthority.publicKey,  // The public key who will have minting authority
        null,                     // Freeze authority (optional)
        9                         // Decimal places
      );
      
      console.log("Token Mint Address: ", mint.toBase58());

      // Create or get the token account associated with the user's wallet address
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,                      // Mint address of the token
        new PublicKey(walletAddress) // The user's wallet address (to mint tokens to)
      );
      
      console.log("User Token Account: ", userTokenAccount.address.toBase58());

      //! Mint 100 tokens to the user's wallet (userTokenAccount)
      const mintTxSignature = await mintTo(
        connection,
        mintAuthority,
        mint,
        userTokenAccount.address,   // Token account to mint to
        mintAuthority,              // Mint authority to authorize the minting
        100 * Math.pow(10, 9)       // Amount of tokens to mint (in smallest unit, adjusted for decimals)
      );
      
      console.log("Mint transaction signature: ", mintTxSignature);

    } catch (error) {
      console.error("Error minting token: ", error);
    } finally {
    }
};






















///////////////////////////////////////////////////////////////////////////////////////////
//?                         MAIN FUNCTIONS FOR THE BACKEND
/////////////////////////////////////////////////////////////////////////////////////////////



// Array to store tokens that have been minted
let mintedTokens = []; // Or use a map { [tokenName]: mintAddress } for more structure

//! Function to create token if it doesn't exist in the array
async function createTokenIfNotExists(tokenName, mintAuthority) {
    // Check if the token has already been minted
    // const existingToken = mintedTokens.find(token => token.name === tokenName);


     // Check if the token exists in the database
     const existingToken = await tokensCollection.findOne({ tokenName });

     if (existingToken) {
        console.log(`${tokenName} already exists with mint address: ${existingToken.mintAddress}`);
        return new web3.PublicKey(existingToken.mintAddress);
    }

    
    if (existingToken) {
        console.log(`${tokenName} already exists with mint address: ${existingToken.mintAddress}`);
        return existingToken.mintAddress; // Return the existing token's mint address
    }

    // Mint a new token if it doesn't exist
    const tokenMint = await splToken.Token.createMint(
        connection,
        programWallet, // Program wallet or admin wallet
        mintAuthority.publicKey,  // Mint authority
        null,                     // Freeze authority
        9,                        // Decimals
        splToken.TOKEN_PROGRAM_ID
    );

    // Store the token name and mint address in the array
    mintedTokens.push({
        name: tokenName,
        mintAddress: tokenMint.publicKey.toBase58()
    });

     // Store the token name and mint address in the database
     await tokensCollection.insertOne({
        tokenName: tokenName,
        mintAddress: tokenMint.publicKey.toBase58(),
        createdAt: new Date()  // Optional: You can store the date the token was created
    });

    console.log(`Minted new token ${tokenName} with mint address: ${tokenMint.publicKey.toBase58()}`);


    // Get the program's associated token account for this mint
    const programTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(programWallet.publicKey);

    // Mint the initial supply of tokens to the program's token account
    await tokenMint.mintTo(
        programTokenAccount.address,   // Program's token account
        mintAuthority.publicKey,       // Mint authority
        [],                            // No multisig signers
        initialSupply * 1e9            // Initial supply (assuming 9 decimals)
    );

    // Store the token name and mint address in the array or map
    mintedTokensMap[tokenName] = tokenMint.publicKey.toBase58();

    console.log(`Minted initial supply of ${initialSupply} ${tokenName} tokens to the program wallet`);
    return tokenMint;
    // return tokenMint.publicKey.toBase58();
}


app.post('/swapsolana', async (req, res) => {
    const { userPublicKey, solAmount, targetTokenMint, priceFeed } = req.body;

    try {
        const userWallet = new web3.PublicKey(userPublicKey);



        // Fetch price feed for the pair
        const tokenPair = `SOL/${targetTokenMint}`;
        const tokenPrice = priceFeed[tokenPair];
        if (!tokenPrice) {
            return res.status(400).json({ error: 'Token pair not supported' });
        }

        // Calculate target token amount based on SOL amount and price feed
        const targetTokenAmount = solAmount * tokenPrice;

        // Get the token mint and ensure it exists
        const mintAuthority = web3.Keypair.generate();  // Mint authority for initial minting
        const tokenMint = await createTokenIfNotExists(targetTokenMint, mintAuthority, 1000000); // Initial supply of 1M tokens for example

        // Ensure the user has an associated token account
        const userTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(userWallet);

        // Program's associated token account (the source of tokens to transfer from)
        const programTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(programWallet.publicKey);

        // Transfer tokens from the program's account to the user's account
        const transferInstruction = splToken.Token.createTransferInstruction(
            splToken.TOKEN_PROGRAM_ID,
            programTokenAccount.address,  // Program's token account
            userTokenAccount.address,     // User's token account
            programWallet.publicKey,      // Program's wallet as the owner
            [],                           // No multisig signers
            targetTokenAmount * 1e9       // Transfer amount (9 decimals)
        );

        // Add the transfer instruction to a transaction
        const transaction = new web3.Transaction().add(transferInstruction);

        // Create a transfer SOL transaction from the user to the program wallet (optional)
        const solTransferInstruction = web3.SystemProgram.transfer({
            fromPubkey: userWallet,
            toPubkey: programWallet.publicKey,
            lamports: solAmount * web3.LAMPORTS_PER_SOL,
        });
        transaction.add(solTransferInstruction);

        // Serialize the transaction
        const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
        const transactionBase64 = serializedTransaction.toString('base64');

        // Return the transaction to the frontend for the user to sign
        res.json({
            transaction: transactionBase64,
            tokenMintAddress: tokenMint.publicKey.toBase58(),  // Return the token mint address
            targetTokenAmount: targetTokenAmount,              // Return the target token amount to be transferred
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Swap transaction preparation failed' });
    }
});

app.post('/swapothers', async (req, res) => {
    const { userPublicKey,targetTokenAmount , targetTokenMint,devSolMint, priceFeed } = req.body
    
    try {
        const userWallet = new web3.PublicKey(userPublicKey);
    
        // Get the conversion rate from the price feed (e.g., USDC -> DeVSol)
        const tokenPair = `${targetTokenMint}/DeVSol`;
        const conversionRate = priceFeed[tokenPair];  // e.g., 1 USDC = 0.04 DeVSol (example rate)
    
        if (!conversionRate) {
            throw new Error(`Conversion rate for ${tokenPair} not found.`);
        }
    
        // Calculate the amount of DeVSol the user will receive
        const devSolAmount = targetTokenAmount * conversionRate;
    
        // Ensure the user has an associated token account for the target token (e.g., USDC)
        const targetTokenAccount = await splToken.Token.getOrCreateAssociatedAccountInfo(
            connection,
            targetTokenMint,
            userWallet
        );
    
        // Ensure the program has an associated token account for DeVSol
        const devSolTokenAccount = await splToken.Token.getOrCreateAssociatedAccountInfo(
            connection,
            devSolMint,
            programWallet.publicKey
        );
    
        // Transfer the target tokens (e.g., USDC) from the user to the program wallet
        const transferInstruction = splToken.Token.createTransferInstruction(
            splToken.TOKEN_PROGRAM_ID,
            targetTokenAccount.address,      // User's target token account (e.g., USDC)
            programWallet.publicKey,         // Program wallet to receive target tokens
            userWallet,                      // User's wallet
            [],                              // No multisig signers
            targetTokenAmount * 1e6          // Amount to transfer (assuming 6 decimals for USDC)
        );
    
        // Mint DeVSol to the user’s associated token account
        const userDevSolTokenAccount = await splToken.Token.getOrCreateAssociatedAccountInfo(
            connection,
            devSolMint,
            userWallet
        );
    
        const mintToInstruction = splToken.Token.createMintToInstruction(
            splToken.TOKEN_PROGRAM_ID,
            devSolMint,                      // Mint address of DeVSol
            userDevSolTokenAccount.address,   // User's DeVSol token account
            programWallet.publicKey,          // Program wallet (as mint authority)
            [],                               // No multisig signers
            devSolAmount * 1e9                // Amount of DeVSol to mint (assuming 9 decimals)
        );
    
        // Add both instructions (transfer and mint) to a transaction
        const transaction = new web3.Transaction().add(transferInstruction, mintToInstruction);
    
        // Send the transaction
        const signature = await web3.sendAndConfirmTransaction(connection, transaction, [programWallet]);
    
        console.log(`Converted ${targetTokenAmount} ${targetTokenMint} to ${devSolAmount} DeVSol.`);
        

          // Prepare return data
          const result = {
            success: true,
            transactionSignature: signature,
            targetTokenAmount,
            devSolAmount,
            message: `Successfully converted ${targetTokenAmount} tokens to ${devSolAmount} DeVSol.`,
            timestamp: new Date(),

            
        };

        res.json(result);
    
    } catch (err) {
        console.error('Conversion failed:', err);
        throw err;
    }
});








const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    mintAddress: { type: String, required: true }
});

const Token = mongoose.model('Token', tokenSchema);

// Example: Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/solana-dex', { useNewUrlParser: true, useUnifiedTopology: true });
