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

        let txHadNew = false;

        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET; // 👈 only outgoing prize payouts
          const recipient = transfer.toUserAccount || transfer.to;
          const amount = Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS);

          if (!isFart || !isOutgoing || !recipient || amount < MIN_AMOUNT) continue;

          const key = `${tx.signature}_${recipient}`;
          if (!knownTransfers.has(key)) {
            console.log(`➡ Outgoing FART detected: ${recipient} received ${amount.toFixed(2)} FART (tx: ${tx.signature})`);

            updatedWinners.unshift({
              address: recipient,
              amount: parseFloat(amount.toFixed(2)),
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: ((tx.timestamp || Math.floor(Date.now() / 1000)) * 1000)
            });

            knownTransfers.add(key);
            newAdded++;
            txHadNew = true;
          } else {
            console.log(`⏭️ Already had transfer for ${recipient} in tx: ${tx.signature}`);
          }
        }

        if (!txHadNew && tokenTransfers.length > 0) {
          console.log(`ℹ️ No qualifying FART transfer in tx: ${tx.signature}`);
        }
      }

      if (transactions.length < BATCH_LIMIT) keepGoing = false;
    }

    // Deduplicate just in case
    const uniqueWinners = Array.from(
      new Map(updatedWinners.map(w => [`${w.signature}_${w.address}`, w])).values()
    );

    writeFileSync(WINNERS_PATH, JSON.stringify(uniqueWinners.slice(0, MAX_WINNERS), null, 2));

    console.log(`✅ Winners file updated. Added ${newAdded} new winners. Total saved: ${uniqueWinners.length} (fetched ${totalFetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
