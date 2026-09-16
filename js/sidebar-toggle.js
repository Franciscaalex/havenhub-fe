/* ==========================================================================
   js/sidenav-loader.js — Administrative Async Sidenav Layout Fragment Mount Engine
   ========================================================================== */

(function () {
  // UNIFIED KEY: Set to match the exact localStorage key used in admin-settings.js
  const AVATAR_STORAGE_KEY = 'userAvatarUrl';

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

        // WIRE CONTROLLERS: Elements are now safely mounted inside the active layout context
        wireSettingsLink(mountedRoot);
        wireLogoutButton(mountedRoot); // FIXED: Added to the execution sequence!
        applyStoredAvatar(mountedRoot);

        // IMPORTANT FIX: Broadcasts the loaded notification cue so sidebar-toggle.js can bind immediately
        window.dispatchEvent(new Event('partialsLoaded'));
      })
      .then(() => {
        // Sequentially initialize script tracking layers down the body anchor tag elements
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

  // FIXED: Executed seamlessly upon template load boundaries to process session clearouts
  function wireLogoutButton(root) {
    const logoutBtn = (root || document).querySelector('#logoutBtn');
    if (!logoutBtn) {
      console.warn('sidenav-loader.js: #logoutBtn not found — Log Out button not wired.');
      return;
    }
 
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log("Logout triggered. Clearing operational application context parameters.");

      // Wipe core storage vectors safely
      if (window.api && typeof window.api.clearSession === 'function') {
        window.api.clearSession();
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expiry');
      }

      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('selectedRole');
      localStorage.removeItem('username');
      sessionStorage.clear();

      if (window.HavenHubSession && typeof window.HavenHubSession.logoutUser === 'function') {
        window.HavenHubSession.logoutUser();
      }

      // Bounce the user directly out to the auth terminal screen layout
      window.location.href = 'login.html';
    });
  }
 
  // Reads the stored avatar and applies it to the sidebar's image
  function applyStoredAvatar(root) {
    const avatarImg = (root || document).querySelector('.admin-avatar');
    if (!avatarImg) return;
    const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (stored) avatarImg.src = stored;
  }

  // Cross-tab updates: fires in *other* tabs/windows when localStorage changes here.
  window.addEventListener('storage', (e) => {
    if (e.key === AVATAR_STORAGE_KEY) applyStoredAvatar();
  });

  // Same-tab updates: handled right after admin writes change data parameters
  window.addEventListener('adminAvatarUpdated', () => applyStoredAvatar());

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Fire fragment compilation instantly upon asset evaluation loop
  loadSidenavFragment();
})();
