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

// Fetch transactions from Helius
async function fetchTransactions(before = null) {
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
    let keepGoing = true;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const preBalances = tx.preTokenBalances || [];
        const postBalances = tx.postTokenBalances || [];

        // Only consider FART token accounts
        const fartAccountsPre = preBalances.filter(b => b.mint === FARTCOIN_MINT);
        const fartAccountsPost = postBalances.filter(b => b.mint === FARTCOIN_MINT);

        // Map post balances by owner for quick lookup
        const postMap = new Map(fartAccountsPost.map(b => [b.owner, Number(b.uiTokenAmount?.uiAmount || 0)]));
        const preMap = new Map(fartAccountsPre.map(b => [b.owner, Number(b.uiTokenAmount?.uiAmount || 0)]));

        for (const [owner, preAmount] of preMap) {
          const postAmount = postMap.get(owner) ?? 0;
          const delta = preAmount - postAmount;

          // Only outgoing from distro wallet and ≥ MIN_AMOUNT
          if (owner === DISTRIBUTION_WALLET && delta >= MIN_AMOUNT) {
            // Find recipient: post account that gained FART
            for (const [toOwner, toPost] of postMap) {
              const toPre = preMap.get(toOwner) ?? 0;
              const received = toPost - toPre;
              if (received >= MIN_AMOUNT && toOwner !== DISTRIBUTION_WALLET) {
                console.log(`➡ Outgoing FART detected: ${toOwner} received ${received.toFixed(2)} FART (tx: ${tx.signature})`);
                winners.unshift({
                  address: toOwner,
                  signature: tx.signature,
                  tx: `https://solscan.io/tx/${tx.signature}`,
                  timestamp: (tx.timestamp || Date.now() / 1000) * 1000
                });
              }
            }
          }
        }
      }

      // Stop paginating if less than 100 txs fetched
      if (transactions.length < 100) keepGoing = false;
    }

    // Sort newest first and truncate
    winners = winners.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_WINNERS);

    // Overwrite winners.json every run
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
