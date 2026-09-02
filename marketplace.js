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
const sellerGameHint = document.getElementById('sellerGameHint');
const sellerGameDetailsButton = document.getElementById('sellerGameDetailsButton');
const codDetailsModal = document.getElementById('codDetailsModal');
const codDetailsClose = document.getElementById('codDetailsClose');
const codDetailsCancel = document.getElementById('codDetailsCancel');
const codDetailsSave = document.getElementById('codDetailsSave');
const codDetailInputs = {
  mpRank: document.getElementById('codMpRank'),
  brRank: document.getElementById('codBrRank'),
  cpBalance: document.getElementById('codCpBalance'),
  mythicWeapons: document.getElementById('codMythicWeapons'),
  legendaryWeapons: document.getElementById('codLegendaryWeapons'),
  operatorSkins: document.getElementById('codOperatorSkins'),
  camos: document.getElementById('codCamos'),
  blueprints: document.getElementById('codBlueprints'),
  highlights: document.getElementById('codHighlights'),
};
const sellerClashDetailsButton = document.getElementById('sellerClashDetailsButton');
const clashDetailsModal = document.getElementById('clashDetailsModal');
const clashDetailsClose = document.getElementById('clashDetailsClose');
const clashDetailsCancel = document.getElementById('clashDetailsCancel');
const clashDetailsSave = document.getElementById('clashDetailsSave');
const clashDetailInputs = {
  townHall: document.getElementById('clashTownHall'),
  heroLevels: document.getElementById('clashHeroLevels'),
  baseStatus: document.getElementById('clashBaseStatus'),
  laboratoryLevel: document.getElementById('clashLaboratoryLevel'),
  heroEquipment: document.getElementById('clashHeroEquipment'),
  rareItems: document.getElementById('clashRareItems'),
};
const sellerDotaDetailsButton = document.getElementById('sellerDotaDetailsButton');
const dotaDetailsModal = document.getElementById('dotaDetailsModal');
const dotaDetailsClose = document.getElementById('dotaDetailsClose');
const dotaDetailsCancel = document.getElementById('dotaDetailsCancel');
const dotaDetailsSave = document.getElementById('dotaDetailsSave');
const dotaDetailInputs = {
  mainRank: document.getElementById('dotaMainRank'),
  mmr: document.getElementById('dotaMmr'),
  arcanaCount: document.getElementById('dotaArcanaCount'),
  immortalCount: document.getElementById('dotaImmortalCount'),
  rareItems: document.getElementById('dotaRareItems'),
  exclusiveItems: document.getElementById('dotaExclusiveItems'),
};
const sellerFortniteDetailsButton = document.getElementById('sellerFortniteDetailsButton');
const fortniteDetailsModal = document.getElementById('fortniteDetailsModal');
const fortniteDetailsClose = document.getElementById('fortniteDetailsClose');
const fortniteDetailsCancel = document.getElementById('fortniteDetailsCancel');
const fortniteDetailsSave = document.getElementById('fortniteDetailsSave');
const fortniteDetailInputs = {
  totalSkins: document.getElementById('fortniteTotalSkins'),
  ogSkins: document.getElementById('fortniteOgSkins'),
  rareSkins: document.getElementById('fortniteRareSkins'),
  pickaxes: document.getElementById('fortnitePickaxes'),
  emotes: document.getElementById('fortniteEmotes'),
  gliders: document.getElementById('fortniteGliders'),
  vbucks: document.getElementById('fortniteVbucks'),
  highlights: document.getElementById('fortniteHighlights'),
};
const sellerGtaDetailsButton = document.getElementById('sellerGtaDetailsButton');
const gtaDetailsModal = document.getElementById('gtaDetailsModal');
const gtaDetailsClose = document.getElementById('gtaDetailsClose');
const gtaDetailsCancel = document.getElementById('gtaDetailsCancel');
const gtaDetailsSave = document.getElementById('gtaDetailsSave');
const gtaDetailInputs = {
  rank: document.getElementById('gtaRank'),
  totalMoney: document.getElementById('gtaTotalMoney'),
  totalRp: document.getElementById('gtaTotalRp'),
  unlockedLevel: document.getElementById('gtaUnlockedLevel'),
  properties: document.getElementById('gtaProperties'),
  vehicles: document.getElementById('gtaVehicles'),
  outfits: document.getElementById('gtaOutfits'),
  weaponizedVehicles: document.getElementById('gtaWeaponizedVehicles'),
  rareItems: document.getElementById('gtaRareItems'),
};
const sellerLolDetailsButton = document.getElementById('sellerLolDetailsButton');
const lolDetailsModal = document.getElementById('lolDetailsModal');
const lolDetailsClose = document.getElementById('lolDetailsClose');
const lolDetailsCancel = document.getElementById('lolDetailsCancel');
const lolDetailsSave = document.getElementById('lolDetailsSave');
const lolDetailInputs = {
  rank: document.getElementById('lolRank'),
  peakRank: document.getElementById('lolPeakRank'),
  accountLevel: document.getElementById('lolAccountLevel'),
  blueEssence: document.getElementById('lolBlueEssence'),
  skinsOwned: document.getElementById('lolSkinsOwned'),
  legendarySkins: document.getElementById('lolLegendarySkins'),
};
const sellerMlDetailsButton = document.getElementById('sellerMlDetailsButton');
const mlDetailsModal = document.getElementById('mlDetailsModal');
const mlDetailsClose = document.getElementById('mlDetailsClose');
const mlDetailsCancel = document.getElementById('mlDetailsCancel');
const mlDetailsSave = document.getElementById('mlDetailsSave');
const mlDetailInputs = {
  currentRank: document.getElementById('mlCurrentRank'),
  highestRank: document.getElementById('mlHighestRank'),
  heroesOwned: document.getElementById('mlHeroesOwned'),
  totalSkins: document.getElementById('mlTotalSkins'),
  legendSkins: document.getElementById('mlLegendSkins'),
  collectorSkins: document.getElementById('mlCollectorSkins'),
  zodiacSkins: document.getElementById('mlZodiacSkins'),
  highlights: document.getElementById('mlHighlights'),
};
const sellerPubgDetailsButton = document.getElementById('sellerPubgDetailsButton');
const pubgDetailsModal = document.getElementById('pubgDetailsModal');
const pubgDetailsClose = document.getElementById('pubgDetailsClose');
const pubgDetailsCancel = document.getElementById('pubgDetailsCancel');
const pubgDetailsSave = document.getElementById('pubgDetailsSave');
const pubgDetailInputs = {
  currentTier: document.getElementById('pubgCurrentTier'),
  highestTier: document.getElementById('pubgHighestTier'),
  royalePass: document.getElementById('pubgRoyalePass'),
  ucBalance: document.getElementById('pubgUcBalance'),
  xSuits: document.getElementById('pubgXSuits'),
  mythicOutfits: document.getElementById('pubgMythicOutfits'),
  gunSkins: document.getElementById('pubgGunSkins'),
  upgradableSkins: document.getElementById('pubgUpgradableSkins'),
  vehicleSkins: document.getElementById('pubgVehicleSkins'),
  highlights: document.getElementById('pubgHighlights'),
};
const sellerRobloxDetailsButton = document.getElementById('sellerRobloxDetailsButton');
const robloxDetailsModal = document.getElementById('robloxDetailsModal');
const robloxDetailsClose = document.getElementById('robloxDetailsClose');
const robloxDetailsCancel = document.getElementById('robloxDetailsCancel');
const robloxDetailsSave = document.getElementById('robloxDetailsSave');
const robloxDetailInputs = {
  robux: document.getElementById('robloxRobux'),
  limitedsCount: document.getElementById('robloxLimitedsCount'),
  rapValue: document.getElementById('robloxRapValue'),
  premium: document.getElementById('robloxPremium'),
  accountAge: document.getElementById('robloxAccountAge'),
  totalSpending: document.getElementById('robloxTotalSpending'),
  topItems: document.getElementById('robloxTopItems'),
  rareItems: document.getElementById('robloxRareItems'),
};
const sellerTitleLabel = document.getElementById('sellerTitleLabel');
const sellerTitle = document.getElementById('sellerTitle');
const sellerPlatform = document.getElementById('sellerPlatform');
const sellerRegion = document.getElementById('sellerRegion');
const sellerAccountStatus = document.getElementById('sellerAccountStatus');
const sellerAccountLevel = document.getElementById('sellerAccountLevel');
const sellerLoginMethod = document.getElementById('sellerLoginMethod');
const sellerEmailChangeable = document.getElementById('sellerEmailChangeable');
const sellerLinkedAccounts = document.getElementById('sellerLinkedAccounts');
const sellerFullAccess = document.getElementById('sellerFullAccess');
const sellerOriginalEmail = document.getElementById('sellerOriginalEmail');
const sellerTwoFactor = document.getElementById('sellerTwoFactor');
const sellerDeliveryMethod = document.getElementById('sellerDeliveryMethod');
const sellerDeliveryTime = document.getElementById('sellerDeliveryTime');
const sellerPrice = document.getElementById('sellerPrice');
const sellerImage = document.getElementById('sellerImage');
const sellerDropzone = document.querySelector('.listing-image-dropzone');
const sellerImageCount = document.getElementById('sellerImageCount');
const sellerImagePreviews = document.getElementById('sellerImagePreviews');
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
const cartButton = document.getElementById('cartButton');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
let sellerSelectedFiles = [];
let sellerPreviewUrls = [];
let codGameDetails = {};
let clashGameDetails = {};
let dotaGameDetails = {};
let fortniteGameDetails = {};
let gtaGameDetails = {};
let lolGameDetails = {};
let mlGameDetails = {};
let pubgGameDetails = {};
let robloxGameDetails = {};

