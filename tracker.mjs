import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_URL = 'https://mainnet.helius-rpc.com/';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE'; // Distribution Wallet
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';  // FartCoin Mint Address
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';

// === RPC Request Setup ===
const jsonRpcBody = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getConfirmedSignaturesForAddress2",
  "params": [
    DISTRIBUTION_WALLET,   // Target Distribution Wallet
    { "limit": 20 }         // Fetch the latest 20 transactions
  ]
};

async function fetchTransactions() {
  const response = await fetch(HELIUS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HELIUS_API_KEY}`
    },
    body: JSON.stringify(jsonRpcBody),
  });

  const data = await response.json();
  return data.result;
}

async function checkTransactions() {
  const transactions = await fetchTransactions();
  if (!transactions || transactions.length === 0) {
    console.log("No transactions fetched.");
    return;
  }

  console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

  const winners = readWinners();

  for (const tx of transactions) {
    // Fetch transaction details (i.e., token transfers)
    const txDetailsResponse = await fetch(`${HELIUS_API_URL}/transactions/${tx.signature}`);
    const txDetails = await txDetailsResponse.json();

    // Log transaction details for debugging
    console.log(`🔍 TX: ${tx.signature}`);
    console.log(txDetails);  // This will show full transaction details

    // Check for token transfers and specifically FartCoin transfers
    const tokenTransfers = txDetails.meta.postTokenBalances;
    if (!tokenTransfers || tokenTransfers.length === 0) {
      console.log('⚠️  No token transfers');
      continue;  // Skip if no token transfers
    }

    for (const transfer of tokenTransfers) {
      // Check if this is a FartCoin transfer and meets the criteria
      if (transfer.mint === FARTCOIN_MINT && parseFloat(transfer.uiAmount) >= MIN_AMOUNT) {
        console.log(`✅ Found FartCoin transfer: ${transfer.uiAmount} FART`);
        if (!winners.includes(tx.signature)) {
          winners.push(tx.signature);
          console.log(`🏆 New winner added: ${tx.signature}`);
        }
      } else {
        console.log(`❌ Not eligible for FartCoin transfer: ${transfer.uiAmount} FART`);
      }
    }
  }

  // Save winners if any new ones were added
  if (winners.length > 0) {
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`📝 Saved winners to ${WINNERS_PATH}`);
  }
}

// Load existing winners (from file)
function readWinners() {
  if (existsSync(WINNERS_PATH)) {
    return JSON.parse(readFileSync(WINNERS_PATH));
  }
  return [];
}

// Run the tracker
checkTransactions().catch((error) => console.error("Error:", error));
