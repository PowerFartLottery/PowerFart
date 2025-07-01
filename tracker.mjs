import fetch from 'node-fetch';

// Solana RPC URL
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

// Wallet address (use the one you shared)
const walletAddress = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE";

// Function to fetch transaction signatures (all past transactions)
async function fetchTransactionSignatures(walletAddress, limit = 1000) {
  try {
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getConfirmedSignaturesForAddress2',
        params: [walletAddress, { limit }],
      }),
    });

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error fetching transaction signatures:', error);
    return [];
  }
}

// Function to fetch detailed transaction info for each signature
async function fetchTransactionDetails(signature) {
  try {
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getConfirmedTransaction',
        params: [signature],
      }),
    });

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error fetching transaction details for signature', signature, error);
    return null;
  }
}

// Function to get all past transactions (signatures + detailed info)
async function getAllPastTransactions(walletAddress) {
  console.log(`Fetching transaction signatures for wallet: ${walletAddress}`);
  
  // Fetch transaction signatures (up to the limit)
  const signatures = await fetchTransactionSignatures(walletAddress);

  if (signatures.length === 0) {
    console.log('No transactions found for this wallet.');
    return;
  }

  console.log(`Found ${signatures.length} transactions. Fetching details...`);

  // Fetch details for each transaction signature
  for (const signatureInfo of signatures) {
    const signature = signatureInfo.signature;
    const transactionDetails = await fetchTransactionDetails(signature);
    
    if (transactionDetails) {
      console.log(`Transaction ${signature}:`, transactionDetails);
    }
  }
}

// Run the script to fetch all past transactions for the wallet
getAllPastTransactions(walletAddress);