const sellerListingsKey = 'wavehub.sellerListings';
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const favoritesKey = 'wavehub.favorites';
const cartKey = 'wavehub.cart';

const games = [
  'Call of Duty',
  'Mobile Legends',
  'CS2',
  'PUBG Mobile',
  'Roblox',
  'Clash of Clans',
  'League of Legends',
  'Fortnite',
  'Minecraft',
  'GTA 5',
  'Dota 2',
  'Valorant',
  'Standoff 2',
];
const accountTypeImages = {
  basic: 'assets/basic-account.png',
  'full-collection': 'assets/full-collection-account.png',
  fullcollection: 'assets/full-collection-account.png',
  og: 'assets/og-account.png',
  premium: 'assets/premium-account.png',
  ranked: 'assets/ranked-account.png',
  rare: 'assets/rare-account.png',
};
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
  const files = sellerSelectedFiles.slice(0, 6);

  if (!files.length) {
    return Promise.resolve([]);
  }

  return Promise.all(files.map(readImageFileData)).then((items) => items.filter(Boolean));
}

function getFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function addSellerImageFiles(fileList) {
  const incoming = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  const selectedKeys = new Set(sellerSelectedFiles.map(getFileKey));
  incoming.forEach((file) => {
    const key = getFileKey(file);
    if (sellerSelectedFiles.length < 6 && !selectedKeys.has(key)) {
      sellerSelectedFiles.push(file);
      selectedKeys.add(key);
    }
  });
  renderSellerImagePreviews();
  setSellerStatus('', sellerSelectedFiles.length === 6 ? 'Maximum 6 photos selected.' : '');
}

function clearSellerPreviewUrls() {
  sellerPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  sellerPreviewUrls = [];
}

function renderSellerImagePreviews() {
  clearSellerPreviewUrls();
  if (sellerImageCount) sellerImageCount.textContent = `${sellerSelectedFiles.length} / 6 photos`;
  if (!sellerImagePreviews) return;
  sellerImagePreviews.innerHTML = '';

  sellerSelectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    sellerPreviewUrls.push(url);
    const preview = document.createElement('span');
    preview.className = 'seller-image-preview';
    preview.style.backgroundImage = `url("${url}")`;
    preview.innerHTML = `${index === 0 ? '<em>Cover</em>' : ''}<button type="button" data-remove-seller-image="${index}" aria-label="Remove ${file.name}">×</button>`;
    sellerImagePreviews.appendChild(preview);
  });
}

function resetSellerImages() {
  sellerSelectedFiles = [];
  if (sellerImage) sellerImage.value = '';
  renderSellerImagePreviews();
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

function getFavoriteId(listing) {
  return listing?.id ? `listing:${listing.id}` : '';
}

function getDetailUrl(listing) {
  return listing?.id ? `detail.html?type=product&id=${encodeURIComponent(listing.id)}` : '';
}

function getPublicProfileUrl(username) {
  return username ? `profile.html?user=${encodeURIComponent(username)}` : '';
}

function getCartItems() {
  const cartItems = readJson(cartKey, []);
  return Array.isArray(cartItems) ? cartItems : [];
}

function saveCartItems(items) {
  writeJson(cartKey, items);
}

function getCartItem(listing) {
  const config = getListingConfig(listing);

  return {
    id: getFavoriteId(listing),
    listingId: listing.id || '',
    title: getListingTitle(listing),
    productType: config.label,
    game: listing.game || 'Marketplace',
    seller: getListingSellerName(listing),
    sellerUsername: listing.sellerUsername || '',
    price: Number(listing.price) || 0,
    priceText: formatListingPrice(listing.price),
    imageData: getMarketplaceCardImage(listing, config),
    detailUrl: getDetailUrl(listing),
    addedAt: new Date().toISOString(),
  };
}

function getCartTotal(items = getCartItems()) {
  return items.reduce((total, item) => total + (Number(item.price) || 0), 0);
}

function addListingToCart(listing) {
  const item = getCartItem(listing);
  const items = getCartItems();
  const exists = items.some((cartItem) => cartItem.id === item.id);
  const nextItems = exists
    ? items.map((cartItem) => (cartItem.id === item.id ? { ...cartItem, ...item, addedAt: cartItem.addedAt } : cartItem))
    : [...items, item];

  saveCartItems(nextItems);
  return !exists;
}

function removeCartItem(id) {
  saveCartItems(getCartItems().filter((item) => item.id !== id));
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

function toggleProductFavorite(listing, username) {
  const favorite = getProductFavorite(listing);
  const favorites = getUserFavorites(username);
  const wasSaved = favorites.some((item) => item.id === favorite.id);
  const nextFavorites = wasSaved
    ? favorites.filter((item) => item.id !== favorite.id)
    : [...favorites.filter((item) => item.id !== favorite.id), favorite];

  saveUserFavorites(username, nextFavorites);
  return !wasSaved;
}

function getFavoriteCount(favoriteId) {
  if (!favoriteId) {
    return 0;
  }

  const favoritesByUser = readJson(favoritesKey, {});
  const source = favoritesByUser && typeof favoritesByUser === 'object' && !Array.isArray(favoritesByUser)
    ? favoritesByUser
    : {};

  return Object.values(source).reduce((count, favorites) => (
    count + (Array.isArray(favorites) && favorites.some((favorite) => favorite.id === favoriteId) ? 1 : 0)
  ), 0);
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

function normalizeAccountStatus(value) {
  const status = String(value || 'basic').trim().toLowerCase();

  return status === 'fullcollection' ? 'full-collection' : status;
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
  const status = normalizeAccountStatus(value);
  const labels = {
    basic: 'Basic Account',
    'full-collection': 'Full Collection Account',
    og: 'OG Account',
    premium: 'Premium Account',
    ranked: 'Ranked Account',
    rare: 'Rare Account',
    elite: 'Elite Account',
  };

  return labels[status] || 'Basic Account';
}

function getAccountTypeImage(value) {
  const status = normalizeAccountStatus(value);
  return accountTypeImages[status] || '';
}

function getAccountStatusClass(value) {
  return `account-status-${normalizeAccountStatus(value)}`;
}

function formatCount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value || '0');
  }

  return number.toLocaleString('en-US');
}

