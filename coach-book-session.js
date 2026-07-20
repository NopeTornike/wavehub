(function () {
  const root = document.getElementById('coachBookingRoot');
  const profileSearch = document.getElementById('coachProfileSearch');
  const cartKey = 'wavehub.cart';
  const purchasesKey = 'wavehub.purchases';
  const sellerReviewsKey = 'wavehub.sellerReviews';
  const localUsersKey = 'wavehub.users';
  const wishlistKey = 'wavehub.coachWishlist';
  const params = new URLSearchParams(window.location.search);
  const requestedCoach = params.get('coach') || params.get('id') || '';
  const bookingState = {
    monthOffset: 0,
    selectedGame: '',
    selectedDate: '',
    selectedTime: '',
  };

  const languageLabels = {
    EN: 'English',
    GE: 'Georgian',
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

  function isProfileCoachListing(item) {
    return item?.productType === 'Coaching'
      && (item.isCoachListing || (item.buyerUsername && item.detailUrl === 'coaching.html'));
  }

  function getCoachListingsFromSessions() {
    const items = readJson(cartKey, []);
    const sessions = Array.isArray(items) ? items.filter(isProfileCoachListing) : [];

    return sessions.map((session) => {
      const owner = getLocalUser(session.buyerUsername);

      return ({
      id: session.id || session.listingId,
      sourceListingId: session.listingId || '',
      sourceSessionId: session.id || '',
      sellerUsername: session.buyerUsername || '',
      isFixedSession: true,
      title: session.title || '',
      name: session.seller || 'Wave Coach',
      game: session.game || 'Coaching',
      games: [session.game || 'Coaching'],
      service: 'Coaching',
      rank: session.rank || 'Coach',
      tier: 'diamond',
      rating: null,
      reviews: null,
      price: Number(session.price) || 0,
      priceText: session.priceText || `${Number(session.price) || 0} GEL/hour`,
      availability: '',
      language: session.language || 'GE',
      languages: Array.isArray(session.languages) ? session.languages : [session.language || 'GE'],
      tags: [session.sessionLabel || 'Custom Session'],
      image: session.imageData || owner?.photoData || '',
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
      });
    });
  }

  function getLocalUser(username) {
    const users = readJson(localUsersKey, []);
    const normalizedUsername = String(username || '').trim().toLowerCase();

    return (Array.isArray(users) ? users : []).find((user) => (
      String(user?.username || '').trim().toLowerCase() === normalizedUsername
    ));
  }

  const coaches = [
    ...(Array.isArray(window.wavehubCoaches) ? window.wavehubCoaches : []),
    ...getCoachListingsFromSessions(),
  ].map((coach) => (coach.isFixedSession ? applyRealCoachActivity(coach) : coach));

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
    const languages = toList(coach.languages).length ? toList(coach.languages) : toList([getLanguage(coach)]);

    return languages.map((language) => languageLabels[language] || language);
  }

  function getReviewItems(coach) {
    return toList(coach.reviewItems || coach.reviewList || coach.reviewsList);
  }

  function getRealCoachReviews(coach) {
    if (!coach.sellerUsername) {
      return [];
    }

    const reviews = readJson(sellerReviewsKey, []);
    const coachIds = new Set([coach.id, coach.sourceListingId, coach.sourceSessionId].filter(Boolean).map(String));

    return (Array.isArray(reviews) ? reviews : [])
      .filter((review) => {
        if (String(review.sellerUsername || '').toLowerCase() !== String(coach.sellerUsername).toLowerCase()) {
          return false;
        }

        const listingId = String(review.listingId || '');
        return (listingId && coachIds.has(listingId)) || /coaching session/i.test(review.itemTitle || '');
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((review) => ({
        author: review.buyerName || review.buyerUsername || 'Verified buyer',
        rating: Number(review.rating) || 0,
        text: review.comment || '',
      }));
  }

  function applyRealCoachActivity(coach) {
    const reviewItems = getRealCoachReviews(coach);
    const rating = reviewItems.length
      ? reviewItems.reduce((total, review) => total + review.rating, 0) / reviewItems.length
      : null;

    return {
      ...coach,
      rating,
      reviews: reviewItems.length,
      reviewItems,
    };
  }

  function getCoachPurchaseStats(coach) {
    const purchases = readJson(purchasesKey, []);
    const coachIds = new Set([coach.id, coach.sourceListingId, coach.sourceSessionId].filter(Boolean).map(String));
    const coachName = String(coach.name || '').trim().toLowerCase();
    const buyers = new Set();
    let sessions = 0;

    (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
      const matchedItems = (Array.isArray(purchase?.items) ? purchase.items : []).filter((item) => {
        if (item?.productType !== 'Coaching') return false;
        const listingId = String(item.listingId || '');
        const sellerName = String(item.seller || '').trim().toLowerCase();
        return (listingId && coachIds.has(listingId)) || (coachName && sellerName === coachName);
      });

      sessions += matchedItems.length;
      if (matchedItems.length && purchase?.buyerUsername) {
        buyers.add(String(purchase.buyerUsername).trim().toLowerCase());
      }
    });

    return { students: buyers.size, sessions };
  }

  function getCoachStudentCount(coach) {
    return getCoachPurchaseStats(coach).students;
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

    const iconMarkup = icon === 'SE'
      ? '<img class="coach-highest-rank-icon" src="assets/sessions-icon.png" alt="" aria-hidden="true">'
      : icon === 'ST'
        ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5bb3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
      : icon === 'SR'
        ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#bd5cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h4l2-7 4 14 2-7h2"/><path d="M14 12c1.4-3.7 4.1-5.8 8-6-.1 4.9-2.1 8-6 9.2"/></svg>'
        : icon === 'RT'
          ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5bb3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M9 2h6"/><path d="M12 5V2"/><path d="m18 7 1.5-1.5"/><path d="M12 9v4l3-2"/><path d="M12 7v1M18 13h-1M12 19v-1M6 13h1"/></svg>'
          : icon === 'HR'
            ? '<img class="coach-highest-rank-icon" src="assets/highest-rank-icon-v3.png" alt="" aria-hidden="true">'
            : icon === 'TW'
              ? '<img class="coach-highest-rank-icon" src="assets/tournament-wins-transparent.png" alt="" aria-hidden="true">'
              : icon === 'YE'
                ? '<img class="coach-highest-rank-icon" src="assets/years-of-experience-icon.png" alt="" aria-hidden="true">'
                : icon === 'CS'
                  ? '<img class="coach-highest-rank-icon" src="assets/coaching-since-icon.png" alt="" aria-hidden="true">'
                  : escapeHtml(icon);
    const iconClass = icon === 'SE'
      ? ' class="coach-profile-metric-icon-plain coach-profile-metric-icon-sessions"'
      : icon === 'ST' || icon === 'SR' || icon === 'RT'
        ? ' class="coach-profile-metric-icon-plain"'
      : icon === 'HR'
        ? ' class="coach-profile-metric-icon-rank"'
        : icon === 'TW'
          ? ' class="coach-profile-metric-icon-rank"'
          : icon === 'YE'
            ? ' class="coach-profile-metric-icon-rank"'
            : icon === 'CS'
              ? ' class="coach-profile-metric-icon-plain"'
            : '';

    return `
      <div class="coach-profile-metric">
        <span${iconClass} aria-hidden="true">${iconMarkup}</span>
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
    } else {
      panels.push(`
        <article class="coach-score-card coach-score-card-empty">
          <span>Wave Score</span>
          <strong>—</strong>
          <em>Calculated after activity</em>
          <i><b style="width: 0%"></b></i>
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
    } else {
      panels.push(`
        <article class="coach-score-card coach-score-card-empty">
          <span>Rating</span>
          <strong>—</strong>
          <small>No reviews yet</small>
        </article>
      `);
    }

    return `<div class="coach-score-panels">${panels.join('')}</div>`;
  }

  function renderMetrics(coach) {
    const activity = getCoachPurchaseStats(coach);
    const metrics = [
      renderMetric('ST', formatNumber(activity.students), 'Students'),
      renderMetric('SE', formatNumber(activity.sessions), 'Completed Sessions'),
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
    const expertiseAreas = toList(coach.expertiseAreas);

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

    if (expertiseAreas.length) {
      cards.push(`
        <article class="coach-info-card">
          <h2>Expertise</h2>
          <ul class="coach-check-list">
            ${expertiseAreas.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `);
    }

    if (hasText(coach.sessionDescription)) {
      cards.push(`
        <article class="coach-info-card">
          <h2>About Session</h2>
          <p>${escapeHtml(coach.sessionDescription)}</p>
        </article>
      `);
    }

    if (games.length) {
      cards.push(`
        <article class="coach-info-card coach-games-card">
          <h2>Games</h2>
          <div>
            ${games.map((game, index) => {
              const gameIconSources = {
                'pubg mobile': 'assets/pubg-mobile-icon.png',
                'cod mobile': 'assets/cod-mobile-icon.png',
                'call of duty': 'assets/cod-mobile-icon.png',
                valorant: 'assets/valorant-icon.png',
                cs2: 'assets/cs2-popular-games-photo.png',
                'mobile legends': 'assets/mobile-legends-popular-games-photo.png',
                'free fire': 'assets/freefire-photo.jpeg',
                roblox: 'assets/roblox-popular-games-photo.png',
              };
              const gameIconSource = gameIconSources[game.trim().toLowerCase()];
              const icon = gameIconSource
                ? `<img src="${gameIconSource}" alt="" aria-hidden="true">`
                : escapeHtml(game.split(' ').map((part) => part[0]).join('').slice(0, 4));
              return `<span${gameIconSource ? ' class="coach-game-item-with-image"' : ''}><b${gameIconSource ? ' class="coach-game-image-shell"' : ''}>${icon}</b>${escapeHtml(game)}${index === 0 ? '<small>Main Game</small>' : ''}</span>`;
            }).join('')}
          </div>
        </article>
      `);
    }

    if (languages.length) {
      cards.push(`
        <article class="coach-info-card coach-languages-card">
          <h2>Languages</h2>
          <div>
            ${languages.map((language) => {
              const languageKey = language.trim().toLowerCase();
              const flagSources = {
                'ქართული': 'assets/georgian-flag-icon.png',
                english: 'assets/united-kingdom-flag.png',
              };
              const flagSource = flagSources[languageKey];
              const isGeorgian = languageKey === 'ქართული';
              return `<span${flagSource ? ` class="coach-language-with-icon${isGeorgian ? ' coach-language-georgian' : ''}"` : ''}>${flagSource ? `<img class="coach-language-icon" src="${flagSource}" alt="" aria-hidden="true">` : ''}${escapeHtml(language)}</span>`;
            }).join('')}
          </div>
        </article>
      `);
    }

    return cards.length ? `<div class="coach-info-grid">${cards.join('')}</div>` : '';
  }

  function renderVideoCard(coach) {
    const hasVideo = hasText(coach.introVideoUrl) || hasText(coach.videoDuration);

    const stats = [
      hasNumber(coach.watched) ? `<div><strong>${formatNumber(coach.watched)}</strong><small>People watched</small></div>` : '',
      hasNumber(coach.helpful) ? `<div><strong>${Number(coach.helpful)}%</strong><small>Found it helpful</small></div>` : '',
    ].filter(Boolean);

    return `
      <article class="coach-video-card">
        <div class="coach-video-preview ${hasVideo ? '' : 'coach-video-preview-empty'}" style="--coach-image: url('${escapeHtml(coach.image)}')">
          ${hasVideo ? '<button type="button" aria-label="Play intro video"></button>' : '<strong>Intro video not added</strong>'}
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
    const customAchievements = toList(coach.achievements).filter((item) => typeof item === 'string');
    const achievementItems = [
      renderMetric('HR', coach.rank, 'Highest Rank'),
      hasNumber(coach.yearsExperience) ? renderMetric('YE', formatNumber(coach.yearsExperience), 'Years of Experience') : '',
      ...toList(coach.achievements)
        .filter((item) => item && typeof item === 'object')
        .map((item) => renderMetric(item.icon || 'AC', item.value, item.label)),
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
          ${customAchievements.length ? `
            <article class="coach-badge-row">
              <span>Coach Achievements</span>
              ${customAchievements.map((achievement) => `<strong>${escapeHtml(achievement)}</strong>`).join('')}
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

  function getDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function formatCalendarDate(date) {
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function getDefaultTimes(coach, date) {
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;

    if (coach.availability === 'weekend' && !isWeekend) {
      return [];
    }

    if (coach.availability === 'now') {
      return isWeekend ? ['12:00', '14:00', '17:00', '20:00'] : ['18:00', '19:30', '21:00'];
    }

    if (coach.availability === 'today') {
      return isWeekend ? ['13:00', '16:00', '19:00'] : ['17:00', '18:30', '20:00'];
    }

    return isWeekend ? ['12:00', '15:00', '18:00'] : ['18:00', '20:00'];
  }

  function getTimesForDate(coach, date) {
    if (coach.isFixedSession) {
      return coach.sessionDate === getDateKey(date) && coach.sessionTime ? [coach.sessionTime] : [];
    }

    const dateKey = getDateKey(date);
    const groups = toList(coach.availableTimes || coach.availabilitySlots);
    const matchedGroup = groups.find((group) => {
      const groupDate = group.date || group.day || group.key;
      return groupDate === dateKey || groupDate === date.toLocaleDateString([], { weekday: 'long' });
    });

    if (matchedGroup) {
      return toList(matchedGroup.times);
    }

    return getDefaultTimes(coach, date);
  }

  function getCalendarDates(coach, monthOffset = bookingState.monthOffset) {
    if (coach.isFixedSession && coach.sessionDate) {
      const fixedDate = new Date(`${coach.sessionDate}T00:00:00`);
      return Number.isNaN(fixedDate.getTime()) ? [] : [fixedDate];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const days = [];

    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      if (date >= today && getTimesForDate(coach, date).length) {
        days.push(date);
      }
    }

    return days;
  }

  function ensureBookingSelection(coach) {
    const games = getCoachGames(coach);

    if (coach.isFixedSession) {
      bookingState.selectedGame = coach.game || games[0] || '';
      bookingState.selectedDate = coach.sessionDate || '';
      bookingState.selectedTime = coach.sessionTime || '';
      return;
    }

    if (!bookingState.selectedGame || !games.includes(bookingState.selectedGame)) {
      bookingState.selectedGame = games[0] || coach.game || '';
    }

    const visibleDates = getCalendarDates(coach);
    const allDates = visibleDates.length ? visibleDates : getCalendarDates(coach, bookingState.monthOffset + 1);

    if (!visibleDates.length && allDates.length) {
      bookingState.monthOffset += 1;
    }

    if (!bookingState.selectedDate || !allDates.some((date) => getDateKey(date) === bookingState.selectedDate)) {
      bookingState.selectedDate = allDates[0] ? getDateKey(allDates[0]) : '';
    }

    const selectedDate = bookingState.selectedDate ? new Date(`${bookingState.selectedDate}T00:00:00`) : null;
    const times = selectedDate ? getTimesForDate(coach, selectedDate) : [];

    if (!bookingState.selectedTime || !times.includes(bookingState.selectedTime)) {
      bookingState.selectedTime = times[0] || '';
    }
  }

  function renderBookingCalendar(coach) {
    ensureBookingSelection(coach);

    if (coach.isFixedSession) {
      const selectedDate = coach.sessionDate ? new Date(`${coach.sessionDate}T00:00:00`) : null;
      const dateText = selectedDate && !Number.isNaN(selectedDate.getTime())
        ? formatCalendarDate(selectedDate)
        : coach.sessionDate || 'Fixed day';
      const summary = coach.sessionLabel || `${coach.game || 'Coaching'} / ${dateText} at ${coach.sessionTime || ''}`;

      return `
        <div class="coach-calendar-card coach-fixed-session-card">
          <div class="coach-fixed-session-row">
            <span>Game</span>
            <strong>${escapeHtml(coach.game || 'Coaching')}</strong>
          </div>
          <div class="coach-fixed-session-row">
            <span>Day</span>
            <strong>${escapeHtml(dateText)}</strong>
          </div>
          <div class="coach-fixed-session-row">
            <span>Hour</span>
            <strong>${escapeHtml(coach.sessionTime || '-')}</strong>
          </div>
          <div class="coach-fixed-session-summary">
            <strong>${escapeHtml(summary)}</strong>
            <small>This session time was set by the coach.</small>
          </div>
        </div>
      `;
    }

    const groups = toList(coach.availableTimes || coach.availabilitySlots).length
      ? toList(coach.availableTimes || coach.availabilitySlots)
      : getCalendarDates(coach).slice(0, 3).map((date, index) => ({
        date: getDateKey(date),
        label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : formatCalendarDate(date),
        tone: index === 0 ? 'green' : index === 1 ? 'gold' : 'cyan',
        times: getTimesForDate(coach, date),
      }));

    return `
      <div class="coach-time-row">
        <div>
          <strong>Available Times</strong>
          ${hasText(coach.timezone) ? `<small>${escapeHtml(coach.timezone)}</small>` : '<small>Local coach time</small>'}
        </div>
        <a href="#" aria-label="View full coach schedule">View full schedule <span aria-hidden="true">→</span></a>
      </div>
      <div class="coach-time-groups">
        ${groups.map((group) => {
          const times = toList(group.times);

          if (!hasText(group.label) || !times.length) {
            return '';
          }

          return `
            <div class="coach-times-group">
              <span class="coach-time-day ${escapeHtml(group.tone || '')}">${escapeHtml(group.label)}</span>
              <div>
                ${times.map((time) => {
                  const dateKey = group.date || '';
                  const isSelected = dateKey === bookingState.selectedDate && time === bookingState.selectedTime;
                  return `<button class="${isSelected ? 'active' : ''}" type="button" data-session-date="${escapeHtml(dateKey)}" data-session-time="${escapeHtml(time)}" aria-pressed="${String(isSelected)}">${escapeHtml(time)}</button>`;
                }).join('')}
              </div>
            </div>
          `;
        }).join('') || '<p class="coach-calendar-empty">No available times yet.</p>'}
      </div>
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
      .filter((item) => item.id !== coach.id && (!coach.isFixedSession || item.isFixedSession))
      .sort((a, b) => (a.game === coach.game ? -1 : 1) - (b.game === coach.game ? -1 : 1))
      .slice(0, 4)
      .map((item) => `
        <a class="coach-similar-card" href="${getCoachUrl(item)}">
          <span class="coach-similar-avatar${hasText(item.image) ? ' has-image' : ''}" style="--coach-image: url('${escapeHtml(item.image)}')">${hasText(item.image) ? '' : escapeHtml(getCoachInitials(item))}</span>
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.rank)}</small>
            ${hasNumber(item.rating) ? `<em>&#9733; ${formatRating(item.rating)}${hasNumber(item.reviews) ? ` (${formatNumber(item.reviews)})` : ''}</em>` : ''}
          </span>
          <b>${Number(item.price) || 0} GEL<small>/hour</small></b>
        </a>
      `).join('');
  }

  function getCoachCartItem(coach) {
    const sessionDate = bookingState.selectedDate || '';
    const sessionTime = bookingState.selectedTime || '';
    const sessionGame = bookingState.selectedGame || coach.game || 'Coaching';
    const sessionLabel = coach.isFixedSession && coach.sessionLabel
      ? coach.sessionLabel
      : sessionDate && sessionTime
      ? `${sessionGame} / ${formatCalendarDate(new Date(`${sessionDate}T00:00:00`))} at ${sessionTime}`
      : 'Unscheduled session';

    return {
      id: `coach:${coach.id}:session:${sessionGame}:${sessionDate}:${sessionTime}`,
      listingId: coach.id,
      title: `${coach.name} Coaching Session`,
      productType: 'Coaching',
      game: sessionGame,
      seller: coach.name,
      sellerUsername: coach.sellerUsername || '',
      price: Number(coach.price) || 0,
      priceText: coach.priceText || `${Number(coach.price) || 0} GEL/hour`,
      imageData: coach.image,
      detailUrl: getCoachUrl(coach),
      sessionDate,
      sessionTime,
      sessionLabel,
      language: coach.language || '',
      about: coach.about || '',
      sessionDescription: coach.sessionDescription || '',
      responseTime: coach.responseTime || '',
      responseTimeMinutes: Number(coach.responseTimeMinutes) || 0,
      addedAt: new Date().toISOString(),
    };
  }

  function addCoachToCart(coach) {
    if (!bookingState.selectedGame || !bookingState.selectedDate || !bookingState.selectedTime) {
      return null;
    }

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
    const bookButtonText = coach.isFixedSession ? 'Add Session to Cart' : 'Book Session';
    const messageUrl = coach.sellerUsername
      ? `messages.html?to=${encodeURIComponent(coach.sellerUsername)}`
      : 'messages.html';
    const bookingFacts = [
      ['Game', coach.game || 'Coaching'],
      ['Language', getLanguage(coach)],
      ['Date', coach.sessionDate ? formatCalendarDate(new Date(`${coach.sessionDate}T00:00:00`)) : 'Choose from calendar'],
      ['Price', coach.priceText || `${Number(coach.price) || 0} GEL/hour`],
    ];

    document.title = `WaveHub - ${coach.name} Book Session`;

    root.innerHTML = `
      <a class="coach-profile-back" href="coaching.html"><span aria-hidden="true">&lt;</span> Back to Coaches</a>

      <section class="coach-profile-hero" aria-labelledby="coachProfileTitle">
        <div class="coach-profile-portrait-wrap">
          <div class="coach-profile-portrait${hasText(coach.image) ? ' has-image' : ''}" style="--coach-image: url('${escapeHtml(coach.image)}')">
            ${hasText(coach.image) ? '' : `<span>${escapeHtml(initials)}</span>`}
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
        ${renderReviews(coach) || '<p class="coach-profile-empty">No reviews yet.</p>'}
      </section>

      <section class="coach-booking-panel" aria-label="Book coaching session">
        <div class="coach-booking-main">
          <div class="coach-starting-price">
            <span>${coach.isFixedSession ? 'Session price' : 'Starting from'}</span>
            <strong>${escapeHtml(coach.priceText || `${Number(coach.price) || 0} GEL/hour`)}</strong>
          </div>
          <button class="coach-book-primary" type="button" data-action="book">${bookButtonText}</button>
          <a class="coach-book-secondary coach-message-secondary" href="${messageUrl}">Message Coach</a>
          <button class="coach-book-secondary" type="button" data-action="wishlist">Add to Wishlist</button>
        </div>

        ${renderBookingCalendar(coach)}

        <p class="coach-booking-status" id="coachBookingStatus" aria-live="polite"></p>

        <div class="coach-protection-row">
          ${bookingFacts.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('')}
        </div>
      </section>

      <section class="coach-similar-section" aria-labelledby="coachSimilarTitle">
        <div>
          <h2 id="coachSimilarTitle">Similar Coaches</h2>
          <a href="coaching.html">View all coaches</a>
        </div>
        <div class="coach-similar-grid">
          ${similarCards || '<p class="coach-profile-empty">No similar coaches available yet.</p>'}
          ${similarCards ? '<a class="coach-similar-next" href="coaching.html" aria-label="Browse more coaches">&gt;</a>' : ''}
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
    const dateButton = target?.closest('[data-session-date]');
    const timeButton = target?.closest('[data-session-time]');
    const gameButton = target?.closest('[data-session-game]');
    const calendarNav = target?.closest('[data-calendar-nav]');

    if (tab) {
      setActiveTab(tab.dataset.profileTab || 'overview');
      return;
    }

    if (calendarNav) {
      const direction = calendarNav.dataset.calendarNav;
      bookingState.monthOffset = Math.max(0, bookingState.monthOffset + (direction === 'next' ? 1 : -1));
      bookingState.selectedDate = '';
      bookingState.selectedTime = '';
      renderCoachPage(activeCoach);
      return;
    }

    if (gameButton) {
      bookingState.selectedGame = gameButton.dataset.sessionGame || '';
      renderCoachPage(activeCoach);
      return;
    }

    if (dateButton && dateButton.dataset.sessionTime) {
      bookingState.selectedDate = dateButton.dataset.sessionDate || '';
      bookingState.selectedTime = dateButton.dataset.sessionTime || '';
      renderCoachPage(activeCoach);
      return;
    }

    if (dateButton) {
      bookingState.selectedDate = dateButton.dataset.sessionDate || '';
      bookingState.selectedTime = '';
      renderCoachPage(activeCoach);
      return;
    }

    if (timeButton) {
      bookingState.selectedTime = timeButton.dataset.sessionTime || '';
      renderCoachPage(activeCoach);
      return;
    }

    if (!action) {
      return;
    }

    const actionName = action.dataset.action;

    if (actionName === 'book') {
      const added = addCoachToCart(activeCoach);
      if (added === null) {
        setStatus('error', 'Choose a game, date and time first.');
        return;
      }

      const item = getCoachCartItem(activeCoach);
      setStatus('success', added ? `${item.sessionLabel} added to cart.` : `${item.sessionLabel} is already in your cart.`);
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

  window.addEventListener('storage', (event) => {
    if (event.key === purchasesKey) {
      renderCoachPage(activeCoach);
    }
  });
}());
