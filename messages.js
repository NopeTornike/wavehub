const menuToggle = document.getElementById('menuToggle');
const scrim = document.getElementById('scrim');
const sideLinks = document.querySelectorAll('.side-link');
const messageSearch = document.getElementById('messageSearch');
const visibleMessageCount = document.getElementById('visibleMessageCount');
const messageCount = document.getElementById('messageCount');
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
const apiUrls = ['http://localhost:4000', 'http://127.0.0.1:4000'];
const minOnlineCount = 2;
const maxOnlineCount = 23;
let activeDirectParticipant = '';
let directMessages = [];

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

function formatMessageTime(value) {
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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, { ...options, credentials: 'include', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestMessagesApi(path = '', options = {}) {
  for (const apiUrl of apiUrls) {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/messages${path}`, options);
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: data?.error || data?.message || 'Message request failed.',
      };
    } catch (err) {
      console.warn('Messages API is unavailable:', err);
    }
  }

  return { ok: false, offline: true, error: 'Messages server is unavailable.' };
}

function getDirectMessages() {
  return directMessages;
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
  if (requested && requested !== username && /^[a-z0-9_-]+$/.test(requested)) names.add(requested);
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

async function markConversationRead(username, participant) {
  if (!username || !participant) return;
  const result = await requestMessagesApi(`/read/${encodeURIComponent(participant)}`, { method: 'POST' });
  if (!result.ok) return;

  const now = new Date().toISOString();
  directMessages = directMessages.map((message) => (
    message.toUsername === username && message.fromUsername === participant && !message.readAt
      ? { ...message, readAt: now }
      : message
  ));
}

function renderDirectMessages() {
  const { user } = getCurrentAccount();
  const username = user?.username || '';
  const messages = getDirectMessages();
  const query = messageSearch?.value.trim().toLowerCase() || '';
  const participants = username
    ? getDirectParticipants(username, messages).filter((participantUsername) => {
      const participant = getUserByUsername(participantUsername);
      const conversation = getConversation(messages, username, participantUsername);
      return !query || [participantUsername, getDisplayName(participant), ...conversation.map((message) => message.body)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    : [];
  const requested = new URLSearchParams(window.location.search).get('to');
  const activeParticipant = participants.includes(requested) ? requested : participants[0] || '';
  activeDirectParticipant = activeParticipant;

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
      time.textContent = `${formatMessageTime(message.createdAt)}${message.fromUsername === username && message.readAt ? ' · Read' : ''}`;
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

function renderMessages() {
  const { user } = getCurrentAccount();
  const unreadDirect = renderDirectMessages();

  if (!user?.username) {
    if (visibleMessageCount) visibleMessageCount.textContent = '0';
    if (messageCount) messageCount.textContent = '0';
    window.wavehubRenderMessageNotifications?.();
    return;
  }

  const directTotal = getDirectMessages().filter((message) => message.fromUsername === user.username || message.toUsername === user.username).length;
  if (visibleMessageCount) visibleMessageCount.textContent = String(directTotal);
  if (messageCount) messageCount.textContent = String(unreadDirect);
  window.wavehubRenderMessageNotifications?.();
}

directMessageContacts?.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-message-user]') : null;
  if (!button) return;
  const username = button.dataset.messageUser || '';
  const url = new URL(window.location.href);
  url.searchParams.set('to', username);
  window.history.replaceState({}, '', url);
  const { user } = getCurrentAccount();
  await markConversationRead(user?.username, username);
  renderMessages();
});

directMessageForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { user } = getCurrentAccount();
  const toUsername = activeDirectParticipant;
  const body = directMessageInput?.value.trim() || '';

  if (!user?.username || !toUsername || !body || toUsername === user.username) return;
  if (directMessageStatus) directMessageStatus.textContent = 'Sending...';
  const result = await requestMessagesApi('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toUsername, body }),
  });

  if (!result.ok) {
    if (directMessageStatus) directMessageStatus.textContent = result.status === 401
      ? 'Your session expired. Please log in again.'
      : result.error;
    return;
  }

  directMessages.push(result.data.message);
  directMessageForm.reset();
  if (directMessageStatus) directMessageStatus.textContent = 'Message sent.';
  renderMessages();
  window.wavehubRefreshMessageNotifications?.();
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

logoutButton?.addEventListener('click', async () => {
  for (const apiUrl of apiUrls) {
    try {
      await fetchWithTimeout(`${apiUrl}/auth/logout`, { method: 'POST' });
      break;
    } catch {}
  }
  localStorage.removeItem(sessionKey);
  directMessages = [];
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

});

async function initializeMessages() {
  renderOnlineCount();
  renderProfile();

  const { user } = getCurrentAccount();
  if (!user?.username) {
    renderMessages();
    return;
  }

  const result = await requestMessagesApi();
  if (result.ok) {
    directMessages = Array.isArray(result.data.messages) ? result.data.messages : [];
    renderMessages();
    if (activeDirectParticipant) {
      await markConversationRead(user.username, activeDirectParticipant);
      renderMessages();
    }
    return;
  }

  if (result.status === 401) {
    localStorage.removeItem(sessionKey);
    renderProfile();
  }
  if (directMessageStatus) directMessageStatus.textContent = result.offline
    ? 'Messages server is unavailable.'
    : 'Please log in to view messages.';
  renderMessages();
}

initializeMessages();
