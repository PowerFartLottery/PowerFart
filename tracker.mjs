import fetch from 'node-fetch'; // Make sure to use import for ES module compatibility
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

const fartCoinMintAddress = new PublicKey('9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'); // FartCoin Mint Address
const distributionWalletAddress = new PublicKey('6cPZe9GFusuZ9rW48FZPMc6rq318FT8PvGCX7WqG47YE'); // Distribution Wallet Address

const minFartCoinAmount = 10; // 10 FartCoin
const minAmountInUnits = minFartCoinAmount * Math.pow(10, 6); // 10,000,000 (for 6 decimals)

// Function to fetch transactions for the given wallet
async function fetchTransactions() {
    try {
        console.log(`Fetching transaction signatures for wallet: ${distributionWalletAddress.toBase58()}`);

        const transactionSignatures = await connection.getSignaturesForAddress(distributionWalletAddress, { limit: 100 });
        if (transactionSignatures.length === 0) {
            console.log('No transactions found for this wallet.');
            return [];
        }

        const transactions = [];

        for (const txSignature of transactionSignatures) {
            const txDetails = await connection.getTransaction(txSignature.signature);
            
            if (!txDetails || !txDetails.meta || !txDetails.meta.preTokenBalances) {
                continue; // Skip if transaction details are missing or malformed
            }

            for (const balance of txDetails.meta.preTokenBalances) {
                // Check if this transaction involves FartCoin and the amount is greater than the minimum threshold
                if (balance.mint === fartCoinMintAddress.toBase58() && balance.uiAmount && balance.uiAmount * Math.pow(10, 6) > minAmountInUnits) {
                    const postBalances = txDetails.meta.postTokenBalances;
                    const outgoingTransaction = postBalances.some(postBalance => 
                        postBalance.mint === fartCoinMintAddress.toBase58() && postBalance.uiAmount < balance.uiAmount
                    );

                    if (outgoingTransaction) {
                        transactions.push({
                            signature: txSignature.signature,
                            blockTime: txDetails.blockTime,
                            amount: balance.uiAmount, // Amount in FartCoin
                        });
                    }
                }
            }
        }

        return transactions;
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
}

// Function to display filtered transactions
async function displayFilteredTransactions() {
    const filteredTransactions = await fetchTransactions();

    if (filteredTransactions.length > 0) {
        console.log('Filtered Outgoing FartCoin Transactions (Greater than 10 FartCoin):');
        console.table(filteredTransactions);
    } else {
        console.log('No outgoing FartCoin transactions found greater than 10 FartCoin.');
    }
}

// Run the function to fetch and display filtered transactions
displayFilteredTransactions();
