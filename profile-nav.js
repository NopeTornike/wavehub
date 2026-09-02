(function () {
  const localUsersKey = 'wavehub.users';
  const sessionKey = 'wavehub.session';
  const purchasesKey = 'wavehub.purchases';
  const walletsKey = 'wavehub.wallets';
  const notificationSeenKey = 'wavehub.notificationSeen';
  const apiUrls = ['http://localhost:4000', 'http://127.0.0.1:4000'];
  let notificationPanel = null;
  let serverMessages = [];
  let messagesRefreshInFlight = null;

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
    const user = sessionUser ? { ...storedUser, ...sessionUser } : null;

    return { session, user };
  }

  function cacheAuthoritativeUser(serverUser) {
    const users = readJson(localUsersKey, []);
    const currentUsers = Array.isArray(users) ? users : [];
    const localUser = currentUsers.find((user) => user.username === serverUser.username) || {};
    const { role: _role, isAdmin: _isAdmin, accountType: _accountType, ...safeLocalProfile } = localUser;
    const authoritativeUser = {
      ...safeLocalProfile,
      id: serverUser.id,
      username: serverUser.username,
      firstName: serverUser.firstName,
      lastName: serverUser.lastName,
      role: serverUser.role,
    };
    const nextUsers = currentUsers.some((user) => user.username === authoritativeUser.username)
      ? currentUsers.map((user) => (user.username === authoritativeUser.username ? authoritativeUser : user))
      : [...currentUsers, authoritativeUser];
    localStorage.setItem(localUsersKey, JSON.stringify(nextUsers));
    const previousSession = readJson(sessionKey, {});
    localStorage.setItem(sessionKey, JSON.stringify({
      loggedInAt: previousSession?.loggedInAt || new Date().toISOString(),
      user: {
        id: authoritativeUser.id,
        username: authoritativeUser.username,
        firstName: authoritativeUser.firstName,
        lastName: authoritativeUser.lastName,
        role: authoritativeUser.role,
      },
    }));
    return authoritativeUser;
  }

  async function validateServerSession() {
    if (!readJson(sessionKey, null)?.user?.username) return null;

    for (const apiUrl of apiUrls) {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: 'include' });
        if (!response.ok) continue;
        const data = await response.json();
        if (data?.user?.username) return cacheAuthoritativeUser(data.user);
      } catch {}
    }

    localStorage.removeItem(sessionKey);
    return null;
  }

  const authReady = validateServerSession().finally(() => {
    renderProfileSurfaces();
    window.dispatchEvent(new StorageEvent('storage', { key: sessionKey }));
    window.dispatchEvent(new CustomEvent('wavehub:auth-changed'));
  });
  window.wavehubAuthReady = authReady;
  window.wavehubGetAuthenticatedUser = async () => authReady;
  window.wavehubRequireAuthenticatedUser = async () => {
    const user = await authReady;
    return user || null;
  };

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

  function purgeLocalCredentials() {
    const users = readJson(localUsersKey, []);
    if (!Array.isArray(users)) return;
    const sanitized = users.map(({ password, passwordHash, ...publicUser }) => publicUser);
    localStorage.setItem(localUsersKey, JSON.stringify(sanitized));
  }

  function createHeaderAction(tagName, className, label, href = '') {
    const element = document.createElement(tagName);
    element.className = className;
    element.setAttribute('aria-label', label);
    element.setAttribute('title', label);
    if (href && element instanceof HTMLAnchorElement) element.href = href;
    return element;
  }

  function getProfileMenuMarkup() {
    return `
      <button class="profile-chip" id="profileButton" type="button" aria-label="Profile menu" aria-haspopup="true" aria-expanded="false">
        <span class="avatar avatar-hot" id="profileAvatar">?</span>
      </button>
      <div class="profile-dropdown profile-dropdown-rich" id="profileDropdown" hidden>
        <div class="profile-dropdown-head">
          <span class="profile-panel-avatar-wrap">
            <span class="avatar avatar-hot" id="profilePanelAvatar">?</span>
            <i aria-label="Online"></i>
          </span>
          <div class="profile-dropdown-identity">
            <div class="profile-dropdown-name-row">
              <strong id="profileFullName">Guest account</strong>
              <span class="profile-verified-mark" aria-label="Verified">&#10003;</span>
            </div>
            <small><span class="profile-rank-gem" aria-hidden="true"></span><span id="profileDropdownRank">Wave Rookie</span></small>
            <span class="profile-tier"><span aria-hidden="true">&#9812;</span><b id="profileTierName">Wave Rookie</b><i aria-hidden="true">&#8594;</i><strong>Prime</strong></span>
          </div>
        </div>
        <div class="profile-level-row" aria-label="Account level">
          <span>Lv. <strong id="profileDropdownLevel">1</strong></span>
          <i><b id="profileDropdownProgress"></b></i>
          <small><span id="profileDropdownXp">0</span> / <span id="profileDropdownXpGoal">500</span> XP</small>
        </div>
        <nav class="profile-dropdown-links" aria-label="Profile shortcuts">
          <div class="profile-dropdown-group">
            <a href="orders.html"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg></span><span>My Orders</span><i aria-hidden="true">&#8250;</i></a>
            <a id="profileFavoritesLink" href="marketplace.html#favorites"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg></span><span>Favorites</span><i aria-hidden="true">&#8250;</i></a>
            <a href="messages.html"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 12H2v5a2 2 0 0 0 2 2h2v-7H4Zm16 0h2v5a2 2 0 0 1-2 2h-2v-7h2ZM18 19c0 2-2 2-4 2"/></svg></span><span>Support</span><i aria-hidden="true">&#8250;</i></a>
            <a href="profile.html"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg></span><span>Settings</span><i aria-hidden="true">&#8250;</i></a>
          </div>
          <div class="profile-dropdown-group">
            <a id="profilePublicLink" href="profile.html"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span><span>View Profile</span></a>
            <a href="profile.html#verification"><span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 7 3v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span><span>Verified Status</span></a>
          </div>
        </nav>
        <div class="auth-entry-actions" id="authEntryActions">
          <a class="auth-open-button" href="auth.html?mode=login">Log in</a>
          <a class="auth-open-button primary" href="auth.html?mode=register">Create account</a>
        </div>
        <button class="logout-button" id="logoutButton" type="button">Log Out</button>
      </div>`;
  }

  function standardizeSidebars() {
    const sidebar = document.getElementById('sidebar');
    const navigation = sidebar?.querySelector('.side-nav');
    if (!navigation) return;

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const isFavoritesPage = path === 'marketplace.html' && window.location.hash === '#favorites';
    const activePage = isFavoritesPage
      ? 'favorites'
      : path === 'detail.html'
        ? 'marketplace'
        : path === 'tournament-detail.html'
          ? 'tournaments'
          : path.replace(/\.html$/, '');
    const pages = [
      { id: 'index', label: 'Home', href: 'index.html', icon: '<img src="assets/home-icon.svg" alt="" />', iconClass: 'nav-icon-home' },
      { id: 'marketplace', label: 'Marketplace', href: 'marketplace.html', icon: '<img src="assets/marketplace-icon.svg" alt="" />', iconClass: 'nav-icon-marketplace' },
      { id: 'steam-keys', label: 'Steam Keys', href: 'steam-keys.html', icon: '<img src="assets/steam-logo.png?v=1" alt="" />', iconClass: 'steam-side-icon' },
      { id: 'coaching', label: 'Coaching', href: 'coaching.html', icon: '<img src="assets/sidebar-coaching-icon.svg" alt="" />', iconClass: 'nav-icon-coaching' },
      { id: 'tournaments', label: 'Tournaments', href: 'tournaments.html', icon: '<img src="assets/tournaments-icon.svg" alt="" />', iconClass: 'nav-icon-tournaments' },
      { id: 'about', label: 'About Us', href: 'about.html', icon: '<img src="assets/about-icon.svg?v=2" alt="" />', iconClass: 'nav-icon-about' },
      { id: 'orders', label: 'Orders', href: 'orders.html', icon: '<img src="assets/orders-icon.svg" alt="" />', iconClass: 'nav-icon-orders' },
      { id: 'messages', label: 'Messages', href: 'messages.html', icon: '<img src="assets/sidebar-message-icon.svg" alt="" />', iconClass: 'nav-icon-messages', count: 'message' },
      { id: 'wallet', label: 'Wallet', href: 'wallet.html', icon: '<img src="assets/wallet-icon.svg" alt="" />', iconClass: 'nav-icon-wallet' },
      { id: 'cart', label: 'Cart', href: 'cart.html', icon: '<img src="assets/sidebar-cart-icon.svg" alt="" />', iconClass: 'nav-icon-cart', count: 'cart' },
      { id: 'favorites', label: 'Favorites', href: 'marketplace.html#favorites', icon: '<img src="assets/favorites-icon.svg" alt="" />', iconClass: 'nav-icon-heart' },
      { id: 'profile', label: 'Settings', href: 'profile.html', icon: '<img src="assets/settings-icon.svg" alt="" />', iconClass: 'nav-icon-settings' },
    ];

    const existingLinks = Array.from(navigation.querySelectorAll('.side-link'));
    navigation.replaceChildren(...pages.map((page) => {
      const link = existingLinks.find((item) => (
        item.dataset.section === page.label
        || item.querySelector(':scope > span:not(.nav-icon):not(.nav-pill)')?.textContent.trim() === page.label
      )) || document.createElement('a');
      link.classList.add('side-link');
      link.classList.toggle('active', page.id === activePage);
      link.href = page.id === 'favorites' && path === 'marketplace.html' ? '#' : page.href;
      link.dataset.section = page.label;

      if (!link.querySelector('.nav-icon')) {
        link.innerHTML = `<span class="nav-icon ${page.iconClass}" aria-hidden="true">${page.icon}</span><span>${page.label}</span>`;
      }

      if (page.count) {
        const count = link.querySelector('.nav-pill') || document.createElement('span');
        count.classList.add('nav-pill');
        if (!count.isConnected) {
          count.textContent = '0';
          link.appendChild(count);
        }
        if (page.count === 'message') count.id = 'messageCount';
        if (page.count === 'cart') count.dataset.cartCount = '';
      }

      return link;
    }));

    window.renderGlobalCartCount?.();
  }

  function standardizeTopbars() {
    document.querySelectorAll('.coach-topbar, .steam-page-nav').forEach((topbar) => {
      const existingSearch = topbar.querySelector('input[type="search"]');
      const existingMenu = topbar.querySelector('.menu-toggle');
      const existingBrand = topbar.querySelector('.coach-brand');
      topbar.className = 'topbar global-topbar';
      topbar.replaceChildren();
      const search = document.createElement('label');
      search.className = 'search-box';
      search.setAttribute('aria-label', 'Search');
      search.innerHTML = '<span class="search-icon" aria-hidden="true">/</span>';
      const input = existingSearch || document.createElement('input');
      input.type = 'search';
      if (!input.placeholder) input.placeholder = 'Search for games, services or players...';
      input.autocomplete = 'off';
      search.appendChild(input);
      const actions = document.createElement('div');
      actions.className = 'top-actions';
      if (existingMenu) topbar.appendChild(existingMenu);
      if (existingBrand) {
        existingBrand.classList.add('global-header-brand');
        topbar.classList.add('has-header-brand');
        topbar.appendChild(existingBrand);
      }
      topbar.append(search, actions);
    });

    if (!document.querySelector('.topbar')) {
      const host = document.querySelector('.main-panel');
      if (host) {
        const topbar = document.createElement('header');
        topbar.className = 'topbar global-topbar';
        topbar.innerHTML = '<label class="search-box" aria-label="Search"><span class="search-icon" aria-hidden="true">/</span><input type="search" placeholder="Search for games, services or players..." autocomplete="off"></label><div class="top-actions"></div>';
        host.prepend(topbar);
      }
    }

    document.querySelectorAll('.topbar').forEach((topbar) => {
      topbar.classList.add('global-topbar');
      const actions = topbar.querySelector('.top-actions');
      if (!actions) return;

      if (!topbar.querySelector('.menu-toggle') && document.getElementById('sidebar')) {
        const menu = document.createElement('button');
        menu.className = 'menu-toggle';
        menu.id = 'menuToggle';
        menu.type = 'button';
        menu.setAttribute('aria-label', 'Open menu');
        menu.setAttribute('aria-controls', 'sidebar');
        menu.setAttribute('aria-expanded', 'false');
        menu.innerHTML = '<span></span><span></span><span></span>';
        topbar.prepend(menu);
      }
      topbar.classList.toggle('no-menu-toggle', !topbar.querySelector('.menu-toggle'));

      if (!topbar.querySelector('.search-box')) {
        const search = document.createElement('label');
        search.className = 'search-box';
        search.setAttribute('aria-label', 'Search');
        search.innerHTML = '<span class="search-icon" aria-hidden="true">/</span><input type="search" placeholder="Search for games, services or players..." autocomplete="off">';
        topbar.insertBefore(search, actions);
        Array.from(topbar.children).forEach((child) => {
          if (!child.matches('.menu-toggle, .search-box, .top-actions')) child.remove();
        });
      }

      let messages = actions.querySelector('.icon-button[href="messages.html"]');
      if (!messages) {
        messages = createHeaderAction('a', 'icon-button', 'Messages', 'messages.html');
        messages.innerHTML = '<img class="message-icon-image" src="assets/message-icon.svg" alt="" aria-hidden="true">';
      }

      let cart = actions.querySelector('.cart-top-button');
      if (!cart) {
        cart = createHeaderAction('a', 'icon-button cart-top-button', 'Cart', 'cart.html');
        cart.innerHTML = '<img class="cart-icon-image" src="assets/cart-icon.png" alt="" aria-hidden="true"><strong class="cart-badge" data-cart-count>0</strong>';
      }

      let notifications = actions.querySelector('.icon-button.has-alert');
      if (!notifications) {
        notifications = createHeaderAction('button', 'icon-button has-alert', 'Notifications');
        notifications.type = 'button';
        notifications.innerHTML = '<span aria-hidden="true">!</span>';
      }

      let wallet = actions.querySelector('.home-top-wallet');
      if (!wallet) {
        wallet = createHeaderAction('a', 'home-top-wallet', 'Wallet balance', 'wallet.html');
        wallet.innerHTML = '<span data-global-wallet-balance>0</span> WC';
      }

      let profileMenu = actions.querySelector('.profile-menu');
      if (!profileMenu) {
        profileMenu = document.createElement('div');
        profileMenu.className = 'profile-menu';
      }
      profileMenu.id = 'profileMenu';
      profileMenu.innerHTML = getProfileMenuMarkup();
      const contextualAction = actions.querySelector('#sellerButton');
      actions.querySelectorAll('.seller-button:not(#sellerButton)').forEach((button) => button.remove());
      actions.replaceChildren(messages, cart, notifications, wallet);
      if (contextualAction) actions.appendChild(contextualAction);
      actions.appendChild(profileMenu);
    });

    window.renderGlobalCartCount?.();
  }

  function renderProfileSurfaces() {
    const { user } = getCurrentAccount();
    const isSignedIn = Boolean(user?.username);
    const isPublicProfile = window.location.pathname.endsWith('profile.html')
      && Boolean(new URLSearchParams(window.location.search).get('user'));
    const username = user?.username || 'Guest';
    const displayName = isSignedIn ? getDisplayName(user) : 'Not signed in';

    ['profileAvatar', 'profilePanelAvatar', 'mobileProfileAvatar', 'mobileHeaderAvatar'].forEach((id) => {
      applyAvatar(document.getElementById(id), user);
    });
    document.querySelectorAll('.global-topbar .profile-chip .avatar').forEach((element) => applyAvatar(element, user));

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
    const profileDropdownRank = document.getElementById('profileDropdownRank');
    const profileTierName = document.getElementById('profileTierName');
    const profileDropdownLevel = document.getElementById('profileDropdownLevel');
    const profileDropdownXp = document.getElementById('profileDropdownXp');
    const profileDropdownXpGoal = document.getElementById('profileDropdownXpGoal');
    const profileDropdownProgress = document.getElementById('profileDropdownProgress');
    const profilePublicLink = document.getElementById('profilePublicLink');
    const mobileProfileUsername = document.getElementById('mobileProfileUsername');
    const mobileProfileRank = document.getElementById('mobileProfileRank');
    const mobileProfileLevel = document.getElementById('mobileProfileLevel');
    const mobileWalletBalance = document.getElementById('mobileWalletBalance');
    const mobileHeaderAuth = document.querySelector('.mobile-header-auth');
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
    const profileRank = user?.rank || user?.role || (isSignedIn ? 'Wave Master' : 'Wave Rookie');
    const profileLevel = Math.max(1, Number(user?.level) || 1);
    const profileXpGoal = Math.max(100, Number(user?.xpGoal) || 500);
    const profileXp = Math.max(0, Math.min(profileXpGoal, Number(user?.xp) || (isSignedIn ? 120 : 0)));
    if (profileDropdownRank) profileDropdownRank.textContent = profileRank;
    if (profileTierName) profileTierName.textContent = profileRank;
    if (profileDropdownLevel) profileDropdownLevel.textContent = String(profileLevel);
    if (profileDropdownXp) profileDropdownXp.textContent = String(profileXp);
    if (profileDropdownXpGoal) profileDropdownXpGoal.textContent = String(profileXpGoal);
    if (profileDropdownProgress) profileDropdownProgress.style.width = `${Math.round((profileXp / profileXpGoal) * 100)}%`;
    if (profilePublicLink instanceof HTMLAnchorElement) {
      profilePublicLink.href = isSignedIn
        ? `profile.html?user=${encodeURIComponent(username)}`
        : 'auth.html?mode=login';
    }
    if (mobileProfileUsername) mobileProfileUsername.textContent = username;
    if (mobileProfileRank) mobileProfileRank.textContent = user?.rank || user?.role || (isSignedIn ? 'Wave Master' : 'Wave Rookie');
    if (mobileProfileLevel) mobileProfileLevel.textContent = String(Math.max(1, Number(user?.level) || 1));
    if (mobileHeaderAuth) mobileHeaderAuth.classList.toggle('is-signed-in', isSignedIn);
    if (mobileWalletBalance) {
      const wallets = readJson(walletsKey, {});
      const balance = isSignedIn ? Math.max(0, Number(wallets?.[username]?.balance) || 0) : 0;
      mobileWalletBalance.textContent = balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    const wallets = readJson(walletsKey, {});
    const globalWalletBalance = isSignedIn ? Math.max(0, Number(wallets?.[username]?.balance) || 0) : 0;
    document.querySelectorAll('[data-global-wallet-balance]').forEach((element) => {
      element.textContent = globalWalletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });
    });
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
    const unread = user?.username
      ? serverMessages.filter((message) => message.toUsername === user.username && !message.readAt).length
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

  function formatNotificationTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getNotifications(user) {
    if (!user?.username) return [];
    const username = user.username;
    const purchases = readJson(purchasesKey, []);
    const items = [];

    if (Array.isArray(serverMessages)) {
      serverMessages.filter((message) => message.toUsername === username).forEach((message) => {
        items.push({
          id: `message:${message.id}`,
          type: 'message',
          title: `New message from @${message.fromUsername}`,
          text: message.body || 'Open the conversation to reply.',
          date: message.createdAt,
          unread: !message.readAt,
          href: `messages.html?to=${encodeURIComponent(message.fromUsername)}`,
        });
      });
    }

    if (Array.isArray(purchases)) {
      purchases.forEach((purchase) => {
        if (purchase.buyerUsername === username) {
          items.push({
            id: `purchase:${purchase.id}:buyer`,
            type: 'order',
            title: 'Order update',
            text: `${purchase.status || 'Checkout request'} · ${purchase.items?.length || 0} item(s)`,
            date: purchase.purchasedAt || purchase.createdAt,
            href: 'orders.html',
          });
        }

        const sellerItems = Array.isArray(purchase.items)
          ? purchase.items.filter((item) => item.sellerUsername === username)
          : [];
        if (sellerItems.length) {
          items.push({
            id: `purchase:${purchase.id}:seller`,
            type: 'sale',
            title: 'New order received',
            text: sellerItems.map((item) => item.title).filter(Boolean).join(', ') || 'A buyer placed an order.',
            date: purchase.purchasedAt || purchase.createdAt,
            href: 'orders.html',
          });
        }
      });
    }

    return items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function renderNotificationCenter() {
    const { user } = getCurrentAccount();
    const notifications = getNotifications(user);
    const seenByUser = readJson(notificationSeenKey, {});
    const seenAt = new Date(seenByUser?.[user?.username] || 0).getTime();
    const unreadCount = notifications.filter((item) => item.unread || new Date(item.date || 0).getTime() > seenAt).length;

    document.querySelectorAll('.icon-button.has-alert').forEach((button) => {
      button.classList.toggle('has-notifications', unreadCount > 0);
      let badge = button.querySelector('.notification-count-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-count-badge';
        button.appendChild(badge);
      }
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.hidden = unreadCount === 0;
      button.setAttribute('aria-expanded', String(notificationPanel && !notificationPanel.hidden));
    });

    if (!notificationPanel) return;
    const list = notificationPanel.querySelector('.notification-center-list');
    if (!list) return;
    list.innerHTML = '';

    if (!user?.username || notifications.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'notification-center-empty';
      empty.textContent = user?.username ? 'No notifications yet.' : 'Log in to see notifications.';
      list.appendChild(empty);
      return;
    }

    notifications.slice(0, 12).forEach((item) => {
      const link = document.createElement('a');
      link.className = `notification-center-item ${item.type}${item.unread ? ' unread' : ''}`;
      link.href = item.href;
      const icon = document.createElement('span');
      icon.className = 'notification-center-icon';
      icon.textContent = item.type === 'message' ? 'M' : item.type === 'offer' ? '₾' : item.type === 'sale' ? 'S' : 'O';
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      const text = document.createElement('small');
      const time = document.createElement('time');
      title.textContent = item.title;
      text.textContent = item.text;
      time.textContent = formatNotificationTime(item.date);
      copy.append(title, text, time);
      link.append(icon, copy);
      list.appendChild(link);
    });
  }

  function setNotificationCenterOpen(isOpen, anchor = null) {
    if (!notificationPanel) return;
    notificationPanel.hidden = !isOpen;
    if (isOpen && anchor) {
      renderNotificationCenter();
      const rect = anchor.getBoundingClientRect();
      const isMobile = window.innerWidth <= 600;

      if (isMobile) {
        notificationPanel.style.inset = 'auto 8px auto 8px';
        notificationPanel.style.width = 'auto';
        notificationPanel.style.maxHeight = 'calc(100dvh - 16px)';
        const panelHeight = Math.min(notificationPanel.scrollHeight, window.innerHeight - 16);
        const preferredTop = rect.bottom + 8;
        const top = preferredTop + panelHeight <= window.innerHeight - 8
          ? preferredTop
          : Math.max(8, window.innerHeight - panelHeight - 8);
        notificationPanel.style.top = `${top}px`;
      } else {
        notificationPanel.style.inset = 'auto';
        notificationPanel.style.width = '';
        notificationPanel.style.maxHeight = '';
        const panelHeight = Math.min(notificationPanel.scrollHeight || 520, window.innerHeight - 24);
        const top = Math.max(12, Math.min(window.innerHeight - panelHeight - 12, rect.bottom + 10));
        notificationPanel.style.top = `${top}px`;
        notificationPanel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      }
      const { user } = getCurrentAccount();
      if (user?.username) {
        const seenByUser = readJson(notificationSeenKey, {});
        localStorage.setItem(notificationSeenKey, JSON.stringify({ ...seenByUser, [user.username]: new Date().toISOString() }));
      }
    }
    document.querySelectorAll('.icon-button.has-alert').forEach((button) => {
      button.setAttribute('aria-expanded', String(isOpen));
    });
  }

  function bindNotificationCenter() {
    notificationPanel = document.createElement('aside');
    notificationPanel.className = 'notification-center';
    notificationPanel.hidden = true;
    notificationPanel.innerHTML = '<header><div><span>Updates</span><h2>Notifications</h2></div><button type="button" aria-label="Close notifications">×</button></header><div class="notification-center-list"></div><a class="notification-center-footer" href="messages.html">Open messages</a>';
    document.body.appendChild(notificationPanel);

    document.querySelectorAll('.icon-button.has-alert').forEach((button) => {
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        setNotificationCenterOpen(notificationPanel.hidden, button);
      });
    });
    notificationPanel.querySelector('header button')?.addEventListener('click', () => setNotificationCenterOpen(false));
    notificationPanel.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => setNotificationCenterOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setNotificationCenterOpen(false);
    });
  }

  function routeToProfile(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = 'profile.html';
  }

  function bindProfileRoutes() {
    const profileButton = document.getElementById('profileButton');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileMenu = document.getElementById('profileMenu');

    const setProfileOpen = (isOpen) => {
      if (!profileButton || !profileDropdown) return;
      profileDropdown.hidden = !isOpen;
      profileButton.setAttribute('aria-expanded', String(isOpen));
    };

    profileButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setNotificationCenterOpen(false);
      setProfileOpen(profileDropdown?.hidden ?? true);
    }, true);

    profileDropdown?.addEventListener('click', (event) => event.stopPropagation());

    document.addEventListener('click', (event) => {
      if (profileMenu?.contains(event.target)) return;
      setProfileOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || profileDropdown?.hidden) return;
      setProfileOpen(false);
      profileButton?.focus();
    });

    document.querySelectorAll('.coach-profile').forEach((button) => {
      button.addEventListener('click', routeToProfile, true);
    });

    document.getElementById('profileFavoritesLink')?.addEventListener('click', (event) => {
      const favoritesLink = document.querySelector('.side-nav [data-section="Favorites"]');
      if (!(favoritesLink instanceof HTMLElement)) return;
      event.preventDefault();
      favoritesLink.click();
    });

    document.getElementById('logoutButton')?.addEventListener('click', async (event) => {
      event.preventDefault();
      for (const apiUrl of apiUrls) {
        try {
          await fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
          break;
        } catch {}
      }
      localStorage.removeItem(sessionKey);
      serverMessages = [];
      setProfileOpen(false);
      renderProfileSurfaces();
      renderMessageNotifications();
      renderNotificationCenter();
    });
  }

  async function refreshServerMessages() {
    if (messagesRefreshInFlight) return messagesRefreshInFlight;
    messagesRefreshInFlight = refreshServerMessagesNow().finally(() => {
      messagesRefreshInFlight = null;
    });
    return messagesRefreshInFlight;
  }

  async function refreshServerMessagesNow() {
    await authReady;
    const { user } = getCurrentAccount();
    if (!user?.username) {
      serverMessages = [];
      renderMessageNotifications();
      return;
    }

    for (const apiUrl of apiUrls) {
      try {
        const response = await fetch(`${apiUrl}/messages`, { credentials: 'include' });
        if (!response.ok) continue;
        const data = await response.json();
        serverMessages = Array.isArray(data.messages) ? data.messages : [];
        renderMessageNotifications();
        renderNotificationCenter();
        return;
      } catch {}
    }
  }

  function renderMarketplaceGameMenu() {
    const marketplaceGames = [
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

    document.querySelectorAll('.side-nav > a[href="marketplace.html"]').forEach((marketplaceLink) => {
      if (marketplaceLink.parentElement?.classList.contains('marketplace-game-menu')) return;

      const menu = document.createElement('div');
      menu.className = 'marketplace-game-menu';
      marketplaceLink.parentNode.insertBefore(menu, marketplaceLink);
      menu.appendChild(marketplaceLink);

      const arrow = document.createElement('span');
      arrow.className = 'marketplace-menu-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      marketplaceLink.appendChild(arrow);
      marketplaceLink.setAttribute('aria-haspopup', 'true');
      marketplaceLink.setAttribute('aria-expanded', 'false');

      const dropdown = document.createElement('div');
      dropdown.className = 'marketplace-game-dropdown';
      dropdown.setAttribute('aria-label', 'Marketplace games');

      const allGames = document.createElement('a');
      allGames.href = 'marketplace.html';
      allGames.textContent = 'All Games';
      dropdown.appendChild(allGames);

      marketplaceGames.forEach((game) => {
        const gameLink = document.createElement('a');
        gameLink.href = `marketplace.html?game=${encodeURIComponent(game)}`;
        gameLink.textContent = game;
        dropdown.appendChild(gameLink);
      });

      menu.appendChild(dropdown);
      marketplaceLink.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const isOpen = menu.classList.toggle('open');
        marketplaceLink.setAttribute('aria-expanded', String(isOpen));
      }, true);

      menu.addEventListener('mouseleave', () => {
        if (!menu.classList.contains('open')) marketplaceLink.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (event) => {
      document.querySelectorAll('.marketplace-game-menu.open').forEach((menu) => {
        if (menu.contains(event.target)) return;
        menu.classList.remove('open');
        menu.querySelector('.side-link')?.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.marketplace-game-menu.open').forEach((menu) => {
        menu.classList.remove('open');
        menu.querySelector('.side-link')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function renderMobileNavigation() {
    if (document.querySelector('.mobile-bottom-nav')) {
      return;
    }

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const activeItem = path === 'marketplace.html' || path === 'detail.html' || path === 'cart.html' || path === 'steam-keys.html'
      ? 'marketplace'
      : path === 'orders.html'
        ? 'orders'
        : path === 'wallet.html'
          ? 'wallet'
      : path === 'profile.html'
          ? 'profile'
          : 'home';

    const navigation = document.createElement('nav');
    navigation.className = 'mobile-bottom-nav';
    navigation.setAttribute('aria-label', 'Mobile navigation');
    navigation.innerHTML = `
      <a class="mobile-home-link" href="index.html" data-mobile-route="home">
        <span class="mobile-home-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/></svg></span>
        <span>Home</span>
      </a>
      <a href="marketplace.html" data-mobile-route="marketplace">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
        <span>Marketplace</span>
      </a>
      <a href="orders.html" data-mobile-route="orders">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/></svg>
        <span>Orders</span>
      </a>
      <a href="wallet.html" data-mobile-route="wallet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v10H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12v4"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></svg>
        <span>Wallet</span>
      </a>
      <a href="profile.html" data-mobile-route="profile">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
        <span>Profile</span>
      </a>`;

    navigation.querySelector(`[data-mobile-route="${activeItem}"]`)?.classList.add('active');
    document.body.appendChild(navigation);
  }

  purgeLocalCredentials();
  standardizeSidebars();
  standardizeTopbars();
  renderProfileSurfaces();
  renderMessageNotifications();
  bindProfileRoutes();
  renderMarketplaceGameMenu();
  bindNotificationCenter();
  renderNotificationCenter();
  renderMobileNavigation();
  refreshServerMessages();
  window.setInterval(() => {
    if (!document.hidden) refreshServerMessages();
  }, 15000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshServerMessages();
  });

  window.addEventListener('resize', () => {
    if (!notificationPanel || notificationPanel.hidden) return;
    const anchor = Array.from(document.querySelectorAll('.icon-button.has-alert')).find((button) => button.getAttribute('aria-expanded') === 'true');
    if (anchor) setNotificationCenterOpen(true, anchor);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === sessionKey || event.key === localUsersKey || event.key === walletsKey) {
      renderProfileSurfaces();
      renderMessageNotifications();
    }

    if ([purchasesKey, notificationSeenKey].includes(event.key)) {
      renderMessageNotifications();
      renderNotificationCenter();
    }
  });

  window.wavehubRenderProfileSurfaces = renderProfileSurfaces;
  window.wavehubRenderMessageNotifications = renderMessageNotifications;
  window.wavehubRefreshMessageNotifications = refreshServerMessages;
  window.wavehubRenderNotificationCenter = renderNotificationCenter;
}());
