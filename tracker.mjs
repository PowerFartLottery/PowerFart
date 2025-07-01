import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';

// === Fetch existing winners ===
function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

// === Fetch enhanced transactions from Helius ===
async function fetchTransactions() {
  const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!Array.isArray(data)) {
      console.error('Invalid response from Helius API:', data);
      return [];
    }

    return data;
  } catch (err) {
    console.error('Error fetching enhanced transactions:', err);
    return [];
  }
}

// === Main logic ===
async function main() {
  try {
    const transactions = await fetchTransactions();
    console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

    const existing = fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    for (const tx of transactions) {
      const { signature } = tx;
      console.log(`🔍 TX: ${signature}`);

      if (knownSignatures.has(signature)) {
        console.log(`   ⏭ Already recorded`);
        continue;
      }

      const transfers = tx.tokenTransfers?.filter(t => t.mint === FARTCOIN_MINT) || [];

      if (!transfers.length) {
        console.log("   ⚠️  No FART token transfers");
        continue;
      }

      for (const transfer of transfers) {
        const {
          fromUserAccount,
          toUserAccount,
          tokenAmount
        } = transfer;

        const isFart = transfer.mint === FARTCOIN_MINT;
        const fromDistributionWallet = fromUserAccount === DISTRIBUTION_WALLET;
        const toOtherWallet = toUserAccount !== DISTRIBUTION_WALLET;
        const amount = Number(tokenAmount);

        console.log(`   ➤ From: ${fromUserAccount}`);
        console.log(`     To: ${toUserAccount}`);
        console.log(`     Amount: ${amount} FART`);
        console.log(`     isFart: ${isFart}`);
        console.log(`     fromDistributionWallet: ${fromDistributionWallet}`);
        console.log(`     toOtherWallet: ${toOtherWallet}`);
        console.log(`     amount >= MIN_AMOUNT: ${amount >= MIN_AMOUNT}`);

        if (isFart && fromDistributionWallet && toOtherWallet && amount >= MIN_AMOUNT) {
          console.log(`   ✅ WINNER! ${toUserAccount} gets ${amount} FART`);

          updatedWinners.unshift({
            address: toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature,
            tx: `https://solscan.io/tx/${signature}`,
            timestamp: Date.now()
          });
        } else {
          console.log("   🚫 Not eligible");
        }
      }
    }

    if (updatedWinners.length !== existing.length) {
      const latest = updatedWinners.slice(0, 100);
      writeFileSync(WINNERS_PATH, JSON.stringify(latest, null, 2));
      console.log(`✅ Saved ${latest.length} total winners.`);
    } else {
      console.log('⏸ No new winners to add.');
    }
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

// Start the tracker
main();
