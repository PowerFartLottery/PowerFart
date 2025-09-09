// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;       // minimum FART to register
const WINNERS_PATH = './winners.json';
const BATCH_LIMIT = 100;     // Helius max per request
const MAX_WINNERS = 500;     // keep file small

// Fetch existing winners from file
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
    const knownSignatures = new Set(existing.map(w => w.signature));
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

      // Update cursor for next batch
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const tokenTransfers = tx.tokenTransfers || [];
        if (!tokenTransfers.length) continue;

        let txHadNew = false;

        for (const transfer of tokenTransfers) {
          const isFart = transfer.mint === FARTCOIN_MINT;
          const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
          const toOtherWallet = transfer.toUserAccount && transfer.toUserAccount !== DISTRIBUTION_WALLET;
          const amount = Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS);

          if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
            if (!knownSignatures.has(tx.signature)) {
              console.log(`➡ Outgoing FART detected: ${transfer.toUserAccount} received ${amount.toFixed(2)} FART (tx: ${tx.signature})`);

              updatedWinners.unshift({
                address: transfer.toUserAccount,
                amount: parseFloat(amount.toFixed(2)),
                signature: tx.signature,
                tx: `https://solscan.io/tx/${tx.signature}`,
                timestamp: ((tx.timestamp || Math.floor(Date.now() / 1000)) * 1000)
              });

              knownSignatures.add(tx.signature);
              newAdded++;
              txHadNew = true;
            } else {
              console.log(`⏭️ Already had tx: ${tx.signature}`);
            }
          }
        }

        if (!txHadNew && tokenTransfers.length > 0) {
          console.log(`ℹ️ No qualifying FART transfer in tx: ${tx.signature}`);
        }
      }

      // Stop if we got less than a full batch
      if (transactions.length < BATCH_LIMIT) keepGoing = false;
    }

    // Deduplicate by signature
    const uniqueWinners = Array.from(
      new Map(updatedWinners.map(w => [w.signature, w])).values()
    );

    // Keep newest MAX_WINNERS
    writeFileSync(WINNERS_PATH, JSON.stringify(uniqueWinners.slice(0, MAX_WINNERS), null, 2));

    console.log(`✅ Winners file updated. Added ${newAdded} new winners. Total saved: ${uniqueWinners.length} (fetched ${totalFetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
