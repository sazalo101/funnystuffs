const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { TonConnect } = require('@tonconnect/sdk');
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

// TON Connect setup
const connector = new TonConnect({
  manifestUrl: 'https://your-app.com/tonconnect-manifest.json', // Replace with your manifest URL
});

// Create a prediction
app.post('/create-prediction', async (req, res) => {
  const { text, walletAddress, txHash } = req.body;

  try {
    // Verify the transaction
    const tx = await connector.getTransaction(txHash);
    if (!tx || tx.amount < 0.30 * 1e9) { // 0.30 TON in nanoTON
      return res.status(400).json({ success: false, error: 'Invalid fee payment' });
    }

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
  const { predictionId, amount, walletAddress, txHash } = req.body;

  try {
    // Verify the transaction
    const tx = await connector.getTransaction(txHash);
    if (!tx || tx.amount < (amount + 0.15) * 1e9) { // Amount + 0.15 TON fee in nanoTON
      return res.status(400).json({ success: false, error: 'Invalid fee payment' });
    }

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