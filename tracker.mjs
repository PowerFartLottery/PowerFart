const fetch = require('node-fetch');

const walletAddress = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE'; // Distribution wallet address
const fartCoinMintAddress = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'; // FartCoin mint address
const minAmountInLamports = 10 * Math.pow(10, 6); // 10 FartCoin = 10,000,000 lamports

// Solana API endpoint
const SOLANA_API_URL = 'https://api.mainnet-beta.solana.com';

// Function to fetch transactions for a wallet
async function getTransactions(walletAddress) {
  try {
    const response = await fetch(SOLANA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [walletAddress, { limit: 1000 }], // Fetching the last 1000 transactions
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Error fetching transactions:', data.error);
      return [];
    }

    return data.result || [];
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Function to fetch transaction details
async function getTransactionDetails(signature) {
  try {
    const response = await fetch(SOLANA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'json' }],
      }),
    });

    const data = await response.json();
    return data.result || {};
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return {};
  }
}

// Function to filter transactions and get outgoing FartCoin transfers greater than 10
async function trackFartCoinTransactions() {
  const transactions = await getTransactions(walletAddress);

  const filteredTransactions = [];

  for (const tx of transactions) {
    const txDetails = await getTransactionDetails(tx.signature);
    
    if (txDetails.meta && txDetails.meta.preTokenBalances) {
      for (const balance of txDetails.meta.preTokenBalances) {
        // Check if the transaction involves FartCoin mint address
        if (balance.mint === fartCoinMintAddress && balance.uiAmount && balance.uiAmount > 10) {
          // Check if the transaction is an outgoing transaction
          const postBalances = txDetails.meta.postTokenBalances;
          const outgoingTransaction = postBalances.some(postBalance => 
            postBalance.mint === fartCoinMintAddress && postBalance.uiAmount < balance.uiAmount
          );

          if (outgoingTransaction) {
            filteredTransactions.push({
              signature: tx.signature,
              blockTime: tx.blockTime,
              amount: balance.uiAmount,
            });
          }
        }
      }
    }
  }

  console.log('Filtered Outgoing FartCoin Transactions (Greater than 10 FartCoin):');
  console.table(filteredTransactions);
}

// Start tracking FartCoin transactions
trackFartCoinTransactions();
