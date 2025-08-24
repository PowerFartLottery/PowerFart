#!/usr/bin/env node
import fs from "fs";
import fetch from "node-fetch";

// CONFIG
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE";
const WINNERS_FILE = "winners.json";
const LIMIT = 100;

// HELPER: Fetch transactions from Helius
async function fetchTxs(limit = LIMIT) {
    console.log("📦 Fetching transactions from Helius...");
    const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions/?api-key=${HELIUS_API_KEY}&limit=${limit}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("📥 Raw API response:", data.length || data);
        if (!Array.isArray(data)) return [];
        return data;
    } catch (err) {
        console.error("❌ Failed to fetch transactions:", err);
        return [];
    }
}

// HELPER: Extract winner info from a transaction
function extractWinner(tx) {
    if (!tx || !tx.info) return null;

    const info = tx.info;

    // Handle only transferChecked type
    if (info.type !== "transferChecked") return null;

    const tokenAmount = info.tokenAmount?.uiAmount || 0;
    return {
        address: info.destination,
        amount: tokenAmount,
        signature: tx.signature || tx.txHash || "",
        tx: tx.signature ? `https://solscan.io/tx/${tx.signature}` : "",
        timestamp: info.timestamp || Date.now()
    };
}

// MAIN
(async () => {
    const txs = await fetchTxs();
    console.log(`📦 Total transactions fetched: ${txs.length}`);

    const winners = txs
        .map(extractWinner)
        .filter(Boolean);

    console.log(`🏆 Winners extracted: ${winners.length}`);
    console.log(winners);

    let oldWinners = [];
    if (fs.existsSync(WINNERS_FILE)) {
        oldWinners = JSON.parse(fs.readFileSync(WINNERS_FILE, "utf-8"));
    }

    const newWinners = winners.filter(
        w => !oldWinners.some(o => o.signature === w.signature)
    );

    if (newWinners.length === 0) {
        console.log("⏸ No new winners to add.");
    } else {
        const updatedWinners = [...oldWinners, ...newWinners];
        fs.writeFileSync(WINNERS_FILE, JSON.stringify(updatedWinners, null, 2));
        console.log(`✅ Added ${newWinners.length} new winners.`);
    }
})();
