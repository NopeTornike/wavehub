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
const publicProfileBio = document.getElementById('publicProfileBio');
const publicProfileMessage = document.getElementById('publicProfileMessage');
const publicProfileRole = document.getElementById('publicProfileRole');
const publicProfileRank = document.getElementById('publicProfileRank');
const publicProfileRankCaption = document.getElementById('publicProfileRankCaption');
const publicProfileRankProgress = document.getElementById('publicProfileRankProgress');
const publicProfileRankMeta = document.getElementById('publicProfileRankMeta');
const publicProfileRegistered = document.getElementById('publicProfileRegistered');
const publicProfileListed = document.getElementById('publicProfileListed');
const publicProfileSold = document.getElementById('publicProfileSold');
const publicProfileReviewCount = document.getElementById('publicProfileReviewCount');
const publicProfileRating = document.getElementById('publicProfileRating');
const publicProfileListings = document.getElementById('publicProfileListings');
const publicProfileListingsEmpty = document.getElementById('publicProfileListingsEmpty');
const publicProfileReviews = document.getElementById('publicProfileReviews');
const publicProfileReviewsEmpty = document.getElementById('publicProfileReviewsEmpty');
const publicProfileFactUsername = document.getElementById('publicProfileFactUsername');
const publicProfileFactType = document.getElementById('publicProfileFactType');
const publicProfileFactActivity = document.getElementById('publicProfileFactActivity');
const publicProfileRatingTotal = document.getElementById('publicProfileRatingTotal');
const publicProfileScore = document.getElementById('publicProfileScore');
const publicProfileScoreStars = document.getElementById('publicProfileScoreStars');
const publicProfileRatingBars = document.getElementById('publicProfileRatingBars');
const publicProfileListingCount = document.getElementById('publicProfileListingCount');
const publicProfileReviewsCount = document.getElementById('publicProfileReviewsCount');
const publicProfileActivityNote = document.getElementById('publicProfileActivityNote');
const publicProfileMainGame = document.getElementById('publicProfileMainGame');
const publicProfileMainGameMeta = document.getElementById('publicProfileMainGameMeta');
const publicProfileMainGameImage = document.getElementById('publicProfileMainGameImage');
const publicProfileSecondaryGame = document.getElementById('publicProfileSecondaryGame');
const publicProfileSecondaryGameMeta = document.getElementById('publicProfileSecondaryGameMeta');
const publicProfileSecondaryGameImage = document.getElementById('publicProfileSecondaryGameImage');
const publicProfileBadges = document.getElementById('publicProfileBadges');
const publicProfilePerformanceReviews = document.getElementById('publicProfilePerformanceReviews');
const publicProfilePerformanceOrders = document.getElementById('publicProfilePerformanceOrders');
const publicProfilePerformanceListings = document.getElementById('publicProfilePerformanceListings');
const publicProfilePerformanceGames = document.getElementById('publicProfilePerformanceGames');
const profileControlLayout = document.getElementById('profileControlLayout');
const profileForm = document.getElementById('profileForm');
const profilePhotoPreview = document.getElementById('profilePhotoPreview');
const profilePhotoInput = document.getElementById('profilePhotoInput');
const profileUsernameInput = document.getElementById('profileUsernameInput');
const profileFirstNameInput = document.getElementById('profileFirstNameInput');
const profileLastNameInput = document.getElementById('profileLastNameInput');
const profileBioInput = document.getElementById('profileBioInput');
const profileBioCount = document.getElementById('profileBioCount');
const profileMainGamesField = document.getElementById('profileMainGamesField');
const profileMainGamesHelp = document.getElementById('profileMainGamesHelp');
const profilePublicLink = document.getElementById('profilePublicLink');
const profileLogoutButton = document.getElementById('profileLogoutButton');
const profileStatus = document.getElementById('profileStatus');
const profileListings = document.getElementById('profileListings');
const profileListingsEmpty = document.getElementById('profileListingsEmpty');
const profileSessions = document.getElementById('profileSessions');
const profileSessionsEmpty = document.getElementById('profileSessionsEmpty');
const profileAddSessionButton = document.getElementById('profileAddSessionButton');
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
const profileSessionModal = document.getElementById('profileSessionModal');
const profileSessionForm = document.getElementById('profileSessionForm');
const profileSessionIdInput = document.getElementById('profileSessionId');
const profileSessionCoachInput = document.getElementById('profileSessionCoach');
const profileSessionGameInput = document.getElementById('profileSessionGame');
const profileSessionPriceInput = document.getElementById('profileSessionPrice');
const profileSessionLanguageInput = document.getElementById('profileSessionLanguage');
const profileSessionDateInput = document.getElementById('profileSessionDate');
const profileSessionTimeInput = document.getElementById('profileSessionTime');
const profileSessionAboutInput = document.getElementById('profileSessionAbout');
const profileSessionDescriptionInput = document.getElementById('profileSessionDescription');
const profileSessionRankInput = document.getElementById('profileSessionRank');
const profileSessionSpecialtyInput = document.getElementById('profileSessionSpecialty');
const profileSessionExperienceInput = document.getElementById('profileSessionExperience');
const profileSessionSuccessRateInput = document.getElementById('profileSessionSuccessRate');
const profileSessionResponseTimeInput = document.getElementById('profileSessionResponseTime');
const profileSessionStyleInput = document.getElementById('profileSessionStyle');
const profileSessionExpertiseInput = document.getElementById('profileSessionExpertise');
const profileSessionAchievementsInput = document.getElementById('profileSessionAchievements');
const profileSessionStatus = document.getElementById('profileSessionStatus');
const profileSessionCloseButton = document.getElementById('profileSessionCloseButton');
const profileSessionCancelButton = document.getElementById('profileSessionCancelButton');
const onlineCount = document.getElementById('onlineCount');

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const sellerListingsKey = 'wavehub.sellerListings';
const purchasesKey = 'wavehub.purchases';
const sellerReviewsKey = 'wavehub.sellerReviews';
const cartKey = 'wavehub.cart';
const favoritesKey = 'wavehub.favorites';
const listingGames = [
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
];
const coaches = Array.isArray(window.wavehubCoaches) ? window.wavehubCoaches : [];
const sessionTimeOptions = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '18:30', '19:00', '19:30', '20:00', '21:00'];
const publicProfileGameImages = {
  'PUBG Mobile': 'assets/pubg-photo.jpeg',
  'Call of Duty': 'assets/call-of-duty-marketplace-photo.png',
  CS2: 'assets/cs2-photo.jpeg',
  'Mobile Legends': 'assets/mobile-legends-photo.jpeg',
  'Free Fire': 'assets/freefire-photo.jpeg',
  Roblox: 'assets/roblox-photo.jpeg',
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
  const normalizedUsername = String(username).trim().toLowerCase();
  return Array.isArray(users)
    ? users.find((user) => String(user.username || '').trim().toLowerCase() === normalizedUsername) || null
    : null;
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

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (23 - 2 + 1)) + 2;
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

