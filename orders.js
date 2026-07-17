(function () {
  const purchasesKey = 'wavehub.purchases';
  const sessionKey = 'wavehub.session';
  const localUsersKey = 'wavehub.users';
  const list = document.getElementById('ordersList');
  const empty = document.getElementById('ordersEmpty');
  const dashboard = document.getElementById('ordersDashboard');
  const loginPanel = document.getElementById('ordersLogin');
  const search = document.getElementById('ordersSearch');
  const menuToggle = document.getElementById('menuToggle');
  const scrim = document.getElementById('scrim');
  let activeTab = 'purchased';

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function getUser() {
    const sessionUser = readJson(sessionKey, null)?.user;
    const users = readJson(localUsersKey, []);
    const stored = (Array.isArray(users) ? users : []).find((user) => user.username === sessionUser?.username);
    return sessionUser ? { ...sessionUser, ...stored } : null;
  }

  function money(value) {
    const amount = Number(value) || 0;
    return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} GEL`;
  }

  function date(value) {
    const parsed = new Date(value || 0);
    return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getRows(user) {
    const purchases = readJson(purchasesKey, []);
    const purchased = [];
    const sold = [];
    (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
      (Array.isArray(purchase.items) ? purchase.items : []).forEach((item, index) => {
        const sellerUsername = item.sellerUsername || (item.productType === 'Coaching' ? item.buyerUsername : '');
        const row = { ...item, sellerUsername, orderId: purchase.id, status: purchase.status || 'Checkout request', purchasedAt: purchase.purchasedAt || purchase.createdAt, buyerUsername: purchase.buyerUsername, rowId: `${purchase.id}:${item.id || index}` };
        if (purchase.buyerUsername === user.username) purchased.push(row);
        if (sellerUsername === user.username) sold.push(row);
      });
    });
    const newest = (a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0);
    return { purchased: purchased.sort(newest), sold: sold.sort(newest) };
  }

  function card(item) {
    const counterparty = activeTab === 'sold' ? `Buyer: @${item.buyerUsername || 'unknown'}` : `Seller: ${item.seller || item.sellerUsername || 'WaveHub seller'}`;
    const details = [item.game, item.productType || item.listingType, item.sessionLabel].filter(Boolean).join(' · ');
    const image = item.imageData ? `style="background-image:linear-gradient(180deg,rgba(5,8,19,.06),rgba(5,8,19,.5)),url('${escapeHtml(item.imageData)}')"` : '';
    return `<article class="order-card">
      <a class="order-thumb" href="${escapeHtml(item.detailUrl || '#')}" ${image}>${item.imageData ? '' : escapeHtml(String(item.game || 'WH').slice(0, 2).toUpperCase())}</a>
      <div class="order-copy"><div><span class="order-status">${escapeHtml(item.status)}</span><small>${escapeHtml(date(item.purchasedAt))}</small></div><h2>${escapeHtml(item.title || 'WaveHub order')}</h2><p>${escapeHtml(details || 'Marketplace item')}</p><span>${escapeHtml(counterparty)}</span><code>Order #${escapeHtml(String(item.orderId || '').slice(0, 8))}</code></div>
      <div class="order-side"><strong>${escapeHtml(item.priceText || money(item.price))}</strong>${item.sessionDate ? `<small>${escapeHtml(item.sessionDate)} ${escapeHtml(item.sessionTime || '')}</small>` : ''}<a href="${escapeHtml(item.detailUrl || '#')}">View details</a></div>
    </article>`;
  }

  function render() {
    const user = getUser();
    loginPanel.hidden = Boolean(user);
    dashboard.hidden = !user;
    if (!user) return;
    const rows = getRows(user);
    const query = search?.value.trim().toLowerCase() || '';
    const shown = rows[activeTab].filter((item) => !query || [item.title, item.game, item.seller, item.sellerUsername, item.buyerUsername, item.status, item.orderId].join(' ').toLowerCase().includes(query));
    document.getElementById('purchasedCount').textContent = String(rows.purchased.length);
    document.getElementById('soldCount').textContent = String(rows.sold.length);
    document.getElementById('purchasedTotal').textContent = money(rows.purchased.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    document.getElementById('soldTotal').textContent = money(rows.sold.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    document.getElementById('ordersTotalCount').textContent = String(rows.purchased.length + rows.sold.length);
    list.innerHTML = shown.map(card).join('');
    empty.hidden = shown.length > 0;
  }

  document.querySelectorAll('[data-orders-tab]').forEach((button) => button.addEventListener('click', () => {
    activeTab = button.dataset.ordersTab;
    document.querySelectorAll('[data-orders-tab]').forEach((tab) => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    render();
  }));
  search?.addEventListener('input', render);
  function setSidebar(open) { document.body.classList.toggle('sidebar-open', open); menuToggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  menuToggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  scrim?.addEventListener('click', () => setSidebar(false));
  window.addEventListener('storage', (event) => { if ([purchasesKey, sessionKey, localUsersKey].includes(event.key)) render(); });
  render();
}());
