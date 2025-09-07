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

// fetch existing winners from file
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

// fetch paginated txs
async function fetchAllTransactions(before = null) {
  let url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
  if (before) url += `&before=${before}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius error: ${res.status}`);
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

      console.log(`📦 Fetched ${transactions.length} txs`);
      fetched += transactions.length;

      for (const tx of transactions) {
        before = tx.signature; // paginate

        if (knownSignatures.has(tx.signature)) continue;

        const tokenTransfers = tx.tokenTransfers || [];
        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
          const toOtherWallet = transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET;
          const amount = Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
            console.log(`🎯 Winner: ${transfer.toUserAccount} (${amount} FART)`);
            updatedWinners.unshift({
              address: transfer.toUserAccount,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: tx.timestamp * 1000 || Date.now()
            });
          }
        }
      }

      // stop paginating if we hit only known signatures
      if (transactions.every(tx => knownSignatures.has(tx.signature))) {
        keepGoing = false;
      }
    }

    // Always save, even if no new winners were found
    updatedWinners = updatedWinners
      .sort((a, b) => b.timestamp - a.timestamp) // newest first
      .slice(0, 500); // keep file size manageable

    writeFileSync(WINNERS_PATH, JSON.stringify(updatedWinners, null, 2));
    console.log(`✅ Saved ${updatedWinners.length} winners (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
