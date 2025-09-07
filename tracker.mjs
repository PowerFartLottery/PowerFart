// tracker.mjs
// Robust Fartcoin Winner Tracker (ESM for GitHub Actions)

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const MIN_AMOUNT = 10;       // minimum FART to register
const WINNERS_PATH = './winners.json';
const MAX_WINNERS = 500;

// Fetch paginated transactions from Helius
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
    let fetched = 0;

    while (keepGoing) {
      const transactions = await fetchTransactions(before);
      if (!transactions.length) break;

      console.log(`📦 Fetched ${transactions.length} transactions`);
      fetched += transactions.length;
      before = transactions[transactions.length - 1].signature;

      for (const tx of transactions) {
        const preBalances = tx.preTokenBalances || [];
        const postBalances = tx.postTokenBalances || [];

        // Find all FART accounts of the distribution wallet
        const distroPreAccounts = preBalances.filter(
          b => b.mint === FARTCOIN_MINT && b.owner === DISTRIBUTION_WALLET
        );

        for (const preAcct of distroPreAccounts) {
          // Find matching post balance for same account
          const postAcct = postBalances.find(
            b => b.mint === FARTCOIN_MINT && b.accountIndex === preAcct.accountIndex
          );
          if (!postAcct) continue;

          const preAmount = preAcct.uiTokenAmount?.uiAmount || 0;
          const postAmount = postAcct.uiTokenAmount?.uiAmount || 0;
          const sentAmount = preAmount - postAmount;

          if (sentAmount < MIN_AMOUNT) continue;

          // Find recipient: any postTokenBalance that increased
          const recipientAcct = postBalances.find(
            b => b.mint === FARTCOIN_MINT && b.owner !== DISTRIBUTION_WALLET && b.uiTokenAmount?.uiAmount > 0
          );
          if (!recipientAcct) continue;

          winners.unshift({
            address: recipientAcct.owner,
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: (tx.timestamp || Date.now() / 1000) * 1000
          });

          console.log(`🎯 Winner detected: ${recipientAcct.owner} (>= ${MIN_AMOUNT} FART)`);
        }
      }

      if (transactions.length < 100) keepGoing = false;
    }

    // Keep newest MAX_WINNERS only
    winners = winners.slice(0, MAX_WINNERS);

    // Always overwrite winners.json
    writeFileSync(WINNERS_PATH, JSON.stringify(winners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${winners.length} (fetched ${fetched} txs).`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
