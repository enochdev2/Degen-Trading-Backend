import Token from "../models/tokenSchema";

const { publicKey } = useWallet();
const { getUserSOLBalance } = useUserSOLBalanceStore();

// SOLANA_NETWORK can be 'devnet', 'testnet', or 'mainnet-beta'
const SOLANA_NETWORK = "devnet";


//! Function to create token if it doesn't exist in the array
export const createTokenIfNotExists = async (tokenName, mintAuthority) => {
  // Check if the token has already been minted
  // const existingToken = mintedTokens.find(token => token.name === tokenName);

  // Check if the token exists in the database
  const existingToken = await Token.findOne({ tokenName });

  if (existingToken) {
    console.log(
      `${tokenName} already exists with mint address: ${existingToken.mintAddress}`
    );
    return new web3.PublicKey(existingToken.mintAddress);
  }

  if (existingToken) {
    console.log(
      `${tokenName} already exists with mint address: ${existingToken.mintAddress}`
    );
    return existingToken.mintAddress; // Return the existing token's mint address
  }

  // Mint a new token if it doesn't exist
  const tokenMint = await splToken.Token.createMint(
    connection,
    programWallet, // Program wallet or admin wallet
    mintAuthority.publicKey, // Mint authority
    null, // Freeze authority
    9, // Decimals
    splToken.TOKEN_PROGRAM_ID
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
}

///////////////////////////////////////////////////////////////////////////////////////////////////////
//?         AIRDROP FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////////////////////

const onClick = useCallback(async () => {
  if (!publicKey) {
    console.log("error", "Wallet not connected!");
    notify({
      type: "error",
      message: "error",
      description: "Wallet not connected!",
    });
    return;
  }

  let signature = "";

  try {
    signature = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);

    // Get the lates block hash to use on our transaction and confirmation
    let latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    notify({
      type: "success",
      message: "Airdrop successful!",
      txid: signature,
    });

    getUserSOLBalance(publicKey, connection);
  } catch (error) {
    notify({
      type: "error",
      message: `Airdrop failed!`,
      description: error?.message,
      txid: signature,
    });
    console.log("error", `Airdrop failed! ${error?.message}`, signature);
  }
}, [publicKey, connection, getUserSOLBalance]);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//?                  MINT TOKEN FUNCTION
////________________________________________________________________________________________________________________

// Function to mint token
const mintToken = async (walletAddress) => {
  try {
    const connection = new Connection(
      clusterApiUrl(SOLANA_NETWORK),
      "confirmed"
    );

    // Create a Keypair (you can replace this with your already created Keypair for the mint)
    const mintAuthority = Keypair.generate();

    // Create new token mint
    const mint = await createMint(
      connection,
      mintAuthority, // The mint authority keypair (private key needed to mint new tokens)
      mintAuthority.publicKey, // The public key who will have minting authority
      null, // Freeze authority (optional)
      9 // Decimal places
    );

    console.log("Token Mint Address: ", mint.toBase58());

    // Create or get the token account associated with the user's wallet address
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mint, // Mint address of the token
      new PublicKey(walletAddress) // The user's wallet address (to mint tokens to)
    );

    console.log("User Token Account: ", userTokenAccount.address.toBase58());

    //! Mint 100 tokens to the user's wallet (userTokenAccount)
    const mintTxSignature = await mintTo(
      connection,
      mintAuthority,
      mint,
      userTokenAccount.address, // Token account to mint to
      mintAuthority, // Mint authority to authorize the minting
      100 * Math.pow(10, 9) // Amount of tokens to mint (in smallest unit, adjusted for decimals)
    );

    console.log("Mint transaction signature: ", mintTxSignature);
  } catch (error) {
    console.error("Error minting token: ", error);
  } finally {
  }
};