function getCoachingSessions(username = getCurrentAccount().user?.username) {
  if (!username) {
    return [];
  }

  return getCartItems().filter((item) => (
    (item.productType === 'Coaching' || String(item.id || '').startsWith('coach:'))
    && item.buyerUsername === username
  ));
}

function getCoachGames(coach) {
  const games = Array.isArray(coach?.games) ? coach.games.filter(Boolean) : [];
  return games.length ? games : [coach?.game].filter(Boolean);
}

function getCoachById(coachId) {
  return coaches.find((coach) => coach.id === coachId)
    || coaches.find((coach) => coach.name === coachId)
    || null;
}

function getSlug(value) {
  const source = String(value || 'session').trim();
  const latinSlug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return latinSlug || encodeURIComponent(source).replace(/%/g, '').toLowerCase().slice(0, 48) || 'session';
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getTodayKey() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getDateKey(today);
}

function formatSessionDate(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getSessionLabel(game, date, time) {
  return game && date && time ? `${game} / ${formatSessionDate(date)} at ${time}` : 'Unscheduled session';
}

function populateSessionCoachOptions(selectedCoachId = '') {
  if (!profileSessionCoachInput) {
    return;
  }

  const coach = getCoachById(selectedCoachId);
  profileSessionCoachInput.value = coach?.name || selectedCoachId || '';
}

function populateSessionGameOptions(coach, selectedGame = '') {
  if (!profileSessionGameInput) {
    return;
  }

  profileSessionGameInput.value = selectedGame || getCoachGames(coach)[0] || '';
}

function populateSessionTimeOptions(selectedTime = '') {
  if (!profileSessionTimeInput) {
    return;
  }

  const times = sessionTimeOptions.includes(selectedTime) || !selectedTime
    ? sessionTimeOptions
    : [selectedTime, ...sessionTimeOptions];

  profileSessionTimeInput.innerHTML = '';
  times.forEach((time) => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = time;
    option.selected = time === selectedTime;
    profileSessionTimeInput.appendChild(option);
  });
}

function setSessionStatus(type, message) {
  if (!profileSessionStatus) {
    return;
  }

  profileSessionStatus.className = type ? `seller-status ${type}` : 'seller-status';
  profileSessionStatus.textContent = message;
}

function setSessionModalOpen(isOpen) {
  if (!profileSessionModal) {
    return;
  }

  profileSessionModal.hidden = !isOpen;
  document.body.classList.toggle('modal-open', isOpen || !profileListingModal?.hidden);

  if (!isOpen) {
    setSessionStatus('', '');
    profileSessionForm?.reset();
  }
}