function getCardLevel(listing) {
  return Number(listing.accountLevel) || '';
}

function getCardViews(listing) {
  return Number(listing.accountViews) || 0;
}

function getCardLikes(listing) {
  return getFavoriteCount(getFavoriteId(listing));
}

function getCardScore(listing) {
  return getFavoriteCount(getFavoriteId(listing));
}

function getMarketplaceProductReviewStats(listingId) {
  if (!listingId) return { rating: null, count: 0 };
  const reviews = readJson('wavehub.sellerReviews', []);
  const matching = Array.isArray(reviews)
    ? reviews.filter((review) => String(review.listingId || '') === String(listingId))
    : [];
  if (!matching.length) return { rating: null, count: 0 };
  return {
    rating: matching.reduce((total, review) => total + (Number(review.rating) || 0), 0) / matching.length,
    count: matching.length,
  };
}

function getMarketplaceSellerPreviewData(username) {
  const reviewsSource = readJson('wavehub.sellerReviews', []);
  const reviews = (Array.isArray(reviewsSource) ? reviewsSource : [])
    .filter((review) => String(review.sellerUsername || '').toLowerCase() === String(username || '').toLowerCase())
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const purchases = readJson('wavehub.purchases', []);
  const completedSales = (Array.isArray(purchases) ? purchases : []).filter((purchase) => {
    const status = String(purchase?.status || '').toLowerCase();
    return ['completed', 'complete', 'delivered', 'fulfilled'].includes(status)
      && Array.isArray(purchase.items)
      && purchase.items.some((item) => String(item.sellerUsername || '').toLowerCase() === String(username || '').toLowerCase());
  }).length;
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length
    : null;
  return {
    reviews: reviews.map((review) => {
      const buyer = getUserByUsername(review.buyerUsername);
      const name = review.buyerName || (buyer ? getDisplayName(buyer) : '') || review.buyerUsername || 'WaveHub member';
      return {
        name,
        username: review.buyerUsername || '',
        initials: buyer ? getInitials(buyer) : getGameInitials(name),
        photo: buyer?.photoData || '',
        rating: review.rating,
        comment: review.comment || '',
        createdAt: review.createdAt || '',
      };
    }),
    average,
    completedSales,
  };
}

function getMarketplaceSellerWaveRank(username) {
  if (!username) return null;

  const users = readJson(localUsersKey, []);
  const listings = getSellerListings();
  const reviews = readJson('wavehub.sellerReviews', []);
  const purchases = readJson('wavehub.purchases', []);
  const soldItems = Array.isArray(purchases)
    ? purchases.flatMap((purchase) => (Array.isArray(purchase.items) ? purchase.items : []))
    : [];
  const usernames = new Set([
    ...(Array.isArray(users) ? users.map((user) => user.username) : []),
    ...listings.map((listing) => listing.sellerUsername),
  ].filter(Boolean));

  const rankedSellers = [...usernames]
    .map((sellerUsername) => {
      const sellerListings = listings.filter((listing) => listing.sellerUsername === sellerUsername);
      const listingIds = new Set(sellerListings.map((listing) => String(listing.id || '')));
      const sellerReviews = Array.isArray(reviews)
        ? reviews.filter((review) => review.sellerUsername === sellerUsername)
        : [];
      const orders = soldItems.filter((item) => (
        item.sellerUsername === sellerUsername
        || (item.listingId && listingIds.has(String(item.listingId)))
      )).length;
      const rating = sellerReviews.length
        ? sellerReviews.reduce((total, review) => total + (Number(review.rating) || 0), 0) / sellerReviews.length
        : 0;

      return {
        username: sellerUsername,
        orders,
        reviews: sellerReviews.length,
        listings: sellerListings.length,
        rating,
      };
    })
    .filter((seller) => seller.orders || seller.reviews || seller.listings)
    .sort((a, b) => (
      b.orders - a.orders
      || b.reviews - a.reviews
      || b.listings - a.listings
      || b.rating - a.rating
      || a.username.localeCompare(b.username)
    ));
  const rankIndex = rankedSellers.findIndex((seller) => seller.username === username);

  return rankIndex < 0 ? null : rankIndex + 1;
}

function getMarketplaceCardImage(listing, config) {
  if (listing.game === 'Call of Duty') {
    return 'assets/call-of-duty-marketplace-photo.png';
  }

  if (listing.game === 'CS2') {
    return 'assets/cs2-marketplace-cover.png';
  }

  if (listing.game === 'Dota 2') {
    return 'assets/dota-2-marketplace-cover.png';
  }

  if (listing.game === 'Fortnite') {
    return 'assets/fortnite-marketplace-cover.png';
  }

  if (listing.game === 'Minecraft') {
    return 'assets/minecraft-marketplace-cover.png';
  }

  if (listing.game === 'GTA 5') {
    return 'assets/gta-5-marketplace-cover.png';
  }

  if (listing.game === 'Valorant') {
    return 'assets/valorant-marketplace-cover.png';
  }

  if (listing.game === 'League of Legends') {
    return 'assets/league-of-legends-marketplace-cover.png';
  }

  if (listing.game === 'Clash of Clans') {
    return 'assets/clash-of-clans-marketplace-cover.png';
  }

  if (listing.game === 'Roblox') {
    return 'assets/roblox-marketplace-cover.png';
  }

  if (listing.game === 'PUBG Mobile') {
    return 'assets/pubg-mobile-marketplace-cover.png';
  }

  if (listing.game === 'Mobile Legends') {
    return 'assets/mobile-legends-marketplace-cover.png';
  }

  if (listing.game === 'Standoff 2') {
    return 'assets/home-game-standoff2.png';
  }

  if (config.type === 'account') {
    return getAccountTypeImage(listing.accountStatus) || listing.imageData || '';
  }

  return listing.imageData || '';
}

function getProductStats(listing, config) {
  if (config.type === 'skin') {
    return [
      { symbol: '#', value: '1', label: 'Skin Item' },
      { symbol: 'G', value: listing.game || '-', label: 'Game' },
      { symbol: 'W', value: 'Instant', label: 'Delivery' },
    ];
  }

  return [
    { symbol: 'LV', value: getCardLevel(listing) ? formatCount(getCardLevel(listing)) : '-', label: 'Level' },
    { symbol: 'V', value: formatCount(getCardViews(listing)), label: 'Views' },
  ];
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

  if (!isSignedIn && getActiveSection() === 'Favorites') {
    setActiveSection('Marketplace');
  }
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (23 - 2 + 1)) + 2;
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
  const isAccount = config.type === 'account';

  if (sellerTitleLabel) {
    sellerTitleLabel.textContent = config.titleLabel;
  }

  if (sellerTitle) {
    sellerTitle.placeholder = config.titlePlaceholder;
    sellerTitle.required = true;
  }

  if (sellerDescription) {
    sellerDescription.placeholder = config.descriptionPlaceholder;
  }

  document.querySelectorAll('.seller-account-field').forEach((field) => {
    field.hidden = !isAccount;
  });

  if (sellerAccountLevel) {
    sellerAccountLevel.required = isAccount;
    sellerAccountLevel.disabled = !isAccount;
  }

  if (sellerAccountStatus) {
    sellerAccountStatus.disabled = !isAccount;
  }

  [sellerLoginMethod, sellerEmailChangeable, sellerFullAccess, sellerOriginalEmail, sellerTwoFactor, sellerDeliveryMethod, sellerDeliveryTime].forEach((field) => {
    if (!field) return;
    field.required = isAccount;
    field.disabled = !isAccount;
  });
}

