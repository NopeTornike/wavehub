const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
const searchInput = document.getElementById('marketplaceSearch');
const gameFilter = document.getElementById('gameFilter');
const priceSort = document.getElementById('priceSort');
const marketplaceGrid = document.getElementById('marketplaceGrid');
const marketplaceEmpty = document.getElementById('marketplaceEmpty');
const marketplaceCount = document.getElementById('marketplaceCount');
const sellerButton = document.getElementById('sellerButton');
const sellerModal = document.getElementById('sellerModal');
const sellerCloseButton = document.getElementById('sellerCloseButton');
const sellerCancelButton = document.getElementById('sellerCancelButton');
const sellerForm = document.getElementById('sellerForm');
const sellerGame = document.getElementById('sellerGame');
const sellerTitle = document.getElementById('sellerTitle');
const sellerPrice = document.getElementById('sellerPrice');
const sellerDescription = document.getElementById('sellerDescription');
const sellerStatus = document.getElementById('sellerStatus');
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

const sellerListingsKey = 'wavehub.sellerListings';
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const favoritesKey = 'wavehub.favorites';
const priceOffersKey = 'wavehub.priceOffers';
const games = ['PUBG Mobile', 'Call of Duty', 'CS2', 'Mobile Legends', 'Free Fire', 'Roblox'];

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
  const storedUser = users.find((user) => user.username === sessionUser?.username);
  const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

  return { session, user };
}

function getUserFavorites(username) {
  if (!username) {
    return [];
  }

  const favoritesByUser = readJson(favoritesKey, {});
  const source = favoritesByUser && typeof favoritesByUser === 'object' && !Array.isArray(favoritesByUser)
    ? favoritesByUser
    : {};
  const favorites = source[username];

  return Array.isArray(favorites) ? favorites : [];
}

function saveUserFavorites(username, favorites) {
  const favoritesByUser = readJson(favoritesKey, {});
  const source = favoritesByUser && typeof favoritesByUser === 'object' && !Array.isArray(favoritesByUser)
    ? favoritesByUser
    : {};

  writeJson(favoritesKey, {
    ...source,
    [username]: favorites,
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

function getFavoriteId(listing) {
  return listing?.id ? `listing:${listing.id}` : '';
}

function getDetailUrl(listing) {
  return listing?.id ? `detail.html?type=product&id=${encodeURIComponent(listing.id)}` : '';
}

function getActiveSection() {
  return document.querySelector('.side-link.active')?.dataset.section || 'Marketplace';
}

function setActiveSection(section) {
  sideLinks.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === section);
  });
}

function setSaveButtonState(button, isSaved) {
  button.classList.toggle('saved', isSaved);
  button.textContent = '';
  button.setAttribute('aria-pressed', String(isSaved));
  button.setAttribute('aria-label', isSaved ? 'Remove from favorites' : 'Save product');
  button.title = isSaved ? 'Remove from favorites' : 'Save product';
}

function applyInitialHash() {
  if (window.location.hash !== '#favorites') {
    return;
  }

  if (getCurrentAccount().user?.username) {
    setActiveSection('Favorites');
  } else {
    setProfileOpen(true);
    profileButton?.focus();
  }
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

function getSellerListings() {
  const listings = readJson(sellerListingsKey, []);
  return Array.isArray(listings) ? listings : [];
}

function saveSellerListings(listings) {
  writeJson(sellerListingsKey, listings);
}

function formatListingPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return '$0';
  }

  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

function getGameInitials(game) {
  const initials = String(game || 'WH')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'WH';
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

  if (!isSignedIn && getActiveSection() === 'Favorites') {
    setActiveSection('Marketplace');
  }
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (225 - 94 + 1)) + 94;
  onlineCount.textContent = `${count} online`;
}

function populateGameSelects() {
  [gameFilter, sellerGame].forEach((select) => {
    if (!select) {
      return;
    }

    const firstValue = select.options[0]?.value || '';
    const currentValue = select.value;
    select.innerHTML = '';

    const firstOption = document.createElement('option');
    firstOption.value = firstValue;
    firstOption.textContent = firstValue === 'all' ? 'All games' : 'Select game';
    select.appendChild(firstOption);

    games.forEach((game) => {
      const option = document.createElement('option');
      option.value = game;
      option.textContent = game;
      select.appendChild(option);
    });

    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  });
}

