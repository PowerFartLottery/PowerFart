// tracker_debug.mjs
// Fartcoin Winner Tracker Debug: logs all outgoing FART transfers

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch transactions with optional pagination
async function fetchTransactions(before = null) {
  let url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
  if (before) url += `&before=${before}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
  return res.json();
}

async function main() {
  try {
    const winners = [];
    const knownSignatures = new Set();

    let before = null;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);

      for (const tx of transactions) {
        if (knownSignatures.has(tx.signature)) continue;
        knownSignatures.add(tx.signature);

        const transfers = tx.tokenTransfers || [];
        for (const t of transfers) {
          const isFart = t.mint === FARTCOIN_MINT;
          const isOutgoing = t.fromUserAccount === DISTRIBUTION_WALLET;
          const recipient = t.toUserAccount;
          const amount = Number(t.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && recipient && recipient !== DISTRIBUTION_WALLET) {
            // Log all outgoing transfers regardless of amount
            console.log(`➡ Outgoing FART detected: ${recipient} received ${amount} FART (tx: ${tx.signature})`);

            // Only save winners >=10 FART
            if (amount >= 10) {
              winners.unshift({
                address: recipient,
                signature: tx.signature,
                tx: `https://solscan.io/tx/${tx.signature}`,
                timestamp: (tx.timestamp || Date.now() / 1000) * 1000
              });
            }
          }
        }
      }

      // Prepare for next page
      before = transactions[transactions.length - 1].signature;
      if (transactions.length < 100) keepGoing = false; // reached the last page
    }

    // Save winners.json
    writeFileSync(WINNERS_PATH, JSON.stringify(winners.slice(0, MAX_WINNERS), null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
