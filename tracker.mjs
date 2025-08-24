// tracker.mjs
import fetch from "node-fetch";
import { existsSync, readFileSync, writeFileSync } from "fs";

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE";
const WINNERS_FILE = "winners.json";

// === HELPERS ===
const loadPreviousWinners = () => {
  if (existsSync(WINNERS_FILE)) {
    return JSON.parse(readFileSync(WINNERS_FILE, "utf-8"));
  }
  return [];
};

const saveWinners = (winners) => {
  writeFileSync(WINNERS_FILE, JSON.stringify(winners, null, 2));
};

// === MAIN ===
const main = async () => {
  console.log("📦 Fetching transactions from Helius...");

  const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions/?api-key=${HELIUS_API_KEY}&limit=100`;
  const res = await fetch(url);
  const data = await res.json();

  if (!Array.isArray(data)) {
    console.error("❌ Unexpected API response:", data);
    return;
  }

  console.log(`📥 Total transactions fetched: ${data.length}`);

  const previousWinners = loadPreviousWinners();
  const knownSignatures = new Set(previousWinners.map((w) => w.signature));

  const newWinners = [];

  for (const tx of data) {
    if (!tx || !tx.parsed || !tx.parsed.instructions) continue;

    for (const instr of tx.parsed.instructions) {
      if (instr.type === "transferChecked") {
        const tokenAmount = instr.info.tokenAmount?.uiAmount || 0;
        const destination = instr.info.destination;

        if (!knownSignatures.has(tx.signature)) {
          const winner = {
            address: destination,
            amount: tokenAmount,
            signature: tx.signature,
            tx: `https://solscan.io/tx/${tx.signature}`,
            timestamp: tx.timestamp || Date.now(),
          };
          newWinners.push(winner);
        }
      }
    }
  }

  if (newWinners.length > 0) {
    console.log(`🏆 Winners extracted: ${newWinners.length}`);
    const allWinners = [...previousWinners, ...newWinners];
    saveWinners(allWinners);
    console.log("✅ winners.json updated.");
  } else {
    console.log("⏸ No new winners to add.");
  }
};

main().catch((err) => console.error("❌ Error running tracker:", err));
