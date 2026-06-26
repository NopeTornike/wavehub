const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const searchInput = document.getElementById('marketSearch');
const sideLinks = document.querySelectorAll('.side-link');
const carousels = document.querySelectorAll('[data-carousel]');
const carouselTracks = document.querySelectorAll('[data-carousel-track]');
const serviceTrack = document.querySelector('[data-service-track]');
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

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const sellerListingsKey = 'wavehub.sellerListings';
const favoritesKey = 'wavehub.favorites';
const priceOffersKey = 'wavehub.priceOffers';
const minOnlineCount = 18;
const maxOnlineCount = 61;
const listingTypeConfig = {
  account: {
    type: 'account',
    label: 'Account',
    tagClass: 'account',
    tagLabel: 'Account',
    titleLabel: 'Account title',
    titlePlaceholder: 'PUBG Mobile Ace account',
    descriptionPlaceholder: 'Rank, skins, level, delivery details...',
    sellerNoun: 'account seller',
    searchTerms: 'account seller listing product',
    actionLabel: 'Order',
  },
  skin: {
    type: 'skin',
    label: 'Skin',
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

function setSidebarOpen(isOpen) {
  document.body.classList.toggle('sidebar-open', isOpen);

  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  }

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

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function getInitials(user) {
  const source = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'G';
  const parts = source.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]).join('').toUpperCase();
}

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.username || 'Guest account';
}

function getShortId(id) {
  if (!id) {
    return '-';
  }

  return String(id).slice(0, 8);
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

function formatCountLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
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

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (maxOnlineCount - minOnlineCount + 1)) + minOnlineCount;
  onlineCount.textContent = `${count} online`;
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

function getReceivedOfferCount(username) {
  if (!username) {
    return 0;
  }

  const offers = readJson(priceOffersKey, []);
  return Array.isArray(offers)
    ? offers.filter((offer) => offer.sellerUsername === username).length
    : 0;
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

function getCardText(card, selector) {
  return card?.querySelector(selector)?.textContent?.trim() || '';
}

function getFavoriteId(card) {
  if (!card) {
    return '';
  }

  if (card.dataset.listingId) {
    return `listing:${card.dataset.listingId}`;
  }

  const search = card.dataset.search || getCardText(card, 'h3');
  const slug = search.trim().toLowerCase().replace(/\s+/g, '-');

  return `service:${slug}`;
}

function getDetailUrl(card) {
  const favoriteId = getFavoriteId(card);
  const [kind, id] = favoriteId.split(':');

  if (!id) {
    return '';
  }

  const type = kind === 'listing' ? 'product' : 'service';
  return `detail.html?type=${type}&id=${encodeURIComponent(id)}`;
}

function getServiceFavorite(card) {
  return {
    id: getFavoriteId(card),
    type: card.dataset.listingId ? 'product' : 'service',
    listingId: card.dataset.listingId || '',
    search: card.dataset.search || '',
    title: getCardText(card, 'h3'),
    description: getCardText(card, 'p'),
    seller: getCardText(card, '.seller-row span:last-child'),
    price: getCardText(card, '.price-row strong'),
    tag: getCardText(card, '.service-tag'),
    savedAt: new Date().toISOString(),
  };
}

function setSaveButtonState(button, isSaved) {
  button.classList.toggle('saved', isSaved);
  button.textContent = '';
  button.setAttribute('aria-pressed', String(isSaved));
  button.setAttribute('aria-label', isSaved ? 'Remove from favorites' : 'Save service');
  button.title = isSaved ? 'Remove from favorites' : 'Save service';
}

function syncMatchingFavoriteButtons(favoriteId, isSaved) {
  document.querySelectorAll('.save-button').forEach((matchingButton) => {
    const matchingCard = matchingButton.closest('[data-search]');

    if (getFavoriteId(matchingCard) === favoriteId) {
      setSaveButtonState(matchingButton, isSaved);
    }
  });
}

function refreshFavoriteButtons(username = getCurrentAccount().user?.username) {
  const favoriteIds = new Set(getUserFavorites(username).map((favorite) => favorite.id));

  document.querySelectorAll('.save-button').forEach((button) => {
    const card = button.closest('[data-search]');
    setSaveButtonState(button, favoriteIds.has(getFavoriteId(card)));
  });
}

function getSearchableCards() {
  return document.querySelectorAll('[data-search]');
}

function getActiveSection() {
  return document.querySelector('.side-link.active')?.dataset.section || 'Home';
}

function setActiveSection(section) {
  sideLinks.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === section);
  });
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

  applySearchFilter();
}

