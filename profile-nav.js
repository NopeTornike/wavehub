(function () {
  const localUsersKey = 'wavehub.users';
  const sessionKey = 'wavehub.session';
  const directMessagesKey = 'wavehub.directMessages';

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
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

  function renderProfileSurfaces() {
    const { user } = getCurrentAccount();
    const isSignedIn = Boolean(user?.username);
    const isPublicProfile = window.location.pathname.endsWith('profile.html')
      && Boolean(new URLSearchParams(window.location.search).get('user'));
    const username = user?.username || 'Guest';
    const displayName = isSignedIn ? getDisplayName(user) : 'Not signed in';

    ['profileAvatar', 'profilePanelAvatar'].forEach((id) => {
      applyAvatar(document.getElementById(id), user);
    });

    document.querySelectorAll('.coach-profile-avatar').forEach((element) => applyAvatar(element, user));
    document.querySelectorAll('[data-section="Settings"]').forEach((link) => {
      if (link instanceof HTMLAnchorElement) {
        link.href = 'profile.html';
      }
    });

    const profileUsername = document.getElementById('profileUsername');
    const profileMeta = document.getElementById('profileMeta');
    const profileFullName = document.getElementById('profileFullName');
    const profileHandle = document.getElementById('profileHandle');
    const accountUsername = document.getElementById('accountUsername');
    const accountName = document.getElementById('accountName');
    const authEntryActions = document.getElementById('authEntryActions');
    const logoutButton = document.getElementById('logoutButton');
    const profileLoginPanel = document.getElementById('profileLoginPanel');
    const profileControlLayout = document.getElementById('profileControlLayout');
    const publicProfileLayout = document.getElementById('publicProfileLayout');

    if (profileUsername) profileUsername.textContent = username;
    if (profileMeta) profileMeta.textContent = isSignedIn ? 'Manage profile' : 'Not signed in';
    if (profileFullName) profileFullName.textContent = isSignedIn ? getDisplayName(user) : 'Guest account';
    if (profileHandle) profileHandle.textContent = isSignedIn ? `@${username}` : '@guest';
    if (accountUsername) accountUsername.textContent = username;
    if (accountName) accountName.textContent = displayName;
    if (authEntryActions) authEntryActions.hidden = isSignedIn;
    if (logoutButton) {
      logoutButton.hidden = !isSignedIn;
      logoutButton.disabled = !isSignedIn;
    }
    if (!isPublicProfile) {
      if (profileLoginPanel) profileLoginPanel.hidden = isSignedIn;
      if (profileControlLayout) profileControlLayout.hidden = !isSignedIn;
      if (publicProfileLayout) publicProfileLayout.hidden = true;
    }

    document.querySelectorAll('.coach-profile').forEach((button) => {
      const strong = button.querySelector('strong');
      const small = button.querySelector('small');
      if (strong) strong.textContent = username;
      if (small) small.textContent = isSignedIn ? getDisplayName(user) : 'Not signed in';
    });
  }

  function renderMessageNotifications() {
    const { user } = getCurrentAccount();
    const messages = readJson(directMessagesKey, []);
    const unread = user?.username && Array.isArray(messages)
      ? messages.filter((message) => message.toUsername === user.username && !message.readAt).length
      : 0;

    document.querySelectorAll('.icon-button[href="messages.html"], .coach-message-button').forEach((button) => {
      let badge = button.querySelector('.message-notification-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'message-notification-badge';
        button.appendChild(badge);
      }
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = unread === 0;
      button.setAttribute('aria-label', unread ? `Messages, ${unread} unread` : 'Messages');
    });

    const sidebarCount = document.getElementById('messageCount');
    if (sidebarCount) sidebarCount.textContent = String(unread);
  }

  function routeToProfile(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = 'profile.html';
  }

  function bindProfileRoutes() {
    document.getElementById('profileButton')?.addEventListener('click', routeToProfile, true);
    document.querySelectorAll('.coach-profile').forEach((button) => {
      button.addEventListener('click', routeToProfile, true);
    });
  }

  renderProfileSurfaces();
  renderMessageNotifications();
  bindProfileRoutes();

  window.addEventListener('storage', (event) => {
    if (event.key === sessionKey || event.key === localUsersKey) {
      renderProfileSurfaces();
      renderMessageNotifications();
    }

    if (event.key === directMessagesKey) {
      renderMessageNotifications();
    }
  });

  window.wavehubRenderProfileSurfaces = renderProfileSurfaces;
  window.wavehubRenderMessageNotifications = renderMessageNotifications;
}());
