const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { Address, TonClient, WalletContractV4, internal } = require('ton');
const { mnemonicToWalletKey } = require('ton-crypto');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'predictions.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        predictionId INTEGER NOT NULL,
        amount REAL NOT NULL,
        walletAddress TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// TON Blockchain Configuration
const TON_API_KEY = process.env.TON_API_KEY; // Get from environment variables
const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS; // Your wallet address
const TON_MNEMONIC = process.env.TON_MNEMONIC; // Your wallet mnemonic (keep secure!)

// Initialize TON Client
const tonClient = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: TON_API_KEY,
});

// Function to send TON
async function sendTON(toAddress, amount) {
  const key = await mnemonicToWalletKey(TON_MNEMONIC.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const contract = tonClient.open(wallet);

  const seqno = await contract.getSeqno(); // Get current sequence number
  const transfer = contract.createTransfer({
    seqno,
    secretKey: key.secretKey,
    messages: [
      internal({
        to: toAddress,
        value: amount.toString(), // Amount in nanoTON
        body: 'Fee for prediction market', // Optional message
      }),
    ],
  });

  await contract.send(transfer); // Send the transaction
  return seqno;
}

// Create a prediction
app.post('/create-prediction', async (req, res) => {
  const { text, fee, walletAddress } = req.body;

  try {
    // Send 0.30 TON fee to your wallet
    const amount = fee * 1e9; // Convert TON to nanoTON
    const seqno = await sendTON(TON_WALLET_ADDRESS, amount);
    console.log(`Sent ${fee} TON to ${TON_WALLET_ADDRESS}. Seqno: ${seqno}`);

    // Save prediction to database
    db.run(
      'INSERT INTO predictions (text, createdBy) VALUES (?, ?)',
      [text, walletAddress],
      function (err) {
        if (err) {
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, predictionId: this.lastID });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a bet
app.post('/place-bet', async (req, res) => {
  const { predictionId, amount, fee, walletAddress } = req.body;

  try {
    // Send 0.15 TON fee to your wallet
    const totalFee = fee * 1e9; // Convert TON to nanoTON
    const seqno = await sendTON(TON_WALLET_ADDRESS, totalFee);
    console.log(`Sent ${fee} TON to ${TON_WALLET_ADDRESS}. Seqno: ${seqno}`);

    // Save bet to database
    db.run(
      'INSERT INTO bets (predictionId, amount, walletAddress) VALUES (?, ?, ?)',
      [predictionId, amount, walletAddress],
      function (err) {
        if (err) {
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch predictions
app.get('/predictions', (req, res) => {
  db.all('SELECT * FROM predictions', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});