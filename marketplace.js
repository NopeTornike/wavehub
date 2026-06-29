const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
const searchInput = document.getElementById('marketplaceSearch');
const productTypeFilter = document.getElementById('productTypeFilter');
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
const sellerProductType = document.getElementById('sellerProductType');
const sellerGame = document.getElementById('sellerGame');
const sellerTitleLabel = document.getElementById('sellerTitleLabel');
const sellerTitle = document.getElementById('sellerTitle');
const sellerPrice = document.getElementById('sellerPrice');
const sellerImage = document.getElementById('sellerImage');
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
const listingTypeConfig = {
  account: {
    type: 'account',
    label: 'Account',
    pluralLabel: 'Accounts',
    tagClass: 'account',
    tagLabel: 'Account',
    titleLabel: 'Account title',
    titlePlaceholder: 'PUBG Mobile Ace account',
    descriptionPlaceholder: 'Rank, skins, level, delivery details...',
    sellerNoun: 'account seller',
    searchTerms: 'account product listing',
    actionLabel: 'Order',
  },
  skin: {
    type: 'skin',
    label: 'Skin',
    pluralLabel: 'Skins',
    tagClass: 'skin',
    tagLabel: 'Skin',
    titleLabel: 'Skin name',
    titlePlaceholder: 'AK-47 Neon Rider skin',
    descriptionPlaceholder: 'Rarity, condition, platform and delivery details...',
    sellerNoun: 'skin seller',
    searchTerms: 'skin cosmetic item marketplace buy sell',
    actionLabel: 'Buy',
  },
};

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

function readSellerImageData() {
  const file = sellerImage?.files?.[0];

  if (!file) {
    return Promise.resolve('');
  }

  if (!file.type.startsWith('image/')) {
    return Promise.resolve('');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const image = new Image();

      image.addEventListener('load', () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context?.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      });

      image.addEventListener('error', () => reject(new Error('Image could not be loaded.')));
      image.src = String(reader.result || '');
    });

    reader.addEventListener('error', () => reject(new Error('Image could not be read.')));
    reader.readAsDataURL(file);
  });
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

function applyInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const game = params.get('game');

  if (productTypeFilter && (type === 'account' || type === 'skin')) {
    productTypeFilter.value = type;
  }

  if (gameFilter && game && [...gameFilter.options].some((option) => option.value === game)) {
    gameFilter.value = game;
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
    return '0 GEL';
  }

  return `${Number.isInteger(price) ? price : price.toFixed(2)} GEL`;
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

function getListingType(listing) {
  return listing?.listingType === 'skin' ? 'skin' : 'account';
}

function getListingConfig(listingOrType) {
  const type = typeof listingOrType === 'string' ? listingOrType : getListingType(listingOrType);
  return listingTypeConfig[type] || listingTypeConfig.account;
}

function getListingTitle(listing) {
  const config = getListingConfig(listing);
  return listing.title || `${listing.game} ${config.label}`;
}

