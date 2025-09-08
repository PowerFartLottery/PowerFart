// tracker.mjs
// Automated Fartcoin Winner Tracker with Deduplication

import fetch from "node-fetch";
import { existsSync, readFileSync, writeFileSync } from "fs";

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE";
const FARTCOIN_MINT = "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump";
const DECIMALS = 6;
const MIN_AMOUNT = 10;
const WINNERS_PATH = "./winners.json";
const MAX_WINNERS = 500; // keep latest 500 winners

// Helius endpoint
const HELIUS_URL = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;

async function fetchExistingWinners() {
  if (existsSync(WINNERS_PATH)) {
    const data = readFileSync(WINNERS_PATH, "utf-8");
    return JSON.parse(data);
  }
  return [];
}

async function main() {
  try {
    const res = await fetch(HELIUS_URL);
    const data = await res.json();
    const transactions = data || [];

    console.log(`📦 Fetched ${transactions.length} transactions`);

    const existingWinners = await fetchExistingWinners();
    const newWinners = [];

    for (const tx of transactions) {
      const tokenTransfers = tx.tokenTransfers || [];
      for (const transfer of tokenTransfers) {
        const isFart = transfer.mint === FARTCOIN_MINT;
        const isOutgoing = transfer.fromUserAccount === DISTRIBUTION_WALLET;
        const toOtherWallet =
          transfer.toUserAccount &&
          transfer.toUserAccount !== DISTRIBUTION_WALLET;

        const amount =
          Number(transfer.tokenAmount?.amount || 0) /
          Math.pow(10, DECIMALS);

        if (isFart && isOutgoing && toOtherWallet && amount >= MIN_AMOUNT) {
          console.log(
            `➡ Outgoing FART detected: ${transfer.toUserAccount} received ${amount.toFixed(
              2
            )} FART (tx: ${tx.signature})`
          );

          newWinners.push({
            address: transfer.toUserAccount,
            amount: parseFloat(amount.toFixed(2)),
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Merge old + new
    const merged = [...existingWinners, ...newWinners];

    // Deduplicate by tx signature
    const deduped = Array.from(
      new Map(merged.map((w) => [w.signature, w])).values()
    );

    // Sort newest first
    deduped.sort((a, b) => b.timestamp - a.timestamp);

    // Save trimmed list
    writeFileSync(
      WINNERS_PATH,
      JSON.stringify(deduped.slice(0, MAX_WINNERS), null, 2)
    );

    console.log(
      `✅ Winners file updated. Total winners saved: ${deduped.length} (fetched ${transactions.length} txs).`
    );
    console.log("✅ Tracker script completed.");
  } catch (err) {
    console.error("❌ Error in winner tracker:", err);
  }
}

main();
