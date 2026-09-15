/* ==========================================================================
   js/sidenav-loader.js — Administrative Async Sidenav Layout Fragment Mount Engine
   ========================================================================== */

(function () {
  // Same key admin-settings.js writes to when the admin uploads a new
  // photo (as a data URL via FileReader).
  const AVATAR_STORAGE_KEY = 'adminAvatarPhoto';

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

        let mountedRoot = document;
        if (asideEl) {
          mount.replaceWith(asideEl);
          mountedRoot = asideEl;
        } else {
          mount.innerHTML = html;
          mountedRoot = mount;
        }

        wireSettingsLink(mountedRoot);
        applyStoredAvatar(mountedRoot);

        // IMPORTANT FIX: Broadcasts the loaded notification cue so sidebar-toggle.js can bind immediately
        window.dispatchEvent(new Event('partialsLoaded'));
      })
      .then(() => {
        // Sequentially initialize script tracking layers down the body anchor tag elements
        // NOTE: 'js/moderation-init.js' was removed — no such file exists, and it was
        // being requested on every page (not just moderation.html), causing a 404 on
        // every load. moderation.js already self-initializes via its own
        // DOMContentLoaded listener when the page that needs it loads it directly.
        ['js/sidebar-toggle.js'].forEach((src) => {
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

  // The Settings nav item ships with href="#" in sidenav.html, so clicking
  // it does nothing on its own — attach a real navigation handler here.
  function wireSettingsLink(root) {
    const settingsLink = (root || document).querySelector('[data-view="view-settings"]');
    if (!settingsLink) {
      console.warn('sidenav-loader.js: [data-view="view-settings"] not found — Settings link not wired.');
      return;
    }

    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'admin-settings.html';
    });
  }

  // Reads the stored avatar (a data URL saved by admin-settings.js) and,
  // if present, applies it to the sidebar's .admin-avatar image so the
  // photo carries over across page loads.
  function applyStoredAvatar(root) {
    const avatarImg = (root || document).querySelector('.admin-avatar');
    if (!avatarImg) return;
    const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (stored) avatarImg.src = stored;
  }

  // Cross-tab updates: fires in *other* tabs/windows when localStorage
  // changes here.
  window.addEventListener('storage', (e) => {
    if (e.key === AVATAR_STORAGE_KEY) applyStoredAvatar();
  });

  // Same-tab updates: admin-settings.js dispatches this right after
  // writing to localStorage — the native 'storage' event does not fire in
  // the tab that made the change, so this covers the case where the admin
  // uploads a photo and the sidenav is visible on that same page.
  window.addEventListener('adminAvatarUpdated', () => applyStoredAvatar());

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Fire fragment compilation instantly upon asset evaluation loop
  loadSidenavFragment();
})();