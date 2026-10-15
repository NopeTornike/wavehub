(function () {
  const apiUrls = ['http://localhost:4000', 'http://127.0.0.1:4000'];
  const managedKeys = new Set([
    'wavehub.cart',
    'wavehub.coachWishlist',
    'wavehub.favorites',
    'wavehub.purchases',
    'wavehub.sellerListings',
    'wavehub.sellerReviews',
    'wavehub.tournaments',
    'wavehub.users',
    'wavehub.steamFavorites',
    'wavehub.notificationSeen',
  ]);
  const walletKey = 'wavehub.wallets';
  const sessionKey = 'wavehub.session';
  const originalSetItem = Storage.prototype.setItem;
  const pendingTimers = new Map();
  const writesInFlight = new Set();
  let applyingServerState = false;
  let refreshInFlight = null;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function apiRequest(path, options = {}) {
    return (async () => {
      for (const apiUrl of apiUrls) {
        try {
          const response = await fetch(`${apiUrl}${path}`, { ...options, credentials: 'include' });
          const data = await response.json().catch(() => ({}));
          if (response.ok) return { ok: true, data };
          if (response.status === 401 || response.status === 403 || response.status === 400) {
            return { ok: false, status: response.status, data };
          }
        } catch {}
      }
      return { ok: false, offline: true };
    })();
  }

  function notify(key) {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }

  function setServerValue(key, value) {
    applyingServerState = true;
    try {
      originalSetItem.call(localStorage, key, JSON.stringify(value));
    } finally {
      applyingServerState = false;
    }
    notify(key);
  }

  function mergeProfiles(serverProfiles) {
    const localProfiles = readJson('wavehub.users', []);
    const localByUsername = new Map((Array.isArray(localProfiles) ? localProfiles : []).map((user) => [user.username, user]));
    const merged = (Array.isArray(serverProfiles) ? serverProfiles : []).map((profile) => {
      const local = localByUsername.get(profile.username) || {};
      const { role, isAdmin, accountType, ...safeLocal } = local;
      return { ...safeLocal, ...profile };
    });
    const sessionUser = readJson(sessionKey, null)?.user;
    if (sessionUser?.username && !merged.some((user) => user.username === sessionUser.username)) {
      const local = localByUsername.get(sessionUser.username) || {};
      merged.push({ ...local, ...sessionUser });
    }
    setServerValue('wavehub.users', merged);
  }

  async function pushState(key) {
    const sessionUser = readJson(sessionKey, null)?.user;
    if (!sessionUser?.username || writesInFlight.has(key)) return;
    writesInFlight.add(key);
    try {
      const result = await apiRequest('/state/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: readJson(key, null) }),
      });
      if (!result.ok && !result.offline) await refreshState(true);
    } finally {
      writesInFlight.delete(key);
    }
  }

  function schedulePush(key) {
    window.clearTimeout(pendingTimers.get(key));
    pendingTimers.set(key, window.setTimeout(() => {
      pendingTimers.delete(key);
      pushState(key);
    }, 350));
  }

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && !applyingServerState && managedKeys.has(key)) schedulePush(key);
  };

  async function refreshState(force = false) {
    if (refreshInFlight && !force) return refreshInFlight;
    refreshInFlight = (async () => {
      const publicResult = await apiRequest('/state/public');
      let publicCoachingListings = [];
      if (publicResult.ok) {
        const values = publicResult.data?.values || {};
        publicCoachingListings = Array.isArray(values['wavehub.publicCoachingListings'])
          ? values['wavehub.publicCoachingListings']
          : [];
        for (const key of ['wavehub.sellerListings', 'wavehub.sellerReviews', 'wavehub.tournaments']) {
          if (Object.hasOwn(values, key) && !pendingTimers.has(key) && !writesInFlight.has(key)) setServerValue(key, values[key]);
          else if (!Object.hasOwn(values, key) && readJson(key, []).length) schedulePush(key);
        }
        if (Object.hasOwn(values, 'wavehub.users')) {
          if (values['wavehub.users'].length) mergeProfiles(values['wavehub.users']);
          else if (readJson('wavehub.users', []).length) schedulePush('wavehub.users');
        }
      }

      const authenticatedUser = await (window.wavehubAuthReady || Promise.resolve(readJson(sessionKey, null)?.user || null));
      if (!authenticatedUser) {
        if (publicCoachingListings.length) setServerValue('wavehub.cart', publicCoachingListings);
        return;
      }
      const privateResult = await apiRequest('/state/me');
      if (!privateResult.ok) return;
      const values = privateResult.data?.values || {};
      for (const key of ['wavehub.cart', 'wavehub.favorites', 'wavehub.purchases', 'wavehub.coachWishlist', 'wavehub.steamFavorites', 'wavehub.notificationSeen']) {
        if (Object.hasOwn(values, key) && !pendingTimers.has(key) && !writesInFlight.has(key)) {
          const value = key === 'wavehub.cart'
            ? [...values[key], ...publicCoachingListings.filter((item) => item?.buyerUsername !== authenticatedUser.username)]
            : values[key];
          setServerValue(key, value);
        }
        else if (!Object.hasOwn(values, key) && localStorage.getItem(key)) schedulePush(key);
      }
      if (Object.hasOwn(values, walletKey)) setServerValue(walletKey, values[walletKey]);
    })().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  window.wavehubRefreshServerState = refreshState;
  refreshState();
  window.setInterval(() => { if (!document.hidden) refreshState(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); });
}());
