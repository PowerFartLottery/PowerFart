// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 1;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;
const FETCH_ALL_HISTORY = true; // set true to ignore MIN_AMOUNT if desired

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
          const isFart = transfer.mint === FARTCOIN_MINT;

          // === Safe FART amount calculation ===
          let amount = 0;
          if (transfer.tokenAmount?.amount) {
            amount = Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS);
          } else if (tx.postTokenBalances) {
            const balanceChange = tx.postTokenBalances.find(
              b => b.mint === FARTCOIN_MINT && b.owner === transfer.toUserAccount
            );
            if (balanceChange?.uiTokenAmount?.uiAmount) {
              amount = balanceChange.uiTokenAmount.uiAmount;
            }
          } else if (tx.preTokenBalances && tx.postTokenBalances) {
            const pre = tx.preTokenBalances.find(b => b.mint === FARTCOIN_MINT && b.owner === transfer.toUserAccount);
            const post = tx.postTokenBalances.find(b => b.mint === FARTCOIN_MINT && b.owner === transfer.toUserAccount);
            const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
            const postAmount = post?.uiTokenAmount?.uiAmount || 0;
            amount = postAmount - preAmount;
          }

          amount = parseFloat(amount.toFixed(2));

          const winnerAddress = transfer.toUserAccount || transfer.to;
          if (!winnerAddress) continue;

          console.log(`Checking transfer: to=${winnerAddress}, amount=${amount}`);

          if (isFart && (amount >= MIN_AMOUNT || FETCH_ALL_HISTORY)) {
            console.log(`🎯 Winner detected: ${winnerAddress} (${amount} FART)`);

            winners.unshift({
              address: winnerAddress,
              amount,
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

    // Sort newest first, limit to MAX_WINNERS
    winners = winners.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_WINNERS);

    // Overwrite winners.json every run
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Saved ${winners.length} winners (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
