(function () {
  const tournamentsKey = 'wavehub.tournaments';
  const demoSeedKey = 'wavehub.tournaments.demoSeeded.v2';
  const demoTournament = {
    id: 'wavehub-pubg-mobile-demo',
    game: 'PUBG Mobile',
    name: 'PUBG Mobile Cup #14',
    description: 'ღია PUBG Mobile ტურნირი ყველა დონის მოთამაშისთვის. შეიკრიბე გუნდთან ერთად, იბრძოლე ფინალისთვის და მოიგე საპრიზო ფონდი.',
    prize: '1,000 GEL',
    status: 'open',
    startDate: '2026-05-25',
    players: 42,
    maxPlayers: 64,
    coverData: '',
    createdAt: '2026-08-13T00:00:00.000Z',
    createdBy: 'WaveHub Official',
    registeredUsers: [],
    region: 'EU Server',
    format: 'Squad (4 Players)',
    teamName: 'WaveRiders',
    matches: [
      { stage: 'Semifinals', status: 'live', teamA: 'WaveRiders', teamB: 'Dark Legion', map: 'Erangel', format: 'Best of 3', date: '2026-05-26', time: '18:30', scoreA: 1, scoreB: 1, result: 'Live' },
      { stage: 'Quarterfinals', status: 'completed', teamA: 'WaveRiders', teamB: 'Nova Esports', map: 'Miramar', format: 'Best of 3', date: '2026-05-26', time: '16:00', scoreA: 2, scoreB: 0, result: 'Win' },
      { stage: 'Group Stage', status: 'completed', teamA: 'WaveRiders', teamB: 'Team Infinity', map: 'Sanhok', format: 'Best of 1', date: '2026-05-25', time: '21:00', scoreA: 1, scoreB: 0, result: 'Win' },
      { stage: 'Group Stage', status: 'completed', teamA: 'WaveRiders', teamB: 'Red Zone', map: 'Erangel', format: 'Best of 1', date: '2026-05-25', time: '17:30', scoreA: 1, scoreB: 0, result: 'Win' },
      { stage: 'Group Stage', status: 'completed', teamA: 'WaveRiders', teamB: 'Alpha Force', map: 'Miramar', format: 'Best of 1', date: '2026-05-25', time: '15:00', scoreA: 1, scoreB: 0, result: 'Win' }
    ]
  };
  const sessionKey = 'wavehub.session';
  const localUsersKey = 'wavehub.users';
  const games = ['Call of Duty', 'Free Fire', 'Mobile Legends', 'CS2', 'PUBG Mobile', 'Standoff 2', 'Roblox', 'Clash of Clans', 'League of Legends', 'Fortnite', 'Minecraft', 'GTA 5', 'Dota 2', 'Valorant'];
  const referenceTournaments = [
    ['tournament-free-fire-6', 'Free Fire', 'Free Fire Showdown #6', 'open', '2026-05-24', 'ME Server', 'Squad (4 Players)'],
    ['tournament-standoff-3', 'Standoff 2', 'Standoff 2 Masters #3', 'completed', '2026-05-10', 'EU Server', '5v5'],
    ['tournament-pubg-11', 'PUBG Mobile', 'PUBG Mobile Cup #11', 'completed', '2026-05-18', 'EU Server', 'Squad (4 Players)'],
    ['tournament-cod-8', 'Call of Duty', 'Call of Duty Cup #8', 'completed', '2026-04-28', 'NA Server', 'Squad (5 Players)'],
    ['tournament-mlbb-2', 'Mobile Legends', 'MLBB Championship #2', 'completed', '2026-04-20', 'SEA Server', '5v5'],
    ['tournament-free-fire-5', 'Free Fire', 'Free Fire Showdown #5', 'completed', '2026-05-05', 'ME Server', 'Squad (4 Players)'],
    ['tournament-pubg-10', 'PUBG Mobile', 'PUBG Mobile Cup #10', 'completed', '2026-05-12', 'EU Server', 'Squad (4 Players)']
  ].map(([id, game, name, status, startDate, region, format], index) => ({ id, game, name, status, startDate, region, format, description: `${game} tournament on WaveHubX.`, prize: '1,000 GEL', players: 64, maxPlayers: 64, coverData: '', createdAt: `2026-05-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`, createdBy: 'WaveHub Official', registeredUsers: [] }));
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
    return sessionUser ? { ...stored, ...sessionUser } : null;
  }

  function isAdmin(user) {
    return Boolean(user && String(user.role || '').toLowerCase() === 'admin');
  }

  async function getAuthoritativeAdmin() {
    const user = await window.wavehubRequireAuthenticatedUser?.();
    return isAdmin(user) ? user : null;
  }

  function getTournaments() {
    const items = readJson(tournamentsKey, []);
    return Array.isArray(items) ? items : [];
  }

  function seedDemoTournament() {
    if (localStorage.getItem(demoSeedKey)) return;
    const tournaments = getTournaments();
    const demoIndex = tournaments.findIndex((item) => item.id === demoTournament.id);
    if (demoIndex < 0) tournaments.unshift(demoTournament);
    else if (!Array.isArray(tournaments[demoIndex].matches) || tournaments[demoIndex].matches.length === 0) tournaments[demoIndex] = { ...demoTournament, ...tournaments[demoIndex], matches: demoTournament.matches, region: tournaments[demoIndex].region || demoTournament.region, format: tournaments[demoIndex].format || demoTournament.format, teamName: tournaments[demoIndex].teamName || demoTournament.teamName };
    writeJson(tournamentsKey, [...referenceTournaments.filter((item) => !tournaments.some((current) => current.id === item.id)), ...tournaments]);
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

  const coverByGame = { 'PUBG Mobile': 'assets/home-game-pubg-mobile.jpg', 'Free Fire': 'assets/freefire-photo.jpeg', 'Standoff 2': 'assets/home-game-standoff2.png', 'Call of Duty': 'assets/cod-photo.jpeg', 'Mobile Legends': 'assets/home-game-mobile-legends.png' };
  const tournamentIcons = { users: '<svg viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87"/></svg>', globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>', calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>', arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' };
  function displayStatus(item) { return String(item.status || '').toLowerCase() === 'completed' ? 'completed' : 'active'; }
  function referenceCard(item, admin) {
    const status = displayStatus(item);
    const image = item.coverData || coverByGame[item.game] || coverByGame['PUBG Mobile'];
    const date = item.startDate ? new Date(`${item.startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA';
    const format = item.format || 'Squad (4 Players)';
    const region = item.region || 'EU Server';
    return `<article class="tournament-card ${status}"><div class="tournament-card-cover" style="background-image:linear-gradient(90deg,rgba(3,6,14,.05),rgba(3,6,14,.52)),url('${escapeHtml(image)}')"></div><div class="tournament-card-copy"><span class="tournament-card-status ${status}"><i></i>${status === 'active' ? 'In Progress' : 'Completed'}</span><h3>${escapeHtml(item.name)}</h3><div class="tournament-card-facts"><span>${tournamentIcons.users}<strong>${escapeHtml(format)}</strong></span><span>${tournamentIcons.globe}<strong>${escapeHtml(region)}</strong></span><span>${tournamentIcons.calendar}<strong>${date}</strong></span></div>${status === 'active' ? `<a class="tournament-view-button" href="tournament-detail.html?id=${encodeURIComponent(item.id)}">View Tournament ${tournamentIcons.arrow}</a>` : `<a class="tournament-card-arrow" href="tournament-detail.html?id=${encodeURIComponent(item.id)}" aria-label="View tournament">${tournamentIcons.arrow}</a>`}${admin ? `<button class="tournament-delete-button" type="button" data-delete-tournament="${escapeHtml(item.id)}">Delete</button>` : ''}</div></article>`;
  }

  function render() {
    const admin = isAdmin(getUser());
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const selectedGame = gameFilter?.value || 'all';
    const selectedStatus = statusFilter?.value || 'all';
    const sort = sortFilter?.value || 'latest';
    const items = getTournaments().filter((item) => {
      const itemStatus = displayStatus(item);
      const matchesQuery = !query || `${item.name} ${item.game} ${item.description}`.toLowerCase().includes(query);
      return matchesQuery && (selectedGame === 'all' || item.game === selectedGame) && (selectedStatus === 'all' || itemStatus === selectedStatus);
    }).sort((a, b) => sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : sort === 'prize' ? (parseFloat(String(b.prize).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(a.prize).replace(/[^0-9.]/g, '')) || 0) : new Date(b.createdAt) - new Date(a.createdAt));
    toggle.hidden = !admin;
    if (!admin) panel.hidden = true;
    const activeItems = items.filter((item) => displayStatus(item) === 'active');
    const completedItems = items.filter((item) => displayStatus(item) === 'completed');
    grid.innerHTML = `${activeItems.length ? `<section class="tournament-group tournament-group-active"><header><h2><i></i>Active Tournaments <strong>${activeItems.length}</strong></h2></header><div class="tournament-card-grid">${activeItems.map((item) => referenceCard(item, admin)).join('')}</div></section>` : ''}${completedItems.length ? `<section class="tournament-group tournament-group-completed"><header><h2><i></i>Completed Tournaments <strong>${completedItems.length}</strong></h2></header><div class="tournament-card-grid">${completedItems.map((item) => referenceCard(item, admin)).join('')}</div></section>` : ''}`;
    empty.hidden = items.length > 0;
    count.textContent = `${items.length} tournament${items.length === 1 ? '' : 's'}`;
    document.getElementById('allTournamentTabCount').textContent = getTournaments().length;
    document.getElementById('activeTournamentTabCount').textContent = getTournaments().filter((item) => displayStatus(item) === 'active').length;
    document.getElementById('completedTournamentTabCount').textContent = getTournaments().filter((item) => displayStatus(item) === 'completed').length;
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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = await getAuthoritativeAdmin();
    if (!user) { setStatus('error', 'Only an authenticated administrator can publish tournaments.'); return; }
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

  grid?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-tournament]');
    if (!button || !(await getAuthoritativeAdmin())) return;
    writeJson(tournamentsKey, getTournaments().filter((item) => item.id !== button.dataset.deleteTournament));
    render();
  });

  function setSidebar(open) { document.body.classList.toggle('sidebar-open', open); menuToggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  menuToggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  scrim?.addEventListener('click', () => setSidebar(false));
  window.addEventListener('storage', (event) => { if ([tournamentsKey, sessionKey, localUsersKey].includes(event.key)) render(); });
  window.addEventListener('wavehub:auth-changed', render);
  seedDemoTournament();
  render();
}());