function updateSellerGameHint() {
  if (!sellerGameHint) return;
  const game = sellerGame?.value || '';
  const isCallOfDuty = isCallOfDutyGame(game);
  const isClashOfClans = isClashOfClansGame(game);
  const isDota2 = isDota2Game(game);
  const isFortnite = isFortniteGame(game);
  const isGta5 = isGta5Game(game);
  const isLeagueOfLegends = isLeagueOfLegendsGame(game);
  const isMobileLegends = isMobileLegendsGame(game);
  const isPubgMobile = isPubgMobileGame(game);
  const isRoblox = isRobloxGame(game);
  sellerGameHint.textContent = isCallOfDuty
    ? 'Call of Duty selected — add the optional rank, weapon and inventory details.'
    : isClashOfClans
      ? 'Clash of Clans selected — add the optional Town Hall, hero and base details.'
    : isDota2
      ? 'Dota 2 selected — add the optional rank, MMR and item details.'
    : isFortnite
      ? 'Fortnite selected — add the optional skins, cosmetics and V-Bucks details.'
    : isGta5
      ? 'GTA 5 selected — add the optional rank, money, property and vehicle details.'
    : isLeagueOfLegends
      ? 'League of Legends selected — add the optional rank, level, essence and skin details.'
    : isMobileLegends
      ? 'Mobile Legends selected — add the optional rank, hero and skin details.'
    : isPubgMobile
      ? 'PUBG Mobile selected — add the optional tier, Royale Pass, UC and skin details.'
    : isRoblox
      ? 'Roblox selected — add the optional Robux, Limiteds, account and item details.'
    : game
      ? `${game} selected — add accurate platform, region, level and delivery information.`
    : 'Game-specific details will appear after selecting a game.';
  sellerGameHint.classList.toggle('ready', Boolean(game));

  if (sellerGameDetailsButton) {
    sellerGameDetailsButton.hidden = !isCallOfDuty;
    sellerGameDetailsButton.textContent = hasCodGameDetails() ? 'Edit Call of Duty Details' : 'Add Call of Duty Details';
  }

  if (sellerClashDetailsButton) {
    sellerClashDetailsButton.hidden = !isClashOfClans;
    sellerClashDetailsButton.textContent = hasClashGameDetails() ? 'Edit Clash of Clans Details' : 'Add Clash of Clans Details';
  }

  if (sellerDotaDetailsButton) {
    sellerDotaDetailsButton.hidden = !isDota2;
    sellerDotaDetailsButton.textContent = hasDotaGameDetails() ? 'Edit Dota 2 Details' : 'Add Dota 2 Details';
  }

  if (sellerFortniteDetailsButton) {
    sellerFortniteDetailsButton.hidden = !isFortnite;
    sellerFortniteDetailsButton.textContent = hasFortniteGameDetails() ? 'Edit Fortnite Details' : 'Add Fortnite Details';
  }

  if (sellerGtaDetailsButton) {
    sellerGtaDetailsButton.hidden = !isGta5;
    sellerGtaDetailsButton.textContent = hasGtaGameDetails() ? 'Edit GTA 5 Details' : 'Add GTA 5 Details';
  }

  if (sellerLolDetailsButton) {
    sellerLolDetailsButton.hidden = !isLeagueOfLegends;
    sellerLolDetailsButton.textContent = hasLolGameDetails() ? 'Edit League of Legends Details' : 'Add League of Legends Details';
  }

  if (sellerMlDetailsButton) {
    sellerMlDetailsButton.hidden = !isMobileLegends;
    sellerMlDetailsButton.textContent = hasMlGameDetails() ? 'Edit Mobile Legends Details' : 'Add Mobile Legends Details';
  }

  if (sellerPubgDetailsButton) {
    sellerPubgDetailsButton.hidden = !isPubgMobile;
    sellerPubgDetailsButton.textContent = hasPubgGameDetails() ? 'Edit PUBG Mobile Details' : 'Add PUBG Mobile Details';
  }

  if (sellerRobloxDetailsButton) {
    sellerRobloxDetailsButton.hidden = !isRoblox;
    sellerRobloxDetailsButton.textContent = hasRobloxGameDetails() ? 'Edit Roblox Details' : 'Add Roblox Details';
  }
}

function isCallOfDutyGame(game = sellerGame?.value || '') {
  return ['call of duty', 'call of duty mobile', 'cod mobile'].includes(String(game).trim().toLowerCase());
}

function isClashOfClansGame(game = sellerGame?.value || '') {
  return String(game).trim().toLowerCase() === 'clash of clans';
}

function isDota2Game(game = sellerGame?.value || '') {
  return ['dota 2', 'dota2'].includes(String(game).trim().toLowerCase());
}

function isFortniteGame(game = sellerGame?.value || '') {
  return String(game).trim().toLowerCase() === 'fortnite';
}

function isGta5Game(game = sellerGame?.value || '') {
  return ['gta 5', 'gta v', 'grand theft auto v'].includes(String(game).trim().toLowerCase());
}

function isLeagueOfLegendsGame(game = sellerGame?.value || '') {
  return ['league of legends', 'lol'].includes(String(game).trim().toLowerCase());
}

function isMobileLegendsGame(game = sellerGame?.value || '') {
  return ['mobile legends', 'mobile legends: bang bang', 'mlbb'].includes(String(game).trim().toLowerCase());
}

function isPubgMobileGame(game = sellerGame?.value || '') {
  return ['pubg mobile', 'pubg'].includes(String(game).trim().toLowerCase());
}

function isRobloxGame(game = sellerGame?.value || '') {
  return String(game).trim().toLowerCase() === 'roblox';
}

