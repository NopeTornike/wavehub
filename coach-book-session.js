(function () {
  const root = document.getElementById('coachBookingRoot');
  const profileSearch = document.getElementById('coachProfileSearch');
  const cartKey = 'wavehub.cart';
  const wishlistKey = 'wavehub.coachWishlist';
  const coaches = Array.isArray(window.wavehubCoaches) ? window.wavehubCoaches : [];
  const params = new URLSearchParams(window.location.search);
  const requestedCoach = params.get('coach') || params.get('id') || '';

  const languageLabels = {
    EN: 'English',
    GE: 'Georgian',
    RU: 'Russian',
  };

  const availabilityLabels = {
    now: 'Online',
    today: 'Today',
    weekend: 'Weekend',
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function hasNumber(value) {
    return value !== null
      && value !== undefined
      && value !== ''
      && !(typeof value === 'string' && value.trim() === '')
      && Number.isFinite(Number(value));
  }

  function toList(value) {
    return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== '') : [];
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US').format(Number(value) || 0);
  }

  function formatRating(value) {
    return hasNumber(value) ? Number(value).toFixed(1) : '';
  }

  function getCoachInitials(coach) {
    return String(coach.name || 'WH')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function getCoachUrl(coach) {
    return `coach-book-session.html?coach=${encodeURIComponent(coach.id || coach.name)}`;
  }

  function getCoachByRequest() {
    return coaches.find((coach) => coach.id === requestedCoach)
      || coaches.find((coach) => coach.name?.toLowerCase() === requestedCoach.toLowerCase())
      || coaches[0];
  }

  function getLanguage(coach) {
    return languageLabels[coach.language] || coach.language || '';
  }

  function getCoachGames(coach) {
    return toList(coach.games).length ? toList(coach.games) : toList([coach.game]);
  }

  function getCoachLanguages(coach) {
    return toList(coach.languages).length ? toList(coach.languages) : toList([getLanguage(coach)]);
  }

  function getReviewItems(coach) {
    return toList(coach.reviewItems || coach.reviewList || coach.reviewsList);
  }

  function renderStars() {
    return '<span aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>';
  }

  function getTagTone(tag) {
    if (/fast/i.test(tag)) return 'green';
    if (/top|pro/i.test(tag)) return 'pink';
    if (/session|coach|rank/i.test(tag)) return 'violet';
    if (/budget|ace|conqueror|master|legendary|diamond/i.test(tag)) return 'gold';
    return '';
  }

  function renderBadge(label, tone = '') {
    if (!hasText(label)) {
      return '';
    }

    return `<span class="coach-profile-badge ${tone}">${escapeHtml(label)}</span>`;
  }

  function renderMetric(icon, value, label) {
    if (!hasText(value) && !hasNumber(value)) {
      return '';
    }

    return `
      <div class="coach-profile-metric">
        <span aria-hidden="true">${escapeHtml(icon)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(label)}</small>
      </div>
    `;
  }

  function renderBadges(coach) {
    const tags = toList(coach.tags);
    const badges = [
      renderBadge(coach.rank, 'gold'),
      renderBadge(coach.service, 'violet'),
      ...tags.map((tag) => renderBadge(tag, getTagTone(tag))),
      renderBadge(getLanguage(coach)),
    ].filter(Boolean);

    return badges.length ? `<div class="coach-profile-badges">${badges.join('')}</div>` : '';
  }

  function renderScorePanels(coach) {
    const panels = [];

    if (hasNumber(coach.waveScore)) {
      const score = Math.max(0, Math.min(100, Number(coach.waveScore)));
      panels.push(`
        <article class="coach-score-card">
          <span>Wave Score</span>
          <strong>${score}<small>/100</small></strong>
          ${hasText(coach.waveScoreLabel) ? `<em>${escapeHtml(coach.waveScoreLabel)}</em>` : ''}
          <i><b style="width: ${score}%"></b></i>
        </article>
      `);
    }

    if (hasNumber(coach.rating)) {
      panels.push(`
        <article class="coach-score-card">
          <span>Rating</span>
          <strong>${formatRating(coach.rating)}</strong>
          <div class="coach-stars">${renderStars()}</div>
          ${hasNumber(coach.reviews) ? `<small>(${formatNumber(coach.reviews)} reviews)</small>` : ''}
        </article>
      `);
    }

    return panels.length ? `<div class="coach-score-panels ${panels.length === 1 ? 'single' : ''}">${panels.join('')}</div>` : '';
  }

  function renderMetrics(coach) {
    const metrics = [
      renderMetric('ST', hasNumber(coach.students) ? formatNumber(coach.students) : '', 'Students'),
      renderMetric('SE', hasNumber(coach.sessions) ? formatNumber(coach.sessions) : '', 'Sessions'),
      renderMetric('SR', hasNumber(coach.successRate) ? `${Number(coach.successRate)}%` : '', 'Success Rate'),
      renderMetric('RT', coach.responseTime, 'Avg. Response Time'),
    ].filter(Boolean);

    return metrics.length ? `<section class="coach-profile-metrics" aria-label="Coach statistics">${metrics.join('')}</section>` : '';
  }

  function renderExpertise(expertise) {
    const rows = toList(expertise)
      .map((item) => {
        const label = Array.isArray(item) ? item[0] : item.label;
        const value = Array.isArray(item) ? item[1] : item.value;

        if (!hasText(label) || !hasNumber(value)) {
          return '';
        }

        const width = Math.max(0, Math.min(100, Number(value)));
        return `
          <div class="coach-expertise-row">
            <span>${escapeHtml(label)}</span>
            <i><b style="width: ${width}%"></b></i>
            <strong>${width}%</strong>
          </div>
        `;
      })
      .filter(Boolean);

    return rows.length ? `<div class="coach-expertise-list">${rows.join('')}</div>` : '';
  }

  function renderInfoGrid(coach) {
    const cards = [];
    const styleItems = toList(coach.style);
    const games = getCoachGames(coach);
    const languages = getCoachLanguages(coach);
    const expertise = renderExpertise(coach.expertise);

    if (hasText(coach.about)) {
      cards.push(`
        <article class="coach-info-card">
          <h2>About ${escapeHtml(coach.name)}</h2>
          <p>${escapeHtml(coach.about)}</p>
        </article>
      `);
    }

    if (styleItems.length) {
      cards.push(`
        <article class="coach-info-card">
          <h2>Coaching Style</h2>
          <ul class="coach-check-list">
            ${styleItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `);
    }

    if (expertise) {
      cards.push(`
        <article class="coach-info-card">
          <h2>Expertise</h2>
          ${expertise}
        </article>
      `);
    }

    if (games.length) {
      cards.push(`
        <article class="coach-info-card coach-games-card">
          <h2>Games</h2>
          <div>
            ${games.map((game, index) => `<span><b>${escapeHtml(game.split(' ').map((part) => part[0]).join('').slice(0, 4))}</b>${escapeHtml(game)}${index === 0 ? '<small>Main Game</small>' : ''}</span>`).join('')}
          </div>
        </article>
      `);
    }

    if (languages.length) {
      cards.push(`
        <article class="coach-info-card coach-languages-card">
          <h2>Languages</h2>
          <div>
            ${languages.map((language) => `<span>${escapeHtml(language)}</span>`).join('')}
          </div>
        </article>
      `);
    }

    return cards.length ? `<div class="coach-info-grid">${cards.join('')}</div>` : '';
  }

  function renderVideoCard(coach) {
    if (!hasText(coach.introVideoUrl) && !hasText(coach.videoDuration) && !hasNumber(coach.watched) && !hasNumber(coach.helpful)) {
      return '';
    }

    const stats = [
      hasNumber(coach.watched) ? `<div><strong>${formatNumber(coach.watched)}</strong><small>People watched</small></div>` : '',
      hasNumber(coach.helpful) ? `<div><strong>${Number(coach.helpful)}%</strong><small>Found it helpful</small></div>` : '',
    ].filter(Boolean);

    return `
      <article class="coach-video-card">
        <div class="coach-video-preview" style="--coach-image: url('${escapeHtml(coach.image)}')">
          <button type="button" aria-label="Play intro video"></button>
          ${hasText(coach.videoDuration) ? `<span>${escapeHtml(coach.videoDuration)}</span>` : ''}
        </div>
        ${stats.length ? `<div class="coach-video-stats">${stats.join('')}</div>` : ''}
      </article>
    `;
  }

  function renderQuoteCard(coach) {
    if (!hasText(coach.quote)) {
      return '';
    }

    return `
      <article class="coach-quote-card">
        <h2>Meet Your Coach</h2>
        <blockquote>"${escapeHtml(coach.quote)}"</blockquote>
        <strong>- ${escapeHtml(coach.name)}</strong>
      </article>
    `;
  }

  function renderOverviewTop(coach) {
    const items = [renderVideoCard(coach), renderQuoteCard(coach)].filter(Boolean);
    return items.length ? `<div class="coach-overview-top">${items.join('')}</div>` : '';
  }

  function renderAchievements(coach) {
    const achievementItems = [
      renderMetric('HR', coach.rank, 'Highest Rank'),
      ...toList(coach.achievements).map((item) => renderMetric(item.icon || 'AC', item.value, item.label)),
    ].filter(Boolean);
    const badges = toList(coach.badges);

    if (!achievementItems.length && !badges.length) {
      return '';
    }

    return `
      <section class="coach-achievements" aria-labelledby="coachAchievementsTitle">
        <h2 id="coachAchievementsTitle">Achievements</h2>
        <div>
          ${achievementItems.join('')}
          ${badges.length ? `
            <article class="coach-badge-row">
              <span>WaveHub Badges</span>
              ${badges.map((badge) => `<strong>${escapeHtml(badge)}</strong>`).join('')}
            </article>
          ` : ''}
        </div>
      </section>
    `;
  }

  function renderTimeGroup(group) {
    const times = toList(group.times);

    if (!hasText(group.label) || !times.length) {
      return '';
    }

    return `
      <div class="coach-times-group">
        <span class="coach-time-day ${escapeHtml(group.tone || '')}">${escapeHtml(group.label)}</span>
        <div>
          ${times.map((time) => `<button type="button">${escapeHtml(time)}</button>`).join('')}
        </div>
      </div>
    `;
  }

  function renderAvailability(coach) {
    const groups = toList(coach.availableTimes || coach.availabilitySlots)
      .map(renderTimeGroup)
      .filter(Boolean);

    if (!groups.length) {
      return '';
    }

    return `
      <div class="coach-time-row">
        <div>
          <strong>Available Times</strong>
          ${hasText(coach.timezone) ? `<small>${escapeHtml(coach.timezone)}</small>` : ''}
        </div>
        ${hasText(coach.fullScheduleUrl) ? `<a href="${escapeHtml(coach.fullScheduleUrl)}">View full schedule</a>` : ''}
      </div>
      <div class="coach-time-groups">${groups.join('')}</div>
    `;
  }

  function renderReviews(coach) {
    return getReviewItems(coach)
      .map((review) => {
        const rating = hasNumber(review.rating) ? `&#9733; ${formatRating(review.rating)}` : '';
        const body = review.text || review.body || review.comment;

        if (!hasText(body)) {
          return '';
        }

        return `
          <article>
            ${rating ? `<strong>${rating}</strong>` : ''}
            <p>${escapeHtml(body)}</p>
            ${hasText(review.author) ? `<span>${escapeHtml(review.author)}</span>` : ''}
          </article>
        `;
      })
      .filter(Boolean)
      .join('');
  }

  function renderSimilar(coach) {
    return coaches
      .filter((item) => item.id !== coach.id)
      .sort((a, b) => (a.game === coach.game ? -1 : 1) - (b.game === coach.game ? -1 : 1))
      .slice(0, 4)
      .map((item) => `
        <a class="coach-similar-card" href="${getCoachUrl(item)}">
          <span class="coach-similar-avatar" style="--coach-image: url('${escapeHtml(item.image)}')">${escapeHtml(getCoachInitials(item))}</span>
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.rank)}</small>
            ${hasNumber(item.rating) ? `<em>&#9733; ${formatRating(item.rating)}${hasNumber(item.reviews) ? ` (${formatNumber(item.reviews)})` : ''}</em>` : ''}
          </span>
          <b>$${Number(item.price) || 0}<small>/hour</small></b>
        </a>
      `).join('');
  }

  function getCoachCartItem(coach) {
    return {
      id: `coach:${coach.id}:session`,
      listingId: coach.id,
      title: `${coach.name} Coaching Session`,
      productType: 'Coaching',
      game: coach.game,
      seller: coach.name,
      price: Number(coach.price) || 0,
      priceText: `$${Number(coach.price) || 0} /hour`,
      imageData: coach.image,
      detailUrl: getCoachUrl(coach),
      addedAt: new Date().toISOString(),
    };
  }

  function addCoachToCart(coach) {
    const item = getCoachCartItem(coach);
    const items = Array.isArray(readJson(cartKey, [])) ? readJson(cartKey, []) : [];
    const exists = items.some((cartItem) => cartItem.id === item.id);
    const nextItems = exists
      ? items.map((cartItem) => (cartItem.id === item.id ? { ...cartItem, ...item, addedAt: cartItem.addedAt } : cartItem))
      : [...items, item];

    writeJson(cartKey, nextItems);
    window.renderGlobalCartCount?.(nextItems.length);
    return !exists;
  }

  function setStatus(type, message) {
    const status = document.getElementById('coachBookingStatus');

    if (!status) {
      return;
    }

    status.className = `coach-booking-status ${type}`;
    status.textContent = message;
  }

  function toggleWishlist(coach) {
    const saved = Array.isArray(readJson(wishlistKey, [])) ? readJson(wishlistKey, []) : [];
    const exists = saved.includes(coach.id);
    const next = exists ? saved.filter((id) => id !== coach.id) : [...saved, coach.id];
    writeJson(wishlistKey, next);
    return !exists;
  }

  function renderCoachPage(coach) {
    if (!root || !coach) {
      return;
    }

    const initials = getCoachInitials(coach);
    const similarCards = renderSimilar(coach);
    const reviewItems = getReviewItems(coach);
    const availabilityText = availabilityLabels[coach.availability] || coach.availability || '';
    const overviewBlocks = [renderOverviewTop(coach), renderInfoGrid(coach), renderAchievements(coach)].filter(Boolean);

    document.title = `WaveHub - ${coach.name} Book Session`;

    root.innerHTML = `
      <a class="coach-profile-back" href="coaching.html"><span aria-hidden="true">&lt;</span> Back to Coaches</a>

      <section class="coach-profile-hero" aria-labelledby="coachProfileTitle">
        <div class="coach-profile-portrait-wrap">
          <div class="coach-profile-portrait" style="--coach-image: url('${escapeHtml(coach.image)}')">
            <span>${escapeHtml(initials)}</span>
          </div>
          ${hasText(availabilityText) ? `<span class="coach-online-pill"><i aria-hidden="true"></i>${escapeHtml(availabilityText)}</span>` : ''}
        </div>

        <div class="coach-profile-intro">
          <div class="coach-profile-title-row">
            <h1 id="coachProfileTitle">${escapeHtml(coach.name)}</h1>
            ${coach.verified ? '<span class="coach-verified-mark" aria-label="Verified coach"></span>' : ''}
          </div>
          ${renderBadges(coach)}
          ${hasText(coach.specialty) ? `<h2>${escapeHtml(coach.specialty)}</h2>` : ''}
          ${hasText(coach.bio) ? `<p>${escapeHtml(coach.bio)}</p>` : ''}
        </div>

        ${renderScorePanels(coach)}
      </section>

      ${renderMetrics(coach)}

      <div class="coach-profile-tabs" role="tablist" aria-label="Coach sections">
        <button class="active" type="button" data-profile-tab="overview" role="tab" aria-selected="true">Overview</button>
        <button type="button" data-profile-tab="reviews" role="tab" aria-selected="false">Reviews (${reviewItems.length})</button>
      </div>

      <section class="coach-profile-panel" data-profile-panel="overview">
        ${overviewBlocks.join('') || '<div class="coach-profile-empty"></div>'}
      </section>

      <section class="coach-profile-panel coach-reviews-panel ${reviewItems.length ? '' : 'is-empty'}" data-profile-panel="reviews" hidden>
        ${renderReviews(coach)}
      </section>

      <section class="coach-booking-panel" aria-label="Book coaching session">
        <div class="coach-booking-main">
          <div class="coach-starting-price">
            <span>Starting from</span>
            <strong>$${Number(coach.price) || 0}<small>/hour</small></strong>
          </div>
          <button class="coach-book-primary" type="button" data-action="book">Book Session</button>
          <a class="coach-book-secondary" href="messages.html">Message Coach</a>
          <button class="coach-book-secondary" type="button" data-action="wishlist">Add to Wishlist</button>
        </div>

        ${renderAvailability(coach)}

        <p class="coach-booking-status" id="coachBookingStatus" aria-live="polite"></p>

        <div class="coach-protection-row">
          <div><strong>100% Secure Checkout</strong><span>Your payment is protected</span></div>
          <div><strong>Escrow Protection</strong><span>Payment released after completion</span></div>
          <div><strong>24/7 Support</strong><span>We are here to help anytime</span></div>
        </div>
      </section>

      <section class="coach-similar-section" aria-labelledby="coachSimilarTitle">
        <div>
          <h2 id="coachSimilarTitle">Similar Coaches</h2>
          <a href="coaching.html">View all coaches</a>
        </div>
        <div class="coach-similar-grid">
          ${similarCards}
          <a class="coach-similar-next" href="coaching.html" aria-label="Browse more coaches">&gt;</a>
        </div>
      </section>
    `;
  }

  function setActiveTab(tabName) {
    root?.querySelectorAll('[data-profile-tab]').forEach((button) => {
      const isActive = button.dataset.profileTab === tabName;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    root?.querySelectorAll('[data-profile-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.profilePanel !== tabName;
    });
  }

  if (!root || coaches.length === 0) {
    if (root) {
      root.innerHTML = '<div class="coach-profile-empty"><a href="coaching.html">Back to Coaches</a></div>';
    }
    return;
  }

  const activeCoach = getCoachByRequest();
  renderCoachPage(activeCoach);

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest('[data-profile-tab]');
    const action = target?.closest('[data-action]');

    if (tab) {
      setActiveTab(tab.dataset.profileTab || 'overview');
      return;
    }

    if (!action) {
      return;
    }

    const actionName = action.dataset.action;

    if (actionName === 'book') {
      const added = addCoachToCart(activeCoach);
      setStatus('success', added ? 'Session added to cart.' : 'Session is already in your cart.');
    } else if (actionName === 'wishlist') {
      const saved = toggleWishlist(activeCoach);
      setStatus('success', saved ? 'Coach added to wishlist.' : 'Coach removed from wishlist.');
    }
  });

  profileSearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const query = profileSearch.value.trim();
    if (query) {
      window.location.href = `coaching.html?search=${encodeURIComponent(query)}`;
    }
  });
}());
