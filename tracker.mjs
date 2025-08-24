#!/usr/bin/env node
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const FARTCOIN_MINT = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'; // Replace with actual mint
const WINNERS_PATH = './winners.json';
const MIN_AMOUNT = 0.01; // Minimum amount to consider a winner

// Load previous winners
let winners = [];
if (existsSync(WINNERS_PATH)) {
    winners = JSON.parse(readFileSync(WINNERS_PATH, 'utf8'));
}

// Fetch transactions from Helius
async function fetchTxs(limit = 100) {
    const url = `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
}

// Main tracker logic
(async () => {
    console.log('📦 Fetching transactions...');
    const txs = await fetchTxs(100);
    console.log(`📦 Fetched ${txs.length} txs`);

    const updatedWinners = [...winners];

    for (const tx of txs) {
        if (!tx?.transactions) continue;

        for (const instr of tx.transactions) {
            // Only consider transferChecked for our mint
            if (instr.type === 'transferChecked' && instr.info?.mint === FARTCOIN_MINT) {
                const amount = Number(instr.info.tokenAmount?.uiAmount || 0);
                const dest = instr.info.destination;
                console.log(`Found transferChecked → ${dest} amount: ${amount}`);

                if (amount >= MIN_AMOUNT && !updatedWinners.find(w => w.signature === tx.signature)) {
                    updatedWinners.unshift({
                        address: dest,
                        amount: parseFloat(amount.toFixed(6)),
                        signature: tx.signature,
                        tx: `https://solscan.io/tx/${tx.signature}`,
                        timestamp: tx.timestamp * 1000 || Date.now()
                    });
                }
            }
        }
    }

    // Keep only latest 500 winners
    const finalWinners = updatedWinners.slice(0, 500);

    // Write winners.json
    writeFileSync(WINNERS_PATH, JSON.stringify(finalWinners, null, 2));
    console.log(`✅ Tracker completed. Total winners: ${finalWinners.length}`);
})();
