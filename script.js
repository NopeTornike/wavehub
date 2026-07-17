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
const sellerAccountStatus = document.getElementById('sellerAccountStatus');
const sellerAccountLevel = document.getElementById('sellerAccountLevel');
const sellerAccountViews = document.getElementById('sellerAccountViews');
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

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const sellerListingsKey = 'wavehub.sellerListings';
const favoritesKey = 'wavehub.favorites';
const priceOffersKey = 'wavehub.priceOffers';
const coachingSessionsKey = 'wavehub.cart';
const minOnlineCount = 2;
const maxOnlineCount = 23;
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
  const sellerUser = getUserByUsername(listing.sellerUsername);
  return sellerUser ? getDisplayName(sellerUser) : listing.sellerName || `${listing.game} ${config.sellerNoun}`;
}

function formatAccountStatus(value) {
  const status = String(value || 'basic').trim().toLowerCase();
  const labels = {
    basic: 'Basic Account',
    'full-collection': 'Full Collection Account',
    fullcollection: 'Full Collection Account',
    og: 'OG Account',
    premium: 'Premium Account',
    ranked: 'Ranked Account',
    rare: 'Rare Account',
    elite: 'Elite Account',
  };

  return labels[status] || 'Basic Account';
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

function readImageFileData(file) {
  if (!file || !file.type.startsWith('image/')) {
    return Promise.resolve('');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const image = new Image();

      image.addEventListener('load', () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context?.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.76));
      });

      image.addEventListener('error', () => reject(new Error('Image could not be loaded.')));
      image.src = String(reader.result || '');
    });

    reader.addEventListener('error', () => reject(new Error('Image could not be read.')));
    reader.readAsDataURL(file);
  });
}

function readSellerImageData() {
  const files = Array.from(sellerImage?.files || []).filter((file) => file.type.startsWith('image/')).slice(0, 6);

  if (!files.length) {
    return Promise.resolve([]);
  }

  return Promise.all(files.map(readImageFileData)).then((items) => items.filter(Boolean));
}

function getCurrentAccount() {
  const session = readJson(sessionKey, null);
  const users = readJson(localUsersKey, []);
  const sessionUser = session?.user || null;
  const storedUser = users.find((user) => user.username === sessionUser?.username);
  const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

  return { session, user };
}

