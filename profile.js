const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const profileSearch = document.getElementById('profileSearch');
const profileTitle = document.getElementById('profileTitle');
const profileRecordCount = document.getElementById('profileRecordCount');
const profileLoginPanel = document.getElementById('profileLoginPanel');
const publicProfileLayout = document.getElementById('publicProfileLayout');
const publicProfileAvatar = document.getElementById('publicProfileAvatar');
const publicProfileName = document.getElementById('publicProfileName');
const publicProfileHandle = document.getElementById('publicProfileHandle');
const publicProfileJoined = document.getElementById('publicProfileJoined');
const publicProfileMessage = document.getElementById('publicProfileMessage');
const publicProfileRegistered = document.getElementById('publicProfileRegistered');
const publicProfileListed = document.getElementById('publicProfileListed');
const publicProfileSold = document.getElementById('publicProfileSold');
const publicProfileReviewCount = document.getElementById('publicProfileReviewCount');
const publicProfileRating = document.getElementById('publicProfileRating');
const publicProfileListings = document.getElementById('publicProfileListings');
const publicProfileListingsEmpty = document.getElementById('publicProfileListingsEmpty');
const publicProfileReviews = document.getElementById('publicProfileReviews');
const publicProfileReviewsEmpty = document.getElementById('publicProfileReviewsEmpty');
const profileControlLayout = document.getElementById('profileControlLayout');
const profileForm = document.getElementById('profileForm');
const profilePhotoPreview = document.getElementById('profilePhotoPreview');
const profilePhotoInput = document.getElementById('profilePhotoInput');
const profileUsernameInput = document.getElementById('profileUsernameInput');
const profileFirstNameInput = document.getElementById('profileFirstNameInput');
const profileLastNameInput = document.getElementById('profileLastNameInput');
const profilePublicLink = document.getElementById('profilePublicLink');
const profileLogoutButton = document.getElementById('profileLogoutButton');
const profileStatus = document.getElementById('profileStatus');
const profileListings = document.getElementById('profileListings');
const profileListingsEmpty = document.getElementById('profileListingsEmpty');
const profilePurchases = document.getElementById('profilePurchases');
const profilePurchasesEmpty = document.getElementById('profilePurchasesEmpty');
const profileListingModal = document.getElementById('profileListingModal');
const profileListingForm = document.getElementById('profileListingForm');
const profileListingIdInput = document.getElementById('profileListingId');
const profileListingTypeInput = document.getElementById('profileListingType');
const profileListingGameInput = document.getElementById('profileListingGame');
const profileListingTitleInput = document.getElementById('profileListingTitle');
const profileListingAccountStatusInput = document.getElementById('profileListingAccountStatus');
const profileListingAccountLevelInput = document.getElementById('profileListingAccountLevel');
const profileListingPriceInput = document.getElementById('profileListingPrice');
const profileListingImageInput = document.getElementById('profileListingImage');
const profileListingDescriptionInput = document.getElementById('profileListingDescription');
const profileListingStatus = document.getElementById('profileListingStatus');
const profileListingCloseButton = document.getElementById('profileListingCloseButton');
const profileListingCancelButton = document.getElementById('profileListingCancelButton');
const onlineCount = document.getElementById('onlineCount');
const messageCount = document.getElementById('messageCount');

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const sellerListingsKey = 'wavehub.sellerListings';
const purchasesKey = 'wavehub.purchases';
const sellerReviewsKey = 'wavehub.sellerReviews';
const priceOffersKey = 'wavehub.priceOffers';
const cartKey = 'wavehub.cart';
const favoritesKey = 'wavehub.favorites';
const listingGames = ['PUBG Mobile', 'Call of Duty', 'CS2', 'Mobile Legends', 'Free Fire', 'Roblox'];

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
  const user = sessionUser ? { ...sessionUser, ...storedUser } : null;

  return { session, user };
}

function getPublicProfileUsername() {
  return new URLSearchParams(window.location.search).get('user')?.trim().toLowerCase() || '';
}

function getPublicProfileUrl(username) {
  return username ? `profile.html?user=${encodeURIComponent(username)}` : 'profile.html';
}

