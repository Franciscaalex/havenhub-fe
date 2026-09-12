/* ============================================================
   js/sidebar.js
   Handles responsive drawer triggers and authenticates profile parameters
   ============================================================ */

window.addEventListener('partialsLoaded', () => {
  const sidebar = document.getElementById('dashSidebar');
  const toggleBtn = document.getElementById('sidebarMobileToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const logoutBtn = document.getElementById('sidebarLogoutBtn');

  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRole = document.querySelector('.dash-profile-role');
  const sidebarAvatar = document.querySelector('.dash-profile-avatar');

  console.log("Sidebar partial elements verified. Initializing active event hooks...");

  /* ---------- 1. RESPONSIVE MOBILE DRAWER INTERACTION ---------- */
  function openMobileSidebar() {
    sidebar?.classList.add('sidebar-open');
    if (overlay) {
      overlay.style.display = 'block';
      setTimeout(() => overlay.style.opacity = '1', 10);
    }
  }

  function closeMobileSidebar() {
    sidebar?.classList.remove('sidebar-open');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.style.display = 'none', 250);
    }
  }

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = sidebar?.classList.contains('sidebar-open');
    if (isOpen) closeMobileSidebar();
    else openMobileSidebar();
  });

  overlay?.addEventListener('click', closeMobileSidebar);

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      closeMobileSidebar();
    }
  });

  /* ---------- 1b. ACTIVE NAV LINK PERSISTENCE ---------- */
  function highlightActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.dash-nav-link[data-page]');

    navLinks.forEach(link => {
      if (link.dataset.page === currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  highlightActiveNavLink();

  /* ---------- 2. DYNAMIC REAL-TIME PROFILE REHYDRATION (API-DRIVEN) ---------- */
  async function fetchAndRehydrateProfile() {
    try {
      if (!window.api) {
        throw new Error("api.js framework core reference is missing.");
      }

      // Step A: Load immediate values from cache first to guarantee a fast, flash-free layout paint
      applyLocalCacheProfileData();

      const response = await window.api.get('/users/me');
      const serverUserObject = response?.data || response;

      if (!serverUserObject) return;

      console.log("Sidebar real-time profile data synchronized:", serverUserObject);

      const firstName = serverUserObject.firstName || '';
      const lastName = serverUserObject.lastName || '';
      const serverName = firstName && lastName ? `${firstName} ${lastName}` : (serverUserObject.name || serverUserObject.username);
      const serverRole = serverUserObject.role || '';

      // FIX: "avatarUrl" was missing from this fallback chain. That's the
      // field name actually used by /users/me, the photo-upload response,
      // and settings.js — without it, this always fell through to the
      // cached/default image even when the server had a real photo.
      const serverAvatarUrl = serverUserObject.avatarUrl || serverUserObject.avatar || serverUserObject.profilePicture || serverUserObject.imageUrl || '';

      if (sidebarUserName && serverName) {
        sidebarUserName.textContent = serverName;
        localStorage.setItem('username', serverName);
      }

      if (sidebarUserRole && serverRole) {
        formatAndDisplayUserRoleLabel(serverRole);
        localStorage.setItem('selectedRole', serverRole.toUpperCase());
      }

      if (sidebarAvatar && serverAvatarUrl && serverAvatarUrl.trim() !== "") {
        sidebarAvatar.src = serverAvatarUrl;
        localStorage.setItem('userAvatarUrl', serverAvatarUrl);
      }

    } catch (err) {
      console.warn("Live API profile load bypassed, relying safely on local memory trace buffers:", err.message);
      applyLocalCacheProfileData();
    }
  }
  

  function applyLocalCacheProfileData() {
    if (sidebarUserName) {
      const cachedName = localStorage.getItem('username');
      if (cachedName) {
        sidebarUserName.textContent = cachedName;
      } else if (window.HavenHubSession && typeof window.HavenHubSession.getCurrentUsername === 'function') {
        sidebarUserName.textContent = window.HavenHubSession.getCurrentUsername();
      }
    }

    if (sidebarAvatar) {
      const customAvatarUrl = localStorage.getItem('userAvatarUrl') || localStorage.getItem('profilePicture');
      if (customAvatarUrl && customAvatarUrl.trim() !== "") {
        sidebarAvatar.src = customAvatarUrl;
      } else {
        sidebarAvatar.src = "images/Avatar 4.svg";
      }
    }

    if (sidebarUserRole) {
      const cachedRole = localStorage.getItem('selectedRole');
      if (cachedRole) {
        formatAndDisplayUserRoleLabel(cachedRole);
      }
    }
  }

  function formatAndDisplayUserRoleLabel(rawRoleString) {
    if (!sidebarUserRole) return;
    const formattedRole = rawRoleString
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    sidebarUserRole.textContent = formattedRole;
  }

  fetchAndRehydrateProfile();

  /* ---------- 3. SECURE LOGOUT MANAGEMENT ---------- */
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Terminating dashboard session parameters...");

    if (window.HavenHubSession && typeof window.HavenHubSession.logoutUser === 'function') {
      window.HavenHubSession.logoutUser();
    } else {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('selectedRole');
      localStorage.removeItem('userAvatarUrl');
      localStorage.removeItem('profilePicture');
      if (window.api && typeof window.api.clearSession === 'function') {
        window.api.clearSession();
      }
    }

    window.location.replace('login.html');
  });

  /*  inbox notification */

document.addEventListener('partialsLoaded', refreshSidebarInboxBadge);
// In case sidebar.js runs after partialsLoaded already fired once.
refreshSidebarInboxBadge();

async function refreshSidebarInboxBadge() {
  const badge = document.getElementById('sidebarInboxBadge');
  if (!badge || !window.api) return;

  try {
    const response = await window.api.get('/enquiries/unread-count');
    
    const unreadCount = typeof response === 'number'
      ? response
      : Number(response?.count ?? response?.unreadCount ?? 0);

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  } catch (err) {
    console.warn('Could not refresh sidebar inbox badge:', err.message);
  }
}
});