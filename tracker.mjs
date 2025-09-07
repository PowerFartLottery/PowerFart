// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// fetch existing winners
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    return JSON.parse(readFileSync(WINNERS_PATH, 'utf-8'));
  }
  return [];
}

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
    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    let updatedWinners = [...existing];

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

        if (knownSignatures.has(tx.signature)) continue;

        const tokenTransfers = tx.tokenTransfers || [];
        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing =
            transfer.fromUserAccount === DISTRIBUTION_WALLET ||
            transfer.from === DISTRIBUTION_WALLET; // fallback to 'from'
          const toOtherWallet =
            transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET ||
            transfer.to && transfer.to !== DISTRIBUTION_WALLET; // fallback to 'to'
          const amount = Number(transfer.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
            const winnerAddress = transfer.toUserAccount || transfer.to;

            console.log(`🎯 Winner: ${winnerAddress} (${amount} FART)`);

            updatedWinners.unshift({
              address: winnerAddress,
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

      if (!newWinnerFound) keepGoing = false;
    }

    // Sort newest first, limit file size
    updatedWinners = updatedWinners
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_WINNERS);

    writeFileSync(WINNERS_PATH, JSON.stringify(updatedWinners, null, 2));
    console.log(`✅ Saved ${updatedWinners.length} winners (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