function getUserByUsername(username) {
  if (!username) {
    return null;
  }

  const users = readJson(localUsersKey, []);
  return Array.isArray(users) ? users.find((user) => user.username === username) || null : null;
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
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || 'Guest account';
}

function formatListingPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? `${Number.isInteger(price) ? price : price.toFixed(2)} GEL` : '0 GEL';
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

function formatProfileDate(value) {
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

function formatCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0';
}

function getSellerReviews(username) {
  if (!username) {
    return [];
  }

  const reviews = readJson(sellerReviewsKey, []);
  return Array.isArray(reviews)
    ? reviews
        .filter((review) => review.sellerUsername === username)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];
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

function getSellerSoldItems(username, listings = getSellerListings(), user = getUserByUsername(username)) {
  if (!username) {
    return [];
  }

  const listingIds = new Set(listings.map((listing) => listing.id).filter(Boolean));
  const displayName = user ? getDisplayName(user) : '';

  return getPurchases()
    .flatMap((purchase) => (Array.isArray(purchase.items) ? purchase.items : []).map((item) => ({
      ...item,
      purchaseId: purchase.id,
      status: purchase.status,
      purchasedAt: purchase.purchasedAt,
    })))
    .filter((item) => (
      item.sellerUsername === username
      || (item.listingId && listingIds.has(item.listingId))
      || (displayName && item.seller === displayName)
    ));
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

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (225 - 94 + 1)) + 94;
  onlineCount.textContent = `${count} online`;
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle('sidebar-open', isOpen);

  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  }

  if (scrim) {
    scrim.hidden = !isOpen;
  }
}

function applyAvatar(element, user) {
  if (!element) {
    return;
  }

  const photoData = user?.photoData || '';
  element.classList.toggle('avatar-image', Boolean(photoData));

  if (photoData) {
    element.style.backgroundImage = `url("${photoData}")`;
    element.textContent = '';
    return;
  }

  element.style.backgroundImage = '';
  element.textContent = user?.username ? getInitials(user) : '?';
}

function setStatus(type, message) {
  if (!profileStatus) {
    return;
  }

  profileStatus.className = type ? `seller-status ${type}` : 'seller-status';
  profileStatus.textContent = message;
}

function getSellerListings() {
  const listings = readJson(sellerListingsKey, []);
  return Array.isArray(listings) ? listings : [];
}

function saveSellerListings(listings) {
  writeJson(sellerListingsKey, listings);
}

function getCartItems() {
  const items = readJson(cartKey, []);
  return Array.isArray(items) ? items : [];
}

function saveCartItems(items) {
  writeJson(cartKey, items);
  window.renderGlobalCartCount?.(items);
}

function formatListingType(listing) {
  const accountTypes = {
    basic: 'Basic Account',
    'full-collection': 'Full Collection Account',
    og: 'OG Account',
    premium: 'Premium Account',
    ranked: 'Ranked Account',
    rare: 'Rare Account',
  };

  if (listing?.listingType === 'account') {
    return accountTypes[listing.accountStatus] || 'Account';
  }

  return listing?.listingType === 'skin' ? 'Skin' : 'Listing';
}

function syncCartListing(listing) {
  if (!listing?.id) {
    return;
  }

  const items = getCartItems();
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.listingId !== listing.id && item.id !== `listing:${listing.id}`) {
      return item;
    }

    changed = true;
    return {
      ...item,
      title: listing.title || item.title,
      productType: formatListingType(listing),
      game: listing.game || item.game,
      price: Number(listing.price) || 0,
      priceText: formatListingPrice(listing.price),
      imageData: listing.imageData || item.imageData,
      detailUrl: getDetailUrl(listing),
    };
  });

  if (changed) {
    saveCartItems(nextItems);
  }
}

function removeListingReferences(listingId) {
  if (!listingId) {
    return;
  }

  const favoriteId = `listing:${listingId}`;
  const favoritesByUser = readJson(favoritesKey, {});
  if (favoritesByUser && typeof favoritesByUser === 'object' && !Array.isArray(favoritesByUser)) {
    const nextFavorites = Object.fromEntries(
      Object.entries(favoritesByUser).map(([username, favorites]) => [
        username,
        Array.isArray(favorites) ? favorites.filter((id) => id !== favoriteId) : favorites,
      ])
    );
    writeJson(favoritesKey, nextFavorites);
  }

  saveCartItems(getCartItems().filter((item) => item.listingId !== listingId && item.id !== favoriteId));

  const offers = readJson(priceOffersKey, []);
  if (Array.isArray(offers)) {
    writeJson(priceOffersKey, offers.filter((offer) => offer.listingId !== listingId));
  }
}

