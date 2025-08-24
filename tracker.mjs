#!/usr/bin/env node
import fetch from "node-fetch";
import { existsSync, readFileSync, writeFileSync } from "fs";

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const MULTISIG_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE"; // your multisig
const WINNERS_FILE = "./winners.json";
const FETCH_LIMIT = 100; // number of txs to fetch at once

// Load existing winners
let winners = [];
if (existsSync(WINNERS_FILE)) {
  winners = JSON.parse(readFileSync(WINNERS_FILE));
}

// Fetch transactions from Helius
async function fetchTransactions() {
  const url = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}&limit=${FETCH_LIMIT}`;
  console.log("📦 Fetching transactions from Helius...");
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (!Array.isArray(data)) {
    console.error("❌ Unexpected API response:", data);
    return [];
  }

  console.log(`📦 Total transactions fetched: ${data.length}`);
  return data;
}

// Extract winners
function extractWinners(txs) {
  const newWinners = [];

  for (const tx of txs) {
    if (!tx || !tx.instructions) continue;

    for (const ix of tx.instructions) {
      // We only care about token transfers to our multisig
      if (ix.type === "transferChecked" || ix.type === "transfer") {
        const info = ix.info;
        if (info.destination === MULTISIG_WALLET) {
          const existing = winners.find(w => w.signature === tx.signature);
          if (!existing) {
            newWinners.push({
              address: info.source,
              amount: info.tokenAmount?.uiAmount || 0,
              signature: tx.signature,
              tx: `https://solscan.io/tx/${tx.signature}`,
              timestamp: tx.timestamp
            });
          }
        }
      }
    }
  }

  return newWinners;
}

// Save winners to file
function saveWinners(newWinners) {
  if (newWinners.length > 0) {
    winners = [...winners, ...newWinners].sort((a, b) => a.timestamp - b.timestamp);
    writeFileSync(WINNERS_FILE, JSON.stringify(winners, null, 2));
    console.log(`🏆 Added ${newWinners.length} new winners.`);
  } else {
    console.log("⏸ No new winners to add.");
  }
}

// Main
(async () => {
  try {
    const txs = await fetchTransactions();
    const newWinners = extractWinners(txs);
    saveWinners(newWinners);
    console.log("✅ Tracker script completed.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
