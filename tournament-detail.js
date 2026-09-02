(function () {
  const key = 'wavehub.tournaments';
  const sessionKey = 'wavehub.session';
  const id = new URLSearchParams(location.search).get('id');
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(name) || JSON.stringify(fallback)); } catch { return fallback; } };
  const write = (name, value) => localStorage.setItem(name, JSON.stringify(value));
  const items = read(key, []);
  let tournament = Array.isArray(items) ? items.find((item) => String(item.id) === String(id)) : null;
  const byId = (name) => document.getElementById(name);
  const notice = byId('tdNotice');
  const formatDate = (value, long) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', long ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA';
  const mobileGames = ['Call of Duty', 'Mobile Legends', 'PUBG Mobile', 'Clash of Clans'];

  function render() {
    if (!tournament) {
      document.title = 'Tournament not found - WaveHubX';
      byId('tournamentDetailPage').innerHTML = '<div class="td-not-found"><h1>Tournament not found</h1><p>This tournament may have been removed.</p><a href="tournaments.html">Back to tournaments</a></div>';
      return;
    }
    const max = Math.max(1, Number(tournament.maxPlayers) || 64);
    const players = Math.min(max, Number(tournament.players) || 0);
    const status = String(tournament.status || 'upcoming').toLowerCase();
    const statusText = status === 'open' ? 'OPEN' : status === 'completed' ? 'COMPLETED' : 'UPCOMING';
    document.title = `${tournament.name} - WaveHubX`;
    if (tournament.coverData) byId('tournamentDetailHero').style.backgroundImage = `linear-gradient(180deg,rgba(0,4,12,.04),rgba(0,4,12,.22)),url("${String(tournament.coverData).replaceAll('"', '%22')}")`;
    byId('tdName').textContent = tournament.name || 'WaveHubX Tournament';
    byId('tdStatus').textContent = statusText;
    byId('tdStatus').className = status === 'open' ? 'is-open' : status === 'completed' ? 'is-purple' : 'is-orange';
    byId('tdDate').textContent = formatDate(tournament.startDate);
    byId('tdDeadline').textContent = tournament.startDate ? `Until ${formatDate(tournament.startDate)}` : 'Until announced';
    byId('tdDeadlineLong').textContent = tournament.startDate ? `${formatDate(tournament.startDate, true)} – 17:00 (GMT+3)` : 'TBA';
    byId('tdPlayers').textContent = `${players} / ${max}`;
    byId('tdPrize').textContent = tournament.prize || 'TBA';
    byId('tdPrizeLarge').textContent = tournament.prize || 'TBA';
    byId('tdDescription').textContent = tournament.description || 'Tournament details will be announced soon.';
    byId('tdOrganizer').textContent = tournament.createdBy || 'WaveHub Official';
    byId('tdContact').href = `messages.html?to=${encodeURIComponent(tournament.createdBy || 'admin')}`;
    byId('tdPlatform').textContent = mobileGames.includes(tournament.game) ? 'MOBILE' : 'PC';
    const button = byId('tdRegister');
    const username = read(sessionKey, null)?.user?.username;
    const registered = Array.isArray(tournament.registeredUsers) && tournament.registeredUsers.includes(username);
    button.disabled = status !== 'open' || players >= max || registered;
    button.innerHTML = registered ? 'REGISTERED ✓' : players >= max ? 'TOURNAMENT FULL' : status === 'open' ? 'REGISTER NOW <span>›</span>' : statusText;
  }

  byId('tdRegister')?.addEventListener('click', () => {
    const user = read(sessionKey, null)?.user;
    if (!user?.username) { location.href = 'auth.html?mode=login'; return; }
    const all = read(key, []);
    const index = all.findIndex((item) => String(item.id) === String(id));
    if (index < 0) return;
    const registeredUsers = Array.isArray(all[index].registeredUsers) ? all[index].registeredUsers : [];
    if (registeredUsers.includes(user.username)) return;
    all[index].registeredUsers = [...registeredUsers, user.username];
    all[index].players = Math.min(Number(all[index].maxPlayers) || 64, (Number(all[index].players) || 0) + 1);
    write(key, all); tournament = all[index]; notice.textContent = 'Registration completed successfully.'; render();
  });

  document.querySelector('.tournament-detail-tabs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-td-tab]'); if (!button) return;
    document.querySelectorAll('[data-td-tab]').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('[data-td-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.tdPanel === button.dataset.tdTab));
  });
  const toggle = byId('menuToggle'); const scrim = byId('scrim');
  function sidebar(open) { document.body.classList.toggle('sidebar-open', open); toggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  toggle?.addEventListener('click', () => sidebar(!document.body.classList.contains('sidebar-open'))); scrim?.addEventListener('click', () => sidebar(false));
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return;
    const nextItems = read(key, []);
    tournament = Array.isArray(nextItems) ? nextItems.find((item) => String(item.id) === String(id)) : null;
    render();
  });
  render();
}());
