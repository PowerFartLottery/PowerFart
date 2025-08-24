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

// First run fetches all history
const FETCH_ALL_HISTORY = !existsSync(WINNERS_PATH);

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

// fetch paginated transactions
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

      console.log(`📦 Fetched ${transactions.length} transactions`);
      fetched += transactions.length;

      for (const tx of transactions) {
        before = tx.signature; // paginate

        if (!FETCH_ALL_HISTORY && knownSignatures.has(tx.signature)) continue;

        // === ENHANCED TRANSFER EXTRACTION ===
        const tokenTransfers = [];

        // old-style tokenTransfers
        if (Array.isArray(tx.tokenTransfers)) {
          tokenTransfers.push(...tx.tokenTransfers);
        }

        // Helius SPL transfer events
        if (Array.isArray(tx.events?.splTransfers)) {
          tx.events.splTransfers.forEach(ev => {
            if (ev.mint === FARTCOIN_MINT) {
              tokenTransfers.push({
                mint: ev.mint,
                fromUserAccount: ev.from,
                toUserAccount: ev.to,
                tokenAmount: { amount: ev.amount.toString() }
              });
            }
          });
        }

        // === PROCESS TRANSFERS ===
        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
          const toOtherWallet = transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET;

          const rawAmount = transfer.tokenAmount?.amount;
          if (!rawAmount) continue; // skip if amount missing
          const amount = Number(rawAmount) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && toOtherWallet && (amount >= MIN_AMOUNT || FETCH_ALL_HISTORY)) {
            console.log(`🎯 Winner: ${transfer.toUserAccount} (${amount.toFixed(2)} FART)`);
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

      // stop paginating if no new transactions
      if (!FETCH_ALL_HISTORY && transactions.every(tx => knownSignatures.has(tx.signature))) {
        keepGoing = false;
      }

      // For first run, continue fetching until transactions.length === 0
      if (FETCH_ALL_HISTORY && transactions.length === 0) {
        keepGoing = false;
      }
    }

    // trim to last MAX_WINNERS
    const trimmed = updatedWinners.slice(0, MAX_WINNERS);

    const hasChanges = JSON.stringify(trimmed, null, 2) !== JSON.stringify(existing, null, 2);
    if (hasChanges) {
      writeFileSync(WINNERS_PATH, JSON.stringify(trimmed, null, 2));
      console.log(`✅ Saved ${trimmed.length} winners (fetched ${fetched} txs).`);
    } else {
      console.log('⏸ No new winners to add.');
    }

  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
    process.exit(1);
  }
}

main();
