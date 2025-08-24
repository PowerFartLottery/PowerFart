// tracker.mjs
import fetch from "node-fetch";
import { existsSync, readFileSync, writeFileSync } from "fs";

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE"; // your multisig
const WINNERS_FILE = "./winners.json";
const MAX_TXS = 100;

// === Load previous winners ===
let previousWinners = [];
if (existsSync(WINNERS_FILE)) {
  previousWinners = JSON.parse(readFileSync(WINNERS_FILE, "utf-8"));
}

// === Fetch transactions ===
console.log("📦 Fetching transactions from Helius...");
const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions/?api-key=${HELIUS_API_KEY}&limit=${MAX_TXS}`;
const res = await fetch(url);
const data = await res.json();

if (!Array.isArray(data)) {
  console.error("❌ Unexpected API response:", data);
  process.exit(1);
}

console.log(`📦 Total transactions fetched: ${data.length}`);

// === Extract winners ===
const newWinners = [];

for (const tx of data) {
  if (!tx || !tx.parsed || !tx.parsed.instructions) continue;

  for (const instr of tx.parsed.instructions) {
    // Check for transfer to your multisig
    if (
      (instr.type === "transferChecked" || instr.type === "transfer") &&
      instr.info.destination === DISTRIBUTION_WALLET
    ) {
      const winner = {
        address: instr.info.source,
        amount: instr.info.tokenAmount?.uiAmount || 0,
        signature: tx.signature,
        tx: `https://solscan.io/tx/${tx.signature}`,
        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
      };

      // Skip duplicates
      if (!previousWinners.find(w => w.signature === winner.signature)) {
        newWinners.push(winner);
        console.log("🏆 Winner found:", winner);
      }
    }
  }
}

// === Merge and save ===
if (newWinners.length > 0) {
  const allWinners = [...previousWinners, ...newWinners];
  writeFileSync(WINNERS_FILE, JSON.stringify(allWinners, null, 2));
  console.log(`✅ ${newWinners.length} new winners added.`);
} else {
  console.log("⏸ No new winners to add.");
}

console.log("✅ Tracker script completed.");
