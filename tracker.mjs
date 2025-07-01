import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_URL = 'https://mainnet.helius-rpc.com/';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';

// === RPC Request Setup ===
const jsonRpcBody = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getConfirmedSignaturesForAddress2",
  "params": [DISTRIBUTION_WALLET, { "limit": 20 }]
};

async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

async function fetchTransactions() {
  try {
    const res = await fetch(HELIUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HELIUS_API_KEY}`,
      },
      body: JSON.stringify(jsonRpcBody),
    });
    
    const data = await res.json();
    
    if (data.result) {
      return data.result;  // Contains the list of transaction signatures
    }
    console.error('Error fetching transactions:', data.error);
    return [];
  } catch (err) {
    console.error('Error in RPC request:', err);
    return [];
  }
}

async function main() {
  try {
    const transactions = await fetchTransactions();

    console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    for (const tx of transactions) {
      console.log(`🔍 TX: ${tx.signature}`);

      if (knownSignatures.has(tx.signature)) {
        console.log(`   ⏭ Already recorded`);
        continue;
      }

      const tokenTransfers = tx.tokenTransfers || [];
      if (!tokenTransfers.length) {
        console.log("   ⚠️  No token transfers");
        continue;
      }

      for (const transfer of tokenTransfers) {
        const isFart = transfer.mint === FARTCOIN_MINT;
        const fromDistributionWallet = transfer.fromUserAccount === DISTRIBUTION_WALLET;  // Ensure it's from distribution wallet
        const toOtherWallet = transfer.toUserAccount !== DISTRIBUTION_WALLET;  // Ensure it's going to another wallet

        // Direct amount without unnecessary division
        const rawAmount = transfer.tokenAmount; // Direct value without dividing
        const amount = Number(rawAmount); // No division needed if it’s already in the correct format

        console.log(`   ➤ Mint: ${transfer.mint}`);
        console.log(`     From: ${transfer.fromUserAccount}`);
        console.log(`     To: ${transfer.toUserAccount}`);
        console.log(`     Raw Amount: ${rawAmount} → ${amount} FART`);
        console.log(`     isFart: ${isFart}`);
        console.log(`     fromDistributionWallet: ${fromDistributionWallet}`);
        console.log(`     toOtherWallet: ${toOtherWallet}`);
        console.log(`     amount >= MIN_AMOUNT: ${amount >= MIN_AMOUNT}`);

        // Only proceed if:
        // 1. Transfer is from the distribution wallet
        // 2. Transfer is to a different wallet (not the distribution wallet)
        // 3. The amount is greater than or equal to MIN_AMOUNT
        if (isFart && fromDistributionWallet && toOtherWallet && amount >= MIN_AMOUNT) {
          console.log(`   ✅ WINNER! ${transfer.toUserAccount} gets ${amount} FART`);
          updatedWinners.unshift({
            address: transfer.toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: Date.now()
          });
        } else {
          console.log("   🚫 Not eligible");
        }
      }
    }

    if (updatedWinners.length !== existing.length) {
      const latest = updatedWinners.slice(0, 100);
      writeFileSync(WINNERS_PATH, JSON.stringify(latest, null, 2));
      console.log(`✅ Saved ${latest.length} total winners.`);
    } else {
      console.log('⏸ No new winners to add.');
    }
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

// Call main function
main();
