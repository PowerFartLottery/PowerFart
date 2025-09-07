// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 0; // set 0 to match old behavior
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch existing winners from file
function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

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
    const existing = fetchExistingWinners();
    let winners = [...existing];
    let before = null;
    let fetched = 0;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      fetched += transactions.length;
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const tokenTransfers = tx.tokenTransfers || [];

        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
          const toOtherWallet = transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET;
          const amount = Number(transfer.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          // Only filter by MIN_AMOUNT if set > 0
          if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
            console.log(`➡ Outgoing FART detected: ${transfer.toUserAccount} received ${amount.toFixed(2)} FART (tx: ${tx.signature})`);

            winners.unshift({
              address: transfer.toUserAccount,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: (tx.timestamp || Date.now() / 1000) * 1000
            });
          }
        }
      }

      if (transactions.length < 100) keepGoing = false;
    }

    // Keep newest MAX_WINNERS and always overwrite
    winners = winners.slice(0, MAX_WINNERS);
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length} (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
