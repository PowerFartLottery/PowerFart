import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const MIN_AMOUNT = 10;
const WINNERS_PATH = './winners.json';
const TX_FETCH_LIMIT = 20;

// === Fetch existing winners ===
function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, 'utf-8');
    return JSON.parse(data);
  }
  return [];
}

// === Fetch enhanced transactions from Helius ===
async function fetchTransactions(beforeSignature = null) {
  const baseUrl = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions`;
  const url = new URL(baseUrl);
  url.searchParams.append('api-key', HELIUS_API_KEY);
  url.searchParams.append('limit', TX_FETCH_LIMIT);
  if (beforeSignature) url.searchParams.append('before', beforeSignature);

  try {
    const res = await fetch(url.toString());
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
    const existing = fetchExistingWinners();
    const knownSignatures = new Set(existing.map(w => w.signature));
    const updatedWinners = [...existing];

    let transactions = await fetchTransactions();
    console.log(`📦 Fetched ${transactions.length} transactions from Helius`);

    for (const tx of transactions) {
      const { signature } = tx;
      if (knownSignatures.has(signature)) {
        console.log(`⏭ Already recorded: ${signature}`);
        continue;
      }

      const transfers = (tx.tokenTransfers || []).filter(t =>
        t.mint === FARTCOIN_MINT &&
        t.fromUserAccount === DISTRIBUTION_WALLET &&
        t.toUserAccount !== DISTRIBUTION_WALLET
      );

      if (transfers.length === 0) {
        console.log(`🔍 TX: ${signature} → ❌ No valid outgoing FART transfers`);
        continue;
      }

      for (const transfer of transfers) {
        const amount = Number(transfer.tokenAmount);

        if (amount >= MIN_AMOUNT) {
          console.log(`🎉 WINNER → ${transfer.toUserAccount} gets ${amount} FART`);
          updatedWinners.unshift({
            address: transfer.toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature,
            tx: `https://solscan.io/tx/${signature}`,
            timestamp: Date.now()
          });
        } else {
          console.log(`🚫 Sent amount (${amount}) is below threshold`);
        }
      }
    }

    if (updatedWinners.length !== existing.length) {
      const latest = updatedWinners.slice(0, 100);
      writeFileSync(WINNERS_PATH, JSON.stringify(latest, null, 2));
      console.log(`✅ Saved ${latest.length} winners to file.`);
    } else {
      console.log('⏸ No new winners added.');
    }
  } catch (err) {
    console.error('❌ Error in winner tracker:', err);
  }
}

main();
