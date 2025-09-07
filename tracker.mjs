// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
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
        before = tx.signature; // paginate

        const tokenTransfers = tx.tokenTransfers || [];
        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const amount = Number(transfer.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

          // ✅ Any transfer with correct mint and enough amount counts as winner
          if (isFart && amount >= MIN_AMOUNT && transfer.to) {
            const winnerAddress = transfer.toUserAccount || transfer.to;

            console.log(`🎯 Winner: ${winnerAddress} (${amount} FART)`);

            winners.unshift({
              address: winnerAddress,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: (tx.timestamp || Date.now() / 1000) * 1000
            });

            newWinnerFound = true;
          }
        }
      }

      if (!newWinnerFound) keepGoing = false;
    }

    // Sort newest first and limit file size
    winners = winners
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_WINNERS);

    // Overwrite winners.json every run
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Saved ${winners.length} winners (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
