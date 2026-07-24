const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
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
const detailLayout = document.getElementById('detailLayout');
const detailEmpty = document.getElementById('detailEmpty');
const detailTabButtons = document.querySelectorAll('.detail-tabs button');
const detailTabPanels = document.querySelectorAll('.detail-tab-panel');
const detailBackLink = document.getElementById('detailBackLink');
const detailBreadcrumb = document.getElementById('detailBreadcrumb');
const detailHeroImage = document.getElementById('detailHeroImage');
const detailHeroTag = document.getElementById('detailHeroTag');
const detailHeroDelivery = document.getElementById('detailHeroDelivery');
const detailGalleryCount = document.getElementById('detailGalleryCount');
const detailThumbnails = document.getElementById('detailThumbnails');
const detailSaveButton = document.getElementById('detailSaveButton');
const detailBasicInfoPanel = document.getElementById('detailBasicInfoPanel');
const detailBasicStatus = document.getElementById('detailBasicStatus');
const detailBasicGame = document.getElementById('detailBasicGame');
const detailBasicLevel = document.getElementById('detailBasicLevel');
const detailBasicViews = document.getElementById('detailBasicViews');
const detailBasicSeller = document.getElementById('detailBasicSeller');
const detailKicker = document.getElementById('detailKicker');
const detailTitle = document.getElementById('detailTitle');
const detailDescription = document.getElementById('detailDescription');
const detailSeller = document.getElementById('detailSeller');
const detailGame = document.getElementById('detailGame');
const detailGameIcon = document.getElementById('detailGameIcon');
const detailPlatform = document.getElementById('detailPlatform');
const detailRegion = document.getElementById('detailRegion');
const detailDelivery = document.getElementById('detailDelivery');
const detailStatusLabel = document.getElementById('detailStatusLabel');
const detailStatusText = document.getElementById('detailStatusText');
const detailLevel = document.getElementById('detailLevel');
const detailViews = document.getElementById('detailViews');
const detailLoginMethod = document.getElementById('detailLoginMethod');
const detailDeliveryTime = document.getElementById('detailDeliveryTime');
const detailLongDescription = document.getElementById('detailLongDescription');
const detailIncluded = document.getElementById('detailIncluded');
const detailGameSpecific = document.getElementById('detailGameSpecific');
const detailGameSpecificGrid = document.getElementById('detailGameSpecificGrid');
const detailGameSpecificTitle = document.getElementById('detailGameSpecificTitle');
const detailReviews = document.getElementById('detailReviews');
const detailReviewSummary = document.getElementById('detailReviewSummary');
const detailReviewList = document.getElementById('detailReviewList');
const detailReviewsEmpty = document.getElementById('detailReviewsEmpty');
const detailReviewForm = document.getElementById('detailReviewForm');
const detailReviewRating = document.getElementById('detailReviewRating');
const detailFeedbackStars = document.getElementById('detailFeedbackStars');
const detailReviewComment = document.getElementById('detailReviewComment');
const detailReviewStatus = document.getElementById('detailReviewStatus');
const detailSellerScore = document.getElementById('detailSellerScore');
const detailSellerScoreLabel = document.getElementById('detailSellerScoreLabel');
const detailQualityScore = document.getElementById('detailQualityScore');
const detailQualityScoreLabel = document.getElementById('detailQualityScoreLabel');
const detailPopularity = document.getElementById('detailPopularity');
const detailSideSellerScore = document.getElementById('detailSideSellerScore');
const detailSideSellerScoreLabel = document.getElementById('detailSideSellerScoreLabel');
const detailSideQualityScore = document.getElementById('detailSideQualityScore');
const detailSideQualityScoreLabel = document.getElementById('detailSideQualityScoreLabel');
const detailTag = document.getElementById('detailTag');
const detailSideDelivery = document.getElementById('detailSideDelivery');
const detailPrice = document.getElementById('detailPrice');

