const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const walletSearch = document.getElementById('walletSearch');
const walletBalance = document.getElementById('walletBalance');
const walletBalanceLarge = document.getElementById('walletBalanceLarge');
const walletBuyForm = document.getElementById('walletBuyForm');
const wavecoinAmountInput = document.getElementById('wavecoinAmount');
const walletBuyTotal = document.getElementById('walletBuyTotal');
const walletStatus = document.getElementById('walletStatus');
const walletTransactionList = document.getElementById('walletTransactionList');
const walletTransactionCount = document.getElementById('walletTransactionCount');
const walletEmpty = document.getElementById('walletEmpty');
const onlineCount = document.getElementById('onlineCount');
const messageCount = document.getElementById('messageCount');

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const priceOffersKey = 'wavehub.priceOffers';
const walletsKey = 'wavehub.wallets';
const apiUrls = ['http://localhost:4000', 'http://127.0.0.1:4000'];

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentAccount() {
  const session = readJson(sessionKey, null);
  const users = readJson(localUsersKey, []);
  const sessionUser = session?.user || null;
  const storedUser = Array.isArray(users)
    ? users.find((user) => user.username === sessionUser?.username)
    : null;
  const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

  return { session, user };
}

function getWallets() {
  const wallets = readJson(walletsKey, {});
  return wallets && typeof wallets === 'object' && !Array.isArray(wallets) ? wallets : {};
}

function getWallet(username) {
  const wallets = getWallets();
  const wallet = wallets[username];

  return wallet && typeof wallet === 'object'
    ? {
        balance: Number(wallet.balance) || 0,
        transactions: Array.isArray(wallet.transactions) ? wallet.transactions : [],
      }
    : { balance: 0, transactions: [] };
}

function saveWallet(username, wallet) {
  writeJson(walletsKey, {
    ...getWallets(),
    [username]: {
      balance: Math.max(0, Number(wallet.balance) || 0),
      transactions: Array.isArray(wallet.transactions) ? wallet.transactions : [],
    },
  });
}

function formatGel(value) {
  const amount = Number(value);
  return `${Number.isFinite(amount) ? amount.toFixed(2).replace(/\.00$/, '') : '0'} GEL`;
}

function formatDate(value) {
  const date = new Date(value || '');

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getReceivedOfferCount(username) {
  if (!username) {
    return 0;
  }

  const offers = readJson(priceOffersKey, []);
  return Array.isArray(offers)
    ? offers.filter((offer) => offer.sellerUsername === username).length
    : 0;
}

function setStatus(type, message) {
  if (!walletStatus) {
    return;
  }

  walletStatus.className = type ? `seller-status ${type}` : 'seller-status';
  walletStatus.textContent = message;
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle('sidebar-open', isOpen);
  menuToggle?.setAttribute('aria-expanded', String(isOpen));

  if (scrim) {
    scrim.hidden = !isOpen;
  }
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  onlineCount.textContent = `${Math.floor(Math.random() * (225 - 94 + 1)) + 94} online`;
}

function getEnteredWavecoins() {
  const amount = Math.floor(Number(wavecoinAmountInput?.value));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function setWavecoinAmount(value) {
  if (!wavecoinAmountInput) {
    return;
  }

  const amount = Math.max(1, Math.floor(Number(value)) || 1);
  wavecoinAmountInput.value = String(amount);
  renderBuyTotal();
}

function renderBuyTotal() {
  const amount = getEnteredWavecoins();
  if (walletBuyTotal) walletBuyTotal.textContent = formatGel(amount);
}

function getFilteredTransactions(transactions) {
  const query = walletSearch?.value.trim().toLowerCase() || '';

  if (!query) {
    return transactions;
  }

  return transactions.filter((transaction) => [
    transaction.type,
    transaction.status,
    transaction.method,
    transaction.id,
    transaction.bogOrderId,
  ].join(' ').toLowerCase().includes(query));
}

function renderWallet() {
  const { user } = getCurrentAccount();
  const isSignedIn = Boolean(user?.username);
  const wallet = isSignedIn ? getWallet(user.username) : { balance: 0, transactions: [] };
  const transactions = getFilteredTransactions(wallet.transactions)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (walletBalance) walletBalance.textContent = String(wallet.balance);
  if (walletBalanceLarge) walletBalanceLarge.textContent = `${wallet.balance} WC`;
  if (messageCount) messageCount.textContent = String(getReceivedOfferCount(user?.username));
  if (walletTransactionCount) walletTransactionCount.textContent = `${wallet.transactions.length} records`;

  if (!walletTransactionList) {
    return;
  }

  walletTransactionList.innerHTML = '';

  if (walletEmpty) {
    walletEmpty.hidden = transactions.length > 0;
    walletEmpty.textContent = isSignedIn ? 'No transactions yet.' : 'Log in to view wallet transactions.';
  }

  transactions.forEach((transaction) => {
    const row = document.createElement('article');
    row.className = 'wallet-transaction-card';

    const icon = document.createElement('span');
    icon.className = `wallet-transaction-icon ${transaction.status || 'pending'}`;
    icon.textContent = transaction.type === 'credit' ? '+' : '-';

    const copy = document.createElement('div');
    copy.className = 'wallet-transaction-copy';

    const title = document.createElement('strong');
    title.textContent = transaction.type === 'credit' ? 'WaveCoin top up' : 'Wallet transaction';

    const meta = document.createElement('span');
    meta.textContent = `${transaction.method || 'BOG'} / ${transaction.status || 'pending'} / ${formatDate(transaction.createdAt)}`;

    const id = document.createElement('small');
    id.textContent = transaction.bogOrderId ? `BOG order: ${transaction.bogOrderId}` : transaction.id;

    copy.append(title, meta, id);

    const amount = document.createElement('strong');
    amount.className = 'wallet-transaction-amount';
    amount.textContent = `${transaction.wavecoins || 0} WC`;

    row.append(icon, copy, amount);
    walletTransactionList.appendChild(row);
  });
}

function saveTransaction(username, transaction) {
  const wallet = getWallet(username);
  saveWallet(username, {
    ...wallet,
    transactions: [transaction, ...wallet.transactions],
  });
}

function updateTransaction(username, transactionId, updates) {
  const wallet = getWallet(username);
  const transactions = wallet.transactions.map((transaction) => (
    transaction.id === transactionId ? { ...transaction, ...updates } : transaction
  ));
  saveWallet(username, { ...wallet, transactions });
}

function completeTransaction(username, transactionId) {
  const wallet = getWallet(username);
  let credited = 0;
  const transactions = wallet.transactions.map((transaction) => {
    if (transaction.id !== transactionId || transaction.status === 'completed') {
      return transaction;
    }

    credited = Number(transaction.wavecoins) || 0;
    return {
      ...transaction,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
  });

  saveWallet(username, {
    balance: wallet.balance + credited,
    transactions,
  });
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createBogOrder(payload) {
  for (const apiUrl of apiUrls) {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/payments/bog/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, error: data?.error || data?.message || 'BOG checkout could not be created.' };
      }

      return { ok: true, data };
    } catch (err) {
      console.warn('BOG checkout API is unavailable:', err);
    }
  }

  return { ok: false, offline: true };
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment') || params.get('status');
  const transactionId = params.get('transaction_id') || params.get('external_order_id');
  const { user } = getCurrentAccount();

  if (!status || !transactionId || !user?.username) {
    return;
  }

  if (status === 'success') {
    completeTransaction(user.username, transactionId);
    setStatus('success', 'WaveCoin balance updated.');
  }

  if (status === 'fail' || status === 'failed') {
    updateTransaction(user.username, transactionId, { status: 'failed' });
    setStatus('error', 'Payment was not completed.');
  }

  const nextUrl = new URL(window.location.href);
  ['payment', 'status', 'transaction_id', 'external_order_id'].forEach((key) => nextUrl.searchParams.delete(key));
  window.history.replaceState({}, '', nextUrl);
}

menuToggle?.addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});

