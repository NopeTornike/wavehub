const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
const messageSearch = document.getElementById('messageSearch');
const receivedMessages = document.getElementById('receivedMessages');
const sentMessages = document.getElementById('sentMessages');
const visibleMessageCount = document.getElementById('visibleMessageCount');
const messageCount = document.getElementById('messageCount');
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

const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const priceOffersKey = 'wavehub.priceOffers';
const minOnlineCount = 94;
const maxOnlineCount = 225;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
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

function getCurrentAccount() {
  const session = readJson(sessionKey, null);
  const users = readJson(localUsersKey, []);
  const sessionUser = session?.user || null;
  const storedUser = users.find((user) => user.username === sessionUser?.username);
  const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

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

function formatOfferTime(value) {
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

function normalizePriceText(value) {
  return String(value || '').replace(/\$(\d+(?:\.\d+)?)/g, '$1 GEL');
}

function getPriceOffers() {
  const offers = readJson(priceOffersKey, []);
  return Array.isArray(offers) ? offers : [];
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
}

function renderOnlineCount() {
  if (!onlineCount) {
    return;
  }

  const count = Math.floor(Math.random() * (maxOnlineCount - minOnlineCount + 1)) + minOnlineCount;
  onlineCount.textContent = `${count} online`;
}

function createMessageCard(offer, mode) {
  const card = document.createElement('article');
  card.className = 'message-card';

  const top = document.createElement('div');
  top.className = 'message-card-top';

  const tag = document.createElement('span');
  tag.className = 'service-tag account';
  tag.textContent = mode === 'received' ? 'Received' : 'Sent';

  const price = document.createElement('strong');
  price.textContent = normalizePriceText(offer.offeredPrice);

  top.append(tag, price);

  const title = document.createElement('h3');
  title.textContent = offer.itemTitle;

  const message = document.createElement('p');
  message.textContent = normalizePriceText(offer.message);

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const participant = document.createElement('span');
  participant.textContent = mode === 'received' ? `From ${offer.buyerName}` : `To ${offer.sellerName}`;

  const ask = document.createElement('span');
  ask.textContent = `Ask ${normalizePriceText(offer.askingPrice)}`;

  const time = document.createElement('span');
  time.textContent = formatOfferTime(offer.createdAt);

  meta.append(participant, ask, time);

  const action = document.createElement('a');
  action.className = 'auth-open-button primary';
  action.href = offer.detailUrl;
  action.textContent = 'Open offer';

  card.append(top, title, message, meta, action);
  return card;
}

function renderList(container, offers, emptyText, mode) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (offers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'marketplace-empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  offers.forEach((offer) => {
    container.appendChild(createMessageCard(offer, mode));
  });
}

function renderMessages() {
  const { user } = getCurrentAccount();
  const query = messageSearch?.value.trim().toLowerCase() || '';

  if (!user?.username) {
    renderList(receivedMessages, [], 'Log in to see received offers.', 'received');
    renderList(sentMessages, [], 'Log in to see sent offers.', 'sent');
    if (visibleMessageCount) visibleMessageCount.textContent = '0';
    if (messageCount) messageCount.textContent = '0';
    return;
  }

  const offers = getPriceOffers();
  const matchesQuery = (offer) => {
    const haystack = [offer.itemTitle, offer.game, offer.message, offer.buyerName, offer.sellerName]
      .join(' ')
      .toLowerCase();
    return !query || haystack.includes(query);
  };
  const received = offers.filter((offer) => offer.sellerUsername === user.username && matchesQuery(offer));
  const sent = offers.filter((offer) => offer.buyerUsername === user.username && matchesQuery(offer));
  const total = received.length + sent.length;

  renderList(receivedMessages, received, 'No received price offers yet.', 'received');
  renderList(sentMessages, sent, 'No sent price offers yet.', 'sent');
  if (visibleMessageCount) visibleMessageCount.textContent = String(total);
  if (messageCount) messageCount.textContent = String(received.length);
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

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  renderProfile();
  renderMessages();
  setProfileOpen(false);
});

messageSearch?.addEventListener('input', renderMessages);

window.addEventListener('resize', () => {
  if (window.innerWidth > 920) {
    setSidebarOpen(false);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === sessionKey || event.key === localUsersKey) {
    renderProfile();
    renderMessages();
  }

  if (event.key === priceOffersKey) {
    renderMessages();
  }
});

renderOnlineCount();
renderProfile();
renderMessages();
