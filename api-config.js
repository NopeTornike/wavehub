(function () {
  // Set this during deployment only when the API is hosted on another origin.
  // Example: const deployedApiUrl = 'https://api.wavehub.ge';
  const deployedApiUrl = '';
  const configuredUrl = window.WAVEHUB_API_URL
    || document.querySelector('meta[name="wavehub-api-url"]')?.content
    || deployedApiUrl;
  const apiUrl = String(configuredUrl || '').trim().replace(/\/$/, '');
  const isLocalHost = window.location.protocol === 'file:'
    || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.wavehubApiUrls = () => {
    if (apiUrl) return [apiUrl];
    if (isLocalHost) return ['http://localhost:4000', 'http://127.0.0.1:4000'];
    return [window.location.origin];
  };
}());
