// tracker.mjs
// Simple Fartcoin Winner Tracker (ESM for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch paginated transactions from Helius
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

      console.log(`📦 Fetched ${transactions.length} txs`);
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const transfers = tx.tokenTransfers || [];
        for (const t of transfers) {
          const isFart = t.mint === FARTCOIN_MINT;
          const isOutgoing = t.fromUserAccount === DISTRIBUTION_WALLET;
          const recipient = t.toUserAccount;
          const amount = Number(t.tokenAmount?.amount || 0) / Math.pow(10, 6);

          if (isFart && isOutgoing && recipient && recipient !== DISTRIBUTION_WALLET && amount >= MIN_AMOUNT) {
            winners.unshift({
              address: recipient,
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: (tx.timestamp || Date.now() / 1000) * 1000
            });
            console.log(`🎯 Winner: ${recipient} (tx: ${tx.signature})`);
          }
        }
      }

      if (transactions.length < 100) keepGoing = false;
    }

    // Keep newest MAX_WINNERS only
    winners = winners.slice(0, MAX_WINNERS);

    // Always overwrite winners.json
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