const detailGameIcons = {
  'PUBG Mobile': 'assets/pubg-mobile-icon.png',
  PUBG: 'assets/pubg-mobile-icon.png',
  'Call of Duty': 'assets/cod-mobile-icon.png',
  'COD Mobile': 'assets/cod-mobile-icon.png',
  Valorant: 'assets/valorant-icon.png',
  CS2: 'assets/cs2-popular-games-photo.png',
  'Mobile Legends': 'assets/mobile-legends-popular-games-photo.png',
  'Free Fire': 'assets/freefire-photo.jpeg',
  Roblox: 'assets/roblox-popular-games-photo.png',
};
const buyButton = document.getElementById('buyButton');
const wishlistButton = document.getElementById('wishlistButton');
const messageSellerButton = document.getElementById('messageSellerButton');
const buyStatus = document.getElementById('buyStatus');
const sellerListingsKey = 'wavehub.sellerListings';
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const favoritesKey = 'wavehub.favorites';
const purchasesKey = 'wavehub.purchases';
const sellerReviewsKey = 'wavehub.sellerReviews';
const minOnlineCount = 2;
const maxOnlineCount = 23;
const accountTypeImages = {
  basic: 'assets/basic-account.png',
  'full-collection': 'assets/full-collection-account.png',
  fullcollection: 'assets/full-collection-account.png',
  og: 'assets/og-account.png',
  premium: 'assets/premium-account.png',
  ranked: 'assets/ranked-account.png',
  rare: 'assets/rare-account.png',
};
const gameVisualConfig = {
  'PUBG Mobile': { coverClass: 'cover-pubg', label: 'PUBG' },
  'Call of Duty': { coverClass: 'cover-cod', label: 'COD' },
  CS2: { coverClass: 'cover-cs2', label: 'CS2' },
  'Mobile Legends': { coverClass: 'cover-ml', label: 'MLBB' },
  'Free Fire': { coverClass: 'cover-freefire', label: 'FF' },
  Roblox: { coverClass: 'cover-roblox', label: 'RBX' },
  'Clash of Clans': { coverClass: '', label: 'COC' },
  'League of Legends': { coverClass: '', label: 'LOL' },
  Fortnite: { coverClass: '', label: 'FN' },
  Minecraft: { coverClass: '', label: 'MC' },
  'GTA 5': { coverClass: '', label: 'GTA' },
  'Dota 2': { coverClass: '', label: 'DOTA' },
  Valorant: { coverClass: 'cover-valorant', label: 'VAL' },
};
const listingTypeConfig = {
  account: {
    type: 'account',
    label: 'Account',
    tagClass: 'account',
    tagLabel: 'Account',
    sellerNoun: 'account seller',
    description: 'Gaming account listing from the WaveHub marketplace.',
    longDescription: 'This marketplace account is listed by a WaveHub seller with delivery details confirmed before purchase.',
    status: 'Account listing',
    included: ['Account delivery details', 'Seller confirmation', 'WaveHub order record', 'Post-purchase support window'],
  },
  skin: {
    type: 'skin',
    label: 'Skin',
    tagClass: 'skin',
    tagLabel: 'Skin',
    sellerNoun: 'skin seller',
    description: 'Gaming skin listing from the WaveHub marketplace.',
    longDescription: 'This skin is listed by a WaveHub seller with item details, transfer method and delivery timing confirmed before purchase.',
    status: 'Skin listing',
    included: ['Skin transfer details', 'Seller confirmation', 'WaveHub order record', 'Post-purchase support window'],
  },
};
let activeOffer = null;

