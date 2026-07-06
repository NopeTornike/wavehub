(function () {
  const cartKey = 'wavehub.cart';

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
  renderGlobalCartCount();

  window.addEventListener('storage', (event) => {
    if (event.key === cartKey) {
      renderGlobalCartCount();
    }
  });
}());
