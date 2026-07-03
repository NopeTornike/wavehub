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
const messageCount = document.getElementById('messageCount');
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
const detailDelivery = document.getElementById('detailDelivery');
const detailStatusText = document.getElementById('detailStatusText');
const detailLevel = document.getElementById('detailLevel');
const detailViews = document.getElementById('detailViews');
const detailLongDescription = document.getElementById('detailLongDescription');
const detailIncluded = document.getElementById('detailIncluded');
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
const buyButton = document.getElementById('buyButton');
const wishlistButton = document.getElementById('wishlistButton');
const messageSellerButton = document.getElementById('messageSellerButton');
const buyStatus = document.getElementById('buyStatus');
const priceOfferForm = document.getElementById('priceOfferForm');
const offerPriceInput = document.getElementById('offerPrice');
const offerMessageInput = document.getElementById('offerMessage');
const offerStatus = document.getElementById('offerStatus');

const sellerListingsKey = 'wavehub.sellerListings';
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const favoritesKey = 'wavehub.favorites';
const priceOffersKey = 'wavehub.priceOffers';
const minOnlineCount = 94;
const maxOnlineCount = 225;
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
  'call-of-duty-codm-coaching-pro-player': {
    type: 'service',
    title: 'CODM Pro Coaching',
    description: 'One-on-one aim, movement and ranked strategy session.',
    longDescription: 'A CODM coach reviews your current playstyle, runs a focused live session and gives practical drills for aim control, positioning and ranked decision-making.',
    seller: 'NeroRush',
    game: 'Call of Duty',
    delivery: '1 hour session',
    status: 'Pro coach',
    tag: 'Pro',
    tagClass: 'pro',
    price: '25 GEL/hr',
    included: ['Live coaching call', 'Aim and movement review', 'Ranked strategy notes', 'Personal practice plan'],
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
  return listing.sellerName || `${listing.game} ${config.sellerNoun}`;
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
    delivery: config.type === 'skin' ? 'Instant delivery' : 'After seller confirmation',
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
    sellerScore: listing.sellerScore || '-',
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

function setOfferStatus(type, message) {
  if (!offerStatus) {
    return;
  }

  offerStatus.className = type ? `seller-status ${type}` : 'seller-status';
  offerStatus.textContent = message;
}

function getPriceOffers() {
  const offers = readJson(priceOffersKey, []);
  return Array.isArray(offers) ? offers : [];
}

function getReceivedOfferCount(username) {
  if (!username) {
    return 0;
  }

  return getPriceOffers().filter((offer) => offer.sellerUsername === username).length;
}

function savePriceOffer(offer) {
  writeJson(priceOffersKey, [offer, ...getPriceOffers()]);
}

function buildOfferMessage(offer, buyerName, offeredPrice, note) {
  const base = `${buyerName} offered ${offeredPrice} for ${offer.title}.`;
  return note ? `${base} Message: ${note}` : base;
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

  const accountTypeImage = offer.productType === 'account' ? getAccountTypeImage(offer.accountStatus) : '';

  if (accountTypeImage) {
    visuals[0] = {
      label: offer.accountStatusLabel || 'Account card',
      coverClass: '',
      src: accountTypeImage,
      isBasicCard: true,
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
  const nextTargetId = document.getElementById(targetId)?.classList.contains('detail-tab-panel')
    ? targetId
    : 'detailOverview';

  detailTabButtons.forEach((button) => {
    const isActive = button.dataset.detailTarget === nextTargetId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  detailTabPanels.forEach((panel) => {
    panel.hidden = panel.id !== nextTargetId;
  });
}

function renderOfferMetrics(offer) {
  if (!offer) {
    return;
  }

  if (detailSellerScore) detailSellerScore.textContent = offer.sellerScore || '-';
  if (detailSellerScoreLabel) detailSellerScoreLabel.textContent = offer.sellerScore && offer.sellerScore !== '-' ? 'Rated' : 'No rating';
  if (detailQualityScore) detailQualityScore.textContent = formatNumber(offer.productScore);
  if (detailQualityScoreLabel) detailQualityScoreLabel.textContent = offer.productScore === 1 ? 'saved' : 'saves';
  if (detailPopularity) detailPopularity.textContent = offer.popularity || formatNumber(offer.accountViews);
  if (detailSideSellerScore) detailSideSellerScore.textContent = offer.sellerScore || '-';
  if (detailSideSellerScoreLabel) detailSideSellerScoreLabel.textContent = offer.sellerScore && offer.sellerScore !== '-' ? 'Rated' : 'No rating';
  if (detailSideQualityScore) detailSideQualityScore.textContent = formatNumber(offer.productScore);
  if (detailSideQualityScoreLabel) detailSideQualityScoreLabel.textContent = offer.favoriteCount === 1 ? 'saved' : 'saves';
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
  if (detailSeller) detailSeller.textContent = offer.seller;
  if (detailGame) detailGame.textContent = offer.game;
  if (detailDelivery) detailDelivery.textContent = offer.delivery;
  if (detailStatusText) detailStatusText.textContent = offer.status;
  if (detailLevel) detailLevel.textContent = formatNumber(offer.accountLevel);
  if (detailViews) detailViews.textContent = offer.popularity || formatNumber(offer.accountViews);
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
  renderOfferMetrics(offer);
  if (detailBasicStatus) detailBasicStatus.textContent = offer.accountStatusLabel || offer.tag;
  if (detailBasicGame) detailBasicGame.textContent = offer.game;
  if (detailBasicLevel) detailBasicLevel.textContent = formatNumber(offer.accountLevel);
  if (detailBasicViews) detailBasicViews.textContent = offer.popularity || formatNumber(offer.accountViews);
  if (detailBasicSeller) detailBasicSeller.textContent = offer.seller;
  if (buyButton) {
    buyButton.textContent = offer.type === 'product' ? 'Buy Now' : 'Buy service';
  }
  if (offerPriceInput) {
    offerPriceInput.value = '';
    offerPriceInput.placeholder = `Offer below ${formatListingPrice(getNumericPrice(offer.price) || 1)}`;
  }

  renderGallery(offer);
  renderIncluded(offer.included || []);
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

  setStatus('success', 'Order request is ready. The seller will confirm details shortly.');
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

  window.location.href = 'messages.html';
});

priceOfferForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  setOfferStatus('', '');

  const { user } = getCurrentAccount();

  if (!user?.username) {
    setOfferStatus('error', 'Please log in before sending a price offer.');
    setProfileOpen(true);
    profileButton?.focus();
    return;
  }

  if (!activeOffer) {
    setOfferStatus('error', 'Offer is not available right now.');
    return;
  }

  if (activeOffer.sellerUsername && activeOffer.sellerUsername === user.username) {
    setOfferStatus('error', 'You cannot send a price offer to your own listing.');
    return;
  }

  const amount = Number(offerPriceInput?.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    setOfferStatus('error', 'Please enter a valid price.');
    return;
  }

  const offeredPrice = formatListingPrice(amount);
  const buyerName = getDisplayName(user);
  const note = offerMessageInput?.value.trim() || '';
  const priceOffer = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    itemId: activeOffer.id,
    itemType: activeOffer.type,
    itemTitle: activeOffer.title,
    detailUrl: `detail.html?type=${activeOffer.type}&id=${encodeURIComponent(activeOffer.id)}`,
    game: activeOffer.game,
    askingPrice: activeOffer.price,
    offeredPrice,
    amount,
    message: buildOfferMessage(activeOffer, buyerName, offeredPrice, note),
    note,
    buyerUsername: user.username,
    buyerName,
    sellerUsername: activeOffer.sellerUsername || '',
    sellerName: activeOffer.seller,
    status: 'sent',
    createdAt: new Date().toISOString(),
  };

  savePriceOffer(priceOffer);
  priceOfferForm.reset();
  renderProfile();
  setOfferStatus('success', activeOffer.sellerUsername
    ? 'Price offer sent to the seller messages.'
    : 'Price offer saved in your sent messages.');
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 920) {
    setSidebarOpen(false);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === sessionKey || event.key === localUsersKey || event.key === priceOffersKey || event.key === favoritesKey) {
    renderProfile();
  }

  if (event.key === sellerListingsKey) {
    renderDetail({ countView: false });
  }
});

renderOnlineCount();
renderProfile();
renderDetail();
