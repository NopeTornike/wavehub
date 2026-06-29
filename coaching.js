const coachSearch = document.getElementById('coachSearch');
const coachFilters = document.getElementById('coachFilters');
const resetFilters = document.getElementById('resetFilters');
const priceRange = document.getElementById('priceRange');
const priceRangeLabel = document.getElementById('priceRangeLabel');
const rankFilter = document.getElementById('rankFilter');
const availabilityFilter = document.getElementById('availabilityFilter');
const languageFilter = document.getElementById('languageFilter');
const coachSort = document.getElementById('coachSort');
const coachGameTabs = document.getElementById('coachGameTabs');
const coachResultCount = document.getElementById('coachResultCount');
const coachGrid = document.getElementById('coachGrid');
const coachEmpty = document.getElementById('coachEmpty');
const viewToggleButtons = document.querySelectorAll('.coach-view-toggle button');
const paginationButtons = document.querySelectorAll('.coach-pagination button');

const mockCoachTotal = 127;
let activeGame = 'all';
let activePage = '1';
let activeView = 'grid';

const coaches = [
  {
    game: 'PUBG Mobile',
    service: 'Coaching',
    rank: 'Conqueror',
    tier: 'ace',
    rating: 4.9,
    reviews: 124,
    price: 15,
    tags: ['Experienced', 'Fast Responder'],
    language: 'EN',
    availability: 'now',
  },
  {
    game: 'PUBG Mobile',
    service: 'Rank Push',
    rank: 'Ace Dominator',
    tier: 'ace',
    rating: 4.8,
    reviews: 98,
    price: 12,
    tags: ['100+ Sessions', 'Fast Responder'],
    language: 'EN',
    availability: 'today',
  },
  {
    game: 'Valorant',
    service: 'Coaching',
    rank: 'Immortal 3',
    tier: 'immortal',
    rating: 4.8,
    reviews: 76,
    price: 18,
    tags: ['Pro Player', 'Fast Responder'],
    language: 'EN',
    availability: 'now',
  },
  {
    game: 'COD Mobile',
    service: 'Rank Push',
    rank: 'Legendary',
    tier: 'ace',
    rating: 4.7,
    reviews: 65,
    price: 10,
    tags: ['100+ Sessions', 'Fast Responder'],
    language: 'EN',
    availability: 'weekend',
  },
  {
    game: 'Fortnite',
    service: 'Coaching',
    rank: 'Diamond IV',
    tier: 'diamond',
    rating: 4.7,
    reviews: 54,
    price: 9,
    tags: ['Friendly', 'Fast Responder'],
    language: 'GE',
    availability: 'today',
  },
  {
    game: 'PUBG Mobile',
    service: 'Coaching',
    rank: 'Conqueror',
    tier: 'ace',
    rating: 4.6,
    reviews: 41,
    price: 14,
    tags: ['50+ Sessions', 'Fast Responder'],
    language: 'EN',
    availability: 'now',
  },
  {
    game: 'Apex Legends',
    service: 'Coaching',
    rank: 'Master',
    tier: 'master',
    rating: 4.6,
    reviews: 38,
    price: 11,
    tags: ['Pro Player', 'Fast Responder'],
    language: 'RU',
    availability: 'today',
  },
  {
    game: 'PUBG Mobile',
    service: 'Rank Push',
    rank: 'Ace',
    tier: 'ace',
    rating: 4.5,
    reviews: 32,
    price: 8,
    tags: ['Budget Friendly', 'Fast Responder'],
    language: 'EN',
    availability: 'weekend',
  },
  {
    game: 'Valorant',
    service: 'Coaching',
    rank: 'Immortal 2',
    tier: 'immortal',
    rating: 4.5,
    reviews: 28,
    price: 16,
    tags: ['Pro Player', '100+ Sessions'],
    language: 'EN',
    availability: 'now',
  },
  {
    game: 'COD Mobile',
    service: 'Coaching',
    rank: 'Grandmaster V',
    tier: 'master',
    rating: 4.4,
    reviews: 25,
    price: 9,
    tags: ['Friendly', 'Fast Responder'],
    language: 'GE',
    availability: 'today',
  },
  {
    game: 'Fortnite',
    service: 'Coaching',
    rank: 'Diamond I',
    tier: 'diamond',
    rating: 4.4,
    reviews: 22,
    price: 8,
    tags: ['Budget Friendly', 'Fast Responder'],
    language: 'EN',
    availability: 'weekend',
  },
  {
    game: 'LOL: Wild Rift',
    service: 'Coaching',
    rank: 'Challenger',
    tier: 'master',
    rating: 4.3,
    reviews: 19,
    price: 12,
    tags: ['Experienced', 'Fast Responder'],
    language: 'EN',
    availability: 'now',
  },
];

