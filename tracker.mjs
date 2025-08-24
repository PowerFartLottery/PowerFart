#!/usr/bin/env node
import fs from "fs/promises";
import fetch from "node-fetch";

// =============================
// Config
// =============================
const TEAM_WALLET = "YOUR_TEAM_WALLET_HERE"; // <-- replace with your real team wallet
const FART_MINT = "YOUR_FART_TOKEN_MINT_HERE"; // <-- replace with your FART token mint
const API_KEY = process.env.HELIUS_API_KEY;

// =============================
// Fetch all winners
// =============================
async function fetchAllWinners() {
  let allTransfers = [];
  let before = undefined;

  while (true) {
    const url = new URL(
      `https://api.helius.xyz/v0/addresses/${TEAM_WALLET}/transfers`
    );
    url.searchParams.set("api-key", API_KEY);
    url.searchParams.set("limit", "100"); // max per page
    if (before) url.searchParams.set("before", before);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("Failed to fetch:", res.status, await res.text());
      break;
    }
    const data = await res.json();

    if (!data || data.length === 0) break;

    // Filter: outgoing FART transfers only
    const winners = data.filter(
      (t) =>
        t.type === "TRANSFER" &&
        t.tokenTransfers?.some(
          (tt) =>
            tt.fromUserAccount === TEAM_WALLET &&
            tt.mint === FART_MINT
        )
    );

    allTransfers.push(...winners);

    // Prepare next page
    before = data[data.length - 1].signature;
  }

  // Map into simplified objects
  return allTransfers.map((t) => {
    const fart = t.tokenTransfers.find((tt) => tt.mint === FART_MINT);
    return {
      address: fart.toUserAccount,
      amount: fart.tokenAmount / 10 ** fart.decimals,
      tx: t.signature,
    };
  });
}

// =============================
// Main
// =============================
async function main() {
  try {
    const winners = await fetchAllWinners();

    // Deduplicate
    const unique = [];
    const seen = new Set();
    for (const w of winners) {
      const key = `${w.address}-${w.amount}-${w.tx}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(w);
      }
    }

    await fs.writeFile("winners.json", JSON.stringify(unique, null, 2));
    console.log(`Saved ${unique.length} winners to winners.json`);
  } catch (err) {
    console.error("Error in tracker:", err);
    process.exit(1);
  }
}

main();