scrim?.addEventListener('click', () => setSidebarOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSidebarOpen(false);
  }
});

wavecoinAmountInput?.addEventListener('input', () => {
  if (Number(wavecoinAmountInput.value) < 1) {
    wavecoinAmountInput.value = '1';
  }
  renderBuyTotal();
});
walletSearch?.addEventListener('input', renderWallet);

document.querySelectorAll('[data-wavecoin-step]').forEach((button) => {
  button.addEventListener('click', () => {
    const step = Number(button.dataset.wavecoinStep) || 0;
    setWavecoinAmount(getEnteredWavecoins() + step);
  });
});

document.querySelectorAll('[data-wavecoin-amount]').forEach((button) => {
  button.addEventListener('click', () => {
    setWavecoinAmount(button.dataset.wavecoinAmount || '10');
  });
});

walletBuyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const { user } = getCurrentAccount();
  const wavecoins = getEnteredWavecoins();

  if (!user?.username) {
    setStatus('error', 'Please log in before buying WaveCoin.');
    return;
  }

  if (wavecoins < 1) {
    setStatus('error', 'Enter at least 1 WaveCoin.');
    return;
  }

  const transaction = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    type: 'credit',
    method: 'BOG',
    status: 'pending',
    wavecoins,
    amountGel: wavecoins,
    createdAt: new Date().toISOString(),
  };

  saveTransaction(user.username, transaction);
  renderWallet();
  setStatus('', 'Creating BOG checkout...');

  const result = await createBogOrder({
    amountGel: wavecoins,
    wavecoins,
    username: user.username,
    transactionId: transaction.id,
    successUrl: `${window.location.origin}${window.location.pathname}?payment=success&transaction_id=${encodeURIComponent(transaction.id)}`,
    failUrl: `${window.location.origin}${window.location.pathname}?payment=fail&transaction_id=${encodeURIComponent(transaction.id)}`,
  });

  if (!result.ok) {
    updateTransaction(user.username, transaction.id, { status: result.offline ? 'pending' : 'failed' });
    renderWallet();
    setStatus(
      result.offline ? 'error' : 'error',
      result.offline
        ? 'BOG backend is not connected. Transaction was saved as pending.'
        : result.error
    );
    return;
  }

  updateTransaction(user.username, transaction.id, {
    bogOrderId: result.data?.orderId || '',
    status: 'redirecting',
  });

  if (result.data?.redirectUrl) {
    window.location.href = result.data.redirectUrl;
    return;
  }

  renderWallet();
  setStatus('success', 'BOG order created, but redirect URL was not returned.');
});

window.addEventListener('storage', (event) => {
  if ([walletsKey, sessionKey, localUsersKey, priceOffersKey].includes(event.key)) {
    renderWallet();
  }
});

renderOnlineCount();
handlePaymentReturn();
renderBuyTotal();
renderWallet();
