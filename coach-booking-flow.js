(function () {
  'use strict';

  const root = document.getElementById('coachBookingRoot');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const requestedCoach = params.get('coach') || params.get('id') || '';
  const stateKey = `wavehub.coachBooking.${requestedCoach || 'default'}`;
  const cartKey = 'wavehub.cart';
  const purchasesKey = 'wavehub.purchases';
  const sessionKey = 'wavehub.session';
  const usersKey = 'wavehub.users';

  const steps = [
    ['Session', 'package'],
    ['Schedule', 'calendar'],
    ['Your Goal', 'target'],
    ['Review', 'clipboard'],
    ['Payment', 'card'],
    ['Confirmed', 'check'],
  ];

  const icons = {
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5m6 6-6-6 6-6"/>',
    package: '<path d="m3 7 9 5 9-5-9-5-9 5Z"/><path d="m3 7 9 5v10l-9-5V7Zm18 0-9 5v10l9-5V7Z"/>',
    rocket: '<path d="M14 5c3.5-3.5 6.8-2.8 6.8-2.8S21.5 5.5 18 9l-5 5-4-4 5-5Z"/><path d="m9 10-4 1-3 3 6 1m5-1 1 6 3-3 1-4M7 17c-2 0-3 1-3 3 2 0 3-1 3-3Z"/>',
    growth: '<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/><path d="m3 8 5-5 5 5 8-8"/>',
    crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z"/><path d="M5 22h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    note: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    chat: '<path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z"/>',
    star: '<path d="m12 2 3 6 6.5 1-4.8 4.7 1.2 6.5L12 17l-5.9 3.2 1.2-6.5L2.5 9 9 8l3-6Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    thumb: '<path d="M7 10v11H3V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1.5-7A2 2 0 0 0 18.5 8H14l1-4c.3-1.2-.5-2-1.5-2L7 10"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-1 .7-1.4 1.2-1.4 2.1m0 4h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m14 10 7-7"/>',
    gamepad: '<path d="M7 8h10a5 5 0 0 1 4.5 7.2l-1.2 2.5a2.2 2.2 0 0 1-3.5.6L15 16H9l-1.8 2.3a2.2 2.2 0 0 1-3.5-.6l-1.2-2.5A5 5 0 0 1 7 8Z"/><path d="M7 11v4m-2-2h4m7-1h.01m2 2h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    discord: '<path class="discord-mark" d="M18.8 5.7A16 16 0 0 0 15 4.5l-.5 1a13.5 13.5 0 0 0-5 0l-.5-1a16 16 0 0 0-3.8 1.2C3.6 8.1 2.8 10.8 2.6 14c1.8 2 3.6 3.1 5.4 3.8l1.3-1.7a11 11 0 0 1-2-1c3 1.4 6.4 1.4 9.4 0-.6.4-1.3.7-2 1l1.3 1.7c1.8-.7 3.6-1.8 5.4-3.8-.2-3.2-1-5.9-2.6-8.3Z"/><ellipse class="discord-eye" cx="9" cy="11.8" rx="1.25" ry="1.55"/><ellipse class="discord-eye" cx="15" cy="11.8" rx="1.25" ry="1.55"/>',
    light: '<path d="M9 18h6m-5 3h4"/><path d="M8.5 15a6 6 0 1 1 7 0c-1 .7-1.5 1.4-1.5 2h-4c0-.6-.5-1.3-1.5-2Z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6m-6 4h6m-6 4h4"/>',
    lari: '<text x="12" y="17" text-anchor="middle" fill="currentColor" stroke="none" font-size="17" font-weight="700">₾</text>',
    bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    bank: '<path d="m3 9 9-6 9 6H3Zm2 3h14M6 12v6m4-6v6m4-6v6m4-6v6M3 21h18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    home: '<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
    external: '<path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v8H3V6h8"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };

  function icon(name, className = '') {
    return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.check}</svg>`;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function getCoach() {
    const base = Array.isArray(window.wavehubCoaches) ? window.wavehubCoaches : [];
    const cart = readJson(cartKey, []);
    const listingItems = (Array.isArray(cart) ? cart : []).filter((item) => (
      item?.productType === 'Coaching'
      && (item.isCoachListing || (item.buyerUsername && item.detailUrl === 'coaching.html'))
    ));
    const seed = listingItems.find((item) => String(item.id) === requestedCoach || String(item.listingId) === requestedCoach)
      || listingItems.find((item) => String(item.seller || '').toLowerCase() === requestedCoach.toLowerCase());

    if (seed) {
      const ownerUsername = String(seed.buyerUsername || seed.sellerUsername || '').toLowerCase();
      const listingId = String(seed.listingId || '');
      const game = String(seed.game || 'Coaching');
      const related = listingItems.filter((item) => (
        String(item.buyerUsername || item.sellerUsername || '').toLowerCase() === ownerUsername
        && String(item.listingId || '') === listingId
        && String(item.game || 'Coaching') === game
      ));
      const identifiers = new Set(related.flatMap((item) => [item.id, item.listingId]).filter(Boolean).map(String));
      const booked = new Set();
      const purchases = readJson(purchasesKey, []);

      (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
        if (/cancel|refund|failed/i.test(String(purchase?.status || ''))) return;
        (Array.isArray(purchase?.items) ? purchase.items : []).forEach((item) => {
          const sameCoach = identifiers.has(String(item?.listingId || ''))
            || (ownerUsername && String(item?.sellerUsername || '').toLowerCase() === ownerUsername);
          const sameGame = !item?.game || String(item.game) === game;
          if (!sameCoach || !sameGame) return;
          if (Array.isArray(item.sessions)) {
            item.sessions.forEach((session) => {
              if (session?.date && session?.time) booked.add(`${session.date}|${session.time}`);
            });
          } else if (item.sessionDate) {
            const times = Array.isArray(item.sessionTimes) ? item.sessionTimes : [item.sessionTime];
            times.filter(Boolean).forEach((time) => booked.add(`${item.sessionDate}|${time}`));
          }
        });
      });

      const slotMap = new Map();
      related.forEach((item) => {
        if (!item.sessionDate || !item.sessionTime) return;
        if (!slotMap.has(item.sessionDate)) slotMap.set(item.sessionDate, []);
        if (!slotMap.get(item.sessionDate).includes(item.sessionTime)) slotMap.get(item.sessionDate).push(item.sessionTime);
      });
      const availableTimes = [...slotMap.entries()]
        .map(([date, times]) => ({ date, times: times.filter((time) => !booked.has(`${date}|${time}`)).sort() }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const users = readJson(usersKey, []);
      const owner = (Array.isArray(users) ? users : []).find((user) => String(user?.username || '').toLowerCase() === ownerUsername);

      return {
        id: seed.id || seed.listingId,
        sourceListingId: seed.listingId || seed.id,
        isRealCoachListing: true,
        name: seed.seller || 'Wave Coach',
        sellerUsername: seed.buyerUsername || seed.sellerUsername || '',
        game,
        service: seed.rank || 'Verified Coach',
        rating: seed.rating || 5,
        reviews: seed.reviews || 0,
        price: Number(seed.price) || 15,
        image: seed.imageData || owner?.photoData || '',
        verified: true,
        sessions: seed.sessions || 0,
        successRate: seed.successRate || 100,
        waveScore: seed.waveScore || 96,
        availability: availableTimes.some((group) => group.times.length) ? 'now' : '',
        timezone: seed.timezone || 'GMT +4',
        availableTimes,
      };
    }

    return base.find((item) => String(item.id) === requestedCoach)
      || base.find((item) => String(item.name).toLowerCase() === requestedCoach.toLowerCase())
      || base[0]
      || { id: 'coach', name: 'NightHawk', game: 'Valorant', service: 'Diamond Coach', rating: 4.9, reviews: 127, price: 15, image: 'assets/pubg-photo.jpeg', verified: true, sessions: 812, successRate: 98, waveScore: 96, availability: 'now', timezone: 'GMT +4' };
  }

  let coach = getCoach();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(days) {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date;
  }

  function getDates() {
    const supplied = Array.isArray(coach.availableTimes) ? coach.availableTimes : [];
    const grouped = new Map();
    supplied.forEach((group) => {
      if (!group?.date) return;
      const date = new Date(`${group.date}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date < today) return;
      const key = dateKey(date);
      if (!grouped.has(key)) grouped.set(key, { date, key, times: [] });
      (Array.isArray(group.times) ? group.times : []).forEach((time) => {
        if (time && !grouped.get(key).times.includes(time)) grouped.get(key).times.push(time);
      });
    });
    return [...grouped.values()].sort((a, b) => a.date - b.date);
  }

  let availableDates = getDates();
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(stateKey) || '{}'); } catch { return {}; } })();
  const booking = {
    step: Math.min(6, Math.max(1, Number(params.get('step')) || Number(saved.step) || 1)),
    packageId: saved.packageId === 'starter' ? 'single' : (saved.packageId || 'growth'),
    date: saved.date || availableDates.find((item) => item.times.length)?.key || availableDates[0]?.key || '',
    sessions: Array.isArray(saved.sessions)
      ? saved.sessions.filter((item) => item?.date && item?.time)
      : (Array.isArray(saved.times) ? saved.times.map((time) => ({ date: saved.date || availableDates[0]?.key || '', time })).filter((item) => item.date) : []),
    goal: saved.goal || '',
    challenges: saved.challenges || '',
    discord: saved.discord || '',
    paid: Boolean(saved.paid),
    showAllDates: Boolean(saved.showAllDates),
  };

  const packages = [
    { id: 'single', name: 'Single Session', icon: 'rocket', tone: 'purple', sessions: 1, subtitle: 'One-time booking · No package or subscription', features: [['user', '1 Live Session'], ['clock', '60 Minutes'], ['check', 'Pay for one session only'], ['check', 'No subscription'], ['chat', 'Chat Support']] },
    { id: 'growth', name: 'Growth', icon: 'growth', tone: 'pink', sessions: 3, subtitle: 'Best for consistent improvement', popular: true, features: [['package', '3 Live Sessions'], ['clock', '60 Minutes Each'], ['note', 'Progress Tracking'], ['check', 'Homework & Tasks'], ['chat', 'Chat Support']] },
    { id: 'elite', name: 'Elite', icon: 'crown', tone: 'gold', sessions: 5, subtitle: 'Best for serious long-term progress', features: [['package', '5 Live Sessions'], ['clock', '60 Minutes Each'], ['note', 'Personalized Plan'], ['check', 'Priority Support'], ['check', 'Progress Tracking'], ['check', 'Homework & Tasks']] },
  ];

  function selectedPackage() { return packages.find((item) => item.id === booking.packageId) || packages[1]; }
  function selectionTitle() {
    const option = selectedPackage();
    return option.id === 'single' ? option.name : `${option.name} Package`;
  }
  function price() { return (Number(coach.price) || 15) * selectedPackage().sessions; }
  function money(value) {
    return `₾${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function save() { sessionStorage.setItem(stateKey, JSON.stringify(booking)); }
  let availableSlotCount = availableDates.reduce((total, item) => total + item.times.length, 0);

  if (!availableDates.some((item) => item.key === booking.date)) {
    booking.date = availableDates.find((item) => item.times.length)?.key || availableDates[0]?.key || '';
  }

  if (coach.isRealCoachListing && selectedPackage().sessions > availableSlotCount) {
    booking.packageId = [...packages].reverse().find((item) => item.sessions <= availableSlotCount)?.id || 'single';
    booking.sessions = booking.sessions.slice(0, selectedPackage().sessions);
  }

  if (!booking.paid) {
    const liveSlots = new Set(availableDates.flatMap((item) => item.times.map((time) => `${item.key}|${time}`)));
    booking.sessions = booking.sessions.filter((session) => liveSlots.has(`${session.date}|${session.time}`));
  }

  if (!Array.isArray(saved.sessions) && !Array.isArray(saved.times)) {
    booking.sessions = (availableDates.find((item) => item.key === booking.date)?.times || [])
      .slice(0, selectedPackage().sessions)
      .map((time) => ({ date: booking.date, time }));
  }

  function initials() {
    return String(coach.name || 'WH').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function logo() {
    return `<a class="booking-logo" href="index.html" aria-label="WaveHubX home"><img src="assets/logo-wavehubx-main.png" alt="WaveHubX"></a>`;
  }

  function header() {
    return `<header class="booking-header">${logo()}<a class="booking-help" href="contact-information.html">${icon('help')}<span>Need help?</span></a></header>${progress()}`;
  }

  function progress() {
    return `<nav class="booking-progress" aria-label="Booking progress">${steps.map(([label], index) => {
      const number = index + 1;
      const done = number < booking.step;
      const active = number === booking.step;
      return `<div class="booking-progress-step ${done ? 'done' : ''} ${active ? 'active' : ''}"><span>${done ? icon('check') : number}</span><small>${label}</small></div>`;
    }).join('')}</nav>`;
  }

  function coachCard() {
    const image = coach.image ? `style="--booking-coach-image:url('${escapeHtml(coach.image)}')"` : '';
    return `<article class="booking-coach-card">
      <div class="booking-coach-avatar ${coach.image ? 'has-image' : ''}" ${image}>${coach.image ? '' : escapeHtml(initials())}</div>
      <div class="booking-coach-copy">
        <div class="booking-coach-name"><h2>${escapeHtml(coach.name)}</h2>${coach.verified ? '<span class="booking-verified">✓</span>' : ''}<em>${icon('shield')} ${escapeHtml(coach.service || 'Diamond Coach')}</em></div>
        <div class="booking-rating">${icon('star')}<strong>${Number(coach.rating || 5).toFixed(1)}</strong><span>(${Number(coach.reviews) || 0} reviews)</span></div>
        ${booking.step >= 3 ? renderCoachAvailability() : ''}
        <div class="booking-coach-stats">${icon('user')} ${Number(coach.sessions) || 812} Sessions Completed <i>•</i> ${icon('thumb')} ${Number(coach.successRate) || 98}% Positive Feedback</div>
      </div>
      <div class="booking-score"><span>${icon('shield')}<strong>Wave Score</strong></span><b>${Number(coach.waveScore) || 96}<small>/100</small></b><em>Excellent</em></div>
    </article>`;
  }

  function renderCoachAvailability() {
    if (!coach.isRealCoachListing) {
      return coach.availability === 'now' ? '<div class="booking-online"><i></i> Online <b>Available Today</b></div>' : '';
    }
    const next = availableDates.find((item) => item.times.length);
    if (!next) return '<div class="booking-online unavailable"><i></i> No available slots</div>';
    if (next.key === dateKey(today)) return '<div class="booking-online"><i></i> Available Today</div>';
    return `<div class="booking-online upcoming"><i></i> Next available <b>${next.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b></div>`;
  }

  function intro(kicker, title, subtitle) {
    return `<div class="booking-intro">${kicker ? `<span>${kicker}</span>` : ''}<h1>${title}</h1><p>${subtitle}</p></div>`;
  }

  function secureNote(text = 'You can review everything before payment.') {
    return `<p class="booking-secure-note">${icon('lock')} ${text}</p>`;
  }

  function navButtons(nextLabel, options = {}) {
    return `<div class="booking-actions ${options.single ? 'single' : ''}">${options.back === false ? '' : `<button class="booking-back" type="button" data-back>${icon('arrowLeft')} Back</button>`}<button class="booking-next" type="button" data-next>${options.lock ? icon('lock') : ''}${nextLabel}${icon('arrowRight')}</button></div>${secureNote(options.note)}`;
  }

  function renderPackage() {
    return `${intro('', 'Book a Coaching Session', 'Choose a single session or a package that fits your goals.')}${coachCard()}
      <section class="booking-section-heading"><span>${icon('package')}</span><div><h2>Choose Your Session Option</h2><p>Book one session with no subscription, or choose a multi-session package. Every option includes 1-on-1 coaching with ${escapeHtml(coach.name)}.</p></div></section>
      <div class="booking-packages">${packages.map((item) => {
        const selected = item.id === booking.packageId;
        const unavailable = coach.isRealCoachListing && item.sessions > availableSlotCount;
        const total = (Number(coach.price) || 15) * item.sessions;
        return `<article class="booking-package ${item.tone} ${selected ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-package-card="${item.id}">${item.popular ? '<span class="booking-popular">MOST POPULAR</span>' : ''}<button class="booking-radio" type="button" data-package="${item.id}" aria-label="Select ${item.name}" ${unavailable ? 'disabled' : ''}>${selected ? icon('check') : ''}</button><div class="booking-package-icon">${icon(item.icon)}</div><h3>${item.name}</h3><p>${unavailable ? `Only ${availableSlotCount} session slot${availableSlotCount === 1 ? '' : 's'} currently available` : item.subtitle}</p><ul>${item.features.map(([name, label]) => `<li>${icon(name)} ${label}</li>`).join('')}</ul><div class="booking-package-price"><strong>${money(total)}</strong><span>total</span><small>${money(Number(coach.price) || 15)} / session</small></div><button class="booking-select" type="button" data-package="${item.id}" ${unavailable ? 'disabled' : ''}>${unavailable ? 'Currently Unavailable' : selected ? `Selected ${icon('check')}` : item.id === 'single' ? 'Select Single Session' : 'Select Package'}</button></article>`;
      }).join('')}</div>
      <div class="booking-benefits"><div>${icon('shield')}<span><strong>Secure & Protected</strong><small>Your payment and personal information are always safe.</small></span></div><div>${icon('calendar')}<span><strong>Flexible Scheduling</strong><small>Choose a time that works best for you.</small></span></div><div>${icon('headset')}<span><strong>24/7 Support</strong><small>We're here to help you anytime you need us.</small></span></div></div>
      ${navButtons('Continue to Schedule', { back: false, single: true })}`;
  }

  function dateLabel(date, index) {
    if (dateKey(date) === dateKey(today)) return 'Today';
    if (dateKey(date) === dateKey(addDays(1))) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  function slotsForSelectedDate() {
    return availableDates.find((item) => item.key === booking.date)?.times || [];
  }

  function getSessionDate(session) {
    const date = session?.date ? new Date(`${session.date}T00:00:00`) : chosenDate();
    return Number.isNaN(date.getTime()) ? chosenDate() : date;
  }

  function sessionLabel(session, long = false) {
    const date = getSessionDate(session);
    return `${date.toLocaleDateString('en-US', { month: long ? 'long' : 'short', day: 'numeric' })} · ${session.time}`;
  }

  function renderSchedule() {
    const pkg = selectedPackage();
    const chosen = availableDates.find((item) => item.key === booking.date) || availableDates[0] || { date: today, key: '', times: [] };
    const slots = slotsForSelectedDate();
    const displaySlots = slots.map((time) => ({ time, status: 'Available' }));
    const visibleDates = booking.showAllDates ? availableDates : availableDates.slice(0, 5);
    return `${intro('STEP 2 OF 6', 'Select Your Sessions', `Choose <b>${pkg.sessions} time slot${pkg.sessions === 1 ? '' : 's'}</b> that work best for you.`)}${coachCard()}
      <section class="booking-schedule-section"><h2>1. Choose a Date</h2><div class="booking-dates">${visibleDates.map((item, index) => {
        const selected = item.key === booking.date;
        const slotsCount = item.times.length;
        return `<button class="${selected ? 'selected' : ''}" type="button" data-date="${item.key}"><strong>${dateLabel(item.date, index)}</strong><span>${item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><small class="${slotsCount ? '' : 'full'}">${slotsCount ? `${slotsCount} slots` : 'Full'}</small></button>`;
      }).join('') || '<p class="booking-no-availability">This coach has not published any available session times yet.</p>'}${availableDates.length > 5 ? `<button type="button" class="booking-more-dates" data-toggle-dates>${icon('calendar')}<strong>${booking.showAllDates ? 'Fewer Dates' : 'More Dates'}</strong><small>${booking.showAllDates ? 'Collapse Calendar' : 'View Calendar'}</small></button>` : ''}</div></section>
      <section class="booking-schedule-section"><div class="booking-slot-title"><div><h2>2. Choose Your Time Slots for ${dateLabel(chosen.date)}, ${chosen.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h2><p>${icon('alert')} You need to select ${pkg.sessions} time slot${pkg.sessions === 1 ? '' : 's'} for your ${pkg.id === 'single' ? 'single session' : 'package'}.</p></div><span>◎ &nbsp;${escapeHtml(coach.timezone || 'GMT +4')}</span></div><div class="booking-slots">${displaySlots.map((slot) => {
        const selected = booking.sessions.some((session) => session.date === booking.date && session.time === slot.time);
        const disabled = slot.status === 'Booked' || slot.status === 'Unavailable';
        return `<button class="${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${slot.status.startsWith('Limited') ? 'limited' : ''}" type="button" data-time="${escapeHtml(slot.time)}" ${disabled ? 'disabled' : ''}><strong>${escapeHtml(slot.time)}</strong><span>${selected ? 'Selected' : slot.status}</span>${selected ? icon('check') : ''}</button>`;
      }).join('') || '<p class="booking-no-availability">No available times on this date.</p>'}</div></section>
      <div class="booking-selected-slots"><span>Selected Slots:</span><div>${booking.sessions.map((session, index) => `<button type="button" data-remove-slot="${index}"><b>${index + 1}</b>${escapeHtml(sessionLabel(session))}${icon('close')}</button>`).join('') || '<small>No slots selected yet</small>'}</div><button type="button" data-clear-times>Clear All ${icon('trash')}</button></div>
      <p class="booking-form-error" id="bookingFormError"></p>${navButtons('Continue to Goals')}`;
  }

  function renderGoal() {
    return `${intro('STEP 3 OF 6', "What's Your Goal?", 'Help your coach understand what you want to achieve<br>so they can prepare the best session for you.')}${coachCard()}
      <div class="booking-goal-layout"><section class="booking-goal-form">
        <label><span>${icon('target')}<b>Describe Your Goal</b><small>Tell your coach what you want to improve, achieve, or learn.</small></span><textarea id="bookingGoal" maxlength="500" placeholder="Example: I want to reach Immortal rank in Valorant and improve my aim and game sense...">${escapeHtml(booking.goal)}</textarea><em><b id="goalCount">${booking.goal.length}</b>/500</em></label>
        <label><span>${icon('gamepad')}<b>Any Specific Challenges? <small>(optional)</small></b><small>Mention any challenges or focus areas you want to work on.</small></span><textarea id="bookingChallenges" maxlength="300" placeholder="Example: I struggle with crosshair placement, need help with mid-round decisions...">${escapeHtml(booking.challenges)}</textarea><em><b id="challengeCount">${booking.challenges.length}</b>/300</em></label>
        <label class="booking-discord"><span>${icon('discord')}<b>Discord for Your Session</b><small>Enter your Discord username so your coach can find you and add you to the right channel before the session.</small></span><div><input id="bookingDiscord" value="${escapeHtml(booking.discord)}" placeholder="e.g. gio.wavehub" autocomplete="off"><b>${booking.discord ? '✓ Discord added' : ''}</b></div><p>${icon('lock')} Your Discord username will be shared only with your coach for this booking.</p></label>
        <div class="booking-discord-help">${icon('discord')}<span><strong>Don't have Discord?</strong><small>Discord is where your coaching session will take place.</small></span><a href="https://discord.com/register" target="_blank" rel="noreferrer">Create an account ${icon('external')}</a></div>
      </section><aside class="booking-tips"><h2>${icon('light')} Quick Tips</h2><ul><li>${icon('target')} Be specific about your current rank or level</li><li>${icon('gamepad')} Mention the game modes you play</li><li>${icon('alert')} Share your biggest challenges</li><li>${icon('chat')} The more details you give, the better your coach can help you</li></ul><div><h3>${icon('lock')} Private & Secure</h3><p>Your goal and Discord info are private and only visible to your coach.</p></div></aside></div>
      <p class="booking-form-error" id="bookingFormError"></p>${navButtons('Continue to Review')}`;
  }

  function chosenDate() { return availableDates.find((item) => item.key === booking.date)?.date || today; }
  function summaryGoal() { return booking.goal || `Improve my ${coach.game || 'game'} rank, aim and game sense.`; }

  function renderReview() {
    const firstSession = booking.sessions[0] || { date: booking.date, time: '' };
    const date = getSessionDate(firstSession);
    return `${intro('STEP 4 OF 6', 'Review Your Booking', 'Please review all details before proceeding to payment.')}${coachCard()}<div class="booking-review-list">
      <article><span class="pink">${icon(selectedPackage().id === 'single' ? 'rocket' : 'growth')}</span><div><h2>Session Option</h2><strong>${selectionTitle()}</strong><small>${selectedPackage().sessions} Session${selectedPackage().sessions === 1 ? ' · No subscription' : 's'}</small></div><button type="button" data-go-step="1">Change ›</button></article>
      <article><span class="purple">${icon('calendar')}</span><div><h2>Schedule</h2><strong>${booking.sessions.length} selected session${booking.sessions.length === 1 ? '' : 's'}</strong><p>${booking.sessions.map((session, index) => `<span><b>${index + 1}</b><em>${escapeHtml(sessionLabel(session, true))}</em></span>`).join('')}</p></div><button type="button" data-go-step="2">Change ›</button></article>
      <article><span class="purple">${icon('target')}</span><div><h2>Your Goal</h2><strong>${escapeHtml(summaryGoal())}</strong></div><button type="button" data-go-step="3">Change ›</button></article>
      <article><span class="green">${icon('lari')}</span><div><h2>Total Price</h2><strong>${selectedPackage().id === 'single' ? 'One-time session · No subscription' : `Includes all ${selectedPackage().sessions} sessions`}</strong></div><b class="booking-total">${money(price())}</b></article>
      </div><div class="booking-benefits review"><div>${icon('shield')}<span><strong>100% Secure Checkout</strong><small>Your data is always protected</small></span></div><div>${icon('package')}<span><strong>Satisfaction Guaranteed</strong><small>We're here to help you succeed</small></span></div><div>${icon('bolt')}<span><strong>Instant Access</strong><small>Start right after payment</small></span></div></div>${navButtons('Continue to Payment')}`;
  }

  function renderPayment() {
    return `${intro('STEP 5 OF 6', 'Payment', 'Complete your payment to secure your coaching session.')}${coachCard()}
      <section class="booking-payment-method"><h2>Payment Method</h2><div class="booking-bank-option"><i></i><span class="bog-mini">BG</span><div><strong>Bank of Georgia</strong><small>Pay directly with your Bank of Georgia account</small></div><em>Only available method</em></div><p>${icon('lock')} Your payment is processed securely through Bank of Georgia.</p></section>
      <section class="booking-how"><div><h2>How it works?</h2><ol><li><b>1</b>Click “Pay Now” and you will be redirected to Bank of Georgia's secure system.</li><li><b>2</b>Complete the payment using your Bank of Georgia account.</li><li><b>3</b>Once the payment is successful, you will be redirected back to WaveHub.</li><li><b>4</b>Your coaching session will be confirmed and available in your dashboard.</li></ol></div><div class="bog-brand"><span>BG</span><strong>BANK OF GEORGIA<small>საქართველოს ბანკი</small></strong></div></section>
      <article class="booking-payment-total"><span class="green">${icon('lari')}</span><div><h2>Total Price</h2><small>${selectedPackage().id === 'single' ? 'One-time session · No subscription' : `Includes all ${selectedPackage().sessions} sessions`}</small></div><b>${money(price())}</b></article>${navButtons('Pay Now', { lock: true, note: "Secure payment  •  You'll return to WaveHub after payment" })}`;
  }

  function persistPurchase() {
    const session = readJson(sessionKey, null);
    const users = readJson(usersKey, []);
    const stored = Array.isArray(users) ? users.find((user) => user.username === session?.user?.username) : null;
    const user = { ...(session?.user || {}), ...(stored || {}) };
    const item = {
      id: `coach:${coach.id}:${Date.now()}`,
      title: `${coach.name} ${selectionTitle()}`,
      productType: 'Coaching', game: coach.game || 'Coaching', seller: coach.name,
      sellerUsername: coach.sellerUsername || '', price: price(), priceText: money(price()), imageData: coach.image || '',
      detailUrl: `coach-book-session.html?coach=${encodeURIComponent(coach.id)}`, sourceCoachId: coach.id, listingId: coach.sourceListingId || coach.id, sessionDate: booking.date,
      sessionTime: booking.sessions[0]?.time || '', sessionTimes: booking.sessions.map((session) => session.time), sessions: booking.sessions, sessionLabel: selectedPackage().id === 'single' ? 'Single session · No subscription' : `${selectedPackage().sessions} session package`,
      packageName: selectionTitle(), coachingGoal: booking.goal, challenges: booking.challenges, discord: booking.discord,
    };
    const purchases = readJson(purchasesKey, []);
    if (!booking.paid) {
      localStorage.setItem(purchasesKey, JSON.stringify([...(Array.isArray(purchases) ? purchases : []), { id: crypto.randomUUID?.() || String(Date.now()), buyerUsername: user.username || 'guest', items: [item], total: price(), status: 'Confirmed', purchasedAt: new Date().toISOString() }]));
    }
    booking.paid = true;
  }

  function renderConfirmed() {
    const firstSession = booking.sessions[0] || { date: booking.date, time: '' };
    const date = getSessionDate(firstSession);
    return `<section class="booking-confirmed"><div class="booking-success-mark">${icon('check')}<i></i></div><h1>Your Coaching Session Is Confirmed! 🎉</h1><p>Your booking with ${escapeHtml(coach.name)} has been confirmed.<br>Your coach has received your goal and session details.</p><span class="booking-notified">✓ Coach notified</span>
      <article class="booking-summary"><h2>Booking Summary</h2><div><span class="booking-summary-avatar ${coach.image ? 'has-image' : ''}" ${coach.image ? `style="--booking-coach-image:url('${escapeHtml(coach.image)}')"` : ''}>${coach.image ? '' : escapeHtml(initials())}</span><small>Coach</small><strong>${escapeHtml(coach.name)} <em>✓</em><b>${icon('shield')} ${escapeHtml(coach.service || 'Diamond Coach')}</b></strong></div><div><span class="pink">${icon(selectedPackage().id === 'single' ? 'rocket' : 'growth')}</span><small>Session Option</small><strong>${selectionTitle()}<b>${selectedPackage().sessions} Session${selectedPackage().sessions === 1 ? ' · No subscription' : 's'}</b></strong></div><div><span class="purple">${icon('calendar')}</span><small>First Session</small><strong>${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${dateLabel(date)}<b>${escapeHtml(firstSession.time)}</b></strong></div><div><span class="purple">${icon('target')}</span><small>Your Goal</small><strong>${escapeHtml(summaryGoal())}</strong></div><div><span class="green">${icon('lari')}</span><small>Total Paid</small><strong class="paid">${money(price())}</strong></div></article>
      <h2 class="booking-next-title">What happens next?</h2><div class="booking-next-steps"><article><span>${icon('mail')}</span><div><strong>1. Coach receives your goal</strong><p>${escapeHtml(coach.name)} has received your goal and session details.</p></div></article><i>${icon('arrowRight')}</i><article><span>${icon('bell')}</span><div><strong>2. Session reminder</strong><p>You'll get a reminder before your session starts.</p></div></article><i>${icon('arrowRight')}</i><article><span>${icon('monitor')}</span><div><strong>3. Join from dashboard</strong><p>Join your session at the scheduled time from your dashboard.</p></div></article></div>
      <div class="booking-confirm-actions"><a href="profile.html?section=coaching">${icon('grid')} Go to My Coaching ${icon('arrowRight')}</a><a href="index.html">${icon('home')} Back to Home</a></div>${secureNote('You can manage your sessions from your dashboard.')}</section>`;
  }

  function render() {
    document.title = `${coach.name} — Book Coaching | WaveHub`;
    root.innerHTML = `<div class="booking-shell">${header()}<div class="booking-stage">${[renderPackage, renderSchedule, renderGoal, renderReview, renderPayment, renderConfirmed][booking.step - 1]()}</div></div>`;
    root.dataset.step = booking.step;
    save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToStep(step, push = true) {
    booking.step = Math.min(6, Math.max(1, step));
    const url = new URL(window.location.href);
    url.searchParams.set('step', booking.step);
    if (push) history.pushState({ step: booking.step }, '', url);
    render();
  }

  function setError(message) {
    const error = document.getElementById('bookingFormError');
    if (error) error.textContent = message;
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const packageButton = target.closest('[data-package]');
    const dateButton = target.closest('[data-date]');
    const timeButton = target.closest('[data-time]');
    const removeSlot = target.closest('[data-remove-slot]');
    const goStep = target.closest('[data-go-step]');

    if (packageButton) {
      const option = packages.find((item) => item.id === packageButton.dataset.package);
      if (!option || (coach.isRealCoachListing && option.sessions > availableSlotCount)) return;
      booking.packageId = option.id;
      booking.sessions = booking.sessions.slice(0, selectedPackage().sessions);
      render();
      return;
    }
    if (dateButton) { booking.date = dateButton.dataset.date; render(); return; }
    if (target.closest('[data-toggle-dates]')) { booking.showAllDates = !booking.showAllDates; render(); return; }
    if (timeButton) {
      const time = timeButton.dataset.time;
      const exists = booking.sessions.some((session) => session.date === booking.date && session.time === time);
      booking.sessions = exists
        ? booking.sessions.filter((session) => !(session.date === booking.date && session.time === time))
        : booking.sessions.length < selectedPackage().sessions
          ? [...booking.sessions, { date: booking.date, time }]
          : booking.sessions;
      render(); return;
    }
    if (removeSlot) { booking.sessions.splice(Number(removeSlot.dataset.removeSlot), 1); render(); return; }
    if (target.closest('[data-clear-times]')) { booking.sessions = []; render(); return; }
    if (goStep) { goToStep(Number(goStep.dataset.goStep)); return; }
    if (target.closest('[data-back]')) { goToStep(booking.step - 1); return; }
    if (target.closest('[data-next]')) {
      if (booking.step === 2 && booking.sessions.length !== selectedPackage().sessions) { setError(`Please select ${selectedPackage().sessions} time slot${selectedPackage().sessions === 1 ? '' : 's'} to continue.`); return; }
      if (booking.step === 3) {
        booking.goal = document.getElementById('bookingGoal')?.value.trim() || '';
        booking.challenges = document.getElementById('bookingChallenges')?.value.trim() || '';
        booking.discord = document.getElementById('bookingDiscord')?.value.trim() || '';
        if (!booking.goal) { setError('Please describe your goal to continue.'); return; }
        if (!booking.discord) { setError('Please add your Discord username to continue.'); return; }
      }
      if (booking.step === 5) persistPurchase();
      goToStep(booking.step + 1);
    }
  });

  root.addEventListener('input', (event) => {
    if (event.target.id === 'bookingGoal') { booking.goal = event.target.value; document.getElementById('goalCount').textContent = booking.goal.length; }
    if (event.target.id === 'bookingChallenges') { booking.challenges = event.target.value; document.getElementById('challengeCount').textContent = booking.challenges.length; }
    if (event.target.id === 'bookingDiscord') { booking.discord = event.target.value; }
    save();
  });

  window.addEventListener('popstate', () => {
    booking.step = Math.min(6, Math.max(1, Number(new URLSearchParams(location.search).get('step')) || 1));
    render();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== cartKey && event.key !== purchasesKey) return;
    coach = getCoach();
    availableDates = getDates();
    availableSlotCount = availableDates.reduce((total, item) => total + item.times.length, 0);
    if (!availableDates.some((item) => item.key === booking.date)) {
      booking.date = availableDates.find((item) => item.times.length)?.key || availableDates[0]?.key || '';
    }
    if (!booking.paid) {
      const liveSlots = new Set(availableDates.flatMap((item) => item.times.map((time) => `${item.key}|${time}`)));
      booking.sessions = booking.sessions.filter((session) => liveSlots.has(`${session.date}|${session.time}`));
    }
    if (coach.isRealCoachListing && selectedPackage().sessions > availableSlotCount) {
      booking.packageId = [...packages].reverse().find((item) => item.sessions <= availableSlotCount)?.id || 'single';
      booking.sessions = booking.sessions.slice(0, selectedPackage().sessions);
    }
    render();
  });

  render();
}());