const serviceDetails = {
  'pubg-mobile-ace-booster-rank-push': {
    type: 'service',
    title: 'PUBG Ace Booster',
    description: 'Fast rank push with verified delivery and progress updates.',
    longDescription: 'A verified PUBG Mobile booster helps push your rank safely with clear checkpoints, delivery updates and agreed play windows before the order starts.',
    seller: 'Top 100 Player',
    game: 'PUBG Mobile',
    delivery: '6-24 hours',
    status: 'Verified booster',
    tag: 'Hot',
    tagClass: 'hot',
    price: '18 GEL',
    included: ['Rank push plan', 'Progress updates', 'Safe login handoff', 'Final delivery report'],
  },
  'mobile-legends-mythic-rank-teammate': {
    type: 'service',
    title: 'MLBB Mythic Duo',
    description: 'Play with a verified carry and climb safely in duo queue.',
    longDescription: 'Queue with a verified Mobile Legends player for coordinated duo games, role planning and steady rank progress without risky shortcuts.',
    seller: 'MythX',
    game: 'Mobile Legends',
    delivery: 'Per game',
    status: 'Verified teammate',
    tag: 'Team',
    tagClass: 'team',
    price: '12 GEL/game',
    included: ['Duo queue session', 'Role coordination', 'Draft suggestions', 'Post-game notes'],
  },
  'free-fire-weekly-tournament-squad-entry': {
    type: 'service',
    title: 'Free Fire Cup Slot',
    description: 'Weekly tournament entry for squads with prize tracking.',
    longDescription: 'Reserve a squad slot in a weekly Free Fire cup with match schedule, prize tracking and admin support through the event window.',
    seller: 'WaveHub Events',
    game: 'Free Fire',
    delivery: 'Weekly event',
    status: 'Event slot',
    tag: 'Event',
    tagClass: 'event',
    price: '9 GEL',
    included: ['Squad entry slot', 'Match schedule', 'Prize tracking', 'Event support'],
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

function getPublicProfileUrl(username) {
  return username ? `profile.html?user=${encodeURIComponent(username)}` : '#';
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

function getPurchases() {
  const purchases = readJson(purchasesKey, []);
  return Array.isArray(purchases) ? purchases : [];
}

function savePurchases(purchases) {
  writeJson(purchasesKey, purchases);
}

function getSellerReviews(username) {
  if (!username) {
    return [];
  }

  const reviews = readJson(sellerReviewsKey, []);
  const matching = Array.isArray(reviews)
    ? reviews
        .filter((review) => review.sellerUsername === username)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];
  const seen = new Set();
  return matching.filter((review) => {
    const key = `${String(review.buyerUsername || '').toLowerCase()}:${String(review.listingId || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function saveSellerReview(review) {
  const reviews = readJson(sellerReviewsKey, []);
  const source = Array.isArray(reviews) ? reviews : [];
  const isSameProductReview = (item) => (
    String(item.buyerUsername || '').toLowerCase() === String(review.buyerUsername || '').toLowerCase()
    && String(item.sellerUsername || '').toLowerCase() === String(review.sellerUsername || '').toLowerCase()
    && String(item.listingId || '') === String(review.listingId || '')
  );
  const nextReviews = [review, ...source.filter((item) => item.id !== review.id && !isSameProductReview(item))];

  writeJson(sellerReviewsKey, nextReviews);
}

function getAverageRating(reviews) {
  if (!reviews.length) {
    return null;
  }

  const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return total / reviews.length;
}

function formatRating(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '-';
}

function formatReviewDate(value) {
  const date = new Date(value || '');

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getReviewablePurchase(offer, buyerUsername) {
  if (!offer?.sellerUsername || !buyerUsername || offer.sellerUsername === buyerUsername) {
    return null;
  }

  return getPurchases().find((purchase) => (
    purchase.buyerUsername === buyerUsername
    && Array.isArray(purchase.items)
    && purchase.items.some((item) => (
      item.listingId
        ? item.listingId === offer.id
        : item.sellerUsername === offer.sellerUsername
    ))
  )) || null;
}

function getPurchaseItemFromOffer(offer) {
  return {
    id: getFavoriteId(offer),
    listingId: offer.type === 'product' ? offer.id : '',
    serviceId: offer.type === 'service' ? offer.id : '',
    title: offer.title,
    productType: offer.productLabel || offer.tag || 'Offer',
    game: offer.game || 'WaveHub',
    seller: offer.seller,
    sellerUsername: offer.sellerUsername || '',
    price: getNumericPrice(offer.price),
    priceText: offer.price,
    imageData: offer.imageData || '',
    detailUrl: `detail.html?type=${offer.type}&id=${encodeURIComponent(offer.id)}`,
  };
}

function getExistingReview(offer, buyerUsername) {
  if (!offer?.sellerUsername || !buyerUsername) {
    return null;
  }

  return getSellerReviews(offer.sellerUsername).find((review) => (
    String(review.buyerUsername || '').toLowerCase() === String(buyerUsername || '').toLowerCase()
    && String(review.listingId || '') === String(offer.id || '')
  )) || null;
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

function getFavoriteId(offer) {
  if (!offer?.id) {
    return '';
  }

  return offer.type === 'product' ? `listing:${offer.id}` : `service:${offer.id}`;
}

function getOfferFavorite(offer) {
  return {
    id: getFavoriteId(offer),
    type: offer.type,
    listingId: offer.type === 'product' ? offer.id : '',
    serviceId: offer.type === 'service' ? offer.id : '',
    search: [offer.game, offer.title, offer.description, offer.seller].join(' ').toLowerCase(),
    title: offer.title,
    description: offer.description || '',
    seller: offer.seller,
    price: offer.price,
    tag: `${offer.game || 'WaveHub'} ${offer.productLabel || offer.tag || 'Offer'}`,
    savedAt: new Date().toISOString(),
  };
}

function setWishlistState(isSaved) {
  if (wishlistButton) {
    wishlistButton.textContent = isSaved ? 'Saved' : 'Add to Wishlist';
    wishlistButton.setAttribute('aria-pressed', String(isSaved));
    wishlistButton.title = isSaved ? 'Remove from wishlist' : 'Add to wishlist';
  }

  if (detailSaveButton) {
    detailSaveButton.classList.toggle('saved', isSaved);
    detailSaveButton.setAttribute('aria-pressed', String(isSaved));
    detailSaveButton.setAttribute('aria-label', isSaved ? 'Remove from wishlist' : 'Add to wishlist');
    detailSaveButton.title = isSaved ? 'Remove from wishlist' : 'Add to wishlist';
  }
}

function formatAccountStatus(value) {
  const status = String(value || 'basic').toLowerCase();
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

function getAccountTypeImage(value) {
  const status = String(value || 'basic').trim().toLowerCase();
  return accountTypeImages[status] || '';
}

function formatNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return '-';
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number.toLocaleString() : '-';
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

function formatListingPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return '0 GEL';
  }

  return `${Number.isInteger(price) ? price : price.toFixed(2)} GEL`;
}

function getNumericPrice(value) {
  const match = String(value || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function getSellerListings() {
  const listings = readJson(sellerListingsKey, []);
  return Array.isArray(listings) ? listings : [];
}

function saveSellerListings(listings) {
  writeJson(sellerListingsKey, listings);
}

function incrementListingViews(id) {
  let updatedListing = null;
  const listings = getSellerListings().map((listing) => {
    if (listing.id !== id) {
      return listing;
    }

    const nextViews = (Number(listing.accountViews) || 0) + 1;
    updatedListing = {
      ...listing,
      accountViews: nextViews,
    };

    return updatedListing;
  });

  if (updatedListing) {
    saveSellerListings(listings);
  }

  return updatedListing;
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

function getProductDetail(id, { countView = true } = {}) {
  const listing = countView
    ? incrementListingViews(id)
    : getSellerListings().find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  const config = getListingConfig(listing);
  const accountStatus = listing.accountStatus || (config.type === 'account' ? 'basic' : '');
  const accountLevel = Number(listing.accountLevel) || '';
  const accountViews = Number(listing.accountViews) || 0;
  const favoriteCount = getFavoriteCount(`listing:${id}`);
  const sellerReviews = getSellerReviews(listing.sellerUsername || '');
  const sellerAverageRating = getAverageRating(sellerReviews);
  const galleryImages = Array.isArray(listing.galleryImages)
    ? listing.galleryImages.filter(Boolean)
    : [listing.imageData].filter(Boolean);

  return {
    id,
    type: 'product',
    productType: config.type,
    productLabel: config.label,
    title: getListingTitle(listing),
    description: listing.description || config.description,
    longDescription: listing.description || config.longDescription,
    seller: getListingSellerName(listing),
    sellerUsername: listing.sellerUsername || '',
    game: listing.game || 'Marketplace',
    delivery: listing.accessDelivery?.deliveryTime || (config.type === 'skin' ? 'Instant delivery' : 'After seller confirmation'),
    status: config.type === 'account' ? formatAccountStatus(accountStatus) : config.status,
    tag: config.type === 'account' ? formatAccountStatus(accountStatus) : config.tagLabel,
    tagClass: config.tagClass,
    price: formatListingPrice(listing.price),
    imageData: listing.imageData || '',
    galleryImages,
    imageName: listing.imageName || '',
    accountStatus,
    accountStatusLabel: accountStatus ? formatAccountStatus(accountStatus) : config.label,
    accountLevel,
    accountViews,
    platform: listing.platform || '-',
    region: listing.region || '-',
    accessDelivery: listing.accessDelivery || {},
    gameDetails: listing.gameDetails || {},
    sellerScore: sellerAverageRating === null ? '-' : formatRating(sellerAverageRating),
    sellerReviewCount: sellerReviews.length,
    productScore: listing.productScore || favoriteCount,
    popularity: formatNumber(accountViews),
    favoriteCount,
    included: config.included,
  };
}

function getDetailOffer({ countView = true } = {}) {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');

  if (!id) {
    return null;
  }

  if (type === 'product') {
    return getProductDetail(id, { countView });
  }

  if (type === 'service') {
    return serviceDetails[id] ? { id, ...serviceDetails[id] } : null;
  }

  return serviceDetails[id] ? { id, ...serviceDetails[id] } : getProductDetail(id, { countView });
}

function setStatus(type, message) {
  if (!buyStatus) {
    return;
  }

  buyStatus.className = type ? `seller-status ${type}` : 'seller-status';
  buyStatus.textContent = message;
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

  syncWishlistForActiveOffer();
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (maxOnlineCount - minOnlineCount + 1)) + minOnlineCount;
  onlineCount.textContent = `${count} online`;
}

function renderIncluded(items) {
  if (!detailIncluded) {
    return;
  }

  detailIncluded.innerHTML = '';

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    detailIncluded.appendChild(li);
  });
}

function getVisualConfig(game) {
  return gameVisualConfig[game] || { coverClass: '', label: 'WH' };
}

function applyHeroVisual(visual, index, total) {
  if (!detailHeroImage) {
    return;
  }

  detailHeroImage.className = `detail-hero-image ${visual.coverClass || ''} ${visual.isBasicCard ? 'is-basic-card' : ''}`.trim();
  detailHeroImage.style.backgroundImage = visual.src
    ? `linear-gradient(180deg, rgba(5, 8, 19, 0.03), rgba(5, 8, 19, 0.22)), url("${visual.src}")`
    : '';
  detailHeroImage.dataset.label = visual.label || '';

  if (detailBasicInfoPanel) {
    detailBasicInfoPanel.hidden = !visual.isBasicCard;
  }

  if (detailGalleryCount) {
    detailGalleryCount.textContent = `${index + 1} / ${total}`;
  }
}

function getGalleryVisuals(offer) {
  const config = getVisualConfig(offer.game);
  const labels = ['Preview', 'Loadout', 'Inventory', 'Rarity', 'Delivery', 'Stats'];
  const visuals = labels.map((label) => ({
    label,
    coverClass: config.coverClass,
    src: '',
    isBasicCard: false,
  }));
  const uploadedImages = Array.isArray(offer.galleryImages) ? offer.galleryImages : [offer.imageData].filter(Boolean);

  const isCs2Product = offer.type === 'product' && offer.game === 'CS2';
  const accountTypeImage = isCs2Product
    ? 'assets/cs2-marketplace-cover.png'
    : offer.productType === 'account' ? getAccountTypeImage(offer.accountStatus) : '';

  if (accountTypeImage) {
    visuals[0] = {
      label: isCs2Product ? 'CS2' : offer.accountStatusLabel || 'Account card',
      coverClass: '',
      src: accountTypeImage,
      isBasicCard: !isCs2Product,
    };

    uploadedImages.slice(0, 5).forEach((src, index) => {
      visuals[index + 1] = {
        label: `Upload ${index + 1}`,
        coverClass: '',
        src,
        isBasicCard: false,
      };
    });

    return visuals;
  }

  uploadedImages.slice(0, 6).forEach((src, index) => {
    visuals[index] = {
      label: index === 0 ? (offer.imageName || 'Uploaded image') : `Upload ${index + 1}`,
      coverClass: '',
      src,
      isBasicCard: false,
    };
  });

  return visuals;
}

function renderGallery(offer) {
  const visuals = getGalleryVisuals(offer);
  applyHeroVisual(visuals[0], 0, visuals.length);

  if (!detailThumbnails) {
    return;
  }

  detailThumbnails.innerHTML = '';

  visuals.forEach((visual, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `detail-thumbnail ${visual.coverClass || ''}`.trim();
    button.setAttribute('aria-label', `Show ${visual.label}`);
    button.classList.toggle('active', index === 0);

    if (visual.src) {
      button.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 19, 0.02), rgba(5, 8, 19, 0.22)), url("${visual.src}")`;
    }

    const label = document.createElement('span');
    label.textContent = visual.label;
    button.appendChild(label);

    button.addEventListener('click', () => {
      detailThumbnails.querySelectorAll('.detail-thumbnail').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyHeroVisual(visual, index, visuals.length);
    });

    detailThumbnails.appendChild(button);
  });
}

function syncWishlistForActiveOffer() {
  const { user } = getCurrentAccount();
  const isSaved = Boolean(activeOffer && user?.username && getUserFavorites(user.username).some((item) => item.id === getFavoriteId(activeOffer)));
  setWishlistState(isSaved);
}

function toggleActiveOfferFavorite(username) {
  if (!activeOffer) {
    return false;
  }

  const favorite = getOfferFavorite(activeOffer);
  const favorites = getUserFavorites(username);
  const wasSaved = favorites.some((item) => item.id === favorite.id);
  const nextFavorites = wasSaved
    ? favorites.filter((item) => item.id !== favorite.id)
    : [...favorites.filter((item) => item.id !== favorite.id), favorite];

  saveUserFavorites(username, nextFavorites);
  return !wasSaved;
}

function setActiveDetailTab(targetId = 'detailOverview') {
  detailTabPanels.forEach((panel) => {
    panel.hidden = false;
  });
}

function renderOfferMetrics(offer) {
  if (!offer) {
    return;
  }

  const sellerRatingLabel = offer.sellerReviewCount
    ? `${formatNumber(offer.sellerReviewCount)} ${offer.sellerReviewCount === 1 ? 'review' : 'reviews'}`
    : 'No rating';

  if (detailSellerScore) detailSellerScore.textContent = offer.sellerScore || '-';
  if (detailSellerScoreLabel) detailSellerScoreLabel.textContent = sellerRatingLabel;
  if (detailQualityScore) detailQualityScore.textContent = formatNumber(offer.productScore);
  if (detailQualityScoreLabel) detailQualityScoreLabel.textContent = offer.productScore === 1 ? 'saved' : 'saves';
  if (detailPopularity) detailPopularity.textContent = offer.popularity || formatNumber(offer.accountViews);
  if (detailSideSellerScore) detailSideSellerScore.textContent = offer.sellerScore || '-';
  if (detailSideSellerScoreLabel) detailSideSellerScoreLabel.textContent = sellerRatingLabel;
  if (detailSideQualityScore) detailSideQualityScore.textContent = formatNumber(offer.productScore);
  if (detailSideQualityScoreLabel) detailSideQualityScoreLabel.textContent = offer.favoriteCount === 1 ? 'saved' : 'saves';
}

function setReviewStatus(type, message) {
  if (!detailReviewStatus) {
    return;
  }

  detailReviewStatus.className = type ? `seller-status ${type}` : 'seller-status';
  detailReviewStatus.textContent = message;
}

function setDetailReviewRating(value) {
  const rating = Math.max(1, Math.min(5, Number(value) || 5));
  if (detailReviewRating) detailReviewRating.value = String(rating);
  detailFeedbackStars?.querySelectorAll('[data-detail-rating]').forEach((button) => {
    const isSelected = Number(button.dataset.detailRating) <= rating;
    button.classList.toggle('selected', isSelected);
    button.setAttribute('aria-checked', String(Number(button.dataset.detailRating) === rating));
  });
}

function createDetailReviewCard(review) {
  const card = document.createElement('article');
  card.className = 'public-review-card';

  const head = document.createElement('div');
  head.className = 'public-review-head';

  const reviewerName = review.buyerName || review.buyerUsername || 'Verified buyer';
  const reviewerUser = getUserByUsername(review.buyerUsername);
  const reviewerWrap = document.createElement(review.buyerUsername ? 'a' : 'div');
  reviewerWrap.className = 'public-review-reviewer';
  if (reviewerWrap instanceof HTMLAnchorElement) {
    reviewerWrap.href = getPublicProfileUrl(review.buyerUsername);
    reviewerWrap.setAttribute('aria-label', `Open ${reviewerName} profile`);
  }

  const reviewerAvatar = document.createElement('span');
  reviewerAvatar.className = 'message-avatar';
  if (reviewerUser?.photoData) {
    reviewerAvatar.classList.add('avatar-image');
    reviewerAvatar.style.backgroundImage = `url("${reviewerUser.photoData}")`;
  } else {
    reviewerAvatar.textContent = reviewerUser ? getInitials(reviewerUser) : reviewerName.trim().charAt(0).toUpperCase() || '?';
  }

  const buyer = document.createElement('strong');
  buyer.textContent = reviewerName;
  reviewerWrap.append(reviewerAvatar, buyer);

  const rating = document.createElement('span');
  rating.className = 'public-review-rating';
  const numericRating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
  rating.textContent = `${'★'.repeat(numericRating)}${'☆'.repeat(5 - numericRating)}`;

  const date = document.createElement('small');
  date.textContent = formatReviewDate(review.createdAt);

  head.append(reviewerWrap, rating, date);

  const item = document.createElement('span');
  item.className = 'public-review-item';
  item.textContent = review.itemTitle ? `About: ${review.itemTitle}` : 'About: Marketplace';

  const body = document.createElement('p');
  body.textContent = review.comment || 'No written comment.';

  card.append(head, item, body);
  return card;
}

function renderOfferReviews(offer) {
  if (!detailReviews || !offer) {
    return;
  }

  const reviews = getSellerReviews(offer.sellerUsername || '');
  const averageRating = getAverageRating(reviews);
  const { user } = getCurrentAccount();
  const reviewablePurchase = offer.type === 'product'
    ? getReviewablePurchase(offer, user?.username)
    : null;
  const existingReview = getExistingReview(offer, user?.username);

  if (detailReviewSummary) {
    detailReviewSummary.textContent = reviews.length
      ? `${formatRating(averageRating)}/5 from ${formatNumber(reviews.length)} ${reviews.length === 1 ? 'review' : 'reviews'}`
      : 'No seller reviews yet.';
  }

  if (detailReviewList) {
    detailReviewList.innerHTML = '';
    reviews.forEach((review) => {
      detailReviewList.appendChild(createDetailReviewCard(review));
    });
  }

  if (detailReviewsEmpty) {
    detailReviewsEmpty.hidden = reviews.length > 0;
  }

  if (detailReviewForm) {
    const canReview = Boolean(
      offer.type === 'product'
      && offer.sellerUsername
      && user?.username
      && String(offer.sellerUsername).toLowerCase() !== String(user.username).toLowerCase()
    );
    detailReviewForm.hidden = !canReview;
    detailReviewForm.dataset.reviewId = existingReview?.id || '';
    detailReviewForm.dataset.purchaseId = reviewablePurchase?.id || '';

    if (canReview) {
      setDetailReviewRating(existingReview?.rating || 5);
      if (detailReviewComment) detailReviewComment.value = existingReview?.comment || '';
      setReviewStatus('', existingReview ? 'You can update your feedback.' : '');
    } else {
      setReviewStatus('', '');
    }
  }
}

function renderGameSpecificDetails(offer) {
  if (!detailGameSpecific || !detailGameSpecificGrid) return;

  const details = offer.gameDetails || {};
  const isClashOfClans = details.type === 'clash-of-clans'
    || String(offer.game || '').trim().toLowerCase() === 'clash of clans';
  const isDota2 = details.type === 'dota-2'
    || ['dota 2', 'dota2'].includes(String(offer.game || '').trim().toLowerCase());
  const isFortnite = details.type === 'fortnite'
    || String(offer.game || '').trim().toLowerCase() === 'fortnite';
  const isGta5 = details.type === 'gta-5'
    || ['gta 5', 'gta v', 'grand theft auto v'].includes(String(offer.game || '').trim().toLowerCase());
  const isLeagueOfLegends = details.type === 'league-of-legends'
    || ['league of legends', 'lol'].includes(String(offer.game || '').trim().toLowerCase());
  const isMobileLegends = details.type === 'mobile-legends'
    || ['mobile legends', 'mobile legends: bang bang', 'mlbb'].includes(String(offer.game || '').trim().toLowerCase());
  const isPubgMobile = details.type === 'pubg-mobile'
    || ['pubg mobile', 'pubg'].includes(String(offer.game || '').trim().toLowerCase());
  const isRoblox = details.type === 'roblox'
    || String(offer.game || '').trim().toLowerCase() === 'roblox';
  const fields = (isClashOfClans
    ? [
        ['Town Hall Level', details.townHall],
        ['Hero Levels', details.heroLevels],
        ['Base Upgrade Status', details.baseStatus],
        ['Laboratory Level', details.laboratoryLevel],
        ['Hero Equipment', details.heroEquipment],
        ['Rare / Valuable Items', details.rareItems],
      ]
    : isDota2
      ? [
          ['Main Rank', details.mainRank],
          ['MMR', details.mmr],
          ['Arcana Count', details.arcanaCount],
          ['Immortal Items Count', details.immortalCount],
          ['Rare / Prestige Items', details.rareItems],
          ['Exclusive / Limited Items', details.exclusiveItems],
        ]
    : isFortnite
      ? [
          ['Total Skins', details.totalSkins],
          ['Exclusive / OG Skins', details.ogSkins],
          ['Rare Skins', details.rareSkins],
          ['Pickaxes', details.pickaxes],
          ['Emotes', details.emotes],
          ['Gliders', details.gliders],
          ['V-Bucks Balance', details.vbucks ? `${formatNumber(details.vbucks)} V-Bucks` : ''],
          ['Rare Items / Highlights', details.highlights],
        ]
    : isGta5
      ? [
          ['Rank', details.rank],
          ['Total Money', details.totalMoney ? `$${formatNumber(details.totalMoney)}` : ''],
          ['Total RP', details.totalRp ? formatNumber(details.totalRp) : ''],
          ['Unlocked Level', details.unlockedLevel],
          ['Properties Owned', details.properties],
          ['Vehicles Owned', details.vehicles],
          ['Outfits Saved', details.outfits],
          ['Weaponized Vehicles', details.weaponizedVehicles],
          ['Rare / Special Items', details.rareItems],
        ]
    : isLeagueOfLegends
      ? [
          ['Rank (Solo/Duo)', details.rank],
          ['Peak Rank', details.peakRank],
          ['Account Level', details.accountLevel],
          ['Blue Essence (BE)', details.blueEssence ? formatNumber(details.blueEssence) : ''],
          ['Skins Owned', details.skinsOwned],
          ['Legendary Skins', details.legendarySkins],
        ]
    : isMobileLegends
      ? [
          ['Current Rank', details.currentRank],
          ['Highest Rank Reached', details.highestRank],
          ['Heroes Owned', details.heroesOwned],
          ['Total Skins', details.totalSkins],
          ['Legend Skins', details.legendSkins],
          ['Collector Skins', details.collectorSkins],
          ['Zodiac Skins', details.zodiacSkins],
          ['Rare Items / Highlights', details.highlights],
        ]
    : isPubgMobile
      ? [
          ['Current Tier', details.currentTier],
          ['Highest Tier Reached', details.highestTier],
          ['Royale Pass', details.royalePass],
          ['UC Balance', details.ucBalance ? `${formatNumber(details.ucBalance)} UC` : ''],
          ['X-Suits', details.xSuits],
          ['Mythic Outfits', details.mythicOutfits],
          ['Gun Skins', details.gunSkins],
          ['Upgradable Gun Skins', details.upgradableSkins],
          ['Vehicle Skins', details.vehicleSkins],
          ['Rare Items / Highlights', details.highlights],
        ]
    : isRoblox
      ? [
          ['Robux Balance', details.robux ? formatNumber(details.robux) : ''],
          ['Limiteds Count', details.limitedsCount],
          ['Limiteds RAP Value', details.rapValue ? formatNumber(details.rapValue) : ''],
          ['Premium Membership', details.premium],
          ['Account Age', details.accountAge],
          ['Total Spending', details.totalSpending ? `$${formatNumber(details.totalSpending)}` : ''],
          ['Top Game Items', details.topItems],
          ['Rare / Valuable Items', details.rareItems],
        ]
    : [
        ['Current MP Rank', details.mpRank],
        ['Current BR Rank', details.brRank],
        ['CP Balance', details.cpBalance ? `${formatNumber(details.cpBalance)} CP` : ''],
        ['Mythic Weapons', details.mythicWeapons],
        ['Legendary Weapons', details.legendaryWeapons],
        ['Operator Skins', details.operatorSkins],
        ['Completionist Camos', details.camos],
        ['Popular Weapon Blueprints', details.blueprints],
        ['Rare Items / Highlights', details.highlights],
      ]).filter(([, value]) => String(value ?? '').trim() !== '');

  const shouldShow = offer.type === 'product'
    && (isCallOfDutyOffer(offer) || isClashOfClans || isDota2 || isFortnite || isGta5 || isLeagueOfLegends || isMobileLegends || isPubgMobile || isRoblox)
    && fields.length > 0;

  detailGameSpecific.hidden = !shouldShow;
  detailGameSpecificGrid.replaceChildren();

  if (!shouldShow) return;
  if (detailGameSpecificTitle) {
    detailGameSpecificTitle.textContent = isClashOfClans
      ? 'Clash of Clans Details'
      : isDota2
        ? 'Dota 2 Details'
        : isFortnite
          ? 'Fortnite Details'
          : isGta5
            ? 'GTA 5 Details'
            : isLeagueOfLegends
              ? 'League of Legends Details'
              : isMobileLegends
                ? 'Mobile Legends Details'
                : isPubgMobile
                  ? 'PUBG Mobile Details'
                  : isRoblox
                    ? 'Roblox Details'
        : 'Call of Duty Details';
  }

  fields.forEach(([label, value]) => {
    const item = document.createElement('div');
    const name = document.createElement('span');
    const content = document.createElement('strong');
    name.textContent = label;
    content.textContent = String(value);
    item.append(name, content);
    detailGameSpecificGrid.append(item);
  });
}

function isCallOfDutyOffer(offer) {
  return offer.gameDetails?.type === 'call-of-duty'
    || ['call of duty', 'call of duty mobile', 'cod mobile'].includes(String(offer.game || '').trim().toLowerCase());
}

function renderDetail({ countView = true } = {}) {
  const offer = getDetailOffer({ countView });

  if (!offer) {
    activeOffer = null;
    if (detailLayout) detailLayout.hidden = true;
    if (detailEmpty) detailEmpty.hidden = false;
    if (detailTitle) detailTitle.textContent = 'Offer not found';
    return;
  }

  activeOffer = offer;
  document.title = `${offer.title} - WaveHub`;

  if (detailLayout) detailLayout.hidden = false;
  if (detailEmpty) detailEmpty.hidden = true;
  if (detailBackLink) detailBackLink.href = offer.type === 'product' ? 'marketplace.html' : 'index.html';
  document.querySelector('[data-section="Favorites"]')?.setAttribute(
    'href',
    offer.type === 'product' ? 'marketplace.html#favorites' : 'index.html#favorites',
  );
  if (detailBreadcrumb) {
    detailBreadcrumb.textContent = [
      'Home',
      offer.type === 'product' ? 'Marketplace' : 'Services',
      offer.game,
      offer.productLabel || offer.tag || 'Offer',
      offer.title,
    ].filter(Boolean).join(' / ');
  }
  if (detailKicker) {
    detailKicker.textContent = offer.type === 'product' ? `${offer.productLabel || 'Product'} detail` : 'Service detail';
  }
  if (detailTitle) detailTitle.textContent = offer.title;
  if (detailDescription) detailDescription.textContent = offer.description;
  if (detailSeller) {
    detailSeller.textContent = offer.seller;
    if (detailSeller instanceof HTMLAnchorElement) {
      detailSeller.href = offer.sellerUsername ? getPublicProfileUrl(offer.sellerUsername) : '#';
      detailSeller.toggleAttribute('aria-disabled', !offer.sellerUsername);
    }
  }
  if (detailGame) detailGame.textContent = offer.game;
  if (detailPlatform) detailPlatform.textContent = offer.platform || '-';
  if (detailRegion) detailRegion.textContent = offer.region || '-';
  if (detailGameIcon) {
    const gameIcon = detailGameIcons[offer.game] || '';
    detailGameIcon.src = gameIcon;
    detailGameIcon.alt = gameIcon ? `${offer.game} icon` : '';
    detailGameIcon.hidden = !gameIcon;
  }
  if (detailDelivery) detailDelivery.textContent = offer.delivery;
  if (detailStatusText) detailStatusText.textContent = offer.status;
  if (detailLevel) detailLevel.textContent = formatNumber(offer.accountLevel);
  if (detailViews) detailViews.textContent = offer.popularity || formatNumber(offer.accountViews);
  if (detailLoginMethod) detailLoginMethod.textContent = offer.accessDelivery?.loginMethod || '-';
  if (detailDeliveryTime) detailDeliveryTime.textContent = offer.accessDelivery?.deliveryTime || offer.delivery || '-';
  renderGameSpecificDetails(offer);
  if (detailLongDescription) detailLongDescription.textContent = offer.longDescription;
  if (detailTag) {
    detailTag.className = `service-tag ${offer.tagClass || 'account'}`;
    detailTag.textContent = offer.tag;
  }
  if (detailHeroTag) {
    detailHeroTag.className = `service-tag ${offer.tagClass || 'account'}`;
    detailHeroTag.textContent = offer.tag;
  }
  if (detailHeroDelivery) detailHeroDelivery.textContent = offer.delivery;
  if (detailSideDelivery) detailSideDelivery.textContent = offer.delivery;
  if (detailPrice) detailPrice.textContent = offer.price;
  if (detailStatusLabel) detailStatusLabel.textContent = offer.productType === 'account' ? 'Account Type' : 'Status';
  renderOfferMetrics(offer);
  if (detailBasicStatus) detailBasicStatus.textContent = offer.accountStatusLabel || offer.tag;
  if (detailBasicGame) detailBasicGame.textContent = offer.game;
  if (detailBasicLevel) detailBasicLevel.textContent = formatNumber(offer.accountLevel);
  if (detailBasicViews) detailBasicViews.textContent = offer.popularity || formatNumber(offer.accountViews);
  if (detailBasicSeller) detailBasicSeller.textContent = offer.seller;
  if (buyButton) {
    buyButton.textContent = offer.type === 'product' ? 'Buy Now' : 'Buy service';
  }
  renderGallery(offer);
  renderIncluded(offer.included || []);
  renderOfferReviews(offer);
  setActiveDetailTab('detailOverview');
  syncWishlistForActiveOffer();
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

sideLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    if (link.getAttribute('href') !== '#') {
      return;
    }

    event.preventDefault();
    sideLinks.forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
    setSidebarOpen(false);
  });
});