function getPopularGameNames() {
  const cards = document.querySelectorAll('.game-grid .game-card:not(.carousel-clone)');
  const names = Array.from(cards)
    .map((card) => card.querySelector('h3')?.textContent?.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

function populateSellerGames() {
  if (!sellerGame) {
    return;
  }

  const currentValue = sellerGame.value;
  const games = getPopularGameNames();

  sellerGame.querySelectorAll('option:not(:first-child)').forEach((option) => option.remove());

  games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game;
    option.textContent = game;
    sellerGame.appendChild(option);
  });

  if (games.includes(currentValue)) {
    sellerGame.value = currentValue;
  }
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

function initCarousels() {
  carouselTracks.forEach((track) => {
    if (track.dataset.carouselReady === 'true') {
      return;
    }

    const cards = Array.from(track.children);

    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.classList.add('carousel-clone');
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    track.dataset.carouselReady = 'true';
  });
}

function resetCarousels() {
  carouselTracks.forEach((track) => {
    track.querySelectorAll('.carousel-clone').forEach((clone) => clone.remove());
    delete track.dataset.carouselReady;
  });
}

function refreshCarousels() {
  resetCarousels();
  initCarousels();
  applySearchFilter();
  refreshFavoriteButtons();
}

function getSellerListings() {
  const listings = readJson(sellerListingsKey, []);
  return Array.isArray(listings) ? listings : [];
}

function saveSellerListings(listings) {
  writeJson(sellerListingsKey, listings);
}

function renderGameListingCounts() {
  const countsByGame = getSellerListings().reduce((counts, listing) => {
    const game = listing.game || '';

    if (!game || listing.isActive === false || listing.status === 'inactive') {
      return counts;
    }

    const type = getListingType(listing);
    const gameCounts = counts[game] || { account: 0, skin: 0 };
    gameCounts[type] += 1;
    counts[game] = gameCounts;

    return counts;
  }, {});

  document.querySelectorAll('.game-card:not(.carousel-clone)').forEach((card) => {
    const game = card.dataset.game || card.querySelector('h3')?.textContent?.trim() || '';
    const counts = countsByGame[game] || { account: 0, skin: 0 };
    const stats = card.querySelector('.game-listing-counts');

    if (!stats) {
      return;
    }

    stats.innerHTML = '';

    const accounts = document.createElement('span');
    accounts.textContent = formatCountLabel(counts.account, 'account', 'accounts');

    const skins = document.createElement('span');
    skins.textContent = formatCountLabel(counts.skin, 'skin', 'skins');

    stats.append(accounts, skins);
  });
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

function formatListingPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return '0 GEL';
  }

  return `${Number.isInteger(price) ? price : price.toFixed(2)} GEL`;
}

function createSellerListingCard(listing) {
  const config = getListingConfig(listing);
  const card = document.createElement('article');
  card.className = 'service-card seller-listing-card';
  card.dataset.search = [listing.game, getListingTitle(listing), listing.description, config.searchTerms].join(' ').toLowerCase();
  card.dataset.listingId = listing.id;

  const top = document.createElement('div');
  top.className = 'service-top';

  const tag = document.createElement('span');
  tag.className = `service-tag ${config.tagClass}`;
  tag.textContent = config.tagLabel;

  const saveButton = document.createElement('button');
  saveButton.className = 'save-button';
  saveButton.type = 'button';
  saveButton.setAttribute('aria-label', 'Save service');
  saveButton.setAttribute('aria-pressed', 'false');
  saveButton.title = 'Save service';

  top.append(tag, saveButton);

  const title = document.createElement('h3');
  title.textContent = getListingTitle(listing);

  const description = document.createElement('p');
  description.textContent = listing.description;

  const sellerRow = document.createElement('div');
  sellerRow.className = 'seller-row';

  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-blue';
  avatar.textContent = getGameInitials(listing.game);

  const seller = document.createElement('span');
  seller.textContent = getListingSellerName(listing);

  sellerRow.append(avatar, seller);

  const priceRow = document.createElement('div');
  priceRow.className = 'price-row';

  const price = document.createElement('strong');
  price.textContent = formatListingPrice(listing.price);

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = config.actionLabel;

  priceRow.append(price, action);
  card.append(top, title, description, sellerRow, priceRow);

  return card;
}

