const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const cartSearch = document.getElementById('cartSearch');
const cartList = document.getElementById('cartList');
const cartEmpty = document.getElementById('cartEmpty');
const cartCount = document.getElementById('cartCount');
const cartNavCount = document.getElementById('cartNavCount');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartSummaryCount = document.getElementById('cartSummaryCount');
const checkoutButton = document.getElementById('checkoutButton');
const checkoutStatus = document.getElementById('checkoutStatus');
const profileButton = document.getElementById('profileButton');
const profileDropdown = document.getElementById('profileDropdown');
const profileAvatar = document.getElementById('profileAvatar');
const profilePanelAvatar = document.getElementById('profilePanelAvatar');
const profileUsername = document.getElementById('profileUsername');
const profileMeta = document.getElementById('profileMeta');
const profileFullName = document.getElementById('profileFullName');
const profileHandle = document.getElementById('profileHandle');
const accountUsername = document.getElementById('accountUsername');
const accountName = document.getElementById('accountName');
const accountId = document.getElementById('accountId');
const accountLoggedIn = document.getElementById('accountLoggedIn');
const logoutButton = document.getElementById('logoutButton');
const authEntryActions = document.getElementById('authEntryActions');
const onlineCount = document.getElementById('onlineCount');
const messageCount = document.getElementById('messageCount');

const cartKey = 'wavehub.cart';
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const priceOffersKey = 'wavehub.priceOffers';

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

function formatListingPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return '0 GEL';
  }

  return `${Number.isInteger(price) ? price : price.toFixed(2)} GEL`;
}

function getCartItems() {
  const items = readJson(cartKey, []);
  return Array.isArray(items) ? items : [];
}

function saveCartItems(items) {
  writeJson(cartKey, items);
}

function getCartTotal(items = getCartItems()) {
  return items.reduce((total, item) => total + (Number(item.price) || 0), 0);
}

function removeCartItem(id) {
  saveCartItems(getCartItems().filter((item) => item.id !== id));
}

function getCurrentAccount() {
  const session = readJson(sessionKey, null);
  const users = readJson(localUsersKey, []);
  const sessionUser = session?.user || null;
  const storedUser = users.find((user) => user.username === sessionUser?.username);
  const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

  return { session, user };
}

function getInitials(user) {
  const source = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'G';
  return source
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.username || 'Guest account';
}

function getShortId(id) {
  return id ? String(id).slice(0, 8) : '-';
}

function formatLoginTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

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

function setSidebarOpen(isOpen) {
  document.body.classList.toggle('sidebar-open', isOpen);
  menuToggle?.setAttribute('aria-expanded', String(isOpen));

  if (scrim) {
    scrim.hidden = !isOpen;
  }
}

function setProfileOpen(isOpen) {
  if (!profileDropdown || !profileButton) {
    return;
  }

  profileDropdown.hidden = !isOpen;
  profileButton.setAttribute('aria-expanded', String(isOpen));
}

function renderProfile() {
  const { session, user } = getCurrentAccount();
  const username = user?.username || 'Guest';
  const displayName = user ? getDisplayName(user) : 'Guest account';
  const initials = user ? getInitials(user) : '?';
  const isSignedIn = Boolean(user?.username);

  if (profileAvatar) profileAvatar.textContent = initials;
  if (profilePanelAvatar) profilePanelAvatar.textContent = initials;
  if (profileUsername) profileUsername.textContent = username;
  if (profileMeta) profileMeta.textContent = isSignedIn ? 'Signed in' : 'Not signed in';
  if (profileFullName) profileFullName.textContent = displayName;
  if (profileHandle) profileHandle.textContent = isSignedIn ? `@${username}` : '@guest';
  if (accountUsername) accountUsername.textContent = username;
  if (accountName) accountName.textContent = isSignedIn ? displayName : 'Not signed in';
  if (accountId) accountId.textContent = getShortId(user?.id);
  if (accountLoggedIn) accountLoggedIn.textContent = formatLoginTime(session?.loggedInAt);

  if (logoutButton) {
    logoutButton.hidden = !isSignedIn;
    logoutButton.disabled = !isSignedIn;
  }

  if (authEntryActions) {
    authEntryActions.hidden = isSignedIn;
  }

  if (messageCount) {
    messageCount.textContent = String(getReceivedOfferCount(user?.username));
  }
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  onlineCount.textContent = `${Math.floor(Math.random() * (225 - 94 + 1)) + 94} online`;
}

