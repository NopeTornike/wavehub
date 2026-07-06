(function () {
  const localUsersKey = 'wavehub.users';
  const sessionKey = 'wavehub.session';

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

    if (profileUsername) profileUsername.textContent = username;
    if (profileMeta) profileMeta.textContent = isSignedIn ? 'Manage profile' : 'Not signed in';
    if (profileFullName) profileFullName.textContent = isSignedIn ? getDisplayName(user) : 'Guest account';
    if (profileHandle) profileHandle.textContent = isSignedIn ? `@${username}` : '@guest';
    if (accountUsername) accountUsername.textContent = username;
    if (accountName) accountName.textContent = displayName;

    document.querySelectorAll('.coach-profile').forEach((button) => {
      const strong = button.querySelector('strong');
      const small = button.querySelector('small');
      if (strong) strong.textContent = username;
      if (small) small.textContent = isSignedIn ? getDisplayName(user) : 'Not signed in';
    });
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
  bindProfileRoutes();

  window.addEventListener('storage', (event) => {
    if (event.key === sessionKey || event.key === localUsersKey) {
      renderProfileSurfaces();
    }
  });

  window.wavehubRenderProfileSurfaces = renderProfileSurfaces;
}());
