(function () {
  const cartKey = 'wavehub.cart';
  const coachWishlistKey = 'wavehub.coachWishlist';
  const coachingCleanupKey = 'wavehub.coachingSeedCleared.v1';

  function clearOldCoachingItems() {
    if (localStorage.getItem(coachingCleanupKey)) {
      return;
    }

    try {
      const items = JSON.parse(localStorage.getItem(cartKey) || '[]');
      if (Array.isArray(items)) {
        const nextItems = items.filter((item) => (
          item?.productType !== 'Coaching'
          && !String(item?.id || '').startsWith('coach:')
        ));
        localStorage.setItem(cartKey, JSON.stringify(nextItems));
      }
      localStorage.removeItem(coachWishlistKey);
    } catch {
      localStorage.setItem(cartKey, '[]');
      localStorage.removeItem(coachWishlistKey);
    }

    localStorage.setItem(coachingCleanupKey, 'true');
  }

  function readCartCount() {
    try {
      const items = JSON.parse(localStorage.getItem(cartKey) || '[]');
      return Array.isArray(items) ? items.length : 0;
    } catch {
      return 0;
    }
  }

  function normalizeCount(count) {
    if (Array.isArray(count)) {
      return count.length;
    }

    const value = Number(count);
    return Number.isFinite(value) ? value : readCartCount();
  }

  function renderGlobalCartCount(count) {
    const value = String(normalizeCount(count));

    document.querySelectorAll('[data-cart-count]').forEach((item) => {
      item.textContent = value;
    });
  }

  window.renderGlobalCartCount = renderGlobalCartCount;
  clearOldCoachingItems();
  renderGlobalCartCount();

  window.addEventListener('storage', (event) => {
    if (event.key === cartKey) {
      renderGlobalCartCount();
    }
  });
}());
