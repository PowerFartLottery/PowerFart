import fetch from 'node-fetch';

const HELIUS_API_URL = 'https://mainnet.helius-rpc.com/';
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE'; // Distribution Wallet

async function testHeliusAPI() {
  const jsonRpcBody = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getConfirmedSignaturesForAddress2",
    "params": [
      DISTRIBUTION_WALLET,   // Distribution Wallet
      { "limit": 5 }          // Fetch the latest 5 transactions
    ]
  };

  try {
    const response = await fetch(HELIUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonRpcBody),
    });

    const data = await response.json();
    if (!data.result || data.result.length === 0) {
      console.log("No transactions found for the distribution wallet.");
    } else {
      console.log("Transactions fetched:", data.result);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

testHeliusAPI();
