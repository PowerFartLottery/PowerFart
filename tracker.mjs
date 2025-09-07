// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 1;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch existing winners
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

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
    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    let before = null;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      before = transactions[transactions.length - 1].signature;

      let newWinnerFound = false;

      for (const tx of transactions) {
        if (knownSignatures.has(tx.signature)) continue;

        const tokenTransfers = tx.tokenTransfers || [];
        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
          const toOtherWallet = transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET;
          const amount = Number(transfer.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
            console.log(`🎯 Winner: ${transfer.toUserAccount} (${amount} FART)`);

            updatedWinners.unshift({
              address: transfer.toUserAccount,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: (tx.timestamp || Date.now() / 1000) * 1000
            });

            knownSignatures.add(tx.signature);
            newWinnerFound = true;
          }
        }
      }

      // Stop if no new winners in this batch
      if (!newWinnerFound) keepGoing = false;
    }

    // ✅ Save winners.json (truncate to MAX_WINNERS)
    writeFileSync(WINNERS_PATH, JSON.stringify(updatedWinners.slice(0, MAX_WINNERS), null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${Math.min(updatedWinners.length, MAX_WINNERS)}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
