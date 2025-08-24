// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version for GitHub Actions)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const MIN_AMOUNT = 10; // minimum FART to consider a winner
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
        before = tx.signature; // paginate

        if (knownSignatures.has(tx.signature)) continue;

        const instructions = tx?.transaction?.message?.instructions || [];

        for (const instr of instructions) {
          if (
            instr.type === 'transferChecked' &&
            instr.info.mint === FARTCOIN_MINT &&
            instr.info.multisigAuthority === DISTRIBUTION_WALLET
          ) {
            const amount = Number(instr.info.tokenAmount.uiAmount);
            if (amount >= MIN_AMOUNT) {
              console.log(`🎯 Winner: ${instr.info.destination} (${amount} FART)`);
              updatedWinners.unshift({
                address: instr.info.destination,
                amount: parseFloat(amount.toFixed(2)),
                signature: tx.signature,
                tx: `https://solscan.io/tx/${tx.signature}`,
                timestamp: tx.timestamp * 1000 || Date.now()
              });
            }
          }
        }
      }

      // stop paginating if no new winners found in this batch
      if (transactions.every(tx => knownSignatures.has(tx.signature))) {
        keepGoing = false;
      }
    }

    // save only last 500 winners to keep file small
    if (updatedWinners.length !== existing.length) {
      writeFileSync(WINNERS_PATH, JSON.stringify(updatedWinners.slice(0, 500), null, 2));
      console.log(`✅ Saved ${updatedWinners.length} total winners (fetched ${fetched} txs).`);
    } else {
      console.log('⏸ No new winners to add.');
    }
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
