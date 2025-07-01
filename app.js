document.addEventListener('DOMContentLoaded', function () {
  const bootScreen = document.getElementById('bootScreen');
  const bootText = document.getElementById('bootText');
  const loadingBar = document.getElementById('loadingBar');
  const cursor = document.getElementById('cursor');
  const bootSound = document.getElementById('bootSound');
  const fartButton = document.getElementById('fartButton');
  const fartSound = document.getElementById('fartSound');
  const caPre = document.getElementById('contractAddress');

  // Boot screen messages
  const bootMessages = [
    "PowerFart OS v4.2.0 initializing...",
    "Loading core modules...",
    "Establishing Fartcoin blockchain link...",
    "Verifying wallet balances...",
    "Checking fart emission levels...",
    "Calibrating gas sensors...",
    "Ready. Enjoy the power of the fart!",
    "PowerFart Technologies® 2025 "
  ];

  let lineIndex = 0;
  let skipBoot = false;

  function typeLine(line, callback) {
    let i = 0;
    function typeChar() {
      if (skipBoot) {
        bootText.textContent += line + "\n";
        callback();
        return;
      }
      if (i < line.length) {
        bootText.textContent += line.charAt(i);
        i++;
        setTimeout(typeChar, 40);
      } else {
        bootText.textContent += "\n";
        callback();
      }
    }
    typeChar();
  }

  function nextLine() {
    if (skipBoot) {
      finishBoot();
      return;
    }
    if (lineIndex < bootMessages.length) {
      const progress = Math.floor((lineIndex / (bootMessages.length - 1)) * 100);
      loadingBar.style.width = progress + '%';
      typeLine(bootMessages[lineIndex], () => {
        lineIndex++;
        setTimeout(nextLine, 200);
      });
    } else {
      finishBoot();
    }
  }

  function finishBoot() {
    loadingBar.style.width = '100%';
    cursor.style.display = 'none';
    bootSound.play();
    bootScreen.style.transition = "opacity 1.5s ease";
    bootScreen.style.opacity = 0;
    setTimeout(() => {
      bootScreen.style.display = "none";
    }, 1600);
  }

  bootScreen.addEventListener('click', () => {
    if (!skipBoot) {
      skipBoot = true;
      finishBoot();
    }
  });

  window.addEventListener('load', () => {
    nextLine();
  });

  // Fart on button click
  fartButton.addEventListener('click', () => {
    fartSound.currentTime = 0;
    fartSound.play();

    const fartCloud = document.createElement('div');
    fartCloud.classList.add('fart-cloud');
    fartCloud.textContent = '💨💥💨';

    const rect = fartButton.getBoundingClientRect();
    fartCloud.style.left = (rect.left + rect.width / 2) + 'px';
    fartCloud.style.bottom = '80px';
    fartCloud.style.position = 'fixed';

    document.body.appendChild(fartCloud);

    fartCloud.addEventListener('animationend', () => {
      fartCloud.remove();
    });
  });

  // Fart & copy contract address
  caPre.addEventListener('click', () => {
    const codeLines = caPre.innerText.trim().split('\n');
    const address = codeLines[codeLines.length - 1].trim();
    navigator.clipboard.writeText(address).then(() => {
      fartSound.currentTime = 0;
      fartSound.play();
    });
  });

  // Countdown for next winner
  function updateCountdown() {
    const countdownEl = document.getElementById('countdown');
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(now.getHours() + 1);
    const diff = nextHour.getTime() - now.getTime();

    if (diff <= 0) {
      countdownEl.textContent = "00:00";
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

  // Fetch Fartcoin balance
  async function fetchFartcoinBalance() {
    try {
      const HELIUS_API_KEY = "c698448b-867d-4b89-8d94-86c6dd939233";
      const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
      const FARTCOIN_TOKEN = "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump";
      const FARTCOIN_DECIMALS = 6;

      const res = await fetch(HELIUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            "6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE",
            { mint: FARTCOIN_TOKEN },
            { encoding: "jsonParsed" }
          ]
        })
      });

      const data = await res.json();
      const tokenAccounts = data.result.value;

      let totalAmount = 0;
      tokenAccounts.forEach(account => {
        totalAmount += account.account.data.parsed.info.tokenAmount.uiAmount;
      });

      document.getElementById("fartcoinBalance").textContent = `${totalAmount.toFixed(6)} Fartcoin`;
    } catch (err) {
      console.error("Error fetching Fartcoin balance", err);
    }
  }

  fetchFartcoinBalance();
});
