(function () {
  const tournamentsKey = 'wavehub.tournaments';
  const sessionKey = 'wavehub.session';
  const localUsersKey = 'wavehub.users';
  const games = ['Call of Duty', 'Mobile Legends', 'CS2', 'PUBG Mobile', 'Roblox', 'Clash of Clans', 'League of Legends', 'Fortnite', 'Minecraft', 'GTA 5', 'Dota 2', 'Valorant'];
  const grid = document.getElementById('tournamentsGrid');
  const empty = document.getElementById('tournamentsEmpty');
  const count = document.getElementById('tournamentCount');
  const form = document.getElementById('tournamentForm');
  const panel = document.getElementById('tournamentAdminPanel');
  const toggle = document.getElementById('tournamentAdminToggle');
  const status = document.getElementById('tournamentFormStatus');
  const coverInput = document.getElementById('tournamentCover');
  const ratioText = document.getElementById('tournamentImageRatio');
  const menuToggle = document.getElementById('menuToggle');
  const scrim = document.getElementById('scrim');
  let selectedCover = null;

  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

  function getUser() {
    const sessionUser = readJson(sessionKey, null)?.user;
    const users = readJson(localUsersKey, []);
    const stored = (Array.isArray(users) ? users : []).find((user) => user.username === sessionUser?.username);
    return sessionUser ? { ...sessionUser, ...stored } : null;
  }

  function isAdmin(user) {
    return Boolean(user && (user.isAdmin === true || String(user.role || user.accountType || '').toLowerCase() === 'admin' || String(user.username || '').toLowerCase() === 'admin'));
  }

  function getTournaments() {
    const items = readJson(tournamentsKey, []);
    return Array.isArray(items) ? items : [];
  }

  function setStatus(type, message) {
    status.className = type ? `seller-status tournament-form-status ${type}` : 'seller-status tournament-form-status';
    status.textContent = message;
  }

  function card(item, admin) {
    const cover = item.coverData ? `style="background-image:linear-gradient(180deg,rgba(3,6,14,.03),rgba(3,6,14,.78)),url('${escapeHtml(item.coverData)}')"` : '';
    return `<article class="tournament-card">
      <div class="tournament-card-cover" ${cover}><span class="tournament-game">${escapeHtml(item.game)}</span><strong class="tournament-prize">${escapeHtml(item.prize)}</strong></div>
      <div class="tournament-card-copy"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div><span>Prize</span><strong>${escapeHtml(item.prize)}</strong></div>${admin ? `<button type="button" data-delete-tournament="${escapeHtml(item.id)}">Delete Tournament</button>` : ''}</div>
    </article>`;
  }

  function render() {
    const admin = isAdmin(getUser());
    const items = getTournaments().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    toggle.hidden = !admin;
    if (!admin) panel.hidden = true;
    grid.innerHTML = items.map((item) => card(item, admin)).join('');
    empty.hidden = items.length > 0;
    count.textContent = `${items.length} tournament${items.length === 1 ? '' : 's'}`;
  }

  const gameSelect = document.getElementById('tournamentGame');
  games.forEach((game) => { const option = document.createElement('option'); option.value = game; option.textContent = game; gameSelect.appendChild(option); });

  toggle?.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) document.getElementById('tournamentGame')?.focus(); });
  document.getElementById('tournamentFormCancel')?.addEventListener('click', () => { panel.hidden = true; form.reset(); selectedCover = null; ratioText.textContent = 'No image selected'; setStatus('', ''); });

  coverInput?.addEventListener('change', () => {
    selectedCover = coverInput.files?.[0] || null;
    if (!selectedCover) { ratioText.textContent = 'No image selected'; return; }
    const image = new Image();
    const url = URL.createObjectURL(selectedCover);
    image.onload = () => {
      const ratio = image.width / image.height;
      const isRecommended = Math.abs(ratio - (16 / 9)) <= 0.12;
      ratioText.textContent = `${image.width} × ${image.height}px · ${ratio.toFixed(2)}:1${isRecommended ? ' · Perfect 16:9 fit' : ' · Recommended: 16:9'}`;
      ratioText.classList.toggle('warning', !isRecommended);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = getUser();
    if (!isAdmin(user)) { setStatus('error', 'Only an administrator can publish tournaments.'); return; }
    if (!selectedCover) { setStatus('error', 'Please choose a tournament cover image.'); return; }
    if (selectedCover.size > 2.5 * 1024 * 1024) { setStatus('error', 'Cover image must be smaller than 2.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const item = { id: window.crypto?.randomUUID?.() || String(Date.now()), game: gameSelect.value, name: document.getElementById('tournamentName').value.trim(), description: document.getElementById('tournamentDescription').value.trim(), prize: document.getElementById('tournamentPrize').value.trim(), coverData: reader.result, createdAt: new Date().toISOString(), createdBy: user.username };
      writeJson(tournamentsKey, [...getTournaments(), item]);
      form.reset(); selectedCover = null; ratioText.textContent = 'No image selected'; setStatus('success', 'Tournament published successfully.'); render();
    };
    reader.onerror = () => setStatus('error', 'Could not read the selected image.');
    reader.readAsDataURL(selectedCover);
  });

  grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-tournament]');
    if (!button || !isAdmin(getUser())) return;
    writeJson(tournamentsKey, getTournaments().filter((item) => item.id !== button.dataset.deleteTournament));
    render();
  });

  function setSidebar(open) { document.body.classList.toggle('sidebar-open', open); menuToggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  menuToggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  scrim?.addEventListener('click', () => setSidebar(false));
  window.addEventListener('storage', (event) => { if ([tournamentsKey, sessionKey, localUsersKey].includes(event.key)) render(); });
  render();
}());
