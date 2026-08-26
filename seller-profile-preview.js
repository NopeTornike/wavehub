(() => {
  const modal = document.createElement('div');
  modal.className = 'seller-profile-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="seller-profile-backdrop" data-preview-close></div>
    <section class="seller-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="quickSellerName">
      <button class="seller-profile-close" type="button" data-preview-close aria-label="Close profile">×</button>
      <header class="seller-profile-header">
        <div class="seller-profile-person">
          <span class="seller-profile-photo" data-preview-photo><b data-preview-initials></b><i aria-label="Online"></i></span>
          <div class="seller-profile-identity">
            <h2><span id="quickSellerName" data-preview-name></span><b data-preview-verified aria-label="Verified" hidden>✓</b></h2>
            <div><strong data-preview-handle></strong><span data-preview-role></span></div>
            <p data-preview-bio></p>
            <small><span>⌖ <b data-preview-location></b></span><span>▣ Member since <b data-preview-member></b></span></small>
          </div>
        </div>
        <div class="seller-rank-card">
          <span class="seller-rank-emblem">W</span>
          <div><small>RANK</small><strong data-preview-rank></strong><span>WaveHubX Rank</span></div>
          <p><span></span><small>Next: <b>PRIME</b></small></p>
        </div>
      </header>
      <div class="seller-profile-stats">
        <div><strong data-preview-rating></strong><small>RATING</small><span>★★★★★</span></div>
        <div><strong data-preview-sales></strong><small>TOTAL SALES</small><span>Completed Orders</span></div>
        <div><strong><span data-preview-score></span><small data-preview-score-suffix>/100</small></strong><small>WV SCORE</small><span data-preview-score-note></span></div>
      </div>
      <section class="seller-profile-reviews">
        <header><h3>☵ &nbsp; REVIEWS <small data-preview-reviews></small></h3><a data-preview-full href="#">View all reviews →</a></header>
        <div data-preview-review-list></div>
      </section>
      <footer class="seller-profile-actions">
        <a class="seller-message-action" data-preview-message href="messages.html"><span>▣</span><b>Message<small>Chat with seller</small></b><i>→</i></a>
        <a class="seller-view-action" data-preview-full href="#">View Full Profile <span>→</span></a>
      </footer>
    </section>`;
  document.body.appendChild(modal);

  let lastTrigger = null;
  const setText = (selector, value) => { modal.querySelector(selector).textContent = value; };
  const formatDate = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Date unavailable';
  };
  const renderReviews = reviews => {
    const list = modal.querySelector('[data-preview-review-list]');
    list.replaceChildren();
    if (!reviews.length) {
      const empty = document.createElement('p');
      empty.className = 'seller-profile-reviews-empty';
      empty.textContent = 'No reviews yet.';
      list.appendChild(empty);
      return;
    }
    reviews.slice(0, 3).forEach((review, index) => {
      const article = document.createElement('article');
      const avatar = document.createElement('span');
      avatar.className = `seller-review-avatar${index === 1 ? ' alt' : index === 2 ? ' warm' : ''}`;
      if (review.photo) {
        avatar.style.backgroundImage = `url("${String(review.photo).replace(/"/g, '%22')}")`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
      } else avatar.textContent = review.initials || '?';
      const copy = document.createElement('div');
      const heading = document.createElement('h4');
      heading.textContent = review.name || review.username || 'WaveHub member';
      const stars = document.createElement('b');
      const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
      stars.textContent = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
      const comment = document.createElement('p');
      comment.textContent = review.comment || 'No written comment.';
      const time = document.createElement('time');
      time.textContent = formatDate(review.createdAt);
      copy.append(heading, stars, comment);
      article.append(avatar, copy, time);
      list.appendChild(article);
    });
  };
  const close = () => {
    modal.classList.remove('is-open');
    document.body.classList.remove('seller-profile-open');
    window.setTimeout(() => { modal.hidden = true; lastTrigger?.focus(); }, 180);
  };
  modal.querySelectorAll('[data-preview-close]').forEach(button => button.addEventListener('click', close));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });

  window.openSellerProfilePreview = (profile, trigger) => {
    lastTrigger = trigger || document.activeElement;
    const photo = modal.querySelector('[data-preview-photo]');
    setText('[data-preview-initials]', profile.initials || '?');
    photo.style.backgroundImage = profile.photo ? `url("${String(profile.photo).replace(/"/g, '%22')}")` : '';
    photo.style.backgroundSize = profile.photo ? 'cover' : '';
    photo.style.backgroundPosition = profile.photo ? 'center' : '';
    setText('[data-preview-name]', profile.name || 'Wave Seller');
    setText('[data-preview-handle]', `@${profile.username || 'seller'}`);
    setText('[data-preview-bio]', profile.bio || 'This member has not added a bio yet.');
    setText('[data-preview-location]', profile.location || 'Not provided');
    setText('[data-preview-member]', profile.member || 'Not available');
    setText('[data-preview-role]', profile.role || 'WaveHub member');
    modal.querySelector('[data-preview-verified]').hidden = !profile.verified;
    setText('[data-preview-rank]', profile.rank || 'UNRANKED');
    setText('[data-preview-rating]', profile.rating || '—');
    setText('[data-preview-sales]', profile.sales || '0');
    setText('[data-preview-score]', profile.score ?? '—');
    modal.querySelector('[data-preview-score-suffix]').hidden = profile.score === null || profile.score === undefined;
    setText('[data-preview-score-note]', profile.score === null || profile.score === undefined ? 'No score yet' : 'Based on seller rating');
    setText('[data-preview-reviews]', `(${profile.reviewCount || 0})`);
    renderReviews(Array.isArray(profile.reviews) ? profile.reviews : []);
    modal.querySelectorAll('[data-preview-full]').forEach(link => { link.href = profile.url || '#'; });
    modal.querySelector('[data-preview-message]').href = profile.username
      ? `messages.html?to=${encodeURIComponent(profile.username)}`
      : 'messages.html';
    modal.hidden = false;
    document.body.classList.add('seller-profile-open');
    requestAnimationFrame(() => { modal.classList.add('is-open'); modal.querySelector('.seller-profile-close').focus(); });
  };
})();