profileButton?.addEventListener('click', () => {
  setProfileOpen(profileDropdown?.hidden ?? true);
});

detailTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.detailTarget || '';

    setActiveDetailTab(targetId);
  });
});

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  renderProfile();
  setProfileOpen(false);
});

buyButton?.addEventListener('click', () => {
  const { user } = getCurrentAccount();

  if (!user?.username) {
    setStatus('error', 'Please log in before buying.');
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  if (!activeOffer) {
    setStatus('error', 'Offer is not available right now.');
    return;
  }

  if (activeOffer.sellerUsername && activeOffer.sellerUsername === user.username) {
    setStatus('error', 'You cannot buy your own listing.');
    return;
  }

  if (activeOffer.type === 'product') {
    const item = getPurchaseItemFromOffer(activeOffer);
    savePurchases([
      ...getPurchases(),
      {
        id: window.crypto?.randomUUID?.() || String(Date.now()),
        buyerUsername: user.username,
        items: [item],
        total: Number(item.price) || 0,
        status: 'Checkout request',
        purchasedAt: new Date().toISOString(),
      },
    ]);
    renderDetail({ countView: false });
  }

  setStatus('success', 'Order request is saved. The seller will confirm details shortly.');
});

[wishlistButton, detailSaveButton].forEach((button) => {
  button?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const { user } = getCurrentAccount();

    if (!user?.username) {
      setStatus('error', 'Please log in before saving this product.');
      setProfileOpen(true);
      profileButton?.focus();
      return;
    }

    if (!activeOffer) {
      return;
    }

    setWishlistState(toggleActiveOfferFavorite(user.username));

    activeOffer.favoriteCount = getFavoriteCount(getFavoriteId(activeOffer));
    activeOffer.productScore = activeOffer.favoriteCount;
    renderOfferMetrics(activeOffer);
  });
});