function getSelectedValues(name) {
  if (!coachFilters) {
    return [];
  }

  return Array.from(coachFilters.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function getGameShortName(game) {
  const labels = {
    'PUBG Mobile': 'PUBG',
    'COD Mobile': 'COD',
    Valorant: 'VAL',
    Fortnite: 'FN',
    'Apex Legends': 'APX',
    'LOL: Wild Rift': 'LOL',
  };

  return labels[game] || 'WH';
}

function isFiltered() {
  return Boolean(
    coachSearch?.value.trim()
      || activeGame !== 'all'
      || getSelectedValues('game').length
      || getSelectedValues('service').length
      || Number(priceRange?.value || 100) < 100
      || rankFilter?.value !== 'all'
      || availabilityFilter?.value !== 'all'
      || languageFilter?.value !== 'all',
  );
}

function matchesRank(coach) {
  const rank = rankFilter?.value || 'all';

  if (rank === 'all') {
    return true;
  }

  return coach.tier === rank || (rank === 'ace' && ['ace', 'immortal', 'master'].includes(coach.tier));
}

function getFilteredCoaches() {
  const query = coachSearch?.value.trim().toLowerCase() || '';
  const selectedGames = getSelectedValues('game');
  const selectedServices = getSelectedValues('service');
  const maxPrice = Number(priceRange?.value || 100);
  const availability = availabilityFilter?.value || 'all';
  const language = languageFilter?.value || 'all';

  const filtered = coaches.filter((coach) => {
    const haystack = [coach.game, coach.service, coach.rank, coach.tags.join(' ')].join(' ').toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesTab = activeGame === 'all' || activeGame === 'more' || coach.game === activeGame;
    const matchesGame = selectedGames.length === 0 || selectedGames.includes(coach.game);
    const matchesService = selectedServices.length === 0 || selectedServices.includes(coach.service);
    const matchesPrice = coach.price <= maxPrice;
    const matchesAvailability = availability === 'all' || coach.availability === availability;
    const matchesLanguage = language === 'all' || coach.language === language;

    return matchesSearch
      && matchesTab
      && matchesGame
      && matchesService
      && matchesPrice
      && matchesRank(coach)
      && matchesAvailability
      && matchesLanguage;
  });

  const sortMode = coachSort?.value || 'rating';

  if (sortMode === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortMode === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortMode === 'reviews') {
    filtered.sort((a, b) => b.reviews - a.reviews);
  } else {
    filtered.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  }

  return filtered;
}

function createTag(tag) {
  const className = tag === 'Budget Friendly'
    ? 'budget'
    : tag.includes('Sessions')
      ? 'sessions'
      : tag === 'Fast Responder'
        ? 'fast'
        : 'standard';

  return `<span class="${className}">${tag}</span>`;
}

function createCoachCard(coach) {
  const card = document.createElement('article');
  card.className = 'coach-card';
  card.dataset.game = coach.game;
  card.innerHTML = `
    <div class="coach-card-main">
      <div class="coach-avatar-ring">
        <span>?</span>
        <i></i>
      </div>
      <div class="coach-card-copy">
        <h2>Unknown</h2>
        <p class="coach-rank-line">
          <span class="coach-rank-dot ${coach.tier}" aria-hidden="true"></span>
          <span>${coach.rank}</span>
        </p>
        <p class="coach-rating-line"><span aria-hidden="true">&#9733;</span> ${coach.rating.toFixed(1)} (${coach.reviews})</p>
      </div>
    </div>

    <div class="coach-game-row">
      <span class="coach-game-icon">${getGameShortName(coach.game)}</span>
      <strong>${coach.game}</strong>
      <span class="coach-service-pill">${coach.service}</span>
    </div>

    <div class="coach-price-row">
      <p><strong>$${coach.price}</strong> <span>/hour</span></p>
      <button type="button">Book Session</button>
    </div>

    <div class="coach-card-tags">
      ${coach.tags.map(createTag).join('')}
      <span class="language">${coach.language}</span>
    </div>
  `;

  return card;
}

function renderCoaches() {
  if (!coachGrid) {
    return;
  }

  const visibleCoaches = getFilteredCoaches();
  coachGrid.innerHTML = '';
  coachGrid.classList.toggle('is-list', activeView === 'list');

  visibleCoaches.forEach((coach) => {
    coachGrid.appendChild(createCoachCard(coach));
  });

  if (coachEmpty) {
    coachEmpty.hidden = visibleCoaches.length > 0;
  }

  if (coachResultCount) {
    const count = isFiltered() ? visibleCoaches.length : mockCoachTotal;
    coachResultCount.textContent = `${count} Coaches found`;
  }
}

function updatePriceLabel() {
  if (!priceRange || !priceRangeLabel) {
    return;
  }

  priceRangeLabel.textContent = Number(priceRange.value) >= 100 ? '$100+' : `$${priceRange.value}`;
}

function syncTabButton(game) {
  coachGameTabs?.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.game === game);
  });
}