function readCodGameDetails() {
  return Object.fromEntries(
    Object.entries(codDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeCodGameDetails(details = {}) {
  Object.entries(codDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasCodGameDetails(details = codGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setCodDetailsOpen(open) {
  if (!codDetailsModal) return;
  codDetailsModal.hidden = !open;
  if (open) {
    writeCodGameDetails(codGameDetails);
    codDetailInputs.mpRank?.focus();
  }
}

function saveCodGameDetails() {
  codGameDetails = readCodGameDetails();
  setCodDetailsOpen(false);
  updateSellerGameHint();
}

function discardCodGameDetails() {
  writeCodGameDetails(codGameDetails);
  setCodDetailsOpen(false);
}

function readClashGameDetails() {
  return Object.fromEntries(
    Object.entries(clashDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeClashGameDetails(details = {}) {
  Object.entries(clashDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasClashGameDetails(details = clashGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setClashDetailsOpen(open) {
  if (!clashDetailsModal) return;
  clashDetailsModal.hidden = !open;
  if (open) {
    writeClashGameDetails(clashGameDetails);
    clashDetailInputs.townHall?.focus();
  }
}

function saveClashGameDetails() {
  clashGameDetails = readClashGameDetails();
  setClashDetailsOpen(false);
  updateSellerGameHint();
}

function discardClashGameDetails() {
  writeClashGameDetails(clashGameDetails);
  setClashDetailsOpen(false);
}

function readDotaGameDetails() {
  return Object.fromEntries(
    Object.entries(dotaDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeDotaGameDetails(details = {}) {
  Object.entries(dotaDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasDotaGameDetails(details = dotaGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setDotaDetailsOpen(open) {
  if (!dotaDetailsModal) return;
  dotaDetailsModal.hidden = !open;
  if (open) {
    writeDotaGameDetails(dotaGameDetails);
    dotaDetailInputs.mainRank?.focus();
  }
}

function saveDotaGameDetails() {
  dotaGameDetails = readDotaGameDetails();
  setDotaDetailsOpen(false);
  updateSellerGameHint();
}

function discardDotaGameDetails() {
  writeDotaGameDetails(dotaGameDetails);
  setDotaDetailsOpen(false);
}

function readFortniteGameDetails() {
  return Object.fromEntries(
    Object.entries(fortniteDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeFortniteGameDetails(details = {}) {
  Object.entries(fortniteDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasFortniteGameDetails(details = fortniteGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setFortniteDetailsOpen(open) {
  if (!fortniteDetailsModal) return;
  fortniteDetailsModal.hidden = !open;
  if (open) {
    writeFortniteGameDetails(fortniteGameDetails);
    fortniteDetailInputs.totalSkins?.focus();
  }
}

function saveFortniteGameDetails() {
  fortniteGameDetails = readFortniteGameDetails();
  setFortniteDetailsOpen(false);
  updateSellerGameHint();
}

function discardFortniteGameDetails() {
  writeFortniteGameDetails(fortniteGameDetails);
  setFortniteDetailsOpen(false);
}

function readGtaGameDetails() {
  return Object.fromEntries(
    Object.entries(gtaDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeGtaGameDetails(details = {}) {
  Object.entries(gtaDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasGtaGameDetails(details = gtaGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setGtaDetailsOpen(open) {
  if (!gtaDetailsModal) return;
  gtaDetailsModal.hidden = !open;
  if (open) {
    writeGtaGameDetails(gtaGameDetails);
    gtaDetailInputs.rank?.focus();
  }
}

function saveGtaGameDetails() {
  gtaGameDetails = readGtaGameDetails();
  setGtaDetailsOpen(false);
  updateSellerGameHint();
}

function discardGtaGameDetails() {
  writeGtaGameDetails(gtaGameDetails);
  setGtaDetailsOpen(false);
}

function readLolGameDetails() {
  return Object.fromEntries(
    Object.entries(lolDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeLolGameDetails(details = {}) {
  Object.entries(lolDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasLolGameDetails(details = lolGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setLolDetailsOpen(open) {
  if (!lolDetailsModal) return;
  lolDetailsModal.hidden = !open;
  if (open) {
    writeLolGameDetails(lolGameDetails);
    lolDetailInputs.rank?.focus();
  }
}

function saveLolGameDetails() {
  lolGameDetails = readLolGameDetails();
  setLolDetailsOpen(false);
  updateSellerGameHint();
}

function discardLolGameDetails() {
  writeLolGameDetails(lolGameDetails);
  setLolDetailsOpen(false);
}

function readMlGameDetails() {
  return Object.fromEntries(
    Object.entries(mlDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeMlGameDetails(details = {}) {
  Object.entries(mlDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasMlGameDetails(details = mlGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setMlDetailsOpen(open) {
  if (!mlDetailsModal) return;
  mlDetailsModal.hidden = !open;
  if (open) {
    writeMlGameDetails(mlGameDetails);
    mlDetailInputs.currentRank?.focus();
  }
}

function saveMlGameDetails() {
  mlGameDetails = readMlGameDetails();
  setMlDetailsOpen(false);
  updateSellerGameHint();
}

function discardMlGameDetails() {
  writeMlGameDetails(mlGameDetails);
  setMlDetailsOpen(false);
}

function readPubgGameDetails() {
  return Object.fromEntries(
    Object.entries(pubgDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writePubgGameDetails(details = {}) {
  Object.entries(pubgDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasPubgGameDetails(details = pubgGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setPubgDetailsOpen(open) {
  if (!pubgDetailsModal) return;
  pubgDetailsModal.hidden = !open;
  if (open) {
    writePubgGameDetails(pubgGameDetails);
    pubgDetailInputs.currentTier?.focus();
  }
}

function savePubgGameDetails() {
  pubgGameDetails = readPubgGameDetails();
  setPubgDetailsOpen(false);
  updateSellerGameHint();
}

function discardPubgGameDetails() {
  writePubgGameDetails(pubgGameDetails);
  setPubgDetailsOpen(false);
}

function readRobloxGameDetails() {
  return Object.fromEntries(
    Object.entries(robloxDetailInputs).map(([key, input]) => [key, input?.value.trim() || '']),
  );
}

function writeRobloxGameDetails(details = {}) {
  Object.entries(robloxDetailInputs).forEach(([key, input]) => {
    if (input) input.value = details[key] ?? '';
  });
}

function hasRobloxGameDetails(details = robloxGameDetails) {
  return Object.values(details || {}).some((value) => String(value).trim() !== '');
}

function setRobloxDetailsOpen(open) {
  if (!robloxDetailsModal) return;
  robloxDetailsModal.hidden = !open;
  if (open) {
    writeRobloxGameDetails(robloxGameDetails);
    robloxDetailInputs.robux?.focus();
  }
}

function saveRobloxGameDetails() {
  robloxGameDetails = readRobloxGameDetails();
  setRobloxDetailsOpen(false);
  updateSellerGameHint();
}

function discardRobloxGameDetails() {
  writeRobloxGameDetails(robloxGameDetails);
  setRobloxDetailsOpen(false);
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

function createProductShowcaseCard(listing) {
  const config = getListingConfig(listing);
  const card = document.createElement('article');
  const detailUrl = getDetailUrl(listing);
  const favoriteCount = getCardScore(listing);
  const sellerName = getListingSellerName(listing);
  const image = getMarketplaceCardImage(listing, config);
  const productReviewStats = getMarketplaceProductReviewStats(listing.id);
  const sellerWaveRank = getMarketplaceSellerWaveRank(listing.sellerUsername);

  card.className = `marketplace-card product-showcase-card ${config.type}-showcase-card`;
  card.dataset.listingId = listing.id;

  if (config.type === 'account') {
    card.classList.add(getAccountStatusClass(listing.accountStatus));
  }

  const cover = document.createElement('div');
  cover.className = 'product-showcase-cover';
  cover.dataset.game = getGameInitials(listing.game);

  if (image) {
    cover.classList.add('has-image');
    cover.style.backgroundImage = `url("${image}")`;
  }

  const badges = document.createElement('div');
  badges.className = 'product-showcase-badges';

  const gameBadge = document.createElement('span');
  gameBadge.className = 'showcase-badge showcase-game-badge';
  gameBadge.textContent = listing.game || 'Marketplace';
  badges.appendChild(gameBadge);

  if (config.type === 'account') {
    const accountTypeBadge = document.createElement('span');
    accountTypeBadge.className = 'showcase-badge showcase-badge-gold';
    accountTypeBadge.textContent = formatAccountStatus(listing.accountStatus);
    badges.appendChild(accountTypeBadge);
  } else if (config.type === 'skin') {
    const typeBadge = document.createElement('span');
    typeBadge.className = 'showcase-badge showcase-badge-gold';
    typeBadge.textContent = 'Skin';
    badges.appendChild(typeBadge);
  }

  const saveButton = document.createElement('button');
  saveButton.className = 'save-button product-showcase-save';
  saveButton.type = 'button';
  saveButton.dataset.favoriteId = getFavoriteId(listing);
  saveButton.setAttribute('aria-label', 'Save product');
  saveButton.setAttribute('aria-pressed', 'false');
  saveButton.title = 'Save product';

  const coverInfo = document.createElement('div');
  coverInfo.className = 'product-showcase-cover-info';

  const showcaseTitle = document.createElement('h3');
  showcaseTitle.textContent = getListingTitle(listing);

  const showcaseLevel = document.createElement('span');
  showcaseLevel.className = 'product-showcase-level';
  showcaseLevel.textContent = getCardLevel(listing)
    ? `✪ Level ${formatCount(getCardLevel(listing))}`
    : config.label;

  coverInfo.append(showcaseTitle, showcaseLevel);
  cover.append(badges, saveButton, coverInfo);

  const body = document.createElement('div');
  body.className = 'product-showcase-body';

  const seller = document.createElement(listing.sellerUsername ? 'a' : 'div');
  seller.className = 'product-showcase-seller';
  if (seller instanceof HTMLAnchorElement) {
    seller.href = getPublicProfileUrl(listing.sellerUsername);
    seller.setAttribute('aria-label', `Preview ${sellerName} public profile`);
    seller.addEventListener('click', event => {
      event.preventDefault();
      const sellerData = getMarketplaceSellerPreviewData(listing.sellerUsername);
      const joined = sellerUser?.createdAt || sellerUser?.joinedAt || '';
      const joinedDate = joined ? new Date(joined) : null;
      const member = joinedDate && !Number.isNaN(joinedDate.getTime())
        ? joinedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '';
      window.openSellerProfilePreview?.({
        initials: getGameInitials(sellerName),
        photo: sellerPhoto,
        name: sellerName,
        username: listing.sellerUsername,
        bio: sellerUser?.bio || '',
        location: sellerUser?.location || sellerUser?.city || sellerUser?.country || '',
        member,
        verified: Boolean(sellerUser?.verified || sellerUser?.isVerified || sellerUser?.verificationStatus === 'verified'),
        role: getSellerListings().some((item) => item.sellerUsername === listing.sellerUsername) ? 'Marketplace seller' : 'WaveHub member',
        rank: sellerWaveRank ? `WAVE RANK #${sellerWaveRank}` : 'UNRANKED',
        rating: sellerData.average === null ? '—' : sellerData.average.toFixed(1),
        reviewCount: sellerData.reviews.length,
        reviews: sellerData.reviews,
        sales: formatCount(sellerData.completedSales),
        score: sellerData.average === null ? null : Math.round(sellerData.average * 20),
        url: getPublicProfileUrl(listing.sellerUsername),
      }, seller);
    });
  }
  const sellerUser = getUserByUsername(listing.sellerUsername);
  const sellerPhoto = sellerUser?.photoData || listing.sellerAvatar || '';

  const sellerAvatar = document.createElement('span');
  sellerAvatar.className = 'product-showcase-avatar';
  if (sellerPhoto) {
    sellerAvatar.classList.add('avatar-image');
    sellerAvatar.style.backgroundImage = `url("${sellerPhoto}")`;
  } else {
    sellerAvatar.textContent = getGameInitials(sellerName);
  }

  const sellerCopy = document.createElement('span');
  const sellerTitle = document.createElement('strong');
  sellerTitle.textContent = sellerName;

  const sellerRank = document.createElement('small');
  sellerRank.className = 'product-showcase-seller-rank';
  sellerRank.textContent = sellerWaveRank ? `Wave Rank #${sellerWaveRank}` : 'Wave Rank: Unranked';

  const sellerScore = document.createElement('small');
  sellerScore.className = 'product-showcase-seller-rating';
  sellerScore.textContent = productReviewStats.rating === null
    ? '★ No product reviews'
    : `★ ${productReviewStats.rating.toFixed(1)} · ${formatCount(productReviewStats.count)} reviews`;

  sellerCopy.append(sellerTitle, sellerRank, sellerScore);
  seller.append(sellerAvatar, sellerCopy);

  body.appendChild(seller);

  const footer = document.createElement('div');
  footer.className = 'product-showcase-footer';

  const price = document.createElement('strong');
  price.className = 'product-showcase-price';
  price.textContent = formatListingPrice(listing.price);

  const social = document.createElement('span');
  social.className = 'product-showcase-social';
  const viewStat = document.createElement('span');
  viewStat.textContent = `◉ ${formatCount(getCardViews(listing))}`;
  const favoriteStat = document.createElement('span');
  favoriteStat.textContent = `♡ ${formatCount(getCardLikes(listing))}`;
  social.append(viewStat, favoriteStat);

  const delivery = document.createElement('span');
  delivery.className = 'product-showcase-delivery';
  delivery.textContent = `⚡ Delivery — ${listing.accessDelivery?.deliveryTime || 'Instant'}`;

  const cartButton = document.createElement('button');
  cartButton.className = 'product-showcase-cart';
  cartButton.type = 'button';
  cartButton.setAttribute('aria-label', 'Add product to cart');

  const cartIcon = document.createElement('img');
  cartIcon.className = 'cart-icon-image';
  cartIcon.src = 'assets/cart-icon.png';
  cartIcon.alt = '';
  cartIcon.setAttribute('aria-hidden', 'true');
  cartButton.appendChild(cartIcon);

  cartButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    addListingToCart(listing);
    renderCart();
  });

  const iconActions = document.createElement('div');
  iconActions.className = 'product-showcase-icon-actions';
  iconActions.append(cartButton);

  const detailButton = document.createElement('button');
  detailButton.className = 'product-showcase-details';
  detailButton.type = 'button';
  detailButton.textContent = 'View Details';
  detailButton.addEventListener('click', () => {
    if (detailUrl) {
      window.location.href = detailUrl;
    }
  });

  footer.append(price, social, delivery, iconActions, detailButton);
  card.append(cover, body, footer);

  return card;
}

function createMarketplaceCard(listing) {
  const config = getListingConfig(listing);
  const shouldUseShowcase = config.type === 'account' || config.type === 'skin';

  if (shouldUseShowcase) {
    return createProductShowcaseCard(listing);
  }

  const card = document.createElement('article');
  card.className = 'marketplace-card';
  card.dataset.listingId = listing.id;
  const isBasicAccount = config.type === 'account' && normalizeAccountStatus(listing.accountStatus) === 'basic';

  if (config.type === 'account') {
    card.classList.add(getAccountStatusClass(listing.accountStatus));
  }

  if (isBasicAccount || listing.imageData) {
    const cover = document.createElement('div');
    cover.className = isBasicAccount ? 'marketplace-card-cover account-basic-cover' : 'marketplace-card-cover';

    if (!isBasicAccount && listing.imageData) {
      cover.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 19, 0.02), rgba(5, 8, 19, 0.32)), url("${listing.imageData}")`;
    }

    card.appendChild(cover);
  }

  const top = document.createElement('div');
  top.className = 'marketplace-card-top';

  const tag = document.createElement('span');
  tag.className = `service-tag ${config.tagClass}`;
  tag.textContent = config.type === 'account' && listing.accountStatus
    ? formatAccountStatus(listing.accountStatus)
    : config.tagLabel;

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

  const account = document.createElement(listing.sellerUsername ? 'a' : 'span');
  account.textContent = `${listing.game || 'Marketplace'} / ${getListingSellerName(listing)}`;
  if (account instanceof HTMLAnchorElement) {
    account.href = getPublicProfileUrl(listing.sellerUsername);
    account.setAttribute('aria-label', `Open ${getListingSellerName(listing)} public profile`);
  }

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = config.actionLabel;
  action.addEventListener('click', () => {
    addListingToCart(listing);
    renderCart();
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
  const isFavoritesView = getActiveSection() === 'Favorites';
  const favoriteIds = new Set(getUserFavorites(username).map((favorite) => favorite.id));
  const listings = getFilteredListings();
  document.body.classList.toggle('favorites-view', isFavoritesView);

  const pageKicker = document.querySelector('.marketplace-head .section-kicker');
  const pageTitle = document.getElementById('marketplaceTitle');
  const totalLabel = document.querySelector('.marketplace-total span');
  const listKicker = document.querySelector('.marketplace-list-section .section-kicker');
  const listTitle = document.getElementById('marketplaceListTitle');
  if (pageKicker) pageKicker.textContent = isFavoritesView ? 'Your personal collection' : 'Account and skin marketplace';
  if (pageTitle) pageTitle.textContent = isFavoritesView ? 'Favorites' : 'Marketplace';
  if (totalLabel) totalLabel.textContent = isFavoritesView ? 'saved items' : 'products';
  if (listKicker) listKicker.textContent = isFavoritesView ? 'Saved for later' : 'Live listings';
  if (listTitle) listTitle.textContent = isFavoritesView ? 'Your Collection' : 'Accounts & Skins';
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
    marketplaceEmpty.innerHTML = isFavoritesView
      ? '<span class="favorites-empty-icon" aria-hidden="true"></span><strong>Your collection is empty</strong><p>Save accounts and skins you like, then find them here anytime.</p><a href="marketplace.html">Explore Marketplace</a>'
      : 'No listings yet.';
  }
}

function setSellerStatus(type, message) {
  if (!sellerStatus) {
    return;
  }

  sellerStatus.className = type ? `seller-status ${type}` : 'seller-status';
  sellerStatus.textContent = message;
}

function renderCart() {
  const items = getCartItems();
  const total = getCartTotal(items);

  window.renderGlobalCartCount?.(items.length);

  if (cartCount) {
    cartCount.textContent = String(items.length);
  }

  if (cartTotal) {
    cartTotal.textContent = formatListingPrice(total);
  }
}

function openSellerModal() {
  if (!sellerModal) {
    return;
  }

  setProfileOpen(false);
  setSidebarOpen(false);
  updateSellerTypeFields();
  updateSellerGameHint();
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
  setCodDetailsOpen(false);
  setClashDetailsOpen(false);
  setDotaDetailsOpen(false);
  setFortniteDetailsOpen(false);
  setGtaDetailsOpen(false);
  setLolDetailsOpen(false);
  setMlDetailsOpen(false);
  setPubgDetailsOpen(false);
  setRobloxDetailsOpen(false);
  sellerButton?.setAttribute('aria-expanded', 'false');

  if (resetForm) {
    sellerForm?.reset();
    codGameDetails = {};
    clashGameDetails = {};
    dotaGameDetails = {};
    fortniteGameDetails = {};
    gtaGameDetails = {};
    lolGameDetails = {};
    mlGameDetails = {};
    pubgGameDetails = {};
    robloxGameDetails = {};
    writeCodGameDetails();
    writeClashGameDetails();
    writeDotaGameDetails();
    writeFortniteGameDetails();
    writeGtaGameDetails();
    writeLolGameDetails();
    writeMlGameDetails();
    writePubgGameDetails();
    writeRobloxGameDetails();
    resetSellerImages();
    updateSellerTypeFields();
    updateSellerGameHint();
    setSellerStatus('', '');
  }
}

menuToggle?.addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});

scrim?.addEventListener('click', () => setSidebarOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (robloxDetailsModal && !robloxDetailsModal.hidden) {
      discardRobloxGameDetails();
      return;
    }
    if (pubgDetailsModal && !pubgDetailsModal.hidden) {
      discardPubgGameDetails();
      return;
    }
    if (mlDetailsModal && !mlDetailsModal.hidden) {
      discardMlGameDetails();
      return;
    }
    if (lolDetailsModal && !lolDetailsModal.hidden) {
      discardLolGameDetails();
      return;
    }
    if (gtaDetailsModal && !gtaDetailsModal.hidden) {
      discardGtaGameDetails();
      return;
    }
    if (fortniteDetailsModal && !fortniteDetailsModal.hidden) {
      discardFortniteGameDetails();
      return;
    }
    if (dotaDetailsModal && !dotaDetailsModal.hidden) {
      discardDotaGameDetails();
      return;
    }
    if (clashDetailsModal && !clashDetailsModal.hidden) {
      discardClashGameDetails();
      return;
    }
    if (codDetailsModal && !codDetailsModal.hidden) {
      discardCodGameDetails();
      return;
    }
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
sellerGame?.addEventListener('change', () => {
  const isCallOfDuty = isCallOfDutyGame();
  const isClashOfClans = isClashOfClansGame();
  const isDota2 = isDota2Game();
  const isFortnite = isFortniteGame();
  const isGta5 = isGta5Game();
  const isLeagueOfLegends = isLeagueOfLegendsGame();
  const isMobileLegends = isMobileLegendsGame();
  const isPubgMobile = isPubgMobileGame();
  const isRoblox = isRobloxGame();

  if (!isCallOfDuty) {
    codGameDetails = {};
    writeCodGameDetails();
    setCodDetailsOpen(false);
  }

  if (!isClashOfClans) {
    clashGameDetails = {};
    writeClashGameDetails();
    setClashDetailsOpen(false);
  }

  if (!isDota2) {
    dotaGameDetails = {};
    writeDotaGameDetails();
    setDotaDetailsOpen(false);
  }

  if (!isFortnite) {
    fortniteGameDetails = {};
    writeFortniteGameDetails();
    setFortniteDetailsOpen(false);
  }

  if (!isGta5) {
    gtaGameDetails = {};
    writeGtaGameDetails();
    setGtaDetailsOpen(false);
  }

  if (!isLeagueOfLegends) {
    lolGameDetails = {};
    writeLolGameDetails();
    setLolDetailsOpen(false);
  }

  if (!isMobileLegends) {
    mlGameDetails = {};
    writeMlGameDetails();
    setMlDetailsOpen(false);
  }

  if (!isPubgMobile) {
    pubgGameDetails = {};
    writePubgGameDetails();
    setPubgDetailsOpen(false);
  }

  if (!isRoblox) {
    robloxGameDetails = {};
    writeRobloxGameDetails();
    setRobloxDetailsOpen(false);
  }

  updateSellerGameHint();
  if (isCallOfDuty) setCodDetailsOpen(true);
  if (isClashOfClans) setClashDetailsOpen(true);
  if (isDota2) setDotaDetailsOpen(true);
  if (isFortnite) setFortniteDetailsOpen(true);
  if (isGta5) setGtaDetailsOpen(true);
  if (isLeagueOfLegends) setLolDetailsOpen(true);
  if (isMobileLegends) setMlDetailsOpen(true);
  if (isPubgMobile) setPubgDetailsOpen(true);
  if (isRoblox) setRobloxDetailsOpen(true);
});
sellerGameDetailsButton?.addEventListener('click', () => setCodDetailsOpen(true));
codDetailsClose?.addEventListener('click', discardCodGameDetails);
codDetailsCancel?.addEventListener('click', discardCodGameDetails);
codDetailsSave?.addEventListener('click', saveCodGameDetails);
sellerClashDetailsButton?.addEventListener('click', () => setClashDetailsOpen(true));
clashDetailsClose?.addEventListener('click', discardClashGameDetails);
clashDetailsCancel?.addEventListener('click', discardClashGameDetails);
clashDetailsSave?.addEventListener('click', saveClashGameDetails);
sellerDotaDetailsButton?.addEventListener('click', () => setDotaDetailsOpen(true));
dotaDetailsClose?.addEventListener('click', discardDotaGameDetails);
dotaDetailsCancel?.addEventListener('click', discardDotaGameDetails);
dotaDetailsSave?.addEventListener('click', saveDotaGameDetails);
sellerFortniteDetailsButton?.addEventListener('click', () => setFortniteDetailsOpen(true));
fortniteDetailsClose?.addEventListener('click', discardFortniteGameDetails);
fortniteDetailsCancel?.addEventListener('click', discardFortniteGameDetails);
fortniteDetailsSave?.addEventListener('click', saveFortniteGameDetails);
sellerGtaDetailsButton?.addEventListener('click', () => setGtaDetailsOpen(true));
gtaDetailsClose?.addEventListener('click', discardGtaGameDetails);
gtaDetailsCancel?.addEventListener('click', discardGtaGameDetails);
gtaDetailsSave?.addEventListener('click', saveGtaGameDetails);
sellerLolDetailsButton?.addEventListener('click', () => setLolDetailsOpen(true));
lolDetailsClose?.addEventListener('click', discardLolGameDetails);
lolDetailsCancel?.addEventListener('click', discardLolGameDetails);
lolDetailsSave?.addEventListener('click', saveLolGameDetails);
sellerMlDetailsButton?.addEventListener('click', () => setMlDetailsOpen(true));
mlDetailsClose?.addEventListener('click', discardMlGameDetails);
mlDetailsCancel?.addEventListener('click', discardMlGameDetails);
mlDetailsSave?.addEventListener('click', saveMlGameDetails);
sellerPubgDetailsButton?.addEventListener('click', () => setPubgDetailsOpen(true));
pubgDetailsClose?.addEventListener('click', discardPubgGameDetails);
pubgDetailsCancel?.addEventListener('click', discardPubgGameDetails);
pubgDetailsSave?.addEventListener('click', savePubgGameDetails);
sellerRobloxDetailsButton?.addEventListener('click', () => setRobloxDetailsOpen(true));
robloxDetailsClose?.addEventListener('click', discardRobloxGameDetails);
robloxDetailsCancel?.addEventListener('click', discardRobloxGameDetails);
robloxDetailsSave?.addEventListener('click', saveRobloxGameDetails);

sellerImage?.addEventListener('change', () => {
  addSellerImageFiles(sellerImage.files);
  sellerImage.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  sellerDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    sellerDropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  sellerDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    sellerDropzone.classList.remove('dragging');
    if (eventName === 'drop') addSellerImageFiles(event.dataTransfer?.files);
  });
});

sellerImagePreviews?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-remove-seller-image]') : null;
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  sellerSelectedFiles.splice(Number(button.dataset.removeSellerImage), 1);
  renderSellerImagePreviews();
  setSellerStatus('', '');
});

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

  event.preventDefault();
  event.stopPropagation();

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

  setSaveButtonState(button, toggleProductFavorite(listing, user.username));
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
  const accountLevel = Number(sellerAccountLevel?.value);
  const description = sellerDescription?.value.trim() || '';
  const platform = sellerPlatform?.value || '';
  const region = sellerRegion?.value || '';

  if (!game || !titleValue || !platform || !region || !description || !Number.isFinite(price) || price <= 0) {
    setSellerStatus('error', 'Please complete all required Basic Information fields.');
    return;
  }

  if (listingType === 'skin' && !titleValue) {
    setSellerStatus('error', 'Please write the skin name.');
    return;
  }

  if (listingType === 'account' && (!Number.isInteger(accountLevel) || accountLevel < 1 || accountLevel > 9999)) {
    setSellerStatus('error', 'Please enter the real account level.');
    sellerAccountLevel?.focus();
    return;
  }

  const accessDelivery = {
    loginMethod: sellerLoginMethod?.value || '',
    emailChangeable: sellerEmailChangeable?.value || '',
    linkedAccounts: sellerLinkedAccounts?.value.trim() || '',
    fullAccess: sellerFullAccess?.value || '',
    originalEmail: sellerOriginalEmail?.value || '',
    twoFactor: sellerTwoFactor?.value || '',
    deliveryMethod: sellerDeliveryMethod?.value || '',
    deliveryTime: sellerDeliveryTime?.value || '',
  };

  if (listingType === 'account' && Object.entries(accessDelivery).some(([key, value]) => key !== 'linkedAccounts' && !value)) {
    setSellerStatus('error', 'Please complete every required Access & Delivery field.');
    return;
  }

  let galleryImages = [];

  if (!sellerSelectedFiles.length) {
    setSellerStatus('error', 'Please upload at least one product image.');
    return;
  }

  try {
    galleryImages = await readSellerImageData();
  } catch {
    setSellerStatus('error', 'Could not read the product image.');
    return;
  }

  const sellerUser = getCurrentAccount().user;
  const accountStatus = sellerAccountStatus?.value || 'basic';
  const listing = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    listingType,
    game,
    title,
    price,
    description,
    platform,
    region,
    accessDelivery: listingType === 'account' ? accessDelivery : {},
    gameDetails: isCallOfDutyGame(game)
      ? { type: 'call-of-duty', ...readCodGameDetails() }
      : isClashOfClansGame(game)
        ? { type: 'clash-of-clans', ...readClashGameDetails() }
        : isDota2Game(game)
          ? { type: 'dota-2', ...readDotaGameDetails() }
          : isFortniteGame(game)
            ? { type: 'fortnite', ...readFortniteGameDetails() }
            : isGta5Game(game)
              ? { type: 'gta-5', ...readGtaGameDetails() }
              : isLeagueOfLegendsGame(game)
                ? { type: 'league-of-legends', ...readLolGameDetails() }
                : isMobileLegendsGame(game)
                  ? { type: 'mobile-legends', ...readMlGameDetails() }
                  : isPubgMobileGame(game)
                    ? { type: 'pubg-mobile', ...readPubgGameDetails() }
                    : isRobloxGame(game)
                      ? { type: 'roblox', ...readRobloxGameDetails() }
                      : {},
    imageData: galleryImages[0] || '',
    galleryImages,
    imageName: sellerSelectedFiles[0]?.name || '',
    accountStatus: listingType === 'account' ? accountStatus : '',
    accountLevel: listingType === 'account' ? accountLevel : '',
    accountViews: 0,
    sellerUsername: sellerUser?.username || '',
    sellerName: sellerUser ? getDisplayName(sellerUser) : `${game} ${config.sellerNoun}`,
    sellerAvatar: sellerUser?.photoData || '',
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
  if (event.key === sessionKey || event.key === localUsersKey) {
    renderProfile();
    renderMarketplace();
  }

  if (event.key === sellerListingsKey || event.key === favoritesKey) {
    renderMarketplace();
  }

  if (event.key === cartKey) {
    renderCart();
  }
});

populateGameSelects();
applyInitialFilters();
updateSellerTypeFields();
updateSellerGameHint();
renderOnlineCount();
renderProfile();
applyInitialHash();
renderMarketplace();
renderCart();