function renderSellerListings() {
  if (!serviceTrack) {
    return;
  }

  serviceTrack.querySelectorAll('.carousel-clone').forEach((clone) => clone.remove());
  serviceTrack.querySelectorAll('.seller-listing-card').forEach((card) => card.remove());

  getSellerListings().forEach((listing) => {
    serviceTrack.appendChild(createSellerListingCard(listing));
  });

  delete serviceTrack.dataset.carouselReady;
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

  populateSellerGames();
  updateSellerTypeFields();
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
    updateSellerTypeFields();
    setSellerStatus('', '');
  }
}

function applySearchFilter() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  const isFavoritesView = getActiveSection() === 'Favorites';
  const favoriteIds = new Set(
    isFavoritesView
      ? getUserFavorites(getCurrentAccount().user?.username).map((favorite) => favorite.id)
      : [],
  );

  carousels.forEach((carousel) => {
    carousel.classList.toggle('is-filtering', query.length > 0 || isFavoritesView);
  });

  getSearchableCards().forEach((card) => {
    const haystack = card.dataset.search || '';
    const matchesQuery = query.length === 0 || haystack.includes(query);
    const matchesFavorites = !isFavoritesView || favoriteIds.has(getFavoriteId(card));

    card.classList.toggle('is-hidden', !matchesQuery || !matchesFavorites);
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
    logoutButton.textContent = 'Log out';
  }

  if (authEntryActions) {
    authEntryActions.hidden = isSignedIn;
  }

  if (messageCount) {
    messageCount.textContent = String(getReceivedOfferCount(user?.username));
  }

  if (!isSignedIn && getActiveSection() === 'Favorites') {
    setActiveSection('Home');
  }

  refreshFavoriteButtons(user?.username);
  applySearchFilter();
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

profileButton?.addEventListener('click', () => {
  setProfileOpen(profileDropdown?.hidden ?? true);
});

sellerButton?.addEventListener('click', () => {
  openSellerModal();
});

sellerCloseButton?.addEventListener('click', () => {
  closeSellerModal({ resetForm: true });
});

sellerCancelButton?.addEventListener('click', () => {
  closeSellerModal({ resetForm: true });
});

sellerProductType?.addEventListener('change', updateSellerTypeFields);

sellerModal?.addEventListener('click', (event) => {
  if (event.target === sellerModal) {
    closeSellerModal({ resetForm: true });
  }
});

sellerForm?.addEventListener('submit', (event) => {
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

  const sellerUser = getCurrentAccount().user;
  const listing = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    listingType,
    game,
    title,
    price,
    description,
    sellerUsername: sellerUser?.username || '',
    sellerName: sellerUser ? getDisplayName(sellerUser) : `${game} ${config.sellerNoun}`,
    createdAt: new Date().toISOString(),
  };

  saveSellerListings([...getSellerListings(), listing]);
  renderGameListingCounts();
  renderSellerListings();
  refreshCarousels();
  closeSellerModal({ resetForm: true });
  document.getElementById('services-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

logoutButton?.addEventListener('click', () => {
  if (logoutButton.disabled) {
    return;
  }

  localStorage.removeItem(sessionKey);
  renderProfile();
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
    applySearchFilter();

    if (section === 'Favorites') {
      document.getElementById('services-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.price-row button') : null;

  if (!button) {
    return;
  }

  const card = button.closest('.service-card');
  const detailUrl = getDetailUrl(card);

  if (detailUrl) {
    window.location.href = detailUrl;
  }
});

document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.save-button') : null;

  if (!button) {
    return;
  }

  const card = button.closest('[data-search]');

  if (!card) {
    return;
  }

  const { user } = getCurrentAccount();

  if (!user?.username) {
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  const favorite = getServiceFavorite(card);
  const favorites = getUserFavorites(user.username);
  const isSaved = !favorites.some((item) => item.id === favorite.id);
  const nextFavorites = isSaved
    ? [...favorites.filter((item) => item.id !== favorite.id), favorite]
    : favorites.filter((item) => item.id !== favorite.id);

  saveUserFavorites(user.username, nextFavorites);
  syncMatchingFavoriteButtons(favorite.id, isSaved);
  applySearchFilter();
});

searchInput?.addEventListener('input', applySearchFilter);

window.addEventListener('resize', () => {
  if (window.innerWidth > 920) {
    setSidebarOpen(false);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === sessionKey || event.key === localUsersKey || event.key === favoritesKey || event.key === priceOffersKey) {
    renderProfile();
  }

  if (event.key === sellerListingsKey) {
    renderGameListingCounts();
    renderSellerListings();
    refreshCarousels();
  }
});

populateSellerGames();
updateSellerTypeFields();
renderGameListingCounts();
renderSellerListings();
initCarousels();
renderOnlineCount();
renderProfile();
applyInitialHash();
