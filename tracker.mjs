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
const BATCH_LIMIT = 100;
const MAX_WINNERS = 500;

// Addresses to ignore (swap/program accounts)
const IGNORED_ADDRESSES = new Set([
  DISTRIBUTION_WALLET,
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  '6LXutJvKUw8Q5ue2gCgKHQdAN4suWW8awzFVC6XCguFx',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  'TessVdML9pBGgG9yGks7o4HewRaXVAMuoVj4x83GLQH',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
]);

// Check if tx timestamp is in the first 2 minutes of the hour
function isWithinFirst2Minutes(ts) {
  if (!ts) return false;
  const d = new Date(ts * 1000);
  return d.getUTCMinutes() < 2;
}

// Load existing winners
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

// Fetch a batch of transactions from Helius
async function fetchTransactions(before = null) {
  let url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=${BATCH_LIMIT}`;
  if (before) url += `&before=${before}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
  return res.json();
}

async function main() {
  try {
    const existing = await fetchExistingWinners();
    const knownTransfers = new Set(existing.map(w => `${w.signature}_${w.address}`));
    const updatedWinners = [...existing];

    let before = null;
    let keepGoing = true;
    let totalFetched = 0;
    let newAdded = 0;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      totalFetched += transactions.length;

      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        if (!isWithinFirst2Minutes(tx.timestamp)) {
          const when = tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'n/a';
          console.log(`⏩ Skipping tx outside prize window (UTC ${when}): ${tx.signature}`);
          continue;
        }

        const tokenTransfers = tx.tokenTransfers || [];
        if (!tokenTransfers.length) continue;

        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          // ✅ Check both fields for sender
          const isOutgoing = (transfer.fromUserAccount === DISTRIBUTION_WALLET || transfer.from === DISTRIBUTION_WALLET);
          const recipient = transfer.toUserAccount || transfer.to;
          const amount = transfer.tokenAmount?.amount
            ? Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS)
            : 0;

          if (!isFart || !isOutgoing || !recipient || IGNORED_ADDRESSES.has(recipient) || amount < MIN_AMOUNT) continue;

          const key = `${tx.signature}_${recipient}`;
          if (!knownTransfers.has(key)) {
            console.log(`➡ Winner detected: ${recipient} received ${amount.toFixed(2)} FART (tx: ${tx.signature})`);

            updatedWinners.push({
              address: recipient,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: ((tx.timestamp || Math.floor(Date.now() / 1000)) * 1000)
            });

            knownTransfers.add(key);
            newAdded++;
          }
        }
      }

      if (transactions.length < BATCH_LIMIT) keepGoing = false;
    }

    // CLEANUP: deduplicate by address, keep newest, sort newest-first
    const seenAddresses = new Set();
    const cleanedWinners = [];

    for (const w of updatedWinners) {
      if (IGNORED_ADDRESSES.has(w.address)) continue; // skip distro/program wallets
      if (!seenAddresses.has(w.address)) {
        cleanedWinners.push(w);
        seenAddresses.add(w.address);
      }
    }

    // Sort by timestamp descending (newest first)
    cleanedWinners.sort((a, b) => b.timestamp - a.timestamp);

    // Write top MAX_WINNERS
    writeFileSync(WINNERS_PATH, JSON.stringify(cleanedWinners.slice(0, MAX_WINNERS), null, 2));

    console.log(`✅ Winners file updated. Added ${newAdded} new winners. Total saved: ${cleanedWinners.length} (fetched ${totalFetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