function getUserByUsername(username) {
  if (!username) {
    return null;
  }

  const users = readJson(localUsersKey, []);
  return Array.isArray(users) ? users.find((user) => user.username === username) || null : null;
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
  const isAccount = config.type === 'account';

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

  document.querySelectorAll('.seller-account-field').forEach((field) => {
    field.hidden = !isAccount;
  });
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
      clone.setAttribute('tabindex', '-1');
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
  const normalizeGameKey = (value) => {
    const game = String(value || '').trim().toLowerCase();
    return game === 'cod mobile' || game === 'call of duty mobile' ? 'call of duty' : game;
  };

  const coachingSessions = readJson(coachingSessionsKey, []);
  const coachesByGame = (Array.isArray(coachingSessions) ? coachingSessions : []).reduce((groups, session) => {
    if (session?.productType !== 'Coaching' || session.isActive === false || session.status === 'inactive') {
      return groups;
    }

    const gameKey = normalizeGameKey(session.game);
    const coachIdentity = session.seller || session.listingId || '';

    if (!gameKey || !coachIdentity) {
      return groups;
    }

    const group = groups[gameKey] || { coaches: new Set(), sessions: 0 };
    group.coaches.add(String(coachIdentity).trim().toLowerCase());
    group.sessions += 1;
    groups[gameKey] = group;
    return groups;
  }, {});

  const countsByGame = getSellerListings().reduce((counts, listing) => {
    const game = listing.game || '';

    if (!game || listing.isActive === false || listing.status === 'inactive') {
      return counts;
    }

    const type = getListingType(listing);
    const gameCounts = counts[game] || { account: 0, skin: 0, players: new Set() };
    gameCounts[type] += 1;

    const playerIdentity = listing.sellerUsername || listing.sellerName || '';
    if (playerIdentity) {
      gameCounts.players.add(String(playerIdentity).trim().toLowerCase());
    }

    counts[game] = gameCounts;

    return counts;
  }, {});

  document.querySelectorAll('.game-card:not(.carousel-clone)').forEach((card, index) => {
    const game = card.dataset.game || card.querySelector('h3')?.textContent?.trim() || '';
    const counts = countsByGame[game] || { account: 0, skin: 0, players: new Set() };
    const stats = card.querySelector('.game-listing-counts');
    const cover = card.querySelector('.game-cover');

    card.dataset.gameUrl = `marketplace.html?game=${encodeURIComponent(game)}`;
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${game} marketplace`);

    if (cover && !cover.querySelector('.game-trend-badge')) {
      const badges = [
        ['hot', 'Hot'],
        ['trending', 'Trending'],
        ['new', 'New'],
        ['popular', 'Popular'],
      ];
      const [badgeType, badgeLabel] = badges[index % badges.length];
      const badge = document.createElement('span');
      badge.className = `game-trend-badge ${badgeType}`;
      badge.textContent = badgeLabel;
      cover.appendChild(badge);
    }

    if (!stats) {
      return;
    }

    stats.innerHTML = '';

    const total = counts.account + counts.skin;
    const coachingStats = coachesByGame[normalizeGameKey(game)];
    const coachCount = coachingStats?.coaches.size || 0;
    const coachingSessionCount = coachingStats?.sessions || 0;
    const activeServiceCount = total + coachingSessionCount;
    const statItems = [
      { icon: 'players', value: counts.players.size, label: 'Players Active' },
      { icon: 'coaches', value: coachCount, label: 'Coaches' },
      { icon: 'listings', value: total, label: 'Listings' },
      { icon: 'services', value: activeServiceCount, label: 'Active Services' },
    ];

    statItems.forEach((item) => {
      const stat = document.createElement('span');
      stat.className = `game-stat game-stat-${item.icon}`;

      const icon = document.createElement('i');
      icon.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('span');
      const value = document.createElement('strong');
      const label = document.createElement('small');
      value.textContent = String(item.value);
      label.textContent = item.label;
      copy.append(value, label);
      stat.append(icon, copy);
      stats.appendChild(stat);
    });
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
  tag.textContent = config.type === 'account' && listing.accountStatus
    ? formatAccountStatus(listing.accountStatus)
    : config.tagLabel;

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
  const sellerUser = getUserByUsername(listing.sellerUsername);
  const sellerPhoto = sellerUser?.photoData || listing.sellerAvatar || '';

  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-blue';
  if (sellerPhoto) {
    avatar.classList.add('avatar-image');
    avatar.style.backgroundImage = `url("${sellerPhoto}")`;
  } else {
    avatar.textContent = getGameInitials(listing.game);
  }

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

  let galleryImages = [];

  try {
    galleryImages = await readSellerImageData();
  } catch {
    setSellerStatus('error', 'Could not read the product image.');
    return;
  }

  const sellerUser = getCurrentAccount().user;
  const accountStatus = sellerAccountStatus?.value || 'basic';
  const accountLevel = Number(sellerAccountLevel?.value) || '';
  const accountViews = Number(sellerAccountViews?.value) || '';
  const listing = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    listingType,
    game,
    title,
    price,
    description,
    imageData: galleryImages[0] || '',
    galleryImages,
    imageName: sellerImage?.files?.[0]?.name || '',
    accountStatus: listingType === 'account' ? accountStatus : '',
    accountLevel: listingType === 'account' ? accountLevel : '',
    accountViews: listingType === 'account' ? accountViews : '',
    sellerUsername: sellerUser?.username || '',
    sellerName: sellerUser ? getDisplayName(sellerUser) : `${game} ${config.sellerNoun}`,
    sellerAvatar: sellerUser?.photoData || '',
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
  const card = event.target instanceof Element ? event.target.closest('.game-card') : null;

  if (!card || event.target.closest('a, button, input, select, textarea')) {
    return;
  }

  const gameUrl = card.dataset.gameUrl;
  if (gameUrl) {
    window.location.href = gameUrl;
  }
});

document.addEventListener('keydown', (event) => {
  const card = event.target instanceof Element ? event.target.closest('.game-card:not(.carousel-clone)') : null;

  if (!card || (event.key !== 'Enter' && event.key !== ' ')) {
    return;
  }

  event.preventDefault();
  const gameUrl = card.dataset.gameUrl;
  if (gameUrl) {
    window.location.href = gameUrl;
  }
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

  if (event.key === coachingSessionsKey) {
    renderGameListingCounts();
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
