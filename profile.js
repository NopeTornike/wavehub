const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const profileSearch = document.getElementById('profileSearch');
const profileRecordCount = document.getElementById('profileRecordCount');
const profileLoginPanel = document.getElementById('profileLoginPanel');
const profileControlLayout = document.getElementById('profileControlLayout');
const profileForm = document.getElementById('profileForm');
const profilePhotoPreview = document.getElementById('profilePhotoPreview');
const profilePhotoInput = document.getElementById('profilePhotoInput');
const profileUsernameInput = document.getElementById('profileUsernameInput');
const profileFirstNameInput = document.getElementById('profileFirstNameInput');
const profileLastNameInput = document.getElementById('profileLastNameInput');
const profileLogoutButton = document.getElementById('profileLogoutButton');
const profileStatus = document.getElementById('profileStatus');
const profileListings = document.getElementById('profileListings');
const profileListingsEmpty = document.getElementById('profileListingsEmpty');
const profilePurchases = document.getElementById('profilePurchases');
const profilePurchasesEmpty = document.getElementById('profilePurchasesEmpty');
const onlineCount = document.getElementById('onlineCount');
const messageCount = document.getElementById('messageCount');

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const sellerListingsKey = 'wavehub.sellerListings';
const purchasesKey = 'wavehub.purchases';
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
  card.append(thumb, copy);
  return card;
}

function renderProfileForm(user) {
  if (!user) {
    return;
  }

  if (profileUsernameInput) profileUsernameInput.value = user.username || '';
  if (profileFirstNameInput) profileFirstNameInput.value = user.firstName || '';
  if (profileLastNameInput) profileLastNameInput.value = user.lastName || '';
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
  const { user } = getCurrentAccount();
  const isSignedIn = Boolean(user?.username);

  if (profileLoginPanel) profileLoginPanel.hidden = isSignedIn;
  if (profileControlLayout) profileControlLayout.hidden = !isSignedIn;

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
  }
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
  if ([localUsersKey, sessionKey, sellerListingsKey, purchasesKey, priceOffersKey].includes(event.key)) {
    renderPage();
  }
});

renderOnlineCount();
renderPage();
