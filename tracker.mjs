import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';

const HELIUS_URL = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;

async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

async function main() {
  try {
    const res = await fetch(HELIUS_URL);
    const data = await res.json();

    const transactions = data || [];
    console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

    const existing = await fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    // Process each transaction
    for (const tx of transactions) {
      console.log(`🔍 TX: ${tx.signature}`);
      if (knownSignatures.has(tx.signature)) {
        console.log(`   ⏭ Already recorded`);
        continue;
      }

      const tokenTransfers = tx.tokenTransfers || [];
      if (!tokenTransfers.length) {
        console.log("   ⚠️  No token transfers");
        continue;
      }

      // Process each token transfer in the transaction
      for (const transfer of tokenTransfers) {
        const isFart = transfer.mint === FARTCOIN_MINT;
        const fromDistributionWallet = transfer.fromUserAccount === DISTRIBUTION_WALLET;
        const toOtherWallet = transfer.toUserAccount !== DISTRIBUTION_WALLET;

        // Direct amount without unnecessary division
        const rawAmount = transfer.tokenAmount;
        const amount = Number(rawAmount);

        // Debug log for each transaction
        console.log(`   ➤ Mint: ${transfer.mint}`);
        console.log(`     From: ${transfer.fromUserAccount}`);
        console.log(`     To: ${transfer.toUserAccount}`);
        console.log(`     Raw Amount: ${rawAmount} → ${amount} FART`);

        // Only process if:
        // 1. Transfer is from the distribution wallet
        // 2. Transfer is to a different wallet (not the distribution wallet)
        // 3. The amount is greater than or equal to MIN_AMOUNT
        if (isFart && fromDistributionWallet && toOtherWallet && amount >= MIN_AMOUNT) {
          console.log(`   ✅ WINNER! ${transfer.toUserAccount} gets ${amount} FART`);
          updatedWinners.unshift({
            address: transfer.toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: Date.now()
          });
        } else {
          console.log("   🚫 Not eligible");
        }
      }
    }

    // Save the updated winners list if there are any new winners
    if (updatedWinners.length !== existing.length) {
      const latest = updatedWinners.slice(0, 100);
      writeFileSync(WINNERS_PATH, JSON.stringify(latest, null, 2));  // Fixed the parentheses here
      console.log(`✅ Saved ${latest.length} total winners.`);
    } else {
      console.log('⏸ No new winners to add.');
    }

  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

// Call main function
main();
