const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
const messageSearch = document.getElementById('messageSearch');
const receivedMessages = document.getElementById('receivedMessages');
const sentMessages = document.getElementById('sentMessages');
const visibleMessageCount = document.getElementById('visibleMessageCount');
const messageCount = document.getElementById('messageCount');
const receivedMessageCount = document.getElementById('receivedMessageCount');
const sentMessageCount = document.getElementById('sentMessageCount');
const directMessageContacts = document.getElementById('directMessageContacts');
const directMessageHistory = document.getElementById('directMessageHistory');
const directMessageForm = document.getElementById('directMessageForm');
const directMessageInput = document.getElementById('directMessageInput');
const directMessageTitle = document.getElementById('directMessageTitle');
const directMessageHandle = document.getElementById('directMessageHandle');
const directMessageAvatar = document.getElementById('directMessageAvatar');
const directMessageStatus = document.getElementById('directMessageStatus');
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
const directMessagesKey = 'wavehub.directMessages';
const minOnlineCount = 2;
const maxOnlineCount = 23;
let activeDirectParticipant = '';

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

function getDirectMessages() {
  const messages = readJson(directMessagesKey, []);
  return Array.isArray(messages) ? messages : [];
}

function getUserByUsername(username) {
  const users = readJson(localUsersKey, []);
  return Array.isArray(users) ? users.find((user) => user.username === username) || null : null;
}

function getDirectParticipants(username, messages) {
  const names = new Set();
  messages.forEach((message) => {
    if (message.fromUsername === username) names.add(message.toUsername);
    if (message.toUsername === username) names.add(message.fromUsername);
  });

  const requested = new URLSearchParams(window.location.search).get('to');
  if (requested && requested !== username && getUserByUsername(requested)) names.add(requested);
  return [...names].filter(Boolean);
}