function getFilteredListings() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  const selectedGame = gameFilter?.value || 'all';
  const sortMode = priceSort?.value || 'newest';
  const isFavoritesView = getActiveSection() === 'Favorites';
  const favoriteIds = new Set(
    isFavoritesView
      ? getUserFavorites(getCurrentAccount().user?.username).map((favorite) => favorite.id)
      : [],
  );
  const listings = getSellerListings().filter((listing) => {
    const matchesGame = selectedGame === 'all' || listing.game === selectedGame;
    const haystack = [listing.game, listing.title, listing.description].join(' ').toLowerCase();
    const matchesFavorites = !isFavoritesView || favoriteIds.has(getFavoriteId(listing));

    return matchesGame && matchesFavorites && (!query || haystack.includes(query));
  });

  if (sortMode === 'asc') {
    listings.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortMode === 'desc') {
    listings.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortMode === 'oldest') {
    listings.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else {
    listings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  return listings;
}

function getProductFavorite(listing) {
  return {
    id: getFavoriteId(listing),
    type: 'product',
    listingId: listing.id || '',
    search: [listing.game, listing.title, listing.description, 'account product listing'].join(' ').toLowerCase(),
    title: listing.title || `${listing.game} Account`,
    description: listing.description || '',
    seller: listing.sellerName || `${listing.game} account`,
    price: formatListingPrice(listing.price),
    tag: listing.game || 'Account',
    savedAt: new Date().toISOString(),
  };
}

function createMarketplaceCard(listing) {
  const card = document.createElement('article');
  card.className = 'marketplace-card';
  card.dataset.listingId = listing.id;

  const top = document.createElement('div');
  top.className = 'marketplace-card-top';

  const tag = document.createElement('span');
  tag.className = 'service-tag account';
  tag.textContent = listing.game;

  const price = document.createElement('strong');
  price.textContent = formatListingPrice(listing.price);

  const saveButton = document.createElement('button');
  saveButton.className = 'save-button';
  saveButton.type = 'button';
  saveButton.dataset.favoriteId = getFavoriteId(listing);
  saveButton.setAttribute('aria-label', 'Save product');
  saveButton.setAttribute('aria-pressed', 'false');
  saveButton.title = 'Save product';

  const actions = document.createElement('div');
  actions.className = 'marketplace-card-actions';
  actions.append(price, saveButton);

  top.append(tag, actions);

  const title = document.createElement('h3');
  title.textContent = listing.title || `${listing.game} Account`;

  const description = document.createElement('p');
  description.textContent = listing.description;

  const meta = document.createElement('div');
  meta.className = 'marketplace-card-meta';

  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-blue';
  avatar.textContent = getGameInitials(listing.game);

  const account = document.createElement('span');
  account.textContent = listing.sellerName || `${listing.game} account`;

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Order';
  action.addEventListener('click', () => {
    const detailUrl = getDetailUrl(listing);

    if (detailUrl) {
      window.location.href = detailUrl;
    }
  });

  meta.append(avatar, account, action);
  card.append(top, title, description, meta);

  return card;
}

function renderMarketplace() {
  if (!marketplaceGrid) {
    return;
  }

  const username = getCurrentAccount().user?.username;
  const favoriteIds = new Set(getUserFavorites(username).map((favorite) => favorite.id));
  const listings = getFilteredListings();
  marketplaceGrid.innerHTML = '';

  listings.forEach((listing) => {
    const card = createMarketplaceCard(listing);
    const saveButton = card.querySelector('.save-button');

    if (saveButton) {
      setSaveButtonState(saveButton, favoriteIds.has(getFavoriteId(listing)));
    }

    marketplaceGrid.appendChild(card);
  });

  if (marketplaceCount) {
    marketplaceCount.textContent = String(listings.length);
  }

  if (marketplaceEmpty) {
    marketplaceEmpty.hidden = listings.length > 0;
    marketplaceEmpty.textContent = getActiveSection() === 'Favorites' ? 'No favorite products yet.' : 'No listings yet.';
  }
}

function setSellerStatus(type, message) {
  if (!sellerStatus) {
    return;
  }

  sellerStatus.className = type ? `seller-status ${type}` : 'seller-status';
  sellerStatus.textContent = message;
}

function openSellerModal() {
  if (!sellerModal) {
    return;
  }

  setProfileOpen(false);
  setSidebarOpen(false);
  setSellerStatus('', '');
  sellerModal.hidden = false;
  sellerButton?.setAttribute('aria-expanded', 'true');
  sellerGame?.focus();
}

function closeSellerModal({ resetForm = false } = {}) {
  if (!sellerModal) {
    return;
  }

  sellerModal.hidden = true;
  sellerButton?.setAttribute('aria-expanded', 'false');

  if (resetForm) {
    sellerForm?.reset();
    setSellerStatus('', '');
  }
}

menuToggle?.addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});