function getListingSellerName(listing) {
  const config = getListingConfig(listing);
  return listing.sellerName || `${listing.game} ${config.sellerNoun}`;
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

function updateSellerTypeFields() {
  const config = getListingConfig(sellerProductType?.value || 'account');

  if (sellerTitleLabel) {
    sellerTitleLabel.textContent = config.titleLabel;
  }

  if (sellerTitle) {
    sellerTitle.placeholder = config.titlePlaceholder;
    sellerTitle.required = config.type === 'skin';
  }

  if (sellerDescription) {
    sellerDescription.placeholder = config.descriptionPlaceholder;
  }
}

function getFilteredListings() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  const selectedType = productTypeFilter?.value || 'all';
  const selectedGame = gameFilter?.value || 'all';
  const sortMode = priceSort?.value || 'newest';
  const isFavoritesView = getActiveSection() === 'Favorites';
  const favoriteIds = new Set(
    isFavoritesView
      ? getUserFavorites(getCurrentAccount().user?.username).map((favorite) => favorite.id)
      : [],
  );
  const listings = getSellerListings().filter((listing) => {
    const listingType = getListingType(listing);
    const config = getListingConfig(listingType);
    const matchesType = selectedType === 'all' || listingType === selectedType;
    const matchesGame = selectedGame === 'all' || listing.game === selectedGame;
    const haystack = [listing.game, getListingTitle(listing), listing.description, config.searchTerms].join(' ').toLowerCase();
    const matchesFavorites = !isFavoritesView || favoriteIds.has(getFavoriteId(listing));

    return matchesType && matchesGame && matchesFavorites && (!query || haystack.includes(query));
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
  const config = getListingConfig(listing);

  return {
    id: getFavoriteId(listing),
    type: 'product',
    listingId: listing.id || '',
    search: [listing.game, getListingTitle(listing), listing.description, config.searchTerms].join(' ').toLowerCase(),
    title: getListingTitle(listing),
    description: listing.description || '',
    seller: getListingSellerName(listing),
    price: formatListingPrice(listing.price),
    tag: `${listing.game || 'Marketplace'} ${config.label}`,
    savedAt: new Date().toISOString(),
  };
}

function createMarketplaceCard(listing) {
  const config = getListingConfig(listing);
  const card = document.createElement('article');
  card.className = 'marketplace-card';
  card.dataset.listingId = listing.id;

  const top = document.createElement('div');
  top.className = 'marketplace-card-top';

  const tag = document.createElement('span');
  tag.className = `service-tag ${config.tagClass}`;
  tag.textContent = config.tagLabel;

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
  title.textContent = getListingTitle(listing);

  const description = document.createElement('p');
  description.textContent = listing.description;

  const meta = document.createElement('div');
  meta.className = 'marketplace-card-meta';

  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-blue';
  avatar.textContent = getGameInitials(listing.game);

  const account = document.createElement('span');
  account.textContent = `${listing.game || 'Marketplace'} / ${getListingSellerName(listing)}`;

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = config.actionLabel;
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
  updateSellerTypeFields();
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
    updateSellerTypeFields();
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
sellerProductType?.addEventListener('change', updateSellerTypeFields);

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

sellerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const game = sellerGame?.value.trim() || '';
  const listingType = sellerProductType?.value === 'skin' ? 'skin' : 'account';
  const config = getListingConfig(listingType);
  const titleValue = sellerTitle?.value.trim() || '';
  const title = titleValue || `${game} ${config.label}`;
  const price = Number(sellerPrice?.value);
  const description = sellerDescription?.value.trim() || '';

  if (!game || !description || !Number.isFinite(price) || price <= 0) {
    setSellerStatus('error', 'Please choose a game, price and description.');
    return;
  }

  if (listingType === 'skin' && !titleValue) {
    setSellerStatus('error', 'Please write the skin name.');
    return;
  }

  let imageData = '';

  try {
    imageData = await readSellerImageData();
  } catch {
    setSellerStatus('error', 'Could not read the product image.');
    return;
  }

  const sellerUser = getCurrentAccount().user;
  const listing = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    listingType,
    game,
    title,
    price,
    description,
    imageData,
    imageName: sellerImage?.files?.[0]?.name || '',
    sellerUsername: sellerUser?.username || '',
    sellerName: sellerUser ? getDisplayName(sellerUser) : `${game} ${config.sellerNoun}`,
    createdAt: new Date().toISOString(),
  };

  saveSellerListings([...getSellerListings(), listing]);
  closeSellerModal({ resetForm: true });
  renderMarketplace();
});

searchInput?.addEventListener('input', renderMarketplace);
productTypeFilter?.addEventListener('change', renderMarketplace);
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
applyInitialFilters();
updateSellerTypeFields();
renderOnlineCount();
renderProfile();
applyInitialHash();
renderMarketplace();
