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
const MAX_WINNERS = 500;

// Fetch existing winners
async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

// Fetch transactions from Helius
async function fetchTransactions() {
  const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
  return res.json();
}

async function main() {
  try {
    const transactions = await fetchTransactions();
    console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    for (const tx of transactions) {
      if (knownSignatures.has(tx.signature)) continue;

      let winnerDetected = false;

      // First try tokenTransfers if present
      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        const isFart = t.mint === FARTCOIN_MINT;
        const isOutgoing = t.fromUserAccount === DISTRIBUTION_WALLET;
        const recipient = t.toUserAccount;
        const amount = Number(t.tokenAmount?.amount || 0) / Math.pow(10, DECIMALS);

        if (isFart && isOutgoing && recipient && recipient !== DISTRIBUTION_WALLET && amount >= MIN_AMOUNT) {
          updatedWinners.unshift({
            address: recipient,
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: (tx.timestamp || Date.now() / 1000) * 1000
          });
          console.log(`🎯 Winner detected (tokenTransfers): ${recipient} (tx: ${tx.signature})`);
          winnerDetected = true;
        }
      }

      // Fallback: pre/post balance diff
      if (!winnerDetected && tx.preTokenBalances && tx.postTokenBalances) {
        const distroPre = tx.preTokenBalances.find(b => b.owner === DISTRIBUTION_WALLET && b.mint === FARTCOIN_MINT);
        const distroPost = tx.postTokenBalances.find(b => b.owner === DISTRIBUTION_WALLET && b.mint === FARTCOIN_MINT);
        const sentAmount = (distroPre?.uiTokenAmount?.uiAmount || 0) - (distroPost?.uiTokenAmount?.uiAmount || 0);

        if (sentAmount >= MIN_AMOUNT) {
          // Find recipient(s)
          const recipientPost = tx.postTokenBalances.find(
            b => b.mint === FARTCOIN_MINT && b.owner !== DISTRIBUTION_WALLET
          );
          if (recipientPost) {
            updatedWinners.unshift({
              address: recipientPost.owner,
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: (tx.timestamp || Date.now() / 1000) * 1000
            });
            console.log(`🎯 Winner detected (balance diff): ${recipientPost.owner} (tx: ${tx.signature})`);
          }
        }
      }
    }

    // Save last MAX_WINNERS only
    const finalWinners = updatedWinners.slice(0, MAX_WINNERS);
    writeFileSync(WINNERS_PATH, JSON.stringify(finalWinners, null, 2));
    console.log(`✅ Winners file updated. Total winners saved: ${finalWinners.length}`);
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
