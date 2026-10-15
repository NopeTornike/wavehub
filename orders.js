(function () {
  const purchasesKey = 'wavehub.purchases';
  const sessionKey = 'wavehub.session';
  const localUsersKey = 'wavehub.users';
  const sellerListingsKey = 'wavehub.sellerListings';
  const cartKey = 'wavehub.cart';
  const favoritesKey = 'wavehub.favorites';
  const listingGames = [
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
  const list = document.getElementById('ordersList');
  const empty = document.getElementById('ordersEmpty');
  const dashboard = document.getElementById('ordersDashboard');
  const loginPanel = document.getElementById('ordersLogin');
  const search = document.getElementById('ordersSearch');
  const menuToggle = document.getElementById('menuToggle');
  const scrim = document.getElementById('scrim');
  const listingsGrid = document.getElementById('ordersListings');
  const listingsEmpty = document.getElementById('ordersListingsEmpty');
  const listingModal = document.getElementById('ordersListingModal');
  const listingForm = document.getElementById('ordersListingForm');
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

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getListings() {
    const listings = readJson(sellerListingsKey, []);
    return Array.isArray(listings) ? listings : [];
  }

  function setListingStatus(type, message) {
    const status = document.getElementById('ordersListingStatus');
    if (!status) return;
    status.className = type ? `seller-status ${type}` : 'seller-status';
    status.textContent = message;
  }

  function setListingModal(open) {
    if (!listingModal) return;
    listingModal.hidden = !open;
    document.body.classList.toggle('modal-open', open);
    if (!open) {
      listingForm?.reset();
      setListingStatus('', '');
    }
  }

  function syncAccountFields() {
    const isAccount = document.getElementById('ordersListingType')?.value === 'account';
    document.querySelectorAll('.orders-listing-account-field').forEach((field) => { field.hidden = !isAccount; });
    const level = document.getElementById('ordersListingAccountLevel');
    if (level) level.required = isAccount;
  }

  function populateGames(selected) {
    const select = document.getElementById('ordersListingGame');
    if (!select) return;
    const games = listingGames.includes(selected) || !selected ? listingGames : [selected, ...listingGames];
    select.innerHTML = games.map((game) => `<option value="${escapeHtml(game)}"${game === selected ? ' selected' : ''}>${escapeHtml(game)}</option>`).join('');
  }

  function openListingEditor(id) {
    const user = getUser();
    const listing = getListings().find((item) => item.id === id && item.sellerUsername === user?.username);
    if (!listing) return;
    document.getElementById('ordersListingId').value = listing.id;
    document.getElementById('ordersListingType').value = listing.listingType === 'skin' ? 'skin' : 'account';
    populateGames(listing.game || '');
    document.getElementById('ordersListingTitle').value = listing.title || '';
    document.getElementById('ordersListingAccountStatus').value = listing.accountStatus || 'basic';
    document.getElementById('ordersListingAccountLevel').value = listing.accountLevel || '';
    document.getElementById('ordersListingPrice').value = listing.price || '';
    document.getElementById('ordersListingDescription').value = listing.description || '';
    syncAccountFields();
    setListingModal(true);
  }

  function listingCard(item) {
    const image = item.imageData ? `style="background-image:linear-gradient(180deg,rgba(5,8,19,.08),rgba(5,8,19,.45)),url('${escapeHtml(item.imageData)}')"` : '';
    return `<article class="profile-record-card">
      <a class="profile-record-thumb" href="detail.html?type=product&id=${encodeURIComponent(item.id)}" ${image}>${item.imageData ? '' : escapeHtml(String(item.game || 'WH').slice(0, 2).toUpperCase())}</a>
      <div class="profile-record-copy"><strong>${escapeHtml(item.title || 'Untitled')}</strong><span>${escapeHtml(item.game || 'WaveHub')} · ${escapeHtml(item.listingType || 'account')}</span><small>${escapeHtml(money(item.price))}${item.accountLevel ? ` · Lv. ${escapeHtml(item.accountLevel)}` : ''}</small>
        <div class="profile-record-actions"><button class="profile-record-action" type="button" data-edit-listing="${escapeHtml(item.id)}">Edit</button><button class="profile-record-action danger" type="button" data-delete-listing="${escapeHtml(item.id)}">Delete</button><a class="profile-record-action" href="detail.html?type=product&id=${encodeURIComponent(item.id)}">View</a></div>
      </div></article>`;
  }

  function renderListings(user) {
    if (!listingsGrid || !listingsEmpty) return;
    const query = search?.value.trim().toLowerCase() || '';
    const listings = getListings().filter((item) => item.sellerUsername === user.username).filter((item) => !query || [item.title, item.game, item.description].join(' ').toLowerCase().includes(query));
    listingsGrid.innerHTML = listings.map(listingCard).join('');
    listingsEmpty.hidden = listings.length > 0;
  }

  function removeListingReferences(id) {
    const favoriteId = `listing:${id}`;
    const cart = readJson(cartKey, []);
    if (Array.isArray(cart)) writeJson(cartKey, cart.filter((item) => item.listingId !== id && item.id !== favoriteId));
    const favorites = readJson(favoritesKey, {});
    if (favorites && typeof favorites === 'object' && !Array.isArray(favorites)) {
      Object.keys(favorites).forEach((username) => {
        if (Array.isArray(favorites[username])) favorites[username] = favorites[username].filter((item) => (typeof item === 'string' ? item : item?.id) !== favoriteId);
      });
      writeJson(favoritesKey, favorites);
    }
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', reject);
      reader.readAsDataURL(file);
    });
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
    renderListings(user);
  }

  document.querySelectorAll('[data-orders-tab]').forEach((button) => button.addEventListener('click', () => {
    activeTab = button.dataset.ordersTab;
    document.querySelectorAll('[data-orders-tab]').forEach((tab) => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    render();
  }));
  search?.addEventListener('input', render);
  listingsGrid?.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-edit-listing]');
    const remove = event.target.closest?.('[data-delete-listing]');
    if (edit) return openListingEditor(edit.dataset.editListing || '');
    if (!remove) return;
    const id = remove.dataset.deleteListing || '';
    const user = getUser();
    const listing = getListings().find((item) => item.id === id && item.sellerUsername === user?.username);
    if (!listing || !window.confirm(`Delete "${listing.title || 'this listing'}"?`)) return;
    writeJson(sellerListingsKey, getListings().filter((item) => item.id !== id));
    removeListingReferences(id);
    render();
  });
  document.getElementById('ordersListingType')?.addEventListener('change', syncAccountFields);
  document.getElementById('ordersListingClose')?.addEventListener('click', () => setListingModal(false));
  document.getElementById('ordersListingCancel')?.addEventListener('click', () => setListingModal(false));
  listingModal?.addEventListener('click', (event) => { if (event.target === listingModal) setListingModal(false); });
  listingForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = getUser();
    const id = document.getElementById('ordersListingId').value;
    const listings = getListings();
    const current = listings.find((item) => item.id === id && item.sellerUsername === user?.username);
    if (!current) return setListingStatus('error', 'Listing was not found.');
    const listingType = document.getElementById('ordersListingType').value === 'skin' ? 'skin' : 'account';
    const title = document.getElementById('ordersListingTitle').value.trim();
    const game = document.getElementById('ordersListingGame').value;
    const price = Number(document.getElementById('ordersListingPrice').value);
    const description = document.getElementById('ordersListingDescription').value.trim();
    const level = Number(document.getElementById('ordersListingAccountLevel').value);
    if (!title || !game || !description || !Number.isFinite(price) || price <= 0) return setListingStatus('error', 'Fill all required fields.');
    if (listingType === 'account' && (!Number.isInteger(level) || level < 1 || level > 9999)) return setListingStatus('error', 'Enter a valid account level.');
    let galleryImages = Array.isArray(current.galleryImages) ? current.galleryImages : [];
    const files = Array.from(document.getElementById('ordersListingImages').files || []).filter((file) => file.type.startsWith('image/')).slice(0, 6);
    if (files.length) {
      try { galleryImages = await Promise.all(files.map(readImage)); } catch { return setListingStatus('error', 'Could not read product images.'); }
    }
    const updated = { ...current, listingType, title, game, price, description, accountStatus: listingType === 'account' ? document.getElementById('ordersListingAccountStatus').value : '', accountLevel: listingType === 'account' ? level : '', galleryImages, imageData: galleryImages[0] || current.imageData || '', updatedAt: new Date().toISOString() };
    writeJson(sellerListingsKey, listings.map((item) => item.id === id ? updated : item));
    const cart = readJson(cartKey, []);
    if (Array.isArray(cart)) writeJson(cartKey, cart.map((item) => item.listingId === id ? { ...item, title, game, price, priceText: money(price), imageData: updated.imageData } : item));
    setListingModal(false);
    render();
  });
  function setSidebar(open) { document.body.classList.toggle('sidebar-open', open); menuToggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  menuToggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  scrim?.addEventListener('click', () => setSidebar(false));
  window.addEventListener('storage', (event) => { if ([purchasesKey, sessionKey, localUsersKey, sellerListingsKey].includes(event.key)) render(); });
  render();
}());