function getFilteredCartItems() {
  const query = cartSearch?.value.trim().toLowerCase() || '';
  const items = getCartItems();

  if (!query) {
    return items;
  }

  return items.filter((item) => [item.title, item.game, item.seller, item.productType]
    .join(' ')
    .toLowerCase()
    .includes(query));
}

function renderCart() {
  const allItems = getCartItems();
  const items = getFilteredCartItems();
  const total = getCartTotal(allItems);

  if (cartCount) cartCount.textContent = String(allItems.length);
  if (cartNavCount) cartNavCount.textContent = String(allItems.length);
  if (cartSummaryCount) cartSummaryCount.textContent = String(allItems.length);
  if (cartSubtotal) cartSubtotal.textContent = formatListingPrice(total);
  if (checkoutButton) checkoutButton.disabled = allItems.length === 0;

  if (!cartList) {
    return;
  }

  cartList.innerHTML = '';

  if (cartEmpty) {
    cartEmpty.hidden = items.length > 0;
    cartEmpty.textContent = allItems.length ? 'No cart products match your search.' : 'Cart is empty.';
  }

  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'cart-item cart-page-item';

    const thumb = document.createElement('a');
    thumb.className = 'cart-item-thumb';
    thumb.href = item.detailUrl || '#';
    thumb.setAttribute('aria-label', `Open ${item.title}`);

    if (item.imageData) {
      thumb.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 19, 0.08), rgba(5, 8, 19, 0.4)), url("${item.imageData}")`;
    } else {
      thumb.textContent = String(item.game || 'WH').slice(0, 2).toUpperCase();
    }

    const copy = document.createElement('div');
    copy.className = 'cart-item-copy';

    const title = document.createElement('strong');
    title.textContent = item.title;

    const meta = document.createElement('span');
    meta.textContent = `${item.game} / ${item.seller}`;

    const price = document.createElement('small');
    price.textContent = item.priceText || formatListingPrice(item.price);

    copy.append(title, meta, price);

    const actions = document.createElement('div');
    actions.className = 'cart-item-actions';

    const openLink = document.createElement('a');
    openLink.href = item.detailUrl || '#';
    openLink.textContent = 'View';

    const removeButton = document.createElement('button');
    removeButton.className = 'cart-remove-button';
    removeButton.type = 'button';
    removeButton.dataset.cartItemId = item.id;
    removeButton.textContent = 'Delete';

    actions.append(openLink, removeButton);
    row.append(thumb, copy, actions);
    cartList.appendChild(row);
  });
}

menuToggle?.addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});

scrim?.addEventListener('click', () => setSidebarOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSidebarOpen(false);
    setProfileOpen(false);
  }
});

document.addEventListener('click', (event) => {
  const target = event.target;

  if (target instanceof Node && profileButton?.contains(target)) {
    return;
  }

  if (target instanceof Node && profileDropdown?.contains(target)) {
    return;
  }

  setProfileOpen(false);
});

profileButton?.addEventListener('click', () => {
  setProfileOpen(profileDropdown?.hidden ?? true);
});

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  renderProfile();
  setProfileOpen(false);
});

cartSearch?.addEventListener('input', renderCart);

cartList?.addEventListener('click', (event) => {
  const removeButton = event.target instanceof Element ? event.target.closest('.cart-remove-button') : null;

  if (!removeButton) {
    return;
  }

  removeCartItem(removeButton.dataset.cartItemId || '');
  renderCart();
});

checkoutButton?.addEventListener('click', () => {
  const { user } = getCurrentAccount();
  const items = getCartItems();

  if (!items.length) {
    return;
  }

  if (!user?.username) {
    if (checkoutStatus) {
      checkoutStatus.className = 'seller-status error';
      checkoutStatus.textContent = 'Please log in before checkout.';
    }
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  if (checkoutStatus) {
    checkoutStatus.className = 'seller-status success';
    checkoutStatus.textContent = 'Checkout request is ready. Sellers will confirm the order details.';
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === cartKey) {
    renderCart();
  }

  if (event.key === sessionKey || event.key === localUsersKey || event.key === priceOffersKey) {
    renderProfile();
  }
});

renderOnlineCount();
renderProfile();
renderCart();
