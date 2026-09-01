(() => {
  if (document.querySelector('.site-footer')) return;

  const icon = (path, viewBox = '0 0 24 24') => `
    <svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${path}</svg>`;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.setAttribute('aria-label', 'WaveHubX footer');
  footer.innerHTML = `
    <div class="site-footer-main">
      <section class="site-footer-brand" aria-labelledby="footerBrandTitle">
        <a href="index.html" class="site-footer-logo" aria-label="WaveHubX home">
          <img src="assets/logo-wavehubx-main.png" alt="WaveHubX" />
          <span id="footerBrandTitle">Play. Connect. Earn.</span>
        </a>
        <p>WaveHubX is the ultimate gaming marketplace. Buy, sell and improve your skills with trusted coaches. Everything you need — all in one place.</p>
        <ul class="site-footer-trust">
          <li>${icon('<path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z"/>')}<span><strong>Secure Transactions</strong><small>Your safety is our priority.</small></span></li>
          <li>${icon('<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v6h4v-6H4Zm16 0h2v6h-4v-6h2ZM18 20c0 1.2-1.4 2-3.5 2"/>')}<span><strong>24/7 Support</strong><small>We are here to help anytime.</small></span></li>
          <li>${icon('<circle cx="12" cy="10" r="6"/><path d="m8 16-1 5 5-2 5 2-1-5M9.5 10.2l1.7 1.7 3.4-3.6"/>')}<span><strong>Trusted Platform</strong><small>Fair play and transparency.</small></span></li>
          <li>${icon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 14a5 5 0 0 1 6 5v1"/>')}<span><strong>Growing Community</strong><small>Join thousands of gamers.</small></span></li>
        </ul>
      </section>

      <nav class="site-footer-column" aria-labelledby="footerCompanyTitle">
        <h2 id="footerCompanyTitle">${icon('<path d="M4 21V5h10v16M14 9h6v12M7 9h2M7 13h2M7 17h2M11 9h1M11 13h1M11 17h1M17 13h1M17 17h1M2 21h20"/>')}<span>Company</span></h2>
        <a href="about-us.html">About Us</a>
        <a href="contact-information.html">Contact Information</a>
      </nav>

      <nav class="site-footer-column site-footer-legal" aria-labelledby="footerLegalTitle">
        <h2 id="footerLegalTitle">${icon('<path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z"/><path d="M9 11a3 3 0 0 0 6 0V9M12 8v3"/>')}<span>Legal</span></h2>
        <a href="terms-of-service.html">Terms of Service</a>
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="refund-cancellation.html">Refund &amp; Cancellation Policy</a>
        <a href="delivery-policy.html">Delivery Policy</a>
        <a href="about.html#payments">Payment &amp; Pricing Policy</a>
        <a href="about.html#wallet">Wallet Policy</a>
        <a href="dispute-resolution.html">Dispute Resolution Policy</a>
      </nav>

      <nav class="site-footer-column" aria-labelledby="footerCommunityTitle">
        <h2 id="footerCommunityTitle">${icon('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M14 14a5 5 0 0 1 7 4.5V20"/>')}<span>Community</span></h2>
        <a href="community-guidelines.html">Community Guidelines</a>
        <a href="seller-standards.html">Seller Standards &amp; Code of Conduct</a>
        <a href="coach-standards.html">Coach Standards &amp; Code of Conduct</a>
      </nav>
    </div>

    <div class="site-footer-bottom">
      <p>© 2026 <strong>WaveHubX.</strong> All rights reserved.</p>
      <div class="site-footer-socials" aria-label="Social media">
        <b>Follow us</b>
        <span aria-hidden="true"></span>
        <a class="discord" href="https://discord.gg/4nqVTBA4d" target="_blank" rel="noopener" aria-label="Discord">${icon('<path d="M7 7c3-1.5 7-1.5 10 0 1.5 2 2.2 4.2 2.4 7-2 1.5-3.4 2-4.8 2.3l-1.1-1.4M17 7l-1-2M7 7 8 5M9 13h.1M15 13h.1M9 17c2 .8 4 .8 6 0"/>')}</a>
        <a class="instagram" href="https://www.instagram.com/wavehubx/" target="_blank" rel="noopener" aria-label="Instagram">${icon('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>')}</a>
        <a class="facebook" href="https://www.facebook.com/profile.php?id=61592006158520" target="_blank" rel="noopener" aria-label="Facebook">${icon('<path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z"/>')}</a>
        <a class="youtube" href="https://youtube.com" target="_blank" rel="noopener" aria-label="YouTube">${icon('<path d="M21 8.2a3 3 0 0 0-2.1-2.1C17.1 5.6 12 5.6 12 5.6s-5.1 0-6.9.5A3 3 0 0 0 3 8.2 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.8a3 3 0 0 0 2.1 2.1c1.8.5 6.9.5 6.9.5s5.1 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8Z"/><path d="m10 9 5 3-5 3V9Z"/>')}</a>
        <a class="tiktok" href="https://www.tiktok.com/@wavehubx" target="_blank" rel="noopener" aria-label="TikTok">${icon('<path d="M14 4v11.2a4.2 4.2 0 1 1-3.6-4.2M14 4c.5 3 2.2 4.5 5 4.8"/>')}</a>
      </div>
      <label class="site-footer-language">
        ${icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>')}
        <select aria-label="Language"><option value="en">EN</option><option value="ka">KA</option></select>
      </label>
    </div>`;

  document.body.appendChild(footer);
})();