function getPurchases() {
  const purchases = readJson(purchasesKey, []);
  return Array.isArray(purchases) ? purchases : [];
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
        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context?.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      });

      image.addEventListener('error', () => reject(new Error('Image could not be loaded.')));
      image.src = String(reader.result || '');
    });

    reader.addEventListener('error', () => reject(new Error('Image could not be read.')));
    reader.readAsDataURL(file);
  });
}

async function readImageFilesData(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/')).slice(0, 6);

  if (!files.length) {
    return [];
  }

  return Promise.all(files.map((file) => readImageFileData(file)));
}

function populateListingGameOptions(selectedGame = '') {
  if (!profileListingGameInput) {
    return;
  }

  const games = listingGames.includes(selectedGame) || !selectedGame
    ? listingGames
    : [selectedGame, ...listingGames];

  profileListingGameInput.innerHTML = '';
  games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game;
    option.textContent = game;
    option.selected = game === selectedGame;
    profileListingGameInput.appendChild(option);
  });
}

function setListingStatus(type, message) {
  if (!profileListingStatus) {
    return;
  }

  profileListingStatus.className = type ? `seller-status ${type}` : 'seller-status';
  profileListingStatus.textContent = message;
}

function setListingModalOpen(isOpen) {
  if (!profileListingModal) {
    return;
  }

  profileListingModal.hidden = !isOpen;
  document.body.classList.toggle('modal-open', isOpen);

  if (!isOpen) {
    setListingStatus('', '');
    profileListingForm?.reset();
  }
}

function syncAccountFieldsVisibility(listingType) {
  const showAccountFields = listingType === 'account';
  document.querySelectorAll('.profile-listing-account-field').forEach((field) => {
    field.hidden = !showAccountFields;
  });
}

function openListingEditor(listingId) {
  const { user } = getCurrentAccount();
  const listing = getSellerListings().find((item) => item.id === listingId && item.sellerUsername === user?.username);

  if (!listing) {
    setStatus('error', 'Listing was not found for this account.');
    return;
  }

  populateListingGameOptions(listing.game || '');
  if (profileListingIdInput) profileListingIdInput.value = listing.id || '';
  const listingType = ['account', 'skin'].includes(listing.listingType) ? listing.listingType : 'account';
  if (profileListingTypeInput) profileListingTypeInput.value = listingType;
  if (profileListingTitleInput) profileListingTitleInput.value = listing.title || '';
  if (profileListingAccountStatusInput) profileListingAccountStatusInput.value = listing.accountStatus || 'basic';
  if (profileListingAccountLevelInput) profileListingAccountLevelInput.value = listing.accountLevel || '';
  if (profileListingPriceInput) profileListingPriceInput.value = listing.price || '';
  if (profileListingDescriptionInput) profileListingDescriptionInput.value = listing.description || '';
  if (profileListingImageInput) profileListingImageInput.value = '';
  syncAccountFieldsVisibility(listingType);
  setListingStatus('', '');
  setListingModalOpen(true);
  profileListingTitleInput?.focus();
}

function getDetailUrl(listing) {
  return listing?.id ? `detail.html?type=product&id=${encodeURIComponent(listing.id)}` : '#';
}

function getSearchQuery() {
  return profileSearch?.value.trim().toLowerCase() || '';
}