function buildCoachSessionItem(coachName, sessionGame, sessionDate, sessionTime, sessionPrice, language, about, sessionDescription, coachDetails = {}, existingItem = {}) {
  const { user } = getCurrentAccount();
  const coachId = existingItem.listingId || `custom-${getSlug(coachName)}`;
  const buyerUsername = existingItem.buyerUsername || user?.username || '';
  const buyerName = existingItem.buyerName || (user ? getDisplayName(user) : '');
  const price = Number(sessionPrice ?? existingItem.price) || 0;
  const sessionLabel = getSessionLabel(sessionGame, sessionDate, sessionTime);
  const cleanAbout = String(about || '').trim();
  const meetYourCoach = cleanAbout ? `Hi, I'm ${coachName}. ${cleanAbout}` : '';

  return {
    ...existingItem,
    id: existingItem.id || `coach:${buyerUsername || 'guest'}:${coachId}:${getSlug(sessionGame)}:${sessionDate}:${sessionTime}`,
    listingId: coachId,
    title: `${coachName || existingItem.seller || 'Coach'} Coaching Session`,
    productType: 'Coaching',
    isCoachListing: true,
    game: sessionGame,
    seller: coachName || existingItem.seller || 'Coach',
    buyerUsername,
    buyerName,
    price,
    priceText: `${price} GEL/hour`,
    language,
    languages: language ? [language] : [],
    about: cleanAbout,
    bio: cleanAbout,
    quote: meetYourCoach,
    sessionDescription: String(sessionDescription || '').trim(),
    rank: coachDetails.rank || '',
    specialty: coachDetails.specialty || '',
    yearsExperience: Number(coachDetails.yearsExperience) || 0,
    successRate: Number(coachDetails.successRate) || 0,
    responseTime: coachDetails.responseTime || '',
    responseTimeMinutes: Number(coachDetails.responseTimeMinutes) || 0,
    style: coachDetails.style || [],
    expertise: coachDetails.expertise || [],
    expertiseAreas: [],
    achievements: coachDetails.achievements || [],
    imageData: existingItem.imageData || '',
    detailUrl: `coach-book-session.html?coach=${encodeURIComponent(existingItem.id || `coach:${buyerUsername || 'guest'}:${coachId}:${getSlug(sessionGame)}:${sessionDate}:${sessionTime}`)}`,
    sessionDate,
    sessionTime,
    sessionLabel,
    addedAt: existingItem.addedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function syncSessionControlsForCoach(selectedGame = '') {
  populateSessionGameOptions(null, selectedGame || profileSessionGameInput?.value || '');
}

function openSessionEditor(sessionId = '') {
  const session = sessionId ? getCoachingSessions(getCurrentAccount().user?.username).find((item) => item.id === sessionId) : null;
  const coach = getCoachById(session?.listingId || '');
  const selectedCoachId = session?.seller || session?.listingId || coach?.name || '';
  const selectedGame = session?.game || getCoachGames(coach)[0] || '';
  const selectedDate = session?.sessionDate || getTodayKey();
  const selectedTime = session?.sessionTime || sessionTimeOptions[0];

  populateSessionCoachOptions(selectedCoachId);
  populateSessionGameOptions(coach, selectedGame);
  populateSessionTimeOptions(selectedTime);

  if (profileSessionIdInput) profileSessionIdInput.value = session?.id || '';
  if (profileSessionDateInput) {
    profileSessionDateInput.min = getTodayKey();
    profileSessionDateInput.value = selectedDate;
  }
  if (profileSessionPriceInput) profileSessionPriceInput.value = session?.price || '';
  if (profileSessionLanguageInput) profileSessionLanguageInput.value = session?.language || '';
  if (profileSessionAboutInput) profileSessionAboutInput.value = session?.about || session?.bio || '';
  if (profileSessionDescriptionInput) profileSessionDescriptionInput.value = session?.sessionDescription || '';
  if (profileSessionRankInput) profileSessionRankInput.value = session?.rank || '';
  if (profileSessionSpecialtyInput) profileSessionSpecialtyInput.value = session?.specialty || '';
  if (profileSessionExperienceInput) profileSessionExperienceInput.value = session?.yearsExperience ?? '';
  if (profileSessionSuccessRateInput) profileSessionSuccessRateInput.value = session?.successRate ?? '';
  if (profileSessionResponseTimeInput) profileSessionResponseTimeInput.value = session?.responseTimeMinutes ?? '';
  if (profileSessionStyleInput) profileSessionStyleInput.value = (session?.style || []).join('\n');
  if (profileSessionExpertiseInput) {
    const expertise = session?.expertise || [];
    profileSessionExpertiseInput.value = expertise.length
      ? expertise.map((item) => `${item.label || ''}: ${item.value ?? ''}`).join('\n')
      : (session?.expertiseAreas || []).map((item) => `${item}: `).join('\n');
  }
  if (profileSessionAchievementsInput) {
    profileSessionAchievementsInput.value = (session?.achievements || [])
      .map((item) => (typeof item === 'string' ? item : item?.label || item?.value || ''))
      .filter(Boolean)
      .join('\n');
  }

  setSessionStatus('', '');
  setSessionModalOpen(true);
  profileSessionCoachInput?.focus();
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

}

function formatProfileMonth(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
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
  document.body.classList.toggle('modal-open', isOpen || !profileSessionModal?.hidden);

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
  meta.textContent = type === 'purchase' || type === 'session'
    ? `${item.game || 'WaveHub'} / ${item.seller || 'Seller'}`
    : `${item.game || 'WaveHub'} / ${item.listingType || 'listing'}`;

  const footer = document.createElement('small');
  footer.textContent = type === 'session'
    ? `${item.sessionLabel || 'Unscheduled session'} / ${item.priceText || formatListingPrice(item.price)} / Avg. Response Time: ${item.responseTime || 'Not specified'}`
    : type === 'purchase'
    ? `${item.status || 'Checkout request'} / ${formatDate(item.purchasedAt || item.createdAt)}`
    : `${formatListingPrice(item.price)} / ${formatDate(item.createdAt)}`;

  copy.append(title, meta, footer);

  if (type === 'listing' || type === 'session') {
    const actions = document.createElement('div');
    actions.className = 'profile-record-actions';

    const editButton = document.createElement('button');
    editButton.className = 'profile-record-action';
    editButton.type = 'button';
    if (type === 'session') {
      editButton.dataset.editSessionId = item.id || '';
    } else {
      editButton.dataset.editListingId = item.id || '';
    }
    editButton.textContent = 'Edit';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'profile-record-action danger';
    deleteButton.type = 'button';
    if (type === 'session') {
      deleteButton.dataset.deleteSessionId = item.id || '';
    } else {
      deleteButton.dataset.deleteListingId = item.id || '';
    }
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

  const reviewerWrap = document.createElement('div');
  reviewerWrap.className = 'public-review-reviewer';

  const reviewerAvatar = document.createElement('span');
  reviewerAvatar.className = 'message-avatar';
  const reviewerName = review.buyerName || review.buyerUsername || 'Verified buyer';
  const reviewerUser = getUserByUsername(review.buyerUsername);
  if (reviewerUser) {
    applyAvatar(reviewerAvatar, reviewerUser);
  } else {
    reviewerAvatar.textContent = String(reviewerName).trim().charAt(0).toUpperCase() || '?';
  }

  const reviewer = document.createElement('strong');
  reviewer.textContent = reviewerName;
  reviewerWrap.append(reviewerAvatar, reviewer);

  const rating = document.createElement('span');
  rating.className = 'public-review-rating';
  const numericRating = Math.max(0, Math.min(5, Number(review.rating) || 0));
  rating.textContent = `${'★'.repeat(Math.round(numericRating))}${'☆'.repeat(5 - Math.round(numericRating))}`;

  const date = document.createElement('small');
  date.textContent = formatProfileDate(review.createdAt);

  head.append(reviewerWrap, rating, date);

  const item = document.createElement('span');
  item.textContent = review.itemTitle ? `Order: ${review.itemTitle}` : 'Marketplace order';

  const body = document.createElement('p');
  body.textContent = review.comment || 'No written comment.';

  card.append(head, item, body);
  return card;
}

function getPublicProfileRank(username) {
  const users = readJson(localUsersKey, []);
  const listings = getSellerListings();
  const rankedUsers = (Array.isArray(users) ? users : []).map((user) => {
    const userListings = listings.filter((listing) => listing.sellerUsername === user.username);
    const orders = getSellerSoldItems(user.username, userListings, user).length;
    const reviews = getSellerReviews(user.username);
    return {
      username: user.username,
      orders,
      reviews: reviews.length,
      listings: userListings.length,
      rating: getAverageRating(reviews) || 0,
    };
  }).filter((entry) => entry.orders || entry.reviews || entry.listings).sort((a, b) => (
    b.orders - a.orders
    || b.reviews - a.reviews
    || b.listings - a.listings
    || b.rating - a.rating
    || a.username.localeCompare(b.username)
  ));

  const index = rankedUsers.findIndex((entry) => entry.username === username);
  if (index < 0) return null;
  const rank = index + 1;
  const total = Math.max(rankedUsers.length, 1);
  const percentile = Math.max(1, Math.ceil((rank / total) * 100));
  return { rank, total, percentile, progress: Math.max(4, Math.round(((total - rank + 1) / total) * 100)) };
}

function getPublicProfileGames(listings, soldItems) {
  const activity = [...listings, ...soldItems].reduce((games, item) => {
    const game = String(item.game || '').trim();
    if (!game) return games;
    const current = games.get(game) || { game, count: 0, listings: 0, orders: 0, imageData: '' };
    current.count += 1;
    current.listings += listings.includes(item) ? 1 : 0;
    current.orders += soldItems.includes(item) ? 1 : 0;
    current.imageData ||= item.imageData || '';
    games.set(game, current);
    return games;
  }, new Map());
  return [...activity.values()].sort((a, b) => b.count - a.count || a.game.localeCompare(b.game));
}

function renderPublicProfileGame(game, nameElement, metaElement, imageElement, fallbackTitle, fallbackMeta) {
  if (nameElement) nameElement.textContent = game?.game || fallbackTitle;
  if (metaElement) {
    metaElement.textContent = game
      ? game.selected && !game.listings && !game.orders
        ? 'Selected in profile settings'
        : `${formatCount(game.listings)} listing${game.listings === 1 ? '' : 's'} · ${formatCount(game.orders)} order${game.orders === 1 ? '' : 's'}`
      : fallbackMeta;
  }
  if (imageElement) {
    const image = game?.imageData || publicProfileGameImages[game?.game] || '';
    imageElement.style.backgroundImage = image
      ? `linear-gradient(180deg, rgba(4, 7, 17, 0.03), rgba(4, 7, 17, 0.5)), url("${image}")`
      : '';
    imageElement.classList.toggle('is-empty', !image);
    imageElement.textContent = image ? '' : 'WH';
  }
}

function getDisplayedProfileGames(user, rankedGames) {
  const selectedGames = Array.isArray(user?.mainGames)
    ? user.mainGames.filter((game) => listingGames.includes(game)).slice(0, 2)
    : [];

  if (!selectedGames.length) {
    return rankedGames.slice(0, 2);
  }

  return selectedGames.map((gameName) => ({
    ...(rankedGames.find((game) => game.game === gameName) || {
      game: gameName,
      count: 0,
      listings: 0,
      orders: 0,
      imageData: '',
    }),
    selected: true,
  }));
}

function renderPublicProfileBadges(user, listings, soldItems, reviews, averageRating) {
  if (!publicProfileBadges) return;
  const badges = [{ icon: 'W', title: 'WaveHub member', detail: `Joined ${formatProfileMonth(user.createdAt)}` }];
  if (listings.length) badges.push({ icon: '◇', title: 'Active seller', detail: `${formatCount(listings.length)} public listing${listings.length === 1 ? '' : 's'}` });
  if (averageRating !== null && averageRating >= 4.5) badges.push({ icon: '★', title: 'Top rated', detail: `${formatRating(averageRating)} average buyer rating` });
  if (soldItems.length) {
    const orderMilestone = soldItems.length >= 100 ? '100+ orders' : soldItems.length >= 10 ? '10+ orders' : 'First order';
    badges.push({ icon: '✓', title: orderMilestone, detail: `${formatCount(soldItems.length)} marketplace order${soldItems.length === 1 ? '' : 's'}` });
  }
  if (reviews.length >= 10) badges.push({ icon: '♡', title: 'Community trusted', detail: `${formatCount(reviews.length)} verified reviews` });

  publicProfileBadges.innerHTML = '';
  badges.slice(0, 5).forEach((badge) => {
    const card = document.createElement('article');
    const icon = document.createElement('i');
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    icon.textContent = badge.icon;
    title.textContent = badge.title;
    detail.textContent = badge.detail;
    card.append(icon, title, detail);
    publicProfileBadges.appendChild(card);
  });
}

function renderPublicRatingOverview(reviews, averageRating) {
  const ratingText = averageRating === null ? '-' : formatRating(averageRating);
  const roundedRating = averageRating === null ? 0 : Math.round(averageRating);
  const stars = `${'★'.repeat(roundedRating)}${'☆'.repeat(5 - roundedRating)}`;

  if (publicProfileRatingTotal) publicProfileRatingTotal.textContent = `${formatCount(reviews.length)} total reviews`;
  if (publicProfileScore) publicProfileScore.textContent = ratingText;
  if (publicProfileScoreStars) publicProfileScoreStars.textContent = stars;

  if (!publicProfileRatingBars) return;
  publicProfileRatingBars.innerHTML = '';
  for (let rating = 5; rating >= 1; rating -= 1) {
    const count = reviews.filter((review) => Math.round(Number(review.rating) || 0) === rating).length;
    const percentage = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'public-profile-rating-row';
    row.innerHTML = `<span>${rating} ★</span><i><b style="width:${percentage}%"></b></i><small>${percentage}%</small>`;
    publicProfileRatingBars.appendChild(row);
  }
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
  document.body.classList.add('public-profile-view');

  if (!user) {
    document.title = 'Profile not found - WaveHub';
    if (profileTitle) profileTitle.textContent = 'Public Profile';
    applyAvatar(publicProfileAvatar, null);
    if (profileRecordCount) profileRecordCount.textContent = '0';
    if (publicProfileName) publicProfileName.textContent = 'Profile not found';
    if (publicProfileHandle) publicProfileHandle.textContent = '@unknown';
    if (publicProfileJoined) publicProfileJoined.textContent = 'This public profile is unavailable.';
    if (publicProfileBio) {
      publicProfileBio.textContent = 'BIO: This user could not be found.';
    }
    if (publicProfileRole) publicProfileRole.textContent = 'Unavailable profile';
    if (publicProfileMessage) publicProfileMessage.hidden = true;
    if (publicProfileRank) publicProfileRank.textContent = '#-';
    if (publicProfileRankCaption) publicProfileRankCaption.textContent = 'Profile unavailable';
    if (publicProfileRankProgress) publicProfileRankProgress.style.width = '0%';
    if (publicProfileRankMeta) publicProfileRankMeta.textContent = 'No ranking data';
    if (publicProfileFactUsername) publicProfileFactUsername.textContent = '@unknown';
    if (publicProfileFactType) publicProfileFactType.textContent = '-';
    if (publicProfileFactActivity) publicProfileFactActivity.textContent = 'No activity';
    if (publicProfileRegistered) publicProfileRegistered.textContent = '-';
    if (publicProfileListed) publicProfileListed.textContent = '0';
    if (publicProfileSold) publicProfileSold.textContent = '0';
    if (publicProfileReviewCount) publicProfileReviewCount.textContent = '0';
    if (publicProfileRating) publicProfileRating.textContent = '-';
    if (publicProfileListingCount) publicProfileListingCount.textContent = '0';
    if (publicProfileReviewsCount) publicProfileReviewsCount.textContent = '0';
    if (publicProfileActivityNote) publicProfileActivityNote.textContent = 'Profile unavailable';
    renderPublicProfileGame(null, publicProfileMainGame, publicProfileMainGameMeta, publicProfileMainGameImage, 'No game listed', 'No marketplace activity.');
    renderPublicProfileGame(null, publicProfileSecondaryGame, publicProfileSecondaryGameMeta, publicProfileSecondaryGameImage, 'No second game', 'No additional marketplace activity.');
    if (publicProfileBadges) publicProfileBadges.innerHTML = '';
    if (publicProfilePerformanceReviews) publicProfilePerformanceReviews.textContent = '0';
    if (publicProfilePerformanceOrders) publicProfilePerformanceOrders.textContent = '0';
    if (publicProfilePerformanceListings) publicProfilePerformanceListings.textContent = '0';
    if (publicProfilePerformanceGames) publicProfilePerformanceGames.textContent = '0';
    renderPublicRatingOverview([], null);
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
  if (publicProfileBio) {
    const bio = String(user.bio || '').trim();
    publicProfileBio.textContent = `BIO: ${bio || 'This member has not added a bio yet.'}`;
  }
  if (publicProfileMessage) {
    const currentUsername = getCurrentAccount().user?.username || '';
    publicProfileMessage.href = `messages.html?to=${encodeURIComponent(user.username)}`;
    publicProfileMessage.hidden = currentUsername === user.username;
  }
  const role = listings.length || soldItems.length ? 'Marketplace seller' : 'WaveHub member';
  const rankedGames = getPublicProfileGames(listings, soldItems);
  const displayedGames = getDisplayedProfileGames(user, rankedGames);
  const activeGames = rankedGames.map((game) => game.game);
  const rank = getPublicProfileRank(user.username);
  if (publicProfileRole) publicProfileRole.textContent = role;
  if (publicProfileFactUsername) publicProfileFactUsername.textContent = `@${user.username}`;
  if (publicProfileFactType) publicProfileFactType.textContent = role;
  if (publicProfileFactActivity) {
    publicProfileFactActivity.textContent = activeGames.length
      ? activeGames.slice(0, 3).join(', ')
      : 'No marketplace activity yet';
  }
  if (publicProfileRegistered) publicProfileRegistered.textContent = formatProfileMonth(user.createdAt);
  if (publicProfileListed) publicProfileListed.textContent = formatCount(listings.length);
  if (publicProfileSold) publicProfileSold.textContent = formatCount(soldItems.length);
  if (publicProfileReviewCount) publicProfileReviewCount.textContent = formatCount(reviews.length);
  if (publicProfileRating) publicProfileRating.textContent = averageRating === null ? '-' : formatRating(averageRating);
  if (publicProfileListingCount) publicProfileListingCount.textContent = formatCount(listings.length);
  if (publicProfileReviewsCount) publicProfileReviewsCount.textContent = formatCount(reviews.length);
  if (publicProfileActivityNote) {
    publicProfileActivityNote.textContent = listings.length || soldItems.length
      ? `${formatCount(listings.length)} listed · ${formatCount(soldItems.length)} orders`
      : 'WaveHub community member';
  }
  if (publicProfileRank) publicProfileRank.textContent = rank ? `#${formatCount(rank.rank)}` : '#-';
  if (publicProfileRankCaption) {
    publicProfileRankCaption.textContent = rank ? `Top ${rank.percentile}% of active members` : 'No marketplace activity yet';
  }
  if (publicProfileRankProgress) publicProfileRankProgress.style.width = rank ? `${rank.progress}%` : '0%';
  if (publicProfileRankMeta) {
    publicProfileRankMeta.textContent = rank ? `${formatCount(rank.rank)} of ${formatCount(rank.total)} ranked members` : 'Not ranked';
  }
  renderPublicProfileGame(
    displayedGames[0],
    publicProfileMainGame,
    publicProfileMainGameMeta,
    publicProfileMainGameImage,
    'No game listed',
    'Choose games in profile settings.',
  );
  renderPublicProfileGame(
    displayedGames[1],
    publicProfileSecondaryGame,
    publicProfileSecondaryGameMeta,
    publicProfileSecondaryGameImage,
    'No second game',
    'Choose up to two games in settings.',
  );
  renderPublicProfileBadges(user, listings, soldItems, reviews, averageRating);
  if (publicProfilePerformanceReviews) publicProfilePerformanceReviews.textContent = formatCount(reviews.length);
  if (publicProfilePerformanceOrders) publicProfilePerformanceOrders.textContent = formatCount(soldItems.length);
  if (publicProfilePerformanceListings) publicProfilePerformanceListings.textContent = formatCount(listings.length);
  if (publicProfilePerformanceGames) publicProfilePerformanceGames.textContent = formatCount(rankedGames.length);
  renderPublicRatingOverview(reviews, averageRating);

  const shownListings = renderPublicListings(user);
  const shownReviews = renderPublicReviews(reviews);
  if (profileRecordCount) profileRecordCount.textContent = String(shownListings.length + shownReviews.length);
}

function renderProfileForm(user) {
  if (!user) {
    return;
  }

  if (profileUsernameInput) profileUsernameInput.value = user.username || '';
  if (profileFirstNameInput) profileFirstNameInput.value = user.firstName || '';
  if (profileLastNameInput) profileLastNameInput.value = user.lastName || '';
  if (profileBioInput) profileBioInput.value = user.bio || '';
  if (profileBioCount) profileBioCount.textContent = String((user.bio || '').length);
  const selectedGames = Array.isArray(user.mainGames) ? user.mainGames.slice(0, 2) : [];
  profileMainGamesField?.querySelectorAll('input[name="mainGames"]').forEach((input) => {
    input.checked = selectedGames.includes(input.value);
  });
  updateMainGamesSelectionState();
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

function renderSessions(user) {
  if (!profileSessions || !profileSessionsEmpty) {
    return [];
  }

  const query = getSearchQuery();
  const sessions = getCoachingSessions(user?.username)
    .filter((session) => {
      const haystack = [session.title, session.game, session.seller, session.sessionLabel].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.addedAt || b.updatedAt || 0) - new Date(a.addedAt || a.updatedAt || 0));

  profileSessions.innerHTML = '';
  sessions.forEach((session) => {
    profileSessions.appendChild(createRecordCard({
      ...session,
      detailUrl: `coach-book-session.html?coach=${encodeURIComponent(session.id || session.listingId || '')}`,
    }, 'session'));
  });
  profileSessionsEmpty.hidden = sessions.length > 0;

  return sessions;
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
  document.body.classList.remove('public-profile-view');

  if (publicProfileLayout) {
    publicProfileLayout.hidden = true;
  }

  if (profileTitle) {
    profileTitle.textContent = 'Profile';
  }

  if (profileSearch) {
    profileSearch.placeholder = 'Search your listings, sessions or purchases...';
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
  const sessions = renderSessions(user);
  const purchases = renderPurchases(user);
  if (profileRecordCount) profileRecordCount.textContent = String(listings.length + sessions.length + purchases.length);
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
      bio: nextUser.bio || '',
      mainGames: Array.isArray(nextUser.mainGames) ? nextUser.mainGames.slice(0, 2) : [],
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
    setSessionModalOpen(false);
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

profileSessionCloseButton?.addEventListener('click', () => setSessionModalOpen(false));
profileSessionCancelButton?.addEventListener('click', () => setSessionModalOpen(false));
profileAddSessionButton?.addEventListener('click', () => openSessionEditor());

profileSessionModal?.addEventListener('click', (event) => {
  if (event.target === profileSessionModal) {
    setSessionModalOpen(false);
  }
});

profileSessionCoachInput?.addEventListener('change', () => {
  syncSessionControlsForCoach();
});

profileSessions?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const editButton = target?.closest('[data-edit-session-id]');
  const deleteButton = target?.closest('[data-delete-session-id]');

  if (editButton instanceof HTMLElement) {
    openSessionEditor(editButton.dataset.editSessionId || '');
    return;
  }

  if (!(deleteButton instanceof HTMLElement)) {
    return;
  }

  const sessionId = deleteButton.dataset.deleteSessionId || '';
  const session = getCoachingSessions(getCurrentAccount().user?.username).find((item) => item.id === sessionId);

  if (!session) {
    setStatus('error', 'Session was not found.');
    return;
  }

  const shouldDelete = window.confirm(`Delete "${session.sessionLabel || session.title || 'this session'}"?`);
  if (!shouldDelete) {
    return;
  }

  saveCartItems(getCartItems().filter((item) => item.id !== sessionId));
  setStatus('success', 'Coaching session deleted.');
  renderPage();
});

profileSessionForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const { user } = getCurrentAccount();
  const coachName = profileSessionCoachInput?.value.trim() || '';
  const sessionId = profileSessionIdInput?.value || '';
  const sessionGame = profileSessionGameInput?.value.trim() || '';
  const sessionDate = profileSessionDateInput?.value || '';
  const sessionTime = profileSessionTimeInput?.value || '';
  const sessionPrice = Number(profileSessionPriceInput?.value || 0);
  const sessionLanguage = profileSessionLanguageInput?.value || '';
  const sessionAbout = profileSessionAboutInput?.value.trim() || '';
  const sessionDescription = profileSessionDescriptionInput?.value.trim() || '';
  const sessionRank = profileSessionRankInput?.value.trim() || '';
  const sessionSpecialty = profileSessionSpecialtyInput?.value.trim() || '';
  const sessionExperienceValue = profileSessionExperienceInput?.value ?? '';
  const sessionSuccessRateValue = profileSessionSuccessRateInput?.value ?? '';
  const sessionResponseTimeValue = profileSessionResponseTimeInput?.value ?? '';
  const toDetailLines = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const sessionStyle = toDetailLines(profileSessionStyleInput?.value);
  const expertiseLines = toDetailLines(profileSessionExpertiseInput?.value);
  const sessionExpertise = expertiseLines.map((line) => {
    const separatorIndex = line.lastIndexOf(':');
    const label = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : '';
    const value = separatorIndex >= 0 ? Number(line.slice(separatorIndex + 1).trim()) : NaN;
    return { label, value };
  });
  const hasInvalidExpertise = sessionExpertise.some((item) => !item.label || !Number.isFinite(item.value) || item.value < 0 || item.value > 100);
  const sessionAchievements = toDetailLines(profileSessionAchievementsInput?.value);
  const existingSession = sessionId ? getCoachingSessions(user?.username).find((item) => item.id === sessionId) : null;

  if (!user?.username) {
    setSessionStatus('error', 'Please log in before managing coaching sessions.');
    return;
  }

  if (hasInvalidExpertise) {
    setSessionStatus('error', 'Use the Expertise format “Skill: 90” and enter a percentage from 0 to 100.');
    return;
  }

  if (!coachName || !sessionGame || !sessionDate || !sessionTime || !sessionPrice || !sessionLanguage || !sessionAbout || !sessionDescription || !sessionRank || !sessionSpecialty || sessionExperienceValue === '' || sessionSuccessRateValue === '' || sessionResponseTimeValue === '' || !sessionStyle.length || !sessionExpertise.length) {
    setSessionStatus('error', 'Fill every required coach and session detail.');
    return;
  }

  const nextSession = buildCoachSessionItem(
    coachName,
    sessionGame,
    sessionDate,
    sessionTime,
    sessionPrice,
    sessionLanguage,
    sessionAbout,
    sessionDescription,
    {
      rank: sessionRank,
      specialty: sessionSpecialty,
      yearsExperience: Number(sessionExperienceValue),
      successRate: Number(sessionSuccessRateValue),
      responseTime: `${Number(sessionResponseTimeValue)} min`,
      responseTimeMinutes: Number(sessionResponseTimeValue),
      style: sessionStyle,
      expertise: sessionExpertise,
      achievements: sessionAchievements,
    },
    existingSession || {},
  );
  const currentItems = getCartItems();
  const duplicate = currentItems.some((item) => (
    item.id !== existingSession?.id
    && item.productType === 'Coaching'
    && item.buyerUsername === user.username
    && item.seller === nextSession.seller
    && item.listingId === nextSession.listingId
    && item.game === nextSession.game
    && item.sessionDate === nextSession.sessionDate
    && item.sessionTime === nextSession.sessionTime
  ));

  if (duplicate) {
    setSessionStatus('error', 'This coaching session is already added.');
    return;
  }

  const nextItems = existingSession
    ? currentItems.map((item) => (item.id === existingSession.id ? nextSession : item))
    : [...currentItems, nextSession];

  saveCartItems(nextItems);
  setSessionModalOpen(false);
  setStatus('success', existingSession ? 'Coaching session updated.' : 'Coaching session added.');
  renderPage();
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

profileBioInput?.addEventListener('input', () => {
  if (profileBioCount) {
    profileBioCount.textContent = String(profileBioInput.value.length);
  }
});

function updateMainGamesSelectionState() {
  const inputs = Array.from(profileMainGamesField?.querySelectorAll('input[name="mainGames"]') || []);
  const selected = inputs.filter((input) => input.checked);
  inputs.forEach((input) => {
    input.disabled = selected.length >= 2 && !input.checked;
  });
  if (profileMainGamesHelp) {
    profileMainGamesHelp.textContent = `${selected.length} of 2 selected`;
  }
}

profileMainGamesField?.addEventListener('change', updateMainGamesSelectionState);

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
    bio: profileBioInput?.value.trim() || '',
    mainGames: Array.from(profileMainGamesField?.querySelectorAll('input[name="mainGames"]:checked') || [])
      .map((input) => input.value)
      .slice(0, 2),
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
  if ([localUsersKey, sessionKey, sellerListingsKey, purchasesKey, sellerReviewsKey, cartKey].includes(event.key)) {
    renderPage();
  }
});

renderOnlineCount();
renderPage();
