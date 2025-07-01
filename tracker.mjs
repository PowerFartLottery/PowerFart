// tracker.mjs
// Automated Fartcoin Winner Tracker (ESM version using Helius Transfers API)

import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// === CONFIG ===
const HELIUS_API_KEY    = process.env.HELIUS_API_KEY;
const DISTRIBUTION_WALLET = '6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE';
const FARTCOIN_MINT     = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const MIN_AMOUNT        = 10;       // Minimum FART to qualify
const WINNERS_PATH      = './winners.json';
const PAGE_LIMIT        = 20;       // How many transfers per page

// Load existing winners
function loadExisting() {
  if (existsSync(WINNERS_PATH)) {
    return JSON.parse(readFileSync(WINNERS_PATH, 'utf8'));
  }
  return [];
}

// Save winners (keep latest 100)
function saveWinners(winners) {
  writeFileSync(WINNERS_PATH, JSON.stringify(winners.slice(0,100), null, 2));
}

// Fetch outgoing FART transfers from distro wallet
async function fetchOutgoingTransfers(beforeSignature = null) {
  const url = new URL('https://api.helius.xyz/v0/transfers');
  url.searchParams.set('api-key', HELIUS_API_KEY);
  url.searchParams.set('account', DISTRIBUTION_WALLET);
  url.searchParams.set('mint', FARTCOIN_MINT);
  url.searchParams.set('direction', 'outgoing');
  url.searchParams.set('limit', PAGE_LIMIT);
  if (beforeSignature) url.searchParams.set('before', beforeSignature);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius responded ${res.status}`);
  return await res.json();  // Array of { signature, to, amount, slot, ... }
}

async function main() {
  try {
    const existing = loadExisting();
    const seen = new Set(existing.map(w => w.signature));
    let updated = [...existing];

    // Single page fetch (you can loop with before= to paginate older)
    const transfers = await fetchOutgoingTransfers();
    console.log(`📦 ${transfers.length} outgoing FART transfers fetched`);

    for (const t of transfers) {
      if (seen.has(t.signature)) continue;  // skip already-recorded

      const amt = Number(t.amount);  
      if (amt >= MIN_AMOUNT) {
        console.log(`🎉 New winner ${t.to}: ${amt} FART`);
        updated.unshift({
          address: t.to,
          amount: parseFloat(amt.toFixed(2)),
          signature: t.signature,
          tx: `https://solscan.io/tx/${t.signature}`,
          timestamp: Date.now()
        });
      }
    }

    if (updated.length !== existing.length) {
      saveWinners(updated);
      console.log(`✅ Winners.json updated (${updated.length} total)`);
    } else {
      console.log('⏸ No new winners');
    }
  } catch (err) {
    console.error('❌ Tracker error:', err);
  }
}

main();