function createRecordCard(item, type) {
  const card = document.createElement('article');
  card.className = 'profile-record-card';
  card.dataset.search = [item.title, item.game, item.seller, item.description, item.status].join(' ').toLowerCase();

  const thumb = document.createElement(item.detailUrl || item.id ? 'a' : 'span');
  thumb.className = 'profile-record-thumb';
  if (item.imageData) {
    thumb.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 19, 0.08), rgba(5, 8, 19, 0.45)), url("${item.imageData}")`;
  } else {
    thumb.textContent = String(item.game || 'WH').slice(0, 2).toUpperCase();
  }

  if (thumb instanceof HTMLAnchorElement) {
    thumb.href = item.detailUrl || getDetailUrl(item);
    thumb.setAttribute('aria-label', `Open ${item.title}`);
  }

  const copy = document.createElement('div');
  copy.className = 'profile-record-copy';

  const title = document.createElement('strong');
  title.textContent = item.title || 'Untitled';

  const meta = document.createElement('span');
  meta.textContent = type === 'purchase'
    ? `${item.game || 'WaveHub'} / ${item.seller || 'Seller'}`
    : `${item.game || 'WaveHub'} / ${item.listingType || 'listing'}`;

  const footer = document.createElement('small');
  footer.textContent = type === 'purchase'
    ? `${item.status || 'Checkout request'} / ${formatDate(item.purchasedAt || item.createdAt)}`
    : `${formatListingPrice(item.price)} / ${formatDate(item.createdAt)}`;

  copy.append(title, meta, footer);

  if (type === 'listing') {
    const actions = document.createElement('div');
    actions.className = 'profile-record-actions';

    const editButton = document.createElement('button');
    editButton.className = 'profile-record-action';
    editButton.type = 'button';
    editButton.dataset.editListingId = item.id || '';
    editButton.textContent = 'Edit';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'profile-record-action danger';
    deleteButton.type = 'button';
    deleteButton.dataset.deleteListingId = item.id || '';
    deleteButton.textContent = 'Delete';

    actions.append(editButton, deleteButton);
    copy.appendChild(actions);
  }

  card.append(thumb, copy);
  return card;
}

function createPublicReviewCard(review) {
  const card = document.createElement('article');
  card.className = 'public-review-card';

  const head = document.createElement('div');
  head.className = 'public-review-head';

  const reviewer = document.createElement('strong');
  reviewer.textContent = review.buyerName || review.buyerUsername || 'Verified buyer';

  const rating = document.createElement('span');
  rating.className = 'public-review-rating';
  rating.textContent = `${formatRating(Number(review.rating))}/5`;

  const date = document.createElement('small');
  date.textContent = formatProfileDate(review.createdAt);

  head.append(reviewer, rating, date);

  const item = document.createElement('span');
  item.textContent = review.itemTitle ? `Order: ${review.itemTitle}` : 'Marketplace order';

  const body = document.createElement('p');
  body.textContent = review.comment || 'No written comment.';

  card.append(head, item, body);
  return card;
}

function renderPublicListings(user) {
  if (!publicProfileListings || !publicProfileListingsEmpty) {
    return [];
  }

  const query = getSearchQuery();
  const listings = getSellerListings()
    .filter((listing) => listing.sellerUsername === user?.username)
    .filter((listing) => {
      const haystack = [listing.title, listing.game, listing.description].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  publicProfileListings.innerHTML = '';
  listings.forEach((listing) => {
    publicProfileListings.appendChild(createRecordCard({ ...listing, detailUrl: getDetailUrl(listing) }, 'publicListing'));
  });
  publicProfileListingsEmpty.hidden = listings.length > 0;

  return listings;
}

function renderPublicReviews(reviews) {
  if (!publicProfileReviews || !publicProfileReviewsEmpty) {
    return [];
  }

  const query = getSearchQuery();
  const filteredReviews = reviews.filter((review) => {
    const haystack = [review.buyerName, review.buyerUsername, review.itemTitle, review.comment].join(' ').toLowerCase();
    return !query || haystack.includes(query);
  });

  publicProfileReviews.innerHTML = '';
  filteredReviews.forEach((review) => {
    publicProfileReviews.appendChild(createPublicReviewCard(review));
  });
  publicProfileReviewsEmpty.hidden = filteredReviews.length > 0;

  return filteredReviews;
}

function renderPublicProfile(user) {
  const listings = getSellerListings().filter((listing) => listing.sellerUsername === user?.username);
  const soldItems = getSellerSoldItems(user?.username, listings, user);
  const reviews = getSellerReviews(user?.username);
  const averageRating = getAverageRating(reviews);
  const joinedDate = formatProfileDate(user?.createdAt);

  if (profileLoginPanel) profileLoginPanel.hidden = true;
  if (profileControlLayout) profileControlLayout.hidden = true;
  if (publicProfileLayout) publicProfileLayout.hidden = false;

  if (!user) {
    document.title = 'Profile not found - WaveHub';
    if (profileTitle) profileTitle.textContent = 'Public Profile';
    applyAvatar(publicProfileAvatar, null);
    if (profileRecordCount) profileRecordCount.textContent = '0';
    if (publicProfileName) publicProfileName.textContent = 'Profile not found';
    if (publicProfileHandle) publicProfileHandle.textContent = '@unknown';
    if (publicProfileJoined) publicProfileJoined.textContent = 'This public profile is unavailable.';
    if (publicProfileRegistered) publicProfileRegistered.textContent = '-';
    if (publicProfileListed) publicProfileListed.textContent = '0';
    if (publicProfileSold) publicProfileSold.textContent = '0';
    if (publicProfileReviewCount) publicProfileReviewCount.textContent = '0';
    if (publicProfileRating) publicProfileRating.textContent = '-';
    if (publicProfileListings) publicProfileListings.innerHTML = '';
    if (publicProfileReviews) publicProfileReviews.innerHTML = '';
    if (publicProfileListingsEmpty) {
      publicProfileListingsEmpty.hidden = false;
      publicProfileListingsEmpty.textContent = 'User was not found.';
    }
    if (publicProfileReviewsEmpty) {
      publicProfileReviewsEmpty.hidden = false;
      publicProfileReviewsEmpty.textContent = 'No reviews yet.';
    }
    return;
  }

  document.title = `${getDisplayName(user)} - WaveHub Profile`;
  if (profileTitle) profileTitle.textContent = 'Public Profile';
  if (profileSearch) profileSearch.placeholder = 'Search public listings or reviews...';
  applyAvatar(publicProfileAvatar, user);
  if (publicProfileName) publicProfileName.textContent = getDisplayName(user);
  if (publicProfileHandle) publicProfileHandle.textContent = `@${user.username}`;
  if (publicProfileJoined) publicProfileJoined.textContent = `Joined ${joinedDate}`;
  if (publicProfileMessage) publicProfileMessage.href = 'messages.html';
  if (publicProfileRegistered) publicProfileRegistered.textContent = joinedDate;
  if (publicProfileListed) publicProfileListed.textContent = formatCount(listings.length);
  if (publicProfileSold) publicProfileSold.textContent = formatCount(soldItems.length);
  if (publicProfileReviewCount) publicProfileReviewCount.textContent = formatCount(reviews.length);
  if (publicProfileRating) publicProfileRating.textContent = averageRating === null ? '-' : `${formatRating(averageRating)}/5`;

  const shownListings = renderPublicListings(user);
  const shownReviews = renderPublicReviews(reviews);
  if (profileRecordCount) profileRecordCount.textContent = String(shownListings.length + shownReviews.length);
  if (messageCount) messageCount.textContent = String(getReceivedOfferCount(getCurrentAccount().user?.username));
}

function renderProfileForm(user) {
  if (!user) {
    return;
  }

  if (profileUsernameInput) profileUsernameInput.value = user.username || '';
  if (profileFirstNameInput) profileFirstNameInput.value = user.firstName || '';
  if (profileLastNameInput) profileLastNameInput.value = user.lastName || '';
  if (profilePublicLink) profilePublicLink.href = getPublicProfileUrl(user.username);
  applyAvatar(profilePhotoPreview, user);
}

function renderListings(user) {
  if (!profileListings || !profileListingsEmpty) {
    return [];
  }

  const query = getSearchQuery();
  const listings = getSellerListings()
    .filter((listing) => listing.sellerUsername === user?.username)
    .filter((listing) => {
      const haystack = [listing.title, listing.game, listing.description].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  profileListings.innerHTML = '';
  listings.forEach((listing) => {
    profileListings.appendChild(createRecordCard({ ...listing, detailUrl: getDetailUrl(listing) }, 'listing'));
  });
  profileListingsEmpty.hidden = listings.length > 0;

  return listings;
}

function renderPurchases(user) {
  if (!profilePurchases || !profilePurchasesEmpty) {
    return [];
  }

  const query = getSearchQuery();
  const purchaseItems = getPurchases()
    .filter((purchase) => purchase.buyerUsername === user?.username)
    .flatMap((purchase) => (Array.isArray(purchase.items) ? purchase.items : []).map((item) => ({
      ...item,
      status: purchase.status,
      purchasedAt: purchase.purchasedAt,
    })))
    .filter((item) => {
      const haystack = [item.title, item.game, item.seller, item.status].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0));

  profilePurchases.innerHTML = '';
  purchaseItems.forEach((purchase) => {
    profilePurchases.appendChild(createRecordCard(purchase, 'purchase'));
  });
  profilePurchasesEmpty.hidden = purchaseItems.length > 0;

  return purchaseItems;
}

function renderPage() {
  const publicUsername = getPublicProfileUsername();
  const publicUser = publicUsername ? getUserByUsername(publicUsername) : null;

  if (publicUsername) {
    renderPublicProfile(publicUser);
    window.wavehubRenderProfileSurfaces?.();
    return;
  }

  const { user } = getCurrentAccount();
  const isSignedIn = Boolean(user?.username);

  if (publicProfileLayout) {
    publicProfileLayout.hidden = true;
  }

  if (profileTitle) {
    profileTitle.textContent = 'Profile';
  }

  if (profileSearch) {
    profileSearch.placeholder = 'Search your listings or purchases...';
  }

  if (profileLoginPanel) {
    profileLoginPanel.hidden = isSignedIn;
  }

  if (profileControlLayout) {
    profileControlLayout.hidden = !isSignedIn;
  }

  if (!isSignedIn) {
    if (profileRecordCount) profileRecordCount.textContent = '0';
    return;
  }

  renderProfileForm(user);
  const listings = renderListings(user);
  const purchases = renderPurchases(user);
  if (profileRecordCount) profileRecordCount.textContent = String(listings.length + purchases.length);
  if (messageCount) messageCount.textContent = String(getReceivedOfferCount(user.username));
  window.wavehubRenderProfileSurfaces?.();
}

function saveUserProfile(nextUser) {
  const users = readJson(localUsersKey, []);
  const nextUsers = Array.isArray(users)
    ? users.map((user) => (user.username === nextUser.username ? { ...user, ...nextUser } : user))
    : [nextUser];

  if (!nextUsers.some((user) => user.username === nextUser.username)) {
    nextUsers.push(nextUser);
  }

  writeJson(localUsersKey, nextUsers);
  writeJson(sessionKey, {
    ...readJson(sessionKey, {}),
    user: {
      id: nextUser.id,
      username: nextUser.username,
      firstName: nextUser.firstName,
      lastName: nextUser.lastName,
      photoData: nextUser.photoData || '',
    },
  });
}

function syncSellerListings(user) {
  const displayName = getDisplayName(user);
  const listings = getSellerListings();
  let changed = false;
  const nextListings = listings.map((listing) => {
    if (listing.sellerUsername !== user.username) {
      return listing;
    }

    changed = true;
    return {
      ...listing,
      sellerName: displayName,
      sellerAvatar: user.photoData || '',
    };
  });

  if (changed) {
    saveSellerListings(nextListings);
  }
}

menuToggle?.addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});

scrim?.addEventListener('click', () => setSidebarOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSidebarOpen(false);
    setListingModalOpen(false);
  }
});

profileListingCloseButton?.addEventListener('click', () => setListingModalOpen(false));
profileListingCancelButton?.addEventListener('click', () => setListingModalOpen(false));
profileListingTypeInput?.addEventListener('change', () => {
  syncAccountFieldsVisibility(profileListingTypeInput.value || '');
});

profileListingModal?.addEventListener('click', (event) => {
  if (event.target === profileListingModal) {
    setListingModalOpen(false);
  }
});

profileListings?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const editButton = target?.closest('[data-edit-listing-id]');
  const deleteButton = target?.closest('[data-delete-listing-id]');

  if (editButton instanceof HTMLElement) {
    openListingEditor(editButton.dataset.editListingId || '');
    return;
  }

  if (!(deleteButton instanceof HTMLElement)) {
    return;
  }

  const listingId = deleteButton.dataset.deleteListingId || '';
  const { user } = getCurrentAccount();
  const listings = getSellerListings();
  const listing = listings.find((item) => item.id === listingId && item.sellerUsername === user?.username);

  if (!listing) {
    setStatus('error', 'Listing was not found for this account.');
    return;
  }

  const shouldDelete = window.confirm(`Delete "${listing.title || 'this listing'}"?`);
  if (!shouldDelete) {
    return;
  }

  saveSellerListings(listings.filter((item) => item.id !== listingId));
  removeListingReferences(listingId);
  setStatus('success', 'Listing deleted.');
  renderPage();
});

profileListingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const { user } = getCurrentAccount();
  const listingId = profileListingIdInput?.value || '';
  const listings = getSellerListings();
  const listing = listings.find((item) => item.id === listingId && item.sellerUsername === user?.username);

  if (!listing) {
    setListingStatus('error', 'Listing was not found for this account.');
    return;
  }

  const title = profileListingTitleInput?.value.trim() || '';
  const requestedListingType = profileListingTypeInput?.value || 'account';
  const listingType = ['account', 'skin'].includes(requestedListingType) ? requestedListingType : 'account';
  const game = profileListingGameInput?.value.trim() || '';
  const price = Number(profileListingPriceInput?.value);
  const description = profileListingDescriptionInput?.value.trim() || '';

  if (!title || !game || !Number.isFinite(price) || price <= 0 || !description) {
    setListingStatus('error', 'Fill title, game, price and description.');
    return;
  }

  let galleryImages = Array.isArray(listing.galleryImages) ? [...listing.galleryImages] : [];
  let imageData = listing.imageData || galleryImages[0] || '';
  let imageName = listing.imageName || '';

  if (profileListingImageInput?.files?.length) {
    try {
      galleryImages = await readImageFilesData(profileListingImageInput.files);
      imageData = galleryImages[0] || imageData;
      imageName = Array.from(profileListingImageInput.files).map((file) => file.name).join(', ');
    } catch {
      setListingStatus('error', 'Could not read product images.');
      return;
    }
  }

  let updatedListing = null;
  const nextListings = listings.map((item) => {
    if (item.id !== listingId) {
      return item;
    }

    updatedListing = {
      ...item,
      listingType,
      game,
      title,
      price,
      description,
      accountStatus: listingType === 'account' ? profileListingAccountStatusInput?.value || 'basic' : '',
      accountLevel: listingType === 'account' ? profileListingAccountLevelInput?.value.trim() || '' : '',
      imageData,
      galleryImages,
      imageName,
      updatedAt: new Date().toISOString(),
    };

    return updatedListing;
  });

  saveSellerListings(nextListings);
  syncCartListing(updatedListing);
  setListingModalOpen(false);
  setStatus('success', 'Listing updated.');
  renderPage();
});

profilePhotoInput?.addEventListener('change', async () => {
  const { user } = getCurrentAccount();
  const file = profilePhotoInput.files?.[0];

  if (!user || !file) {
    return;
  }

  try {
    const photoData = await readImageFileData(file);
    applyAvatar(profilePhotoPreview, { ...user, photoData });
    setStatus('', '');
  } catch {
    setStatus('error', 'Could not read the profile photo.');
  }
});

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const { user } = getCurrentAccount();

  if (!user?.username) {
    setStatus('error', 'Please log in before editing your profile.');
    return;
  }

  let photoData = user.photoData || '';
  const file = profilePhotoInput?.files?.[0];

  if (file) {
    try {
      photoData = await readImageFileData(file);
    } catch {
      setStatus('error', 'Could not read the profile photo.');
      return;
    }
  }

  const nextUser = {
    ...user,
    firstName: profileFirstNameInput?.value.trim() || '',
    lastName: profileLastNameInput?.value.trim() || '',
    photoData,
  };

  saveUserProfile(nextUser);
  syncSellerListings(nextUser);
  if (profilePhotoInput) profilePhotoInput.value = '';
  setStatus('success', 'Profile updated.');
  renderPage();
});

profileLogoutButton?.addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  setStatus('', '');
  renderPage();
  window.wavehubRenderProfileSurfaces?.();
});

profileSearch?.addEventListener('input', renderPage);

window.addEventListener('storage', (event) => {
  if ([localUsersKey, sessionKey, sellerListingsKey, purchasesKey, sellerReviewsKey, priceOffersKey].includes(event.key)) {
    renderPage();
  }
});

renderOnlineCount();
renderPage();
