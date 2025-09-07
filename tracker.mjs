// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// fetch paginated transactions
async function fetchAllTransactions(before = null) {
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
    let fetched = 0;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchAllTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      fetched += transactions.length;

      let newWinnerFound = false;

      for (const tx of transactions) {
        before = tx.signature; // for pagination

        const tokenTransfers = tx.tokenTransfers || [];
        for (const transfer of tokenTransfers) {
          // Only track Fartcoin transfers
          if (transfer.mint !== FARTCOIN_MINT) continue;

          // Record any outgoing transfer from the distribution wallet
          const from = transfer.fromUserAccount || transfer.from;
          const to = transfer.toUserAccount || transfer.to;

          if (!from || !to || from !== DISTRIBUTION_WALLET) continue;

          console.log(`🎯 Winner detected: ${to}`);

          winners.unshift({
            address: to,
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: (tx.timestamp || Date.now() / 1000) * 1000
          });

          newWinnerFound = true;
        }
      }

      if (!newWinnerFound) keepGoing = false;
    }

    // Sort newest first and truncate
    winners = winners.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_WINNERS);

    // Overwrite winners.json every run
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Saved ${winners.length} winners (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
