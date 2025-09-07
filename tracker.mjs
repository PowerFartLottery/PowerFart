// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;       // Fartcoin has 6 decimals
const MIN_AMOUNT = 10;    // minimum FART to be considered a winner
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch paginated transactions
async function fetchTransactions(before = null) {
  let url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
  if (before) url += `&before=${before}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
  return res.json();
}

async function main() {
  try {
    let winners = [];
    let before = null;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const tokenTransfers = tx.tokenTransfers || [];

        for (const transfer of tokenTransfers) {
          // Only Fartcoin transfers
          if (transfer.mint !== FARTCOIN_MINT) continue;

          const from = transfer.fromUserAccount || transfer.from;
          const to = transfer.toUserAccount || transfer.to;

          if (!from || from !== DISTRIBUTION_WALLET || !to) continue;

          // Compute amount in FART
          const amount = Number(transfer.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          // Only include transfers ≥ MIN_AMOUNT
          if (amount < MIN_AMOUNT) continue;

          console.log(`🎯 Winner detected: ${to} (${amount} FART)`);

          winners.unshift({
            address: to,
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: (tx.timestamp || Date.now() / 1000) * 1000
          });
        }
      }

      // Stop if fetched less than 100 txs (no more pages)
      if (transactions.length < 100) keepGoing = false;
    }

    // Sort newest first and truncate
    winners = winners.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_WINNERS);

    // Overwrite winners.json every run
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
