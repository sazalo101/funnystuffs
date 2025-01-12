// Initialize Telegram Web App
const tg = window.Telegram.WebApp;

// Fetch wallet balance from TON blockchain
async function fetchBalance() {
  const walletAddress = tg.initDataUnsafe.user?.id; // Use Telegram user ID as wallet address
  const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${walletAddress}`);
  const data = await response.json();
  document.getElementById('balance').textContent = data.result / 1e9; // Convert nanoTON to TON
}

// Fetch and display predictions
async function fetchPredictions() {
  const response = await fetch('/predictions');
  const predictions = await response.json();
  const predictionsList = document.getElementById('predictions');
  predictionsList.innerHTML = predictions.map(prediction => `
    <li>
      <strong>${prediction.text}</strong>
      <button onclick="placeBet(${prediction.id}, 10)">Bet 10 TON</button>
    </li>
  `).join('');
}

// Handle prediction creation
document.getElementById('create-prediction').addEventListener('click', async () => {
  const predictionText = document.getElementById('prediction-text').value;
  if (!predictionText) {
    alert('Please enter a prediction.');
    return;
  }

  const fee = 0.30; // 0.30 TON fee for creating a prediction
  const response = await createPrediction(predictionText, fee);
  if (response.success) {
    alert(`Prediction created! Fee: ${fee} TON`);
    fetchBalance(); // Refresh balance
    fetchPredictions(); // Refresh predictions list
  } else {
    alert('Failed to create prediction. Please try again.');
  }
});

// Function to create a prediction
async function createPrediction(text, fee) {
  const walletAddress = tg.initDataUnsafe.user?.id;
  const response = await fetch('/create-prediction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fee, walletAddress }),
  });
  return response.json();
}

// Function to place a bet
async function placeBet(predictionId, amount) {
  const fee = 0.15; // 0.15 TON fee for placing a bet
  const total = amount + fee;

  const response = await fetch('/place-bet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ predictionId, amount, fee, walletAddress: tg.initDataUnsafe.user?.id }),
  });

  if (response.success) {
    alert(`Bet placed! Total: ${total} TON`);
    fetchBalance(); // Refresh balance
  } else {
    alert('Failed to place bet. Please try again.');
  }
}

// Initialize
tg.ready(); // Show the app
fetchBalance();
fetchPredictions();