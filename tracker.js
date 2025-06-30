// tracker.js
// Automated Fartcoin Winner Tracker (local + GitHub update)

const fetch = require('node-fetch');
const fs = require('fs');

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const HELIUS_URL = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;

const WINNERS_PATH = './winners.json';

async function fetchExistingWinners() {
  if (fs.existsSync(WINNERS_PATH)) {
    const data = fs.readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
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
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: Date.now()
          });
        }
      }
    }

    if (updatedWinners.length > existing.length) {
      const top100 = updatedWinners.slice(0, 100);
      fs.writeFileSync(WINNERS_PATH, JSON.stringify(top100, null, 2));
      console.log(`✅ Updated winners.json with ${top100.length} entries.`);
    } else {
      console.log('⏸ No new winners found.');
    }

  } catch (err) {
    console.error('❌ Error during fetch or write:', err);
  }
}

main();
