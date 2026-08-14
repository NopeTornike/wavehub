(function () {
  const games = [
    { id: 'steam-elden-ring', title: 'Elden Ring', price: 89, label: 'Featured', stock: 'In Stock', state: 'stock', cover: 'assets/dota-2-marketplace-cover.png' },
    { id: 'steam-gta-v', title: 'GTA V', price: 49, label: 'Popular', stock: 'Pre-order', state: 'preorder', cover: 'assets/gta-5-marketplace-cover.png' },
    { id: 'steam-rdr2', title: 'Red Dead Redemption 2', price: 69, label: 'Best Price', stock: 'Out of Stock', state: 'out', cover: 'assets/clash-of-clans-marketplace-cover.png' },
    { id: 'steam-cyberpunk', title: 'Cyberpunk 2077', price: 59, label: 'Hot', stock: 'Sold', state: 'sold', cover: 'assets/valorant-marketplace-cover.png' }
  ];
  const grid = document.getElementById('steamGrid');
  const menuToggle = document.getElementById('menuToggle');
  const scrim = document.getElementById('scrim');
  const favoritesKey = 'wavehub.steamFavorites';
  const readFavorites = () => { try { return JSON.parse(localStorage.getItem(favoritesKey) || '[]'); } catch { return []; } };
  const render = () => {
    const favorites = readFavorites();
    grid.innerHTML = games.map((game) => `<article class="steam-game-card">
      <div class="steam-game-cover" style="background-image:url('${game.cover}')"><span>${game.label}</span><button type="button" class="${favorites.includes(game.id) ? 'active' : ''}" data-steam-favorite="${game.id}" aria-label="Save ${game.title}">♡</button></div>
      <div class="steam-game-info"><h2>${game.title}</h2><p><i>◉</i> Steam Key</p><div class="steam-game-price"><strong>${game.price}<small> GEL</small></strong><span class="${game.state}">${game.stock}<i></i></span></div><div class="steam-game-actions"><a href="#" data-steam-view="${game.id}">View Game <span>→</span></a><button type="button" ${['out','sold'].includes(game.state) ? 'disabled' : ''} aria-label="Add ${game.title} to cart">🛒</button></div></div>
    </article>`).join('');
  };
  grid?.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-steam-favorite]');
    if (!favorite) return;
    const favorites = readFavorites();
    const id = favorite.dataset.steamFavorite;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]));
    render();
  });
  function setSidebar(open) { document.body.classList.toggle('sidebar-open', open); menuToggle?.setAttribute('aria-expanded', String(open)); if (scrim) scrim.hidden = !open; }
  menuToggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  scrim?.addEventListener('click', () => setSidebar(false));
  render();
}());
