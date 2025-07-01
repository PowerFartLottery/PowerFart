import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// List of winners
const winners = [
    { address: "AtoQ1Y6zm4NxNwie8jbrM4VjXVh6fQyqyajCKEyn5RPJ", amount: 1261.47 },
    { address: "jjXczvExrj8ChL39PVwq54yNXFi86WKciCgvRuLdNda", amount: 1060.00 },
    { address: "7h8CFdqynASZmFcVVEexLgPBmgTmvNF243bBAnryK8MS", amount: 1016.86 },
    { address: "EKFxBzg8n4PbwTES5skQm2cKvxpr2g8skKYq6HKvfEWF", amount: 815.18 },
    { address: "6SY1BdgfJkcoKKsu36bFFXJHYQB3kqpWQx2EgBD85gMo", amount: 440.92 },
    { address: "Fus1BvxRyiMxSokafiDE21cJVS3GFCeasc3kWUBWgzi7", amount: 472.39 },
    { address: "HLgkhbN966cCCrX9xDsJofmgmzbKDjh6Sodecaq14gfz", amount: 255.74 },
    { address: "2yg76DQnzdLVc6zGp4GB3ankn66L1fZJuBcWaoo1TwRx", amount: 275.40 }
];

// Initialize Solana connection
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

// Fetch transactions for a given wallet address
async function getTransactions(walletAddress) {
    const publicKey = new PublicKey(walletAddress);
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 1000 });
    
    for (const signatureData of signatures) {
        const transaction = await connection.getTransaction(signatureData.signature);
        
        // Check if the transaction involves any winners
        checkForWinners(transaction);
    }
}

// Check if the transaction involves any of the winner's addresses
function checkForWinners(transaction) {
    if (!transaction) return;

    const { transaction: { message } } = transaction;

    // Loop through each instruction in the transaction to see if any winner's address is involved
    for (const instruction of message.instructions) {
        const senderAddress = instruction.keys[0]?.pubkey.toBase58();  // Sender address
        const receiverAddress = instruction.keys[1]?.pubkey.toBase58(); // Receiver address
        
        // Check if sender or receiver is one of the winners
        if (isWinner(senderAddress) || isWinner(receiverAddress)) {
            console.log('Winner Transaction Detected: ', {
                senderAddress,
                receiverAddress,
                signature: transaction.transaction.signatures[0],
                blockTime: transaction.blockTime
            });
        }
    }
}

// Check if an address is one of the winners
function isWinner(address) {
    return winners.some(winner => winner.address === address);
}

// Start fetching transactions for the wallet
const walletAddress = 'your_wallet_address_here';
getTransactions(walletAddress);
