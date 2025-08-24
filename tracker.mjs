#!/usr/bin/env node
import fs from "fs";
import fetch from "node-fetch";

// =============================
// CONFIG
// =============================
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE";
const WINNERS_FILE = "winners.json";
const LIMIT = 100; // number of txs to fetch per call

// =============================
// HELPERS
// =============================
async function fetchTxs(limit = LIMIT) {
    console.log("📦 Fetching transactions...");
    const url = `https://api.helius.xyz/v0/addresses/${DISTRIBUTION_WALLET}/transactions/?api-key=${HELIUS_API_KEY}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) {
        console.error("❌ Unexpected response from Helius:", data);
        return [];
    }
    console.log(`📦 Fetched ${data.length} txs`);
    return data;
}

function extractWinner(tx) {
    if (!tx || !tx.info) return null;
    const info = tx.info;

    // Only handle transferChecked type
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

// =============================
// MAIN
// =============================
(async () => {
    try {
        const txs = await fetchTxs();

        const winners = txs
            .map(extractWinner)
            .filter(Boolean);

        let oldWinners = [];
        if (fs.existsSync(WINNERS_FILE)) {
            oldWinners = JSON.parse(fs.readFileSync(WINNERS_FILE, "utf-8"));
        }

        // only keep new winners
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
    } catch (err) {
        console.error("❌ Error in tracker:", err);
    }
})();
