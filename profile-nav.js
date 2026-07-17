(function () {
  const localUsersKey = 'wavehub.users';
  const sessionKey = 'wavehub.session';
  const directMessagesKey = 'wavehub.directMessages';
  const priceOffersKey = 'wavehub.priceOffers';
  const purchasesKey = 'wavehub.purchases';
  const notificationSeenKey = 'wavehub.notificationSeen';
  let notificationPanel = null;

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

  function formatNotificationTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getNotifications(user) {
    if (!user?.username) return [];
    const username = user.username;
    const messages = readJson(directMessagesKey, []);
    const offers = readJson(priceOffersKey, []);
    const purchases = readJson(purchasesKey, []);
    const items = [];

    if (Array.isArray(messages)) {
      messages.filter((message) => message.toUsername === username).forEach((message) => {
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

    if (Array.isArray(offers)) {
      offers.filter((offer) => offer.sellerUsername === username).forEach((offer) => {
        items.push({
          id: `offer:${offer.id}`,
          type: 'offer',
          title: `Price offer from ${offer.buyerName || offer.buyerUsername || 'buyer'}`,
          text: offer.itemTitle || offer.message || 'A new marketplace offer arrived.',
          date: offer.createdAt,
          href: offer.detailUrl || 'messages.html',
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
            href: 'profile.html',
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
            href: 'profile.html',
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
      const rect = anchor.getBoundingClientRect();
      notificationPanel.style.top = `${Math.max(12, Math.min(window.innerHeight - 430, rect.bottom + 10))}px`;
      notificationPanel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      const { user } = getCurrentAccount();
      if (user?.username) {
        const seenByUser = readJson(notificationSeenKey, {});
        localStorage.setItem(notificationSeenKey, JSON.stringify({ ...seenByUser, [user.username]: new Date().toISOString() }));
      }
      renderNotificationCenter();
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
    document.getElementById('profileButton')?.addEventListener('click', routeToProfile, true);
    document.querySelectorAll('.coach-profile').forEach((button) => {
      button.addEventListener('click', routeToProfile, true);
    });
  }

  renderProfileSurfaces();
  renderMessageNotifications();
  bindProfileRoutes();
  bindNotificationCenter();
  renderNotificationCenter();

  window.addEventListener('storage', (event) => {
    if (event.key === sessionKey || event.key === localUsersKey) {
      renderProfileSurfaces();
      renderMessageNotifications();
    }

    if ([directMessagesKey, priceOffersKey, purchasesKey, notificationSeenKey].includes(event.key)) {
      renderMessageNotifications();
      renderNotificationCenter();
    }
  });

  window.wavehubRenderProfileSurfaces = renderProfileSurfaces;
  window.wavehubRenderMessageNotifications = renderMessageNotifications;
  window.wavehubRenderNotificationCenter = renderNotificationCenter;
}());
