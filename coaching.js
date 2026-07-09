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
const coachPagination = document.querySelector('.coach-pagination');
const viewToggleButtons = document.querySelectorAll('.coach-view-toggle button');
const paginationButtons = document.querySelectorAll('.coach-pagination button');
const cartKey = 'wavehub.cart';

let activeGame = 'all';
let activePage = '1';
let activeView = 'grid';

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isProfileCoachListing(item) {
  return item?.productType === 'Coaching'
    && (item.isCoachListing || (item.buyerUsername && item.detailUrl === 'coaching.html'));
}

function getCoachListingsFromSessions() {
  const items = readJson(cartKey, []);
  const sessions = Array.isArray(items) ? items.filter(isProfileCoachListing) : [];

  return sessions.map((session) => ({
    id: session.id || session.listingId,
    sourceListingId: session.listingId || '',
    sourceSessionId: session.id || '',
    title: session.title || '',
    name: session.seller || 'Wave Coach',
    game: session.game || 'Coaching',
    games: [session.game || 'Coaching'],
    service: 'Coaching',
    rank: 'Coach',
    tier: 'diamond',
    rating: 5,
    reviews: 0,
    price: Number(session.price) || 0,
    priceText: session.priceText || `${Number(session.price) || 0} GEL/hour`,
    availability: 'today',
    language: 'GE',
    tags: [session.sessionLabel || 'Custom Session'],
    image: session.imageData || '',
    bio: session.sessionLabel || 'Custom coaching session',
    specialty: `${session.game || 'Game'} coaching`,
    sessionDate: session.sessionDate || '',
    sessionTime: session.sessionTime || '',
    sessionLabel: session.sessionLabel || '',
    addedAt: session.addedAt || '',
    updatedAt: session.updatedAt || '',
    availableTimes: session.sessionDate && session.sessionTime
      ? [{ date: session.sessionDate, label: session.sessionLabel, times: [session.sessionTime] }]
      : [],
  }));
}

const coaches = [
  ...(Array.isArray(window.wavehubCoaches) ? window.wavehubCoaches : []),
  ...getCoachListingsFromSessions(),
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

function getCoachInitials(coach) {
  return String(coach.name || coach.game || 'WH')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getCoachBookingUrl(coach) {
  return `coach-book-session.html?coach=${encodeURIComponent(coach.id || coach.name || coach.game)}`;
}

function getCoachSearchText(coach) {
  return [
    coach.title,
    coach.name,
    coach.game,
    coach.service,
    coach.rank,
    coach.sessionLabel,
    coach.sessionDate,
    coach.sessionTime,
    ...(Array.isArray(coach.tags) ? coach.tags : []),
  ].join(' ').toLowerCase();
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
    const haystack = getCoachSearchText(coach);
    const matchesSearch = !query || haystack.includes(query);
    const matchesTab = activeGame === 'all' || activeGame === 'more' || coach.game === activeGame;
    const matchesGame = selectedGames.length === 0 || selectedGames.includes(coach.game);
    const matchesService = selectedServices.length === 0 || selectedServices.includes(coach.service);
    const matchesPrice = maxPrice >= 100 || coach.price <= maxPrice;
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

function createSessionMeta(coach) {
  if (!coach.sessionLabel) {
    return '';
  }

  return `<p class="coach-session-meta">${coach.sessionLabel}</p>`;
}

function createCoachCard(coach) {
  const card = document.createElement('article');
  card.className = 'coach-card';
  card.dataset.game = coach.game;
  card.dataset.coachId = coach.id || '';
  card.innerHTML = `
    <div class="coach-card-main">
      <div class="coach-avatar-ring">
        <span>${getCoachInitials(coach)}</span>
        <i></i>
      </div>
      <div class="coach-card-copy">
        <h2>${coach.name || 'Wave Coach'}</h2>
        <p class="coach-rank-line">
          <span class="coach-rank-dot ${coach.tier}" aria-hidden="true"></span>
          <span>${coach.rank}</span>
        </p>
        <p class="coach-rating-line"><span aria-hidden="true">&#9733;</span> ${coach.rating.toFixed(1)} (${coach.reviews})</p>
        ${createSessionMeta(coach)}
      </div>
    </div>

    <div class="coach-game-row">
      <span class="coach-game-icon">${getGameShortName(coach.game)}</span>
      <strong>${coach.game}</strong>
      <span class="coach-service-pill">${coach.service}</span>
    </div>

    <div class="coach-price-row">
      <p><strong>${coach.priceText || `${coach.price} GEL/hour`}</strong></p>
      <a href="${getCoachBookingUrl(coach)}" aria-label="Book a session with ${coach.name || 'this coach'}">Book Session</a>
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
    const count = visibleCoaches.length;
    coachResultCount.textContent = `${count} ${count === 1 ? 'Coach' : 'Coaches'} found`;
  }

  if (coachPagination) {
    coachPagination.hidden = visibleCoaches.length === 0;
  }
}

function updatePriceLabel() {
  if (!priceRange || !priceRangeLabel) {
    return;
  }

  priceRangeLabel.textContent = Number(priceRange.value) >= 100 ? '100 GEL+' : `${priceRange.value} GEL`;
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

function applySearchParam() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('search');

  if (query && coachSearch) {
    coachSearch.value = query;
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
applySearchParam();
updatePriceLabel();
renderCoaches();
