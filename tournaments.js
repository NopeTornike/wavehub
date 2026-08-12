(function () {
  const tournamentsKey = 'wavehub.tournaments';
  const demoSeedKey = 'wavehub.tournaments.demoSeeded.v1';
  const demoTournament = {
    id: 'wavehub-pubg-mobile-demo',
    game: 'PUBG Mobile',
    name: 'WaveHub PUBG Mobile Cup',
    description: 'ღია PUBG Mobile ტურნირი ყველა დონის მოთამაშისთვის. შეიკრიბე გუნდთან ერთად, იბრძოლე ფინალისთვის და მოიგე საპრიზო ფონდი.',
    prize: '1,000 GEL',
    status: 'open',
    startDate: '2026-09-12',
    players: 42,
    maxPlayers: 64,
    coverData: '',
    createdAt: '2026-08-13T00:00:00.000Z',
    createdBy: 'WaveHub Official',
    registeredUsers: []
  };
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
  const searchInput = document.getElementById('tournamentSearch');
  const gameFilter = document.getElementById('tournamentGameFilter');
  const statusFilter = document.getElementById('tournamentStatusFilter');
  const sortFilter = document.getElementById('tournamentSort');
  const statusTabs = document.getElementById('tournamentStatusTabs');
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

  function seedDemoTournament() {
    if (localStorage.getItem(demoSeedKey)) return;
    const tournaments = getTournaments();
    if (!tournaments.some((item) => item.id === demoTournament.id)) {
      writeJson(tournamentsKey, [demoTournament, ...tournaments]);
    }
    localStorage.setItem(demoSeedKey, 'true');
  }

  function setStatus(type, message) {
    status.className = type ? `seller-status tournament-form-status ${type}` : 'seller-status tournament-form-status';
    status.textContent = message;
  }

  function card(item, admin) {
    const cover = item.coverData ? `style="background-image:linear-gradient(180deg,rgba(3,6,14,.02),rgba(3,6,14,.84)),url('${escapeHtml(item.coverData)}')"` : '';
    const tournamentStatus = String(item.status || 'upcoming').toLowerCase();
    const statusLabel = tournamentStatus === 'open' ? 'Registration Open' : tournamentStatus === 'completed' ? 'Completed' : 'Upcoming';
    const maxPlayers = Number(item.maxPlayers) || 64;
    const players = Math.min(Number(item.players) || 0, maxPlayers);
    const progress = Math.round((players / maxPlayers) * 100);
    const startDate = item.startDate ? new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA';
    return `<article class="tournament-card">
      <div class="tournament-card-cover" ${cover}>
        <span class="tournament-game">${escapeHtml(item.game)}</span>
        <div class="tournament-card-title"><h3>${escapeHtml(item.name)}</h3><span class="tournament-card-status ${tournamentStatus}"><i></i>${statusLabel}</span></div>
      </div>
      <div class="tournament-card-copy">
        <p class="tournament-card-description">${escapeHtml(item.description)}</p>
        <div class="tournament-card-facts"><span><b aria-hidden="true">▣</b><strong>${startDate}</strong><small>Start Date</small></span><span><b aria-hidden="true">♛</b><strong>${escapeHtml(item.prize)}</strong><small>Prize Pool</small></span><span><b aria-hidden="true">♙</b><strong>${players} / ${maxPlayers}</strong><small>Players</small></span></div>
        <div class="tournament-progress"><span><small>Registration Progress</small><strong>${progress}% Filled</strong></span><i><b style="width:${progress}%"></b></i></div>
        <a class="tournament-view-button" href="tournament-detail.html?id=${encodeURIComponent(item.id)}">View Tournament <span aria-hidden="true">→</span></a>
        ${admin ? `<button class="tournament-delete-button" type="button" data-delete-tournament="${escapeHtml(item.id)}">Delete Tournament</button>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const admin = isAdmin(getUser());
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const selectedGame = gameFilter?.value || 'all';
    const selectedStatus = statusFilter?.value || 'all';
    const sort = sortFilter?.value || 'latest';
    const items = getTournaments().filter((item) => {
      const itemStatus = String(item.status || 'upcoming').toLowerCase();
      const matchesQuery = !query || `${item.name} ${item.game} ${item.description}`.toLowerCase().includes(query);
      return matchesQuery && (selectedGame === 'all' || item.game === selectedGame) && (selectedStatus === 'all' || itemStatus === selectedStatus);
    }).sort((a, b) => sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : sort === 'prize' ? (parseFloat(String(b.prize).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(a.prize).replace(/[^0-9.]/g, '')) || 0) : new Date(b.createdAt) - new Date(a.createdAt));
    toggle.hidden = !admin;
    if (!admin) panel.hidden = true;
    grid.innerHTML = items.map((item) => card(item, admin)).join('');
    empty.hidden = items.length > 0;
    count.textContent = `${items.length} tournament${items.length === 1 ? '' : 's'}`;
  }

  const gameSelect = document.getElementById('tournamentGame');
  games.forEach((game) => {
    const option = document.createElement('option'); option.value = game; option.textContent = game; gameSelect.appendChild(option);
    const filterOption = option.cloneNode(true); gameFilter?.appendChild(filterOption);
  });

  [searchInput, gameFilter, sortFilter].forEach((control) => control?.addEventListener(control === searchInput ? 'input' : 'change', render));
  statusFilter?.addEventListener('change', () => {
    statusTabs?.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tournamentStatus === statusFilter.value);
    });
    render();
  });
  statusTabs?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tournament-status]');
    if (!button) return;
    statusTabs.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    statusFilter.value = button.dataset.tournamentStatus;
    render();
  });

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
      const maxPlayers = Math.max(2, Number(document.getElementById('tournamentMaxPlayers').value) || 64);
      const players = Math.min(maxPlayers, Math.max(0, Number(document.getElementById('tournamentPlayers').value) || 0));
      const item = { id: window.crypto?.randomUUID?.() || String(Date.now()), game: gameSelect.value, name: document.getElementById('tournamentName').value.trim(), description: document.getElementById('tournamentDescription').value.trim(), prize: document.getElementById('tournamentPrize').value.trim(), status: document.getElementById('tournamentStatus').value, startDate: document.getElementById('tournamentStartDate').value, players, maxPlayers, coverData: reader.result, createdAt: new Date().toISOString(), createdBy: user.username };
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
  seedDemoTournament();
  render();
}());