messageSellerButton?.addEventListener('click', () => {
  const { user } = getCurrentAccount();

  if (!user?.username) {
    setStatus('error', 'Please log in before messaging the seller.');
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  window.location.href = activeOffer?.sellerUsername
    ? `messages.html?to=${encodeURIComponent(activeOffer.sellerUsername)}`
    : 'messages.html';
});

detailReviewForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  setReviewStatus('', '');

  const { user } = getCurrentAccount();

  if (!user?.username) {
    setReviewStatus('error', 'Please log in before writing a review.');
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  if (!activeOffer?.sellerUsername) {
    setReviewStatus('error', 'This seller cannot be reviewed yet.');
    return;
  }

  if (String(activeOffer.sellerUsername).toLowerCase() === String(user.username).toLowerCase()) {
    setReviewStatus('error', 'You cannot review your own listing.');
    return;
  }

  const purchase = getReviewablePurchase(activeOffer, user.username);

  const rating = Number(detailReviewRating?.value);
  const comment = detailReviewComment?.value.trim() || '';

  if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !comment) {
    setReviewStatus('error', 'Choose a rating and write a short review.');
    return;
  }

  const existingReview = getExistingReview(activeOffer, user.username);
  const review = {
    id: existingReview?.id || window.crypto?.randomUUID?.() || String(Date.now()),
    sellerUsername: activeOffer.sellerUsername,
    sellerName: activeOffer.seller,
    buyerUsername: user.username,
    buyerName: getDisplayName(user),
    listingId: activeOffer.id,
    itemTitle: activeOffer.title,
    purchaseId: purchase?.id || '',
    rating,
    comment,
    reviewType: activeOffer.productType === 'skin' ? 'skin' : 'account',
    createdAt: existingReview?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveSellerReview(review);
  renderDetail({ countView: false });
  setActiveDetailTab('detailReviews');
  setReviewStatus('success', existingReview ? 'Review updated.' : 'Review saved.');
});

detailFeedbackStars?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-detail-rating]');
  if (button) setDetailReviewRating(button.dataset.detailRating);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 920) {
    setSidebarOpen(false);
  }
});

window.addEventListener('storage', (event) => {
  if ([sessionKey, localUsersKey, favoritesKey, purchasesKey, sellerReviewsKey].includes(event.key)) {
    renderProfile();
    renderDetail({ countView: false });
  }

  if (event.key === sellerListingsKey) {
    renderDetail({ countView: false });
  }
});

renderOnlineCount();
renderProfile();
renderDetail();