scrim?.addEventListener('click', () => setSidebarOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSidebarOpen(false);
    setProfileOpen(false);
    closeSellerModal();
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

sideLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    if (link.getAttribute('href') !== '#') {
      return;
    }

    event.preventDefault();

    const section = link.dataset.section || '';

    if (section === 'Favorites' && !getCurrentAccount().user?.username) {
      setSidebarOpen(false);
      setProfileOpen(true);
      profileButton?.focus();
      return;
    }

    setActiveSection(section);
    setSidebarOpen(false);
    renderMarketplace();
  });
});

profileButton?.addEventListener('click', () => {
  setProfileOpen(profileDropdown?.hidden ?? true);
});

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  renderProfile();
  renderMarketplace();
  setProfileOpen(false);
});

sellerButton?.addEventListener('click', openSellerModal);
sellerCloseButton?.addEventListener('click', () => closeSellerModal({ resetForm: true }));
sellerCancelButton?.addEventListener('click', () => closeSellerModal({ resetForm: true }));

sellerModal?.addEventListener('click', (event) => {
  if (event.target === sellerModal) {
    closeSellerModal({ resetForm: true });
  }
});

document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.save-button') : null;

  if (!button) {
    return;
  }

  const card = button.closest('.marketplace-card');
  const listingId = card?.dataset.listingId || '';
  const listing = getSellerListings().find((item) => item.id === listingId);

  if (!listing) {
    return;
  }

  const { user } = getCurrentAccount();

  if (!user?.username) {
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  const favorite = getProductFavorite(listing);
  const favorites = getUserFavorites(user.username);
  const isSaved = !favorites.some((item) => item.id === favorite.id);
  const nextFavorites = isSaved
    ? [...favorites.filter((item) => item.id !== favorite.id), favorite]
    : favorites.filter((item) => item.id !== favorite.id);

  saveUserFavorites(user.username, nextFavorites);
  renderMarketplace();
});

sellerForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const game = sellerGame?.value.trim() || '';
  const title = sellerTitle?.value.trim() || `${game} Account`;
  const price = Number(sellerPrice?.value);
  const description = sellerDescription?.value.trim() || '';

  if (!game || !description || !Number.isFinite(price) || price <= 0) {
    setSellerStatus('error', 'Please choose a game, price and description.');
    return;
  }

  const sellerUser = getCurrentAccount().user;
  const listing = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    game,
    title,
    price,
    description,
    sellerUsername: sellerUser?.username || '',
    sellerName: sellerUser ? getDisplayName(sellerUser) : `${game} account seller`,
    createdAt: new Date().toISOString(),
  };

  saveSellerListings([...getSellerListings(), listing]);
  closeSellerModal({ resetForm: true });
  renderMarketplace();
});

searchInput?.addEventListener('input', renderMarketplace);
gameFilter?.addEventListener('change', renderMarketplace);
priceSort?.addEventListener('change', renderMarketplace);

window.addEventListener('resize', () => {
  if (window.innerWidth > 920) {
    setSidebarOpen(false);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === sessionKey || event.key === localUsersKey || event.key === priceOffersKey) {
    renderProfile();
    renderMarketplace();
  }

  if (event.key === sellerListingsKey || event.key === favoritesKey) {
    renderMarketplace();
  }
});

populateGameSelects();
renderOnlineCount();
renderProfile();
applyInitialHash();
renderMarketplace();
