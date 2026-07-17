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
const cartKey = 'wavehub.cart';
const coachesPerPage = 8;

let activeGame = 'all';
let activePage = 1;
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
    rank: session.rank || 'Coach',
    tier: 'diamond',
    rating: null,
    reviews: 0,
    price: Number(session.price) || 0,
    priceText: session.priceText || `${Number(session.price) || 0} GEL/hour`,
    availability: 'today',
    language: session.language || 'GE',
    languages: Array.isArray(session.languages) ? session.languages : [session.language || 'GE'],
    tags: [session.sessionLabel || 'Custom Session'],
    image: session.imageData || '',
    bio: session.bio || session.about || session.sessionLabel || 'Custom coaching session',
    about: session.about || session.bio || '',
    quote: session.quote || (session.about ? `Hi, I'm ${session.seller || 'your coach'}. ${session.about}` : ''),
    sessionDescription: session.sessionDescription || '',
    specialty: session.specialty || `${session.game || 'Game'} coaching`,
    yearsExperience: Number(session.yearsExperience) || 0,
    successRate: Number(session.successRate) || 0,
    responseTime: session.responseTime || '',
    responseTimeMinutes: Number(session.responseTimeMinutes) || 0,
    style: Array.isArray(session.style) ? session.style : [],
    expertise: Array.isArray(session.expertise) ? session.expertise : [],
    expertiseAreas: Array.isArray(session.expertiseAreas) ? session.expertiseAreas : [],
    achievements: Array.isArray(session.achievements) ? session.achievements : [],
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
    const coachPrice = Number(coach.price) || 0;
    const matchesPrice = maxPrice >= Number(priceRange?.max || 100) || coachPrice <= maxPrice;
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
  const details = [
    coach.sessionLabel || '',
    coach.responseTime ? `Avg. Response Time: ${coach.responseTime}` : '',
  ].filter(Boolean);

  if (!details.length) {
    return '';
  }

  return `<p class="coach-session-meta">${details.join(' · ')}</p>`;
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
        <p class="coach-rating-line">${coach.rating !== null && coach.rating !== '' && Number.isFinite(Number(coach.rating))
          ? `<span aria-hidden="true">&#9733;</span> ${Number(coach.rating).toFixed(1)} (${Number(coach.reviews) || 0})`
          : 'No reviews yet'}</p>
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

function createPaginationButton(page, label, ariaLabel = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.page = String(page);
  button.textContent = label;

  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }

  if (page === activePage) {
    button.classList.add('active');
    button.setAttribute('aria-current', 'page');
  }

  return button;
}

function renderPagination(totalItems) {
  if (!coachPagination) {
    return;
  }

  const totalPages = Math.ceil(totalItems / coachesPerPage);
  activePage = Math.max(1, Math.min(activePage, Math.max(1, totalPages)));
  coachPagination.innerHTML = '';
  coachPagination.hidden = totalPages <= 1;

  if (totalPages <= 1) {
    return;
  }

  const previous = createPaginationButton('prev', '<', 'Previous page');
  previous.disabled = activePage === 1;
  coachPagination.appendChild(previous);

  const visiblePages = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : Array.from(new Set([1, activePage - 1, activePage, activePage + 1, totalPages]))
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

  visiblePages.forEach((page, index) => {
    if (index > 0 && page - visiblePages[index - 1] > 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.setAttribute('aria-hidden', 'true');
      coachPagination.appendChild(ellipsis);
    }

    coachPagination.appendChild(createPaginationButton(page, String(page)));
  });

  const next = createPaginationButton('next', '>', 'Next page');
  next.disabled = activePage === totalPages;
  coachPagination.appendChild(next);
}

function renderCoaches() {
  if (!coachGrid) {
    return;
  }

  const filteredCoaches = getFilteredCoaches();
  const totalPages = Math.max(1, Math.ceil(filteredCoaches.length / coachesPerPage));
  activePage = Math.min(activePage, totalPages);
  const pageStart = (activePage - 1) * coachesPerPage;
  const visibleCoaches = filteredCoaches.slice(pageStart, pageStart + coachesPerPage);
  coachGrid.innerHTML = '';
  coachGrid.classList.toggle('is-list', activeView === 'list');

  visibleCoaches.forEach((coach) => {
    coachGrid.appendChild(createCoachCard(coach));
  });

  if (coachEmpty) {
    coachEmpty.hidden = filteredCoaches.length > 0;
  }

  if (coachResultCount) {
    const count = filteredCoaches.length;
    coachResultCount.textContent = `${count} ${count === 1 ? 'Coach' : 'Coaches'} found`;
  }

  renderPagination(filteredCoaches.length);
}

function updatePriceLabel() {
  if (!priceRange || !priceRangeLabel) {
    return;
  }

  const min = Number(priceRange.min) || 0;
  const max = Number(priceRange.max) || 100;
  const value = Math.max(min, Math.min(Number(priceRange.value) || max, max));
  const progress = max === min ? 100 : ((value - min) / (max - min)) * 100;
  const label = value >= max ? `${max} GEL+` : `Up to ${value} GEL`;

  priceRangeLabel.textContent = label;
  priceRange.style.setProperty('--price-progress', `${progress}%`);
  priceRange.setAttribute('aria-valuetext', label);
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

coachSearch?.addEventListener('input', () => {
  activePage = 1;
  renderCoaches();
});
coachFilters?.addEventListener('change', () => {
  activePage = 1;
  updatePriceLabel();
  renderCoaches();
});
coachSort?.addEventListener('change', () => {
  activePage = 1;
  renderCoaches();
});
priceRange?.addEventListener('input', () => {
  activePage = 1;
  updatePriceLabel();
  renderCoaches();
});

resetFilters?.addEventListener('click', () => {
  coachFilters?.reset();
  if (coachSearch) coachSearch.value = '';
  activeGame = 'all';
  activePage = 1;
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
  activePage = 1;
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

coachPagination?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;

  if (!button || button.disabled) {
    return;
  }

  const page = button.dataset.page || '1';
  const totalPages = Math.max(1, Math.ceil(getFilteredCoaches().length / coachesPerPage));

  if (page === 'prev') {
    activePage = Math.max(1, activePage - 1);
  } else if (page === 'next') {
    activePage = Math.min(totalPages, activePage + 1);
  } else {
    activePage = Math.max(1, Math.min(Number(page) || 1, totalPages));
  }

  renderCoaches();
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
