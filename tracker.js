// tracker.js
// Automated Fartcoin Winner Tracker

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import { Octokit } from '@octokit/rest';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID; // ID of the winners.json Gist
const GIST_FILENAME = 'winners.json';

const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10; // Minimum FART to qualify as a winner
const HELIUS_URL = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function fetchExistingWinners() {
  const gist = await octokit.gists.get({ gist_id: GIST_ID });
  const content = gist.data.files[GIST_FILENAME].content;
  return JSON.parse(content);
}

async function updateWinners(newWinners) {
  const content = JSON.stringify(newWinners, null, 2);
  await octokit.gists.update({
    gist_id: GIST_ID,
    files: {
      [GIST_FILENAME]: { content },
    },
  });
  console.log(`✅ Gist updated with ${newWinners.length} winners.`);
}

async function main() {
  try {
    const res = await fetch(HELIUS_URL);
    const data = await res.json();

    const transactions = data || [];
    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    for (const tx of transactions) {
      if (knownSignatures.has(tx.signature)) continue;

      const tokenTransfers = tx.tokenTransfers || [];
      for (const transfer of tokenTransfers) {
        const isFart = transfer.mint === FARTCOIN_MINT;
        const toOtherWallet = transfer.toUserAccount !== DISTRIBUTION_WALLET;
        const amount = Number(transfer.tokenAmount.amount) / Math.pow(10, DECIMALS);

        if (isFart && toOtherWallet && amount >= MIN_AMOUNT) {
          updatedWinners.unshift({
            address: transfer.toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature: tx.signature,
            timestamp: Date.now(),
          });
        }
      }
    }

    if (updatedWinners.length !== existing.length) {
      await updateWinners(updatedWinners.slice(0, 100)); // keep top 100
    } else {
      console.log('⏸ No new winners.');
    }
  } catch (err) {
    console.error('❌ Error fetching transactions or updating winners:', err);
  }
}

main();