function applyServiceParam() {
  const params = new URLSearchParams(window.location.search);
  const service = params.get('service');
  const value = service === 'rank-push'
    ? 'Rank Push'
    : service === 'duo-play'
      ? 'Duo Play'
      : '';

  if (!value || !coachFilters) {
    return;
  }

  const checkbox = coachFilters.querySelector(`input[name="service"][value="${value}"]`);

  if (checkbox) {
    checkbox.checked = true;
  }
}

coachSearch?.addEventListener('input', renderCoaches);
coachFilters?.addEventListener('change', () => {
  updatePriceLabel();
  renderCoaches();
});
coachSort?.addEventListener('change', renderCoaches);
priceRange?.addEventListener('input', () => {
  updatePriceLabel();
  renderCoaches();
});

resetFilters?.addEventListener('click', () => {
  coachFilters?.reset();
  if (coachSearch) coachSearch.value = '';
  activeGame = 'all';
  syncTabButton(activeGame);
  updatePriceLabel();
  renderCoaches();
});

coachGameTabs?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;

  if (!button) {
    return;
  }

  activeGame = button.dataset.game || 'all';
  syncTabButton(activeGame);
  renderCoaches();
});

viewToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeView = button.dataset.view || 'grid';
    viewToggleButtons.forEach((item) => item.classList.toggle('active', item === button));
    renderCoaches();
  });
});

paginationButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const page = button.dataset.page || '1';

    if (page === 'prev' || page === 'next') {
      return;
    }

    activePage = page;
    paginationButtons.forEach((item) => item.classList.toggle('active', item.dataset.page === activePage));
  });
});

document.querySelectorAll('.coach-collapse').forEach((button) => {
  button.addEventListener('click', () => {
    const fieldset = button.closest('fieldset');
    fieldset?.classList.toggle('is-collapsed');
  });
});

applyServiceParam();
updatePriceLabel();
renderCoaches();
