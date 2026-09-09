/* ==========================================================================
   js/sidenav-loader.js — Administrative Async Sidenav Layout Fragment Mount Engine
   ========================================================================== */

(function () {
  function loadSidenavFragment() {
    const mount = document.getElementById('sidenav-placeholder');
    if (!mount) {
      console.error('sidenav-loader.js: #sidenav-placeholder element target missing from DOM structure template.');
      return;
    }

    // Async load your external layout partial template file asset structure
    fetch('sidenav.html')
      .then((res) => {
        if (!res.ok) throw new Error(`Network fault encountered: status code ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Target your explicit second template layout shell wrapper hook
        const asideEl = doc.querySelector('aside.admin-sidebar') || doc.querySelector('aside');
        
        if (asideEl) {
          mount.replaceWith(asideEl);
        } else {
          mount.innerHTML = html;
        }

        // IMPORTANT FIX: Broadcasts the loaded notification cue so sidebar-toggle.js can bind immediately
        window.dispatchEvent(new Event('partialsLoaded'));
      })
      .then(() => {
        // Sequentially initialize script tracking layers down the body anchor tag elements
        ['js/moderation-init.js', 'js/sidebar-toggle.js'].forEach((src) => {
          // Prevent resource duplication scripts if they already exist inside the document context
          if (document.querySelector(`script[src="${src}"]`)) return;

          const scriptTag = document.createElement('script');
          scriptTag.src = src;
          scriptTag.async = true; // Non-blocking asynchronous ingestion optimization flag applied
          document.body.appendChild(scriptTag);
        });
      })
      .catch((err) => {
        console.error('Could not map global side navigation footprint layouts:', err);
        mount.innerHTML = `<div style="padding:16px; color:#ef4444; font-weight:600;">Failed to render sidebar pipeline layout components (${escapeHtml(err.message)}).</div>`;
      });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Fire fragment compilation instantly upon asset evaluation loop
  loadSidenavFragment();
})();
