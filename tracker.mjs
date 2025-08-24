// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
if (!HELIUS_API_KEY) {
  console.error('❌ Helius API key is missing! Set HELIUS_API_KEY in secrets.');
  process.exit(1);
}

const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// fetch existing winners from file
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    try {
      return JSON.parse(data);
    } catch {
      console.warn('⚠️ winners.json is corrupted. Resetting...');
      return [];
    }
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
    const updatedWinners = [...existing];

    let before = null;
    let fetched = 0;
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchAllTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} txs`);
      fetched += transactions.length;

      for (const tx of transactions) {
        before = tx.signature;

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

      // stop paginating if no new winners found in this batch
      if (transactions.every(tx => knownSignatures.has(tx.signature))) {
        keepGoing = false;
      }
    }

    // save only last MAX_WINNERS winners to keep file small
    const trimmed = updatedWinners.slice(0, MAX_WINNERS);

    const hasChanges = JSON.stringify(trimmed, null, 2) !== JSON.stringify(existing, null, 2);
    if (hasChanges) {
      writeFileSync(WINNERS_PATH, JSON.stringify(trimmed, null, 2));
      console.log(`✅ Saved ${trimmed.length} total winners (fetched ${fetched} txs).`);
    } else {
      console.log('⏸ No new winners to add.');
    }
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
    process.exit(1); // ensure Actions marks the run as failed if something critical breaks
  }
}

main();
