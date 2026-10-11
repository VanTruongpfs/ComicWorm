/* Local frontend previews use the backend's protected seller pages and JWT session. */
(function () {
  'use strict';
  const location = window.location;
  let base = window.BookMoochApiBase;
  if (base == null && location.protocol === 'file:') base = 'http://localhost:8080';
  if (base == null && ['5500', '5501'].includes(location.port)
      && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    base = `${location.protocol}//${location.hostname}:8080`;
  }
  if (!base) return;
  const target = new URL(String(base).replace(/\/$/, '') + '/seller/html/' + location.pathname.split('/').pop());
  target.search = location.search;
  target.hash = location.hash;
  if (target.origin !== location.origin) {
    document.documentElement.style.visibility = 'hidden';
    location.replace(target.href);
  }
})();