function getConversation(messages, username, participant) {
  return messages
    .filter((message) => (
      (message.fromUsername === username && message.toUsername === participant)
      || (message.fromUsername === participant && message.toUsername === username)
    ))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function markConversationRead(messages, username, participant) {
  let changed = false;
  const now = new Date().toISOString();
  const next = messages.map((message) => {
    if (message.toUsername === username && message.fromUsername === participant && !message.readAt) {
      changed = true;
      return { ...message, readAt: now };
    }
    return message;
  });

  if (changed) writeJson(directMessagesKey, next);
  return next;
}

function renderDirectMessages() {
  const { user } = getCurrentAccount();
  const username = user?.username || '';
  let messages = getDirectMessages();
  const participants = username ? getDirectParticipants(username, messages) : [];
  const requested = new URLSearchParams(window.location.search).get('to');
  const activeParticipant = participants.includes(requested) ? requested : participants[0] || '';
  activeDirectParticipant = activeParticipant;

  if (activeParticipant && username) {
    messages = markConversationRead(messages, username, activeParticipant);
  }

  if (directMessageContacts) {
    directMessageContacts.innerHTML = '';
    if (!username || participants.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'direct-message-empty';
      empty.textContent = username ? 'Open a user profile and press Message.' : 'Log in to start messaging.';
      directMessageContacts.appendChild(empty);
    }

    participants.forEach((participantUsername) => {
      const participantUser = getUserByUsername(participantUsername);
      const conversation = getConversation(messages, username, participantUsername);
      const latest = conversation.at(-1);
      const unread = conversation.filter((message) => message.toUsername === username && !message.readAt).length;
      const button = document.createElement('button');
      button.className = `direct-contact${participantUsername === activeParticipant ? ' active' : ''}`;
      button.type = 'button';
      button.dataset.messageUser = participantUsername;
      const avatar = document.createElement('span');
      avatar.className = 'message-avatar';
      avatar.textContent = getInitials(participantUser || { username: participantUsername });
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      const preview = document.createElement('small');
      name.textContent = getDisplayName(participantUser || { username: participantUsername });
      preview.textContent = latest?.body || 'Start a conversation';
      copy.append(name, preview);
      button.append(avatar, copy);
      if (unread) {
        const badge = document.createElement('b');
        badge.textContent = String(unread);
        button.appendChild(badge);
      }
      directMessageContacts.appendChild(button);
    });
  }

  const participantUser = activeParticipant ? getUserByUsername(activeParticipant) : null;
  if (directMessageTitle) directMessageTitle.textContent = participantUser ? getDisplayName(participantUser) : 'Select a conversation';
  if (directMessageHandle) directMessageHandle.textContent = activeParticipant ? `@${activeParticipant}` : 'Choose a user to start messaging';
  if (directMessageAvatar) directMessageAvatar.textContent = activeParticipant ? getInitials(participantUser || { username: activeParticipant }) : '?';
  if (directMessageInput) directMessageInput.disabled = !username || !activeParticipant;
  directMessageForm?.querySelector('button')?.toggleAttribute('disabled', !username || !activeParticipant);

  if (directMessageHistory) {
    directMessageHistory.innerHTML = '';
    const conversation = activeParticipant ? getConversation(messages, username, activeParticipant) : [];
    if (conversation.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'direct-message-empty';
      empty.textContent = activeParticipant ? 'No messages yet. Say hello!' : 'Your conversation will appear here.';
      directMessageHistory.appendChild(empty);
    }
    conversation.forEach((message) => {
      const bubble = document.createElement('article');
      bubble.className = `direct-message-bubble ${message.fromUsername === username ? 'mine' : 'theirs'}`;
      const body = document.createElement('p');
      body.textContent = message.body;
      const time = document.createElement('small');
      time.textContent = `${formatOfferTime(message.createdAt)}${message.fromUsername === username && message.readAt ? ' · Read' : ''}`;
      bubble.append(body, time);
      directMessageHistory.appendChild(bubble);
    });
    directMessageHistory.scrollTop = directMessageHistory.scrollHeight;
  }

  return messages.filter((message) => message.toUsername === username && !message.readAt).length;
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
  card.className = `message-card ${mode}`;

  const top = document.createElement('div');
  top.className = 'message-card-top';

  const tag = document.createElement('span');
  tag.className = 'service-tag account';
  tag.textContent = mode === 'received' ? 'Received' : 'Sent';

  const game = document.createElement('span');
  game.className = 'message-game';
  game.textContent = offer.game || 'Marketplace';

  const price = document.createElement('strong');
  price.textContent = normalizePriceText(offer.offeredPrice);

  const labels = document.createElement('div');
  labels.className = 'message-card-labels';
  labels.append(tag, game);
  top.append(labels, price);

  const title = document.createElement('h3');
  title.textContent = offer.itemTitle;

  const message = document.createElement('p');
  message.textContent = normalizePriceText(offer.message);

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  const participantName = mode === 'received' ? offer.buyerName : offer.sellerName;
  avatar.textContent = String(participantName || '?').trim().charAt(0).toUpperCase() || '?';

  const metaCopy = document.createElement('div');
  metaCopy.className = 'message-meta-copy';
  const participant = document.createElement('span');
  participant.textContent = mode === 'received' ? `From ${offer.buyerName}` : `To ${offer.sellerName}`;

  const ask = document.createElement('span');
  ask.textContent = `Ask ${normalizePriceText(offer.askingPrice)}`;

  const time = document.createElement('span');
  time.textContent = formatOfferTime(offer.createdAt);

  metaCopy.append(participant, ask, time);
  meta.append(avatar, metaCopy);

  const action = document.createElement('a');
  action.className = 'auth-open-button primary';
  action.href = offer.detailUrl;
  action.innerHTML = '<span>View offer</span><span aria-hidden="true">→</span>';

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

  const unreadDirect = renderDirectMessages();

  if (!user?.username) {
    renderList(receivedMessages, [], 'Log in to see received offers.', 'received');
    renderList(sentMessages, [], 'Log in to see sent offers.', 'sent');
    if (visibleMessageCount) visibleMessageCount.textContent = '0';
    if (messageCount) messageCount.textContent = '0';
    if (receivedMessageCount) receivedMessageCount.textContent = '0';
    if (sentMessageCount) sentMessageCount.textContent = '0';
    window.wavehubRenderMessageNotifications?.();
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
  const directTotal = getDirectMessages().filter((message) => message.fromUsername === user.username || message.toUsername === user.username).length;
  if (visibleMessageCount) visibleMessageCount.textContent = String(total + directTotal);
  if (messageCount) messageCount.textContent = String(received.length + unreadDirect);
  if (receivedMessageCount) receivedMessageCount.textContent = String(received.length);
  if (sentMessageCount) sentMessageCount.textContent = String(sent.length);
  window.wavehubRenderMessageNotifications?.();
}

directMessageContacts?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-message-user]') : null;
  if (!button) return;
  const username = button.dataset.messageUser || '';
  const url = new URL(window.location.href);
  url.searchParams.set('to', username);
  window.history.replaceState({}, '', url);
  renderMessages();
});

directMessageForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const { user } = getCurrentAccount();
  const toUsername = activeDirectParticipant;
  const body = directMessageInput?.value.trim() || '';

  if (!user?.username || !toUsername || !body || toUsername === user.username) return;
  const messages = getDirectMessages();
  messages.push({
    id: window.crypto?.randomUUID?.() || `message-${Date.now()}`,
    fromUsername: user.username,
    toUsername,
    body,
    createdAt: new Date().toISOString(),
    readAt: '',
  });
  writeJson(directMessagesKey, messages);
  directMessageForm.reset();
  if (directMessageStatus) directMessageStatus.textContent = 'Message sent.';
  renderMessages();
});

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

  if (event.key === priceOffersKey || event.key === directMessagesKey) {
    renderMessages();
  }
});

renderOnlineCount();
renderProfile();
renderMessages();
