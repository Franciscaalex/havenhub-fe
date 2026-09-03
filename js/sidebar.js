/* ============================================================
   js/sidebar.js
   Handles responsive drawer triggers and authenticates profile parameters
   ============================================================ */

// FIXED: Wrapped the initialization sequence safely inside the partialsLoaded event listener
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

  // Open sidebar on hamburger click
  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = sidebar?.classList.contains('sidebar-open');
    if (isOpen) closeMobileSidebar(); 
    else openMobileSidebar();
  });

  // Close when tapping outside onto the dimmed overlay screen
  overlay?.addEventListener('click', closeMobileSidebar);

  // Close automatically if window gets resized back to large layout viewports
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

      // Step B: Query your actual NestJS backend database server for the absolute latest profile state
      // Traverses common user routes (/users/me or /users/profile) safely
      let serverUserObject;
      try {
        const response = await window.api.get('/users/profile');
        serverUserObject = response?.data || response;
      } catch (apiErr) {
        console.warn("Retrying profile lookup on alternative target endpoint path...");
        const responseFallback = await window.api.get('/users/me');
        serverUserObject = responseFallback?.data || responseFallback;
      }

      if (!serverUserObject) return;

      console.log("Sidebar real-time profile data synchronized:", serverUserObject);

      // Step C: Extract property attributes cleanly from the database record payload
      const firstName = serverUserObject.firstName || '';
      const lastName = serverUserObject.lastName || '';
      const serverName = firstName && lastName ? `${firstName} ${lastName}` : (serverUserObject.name || serverUserObject.username);
      const serverRole = serverUserObject.role || '';
      const serverAvatarUrl = serverUserObject.avatar || serverUserObject.profilePicture || serverUserObject.imageUrl || '';

      // Step D: Inject live database string values into the sidebar UI text tags dynamically
      if (sidebarUserName && serverName) {
        sidebarUserName.textContent = serverName;
        localStorage.setItem('username', serverName); // Keep cache warm for other view layers
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
      // Fallback permanently to local cache parameters if connection drops or endpoint requires custom params
      applyLocalCacheProfileData();
    }
  }

  function applyLocalCacheProfileData() {
    // Rehydrate Profile Username Label from history traces
    if (sidebarUserName) {
      const cachedName = localStorage.getItem('username');
      if (cachedName) {
        sidebarUserName.textContent = cachedName;
      } else if (window.HavenHubSession && typeof window.HavenHubSession.getCurrentUsername === 'function') {
        sidebarUserName.textContent = window.HavenHubSession.getCurrentUsername();
      }
    }

    // Rehydrate Profile Settings Avatar Image from history traces
    if (sidebarAvatar) {
      const customAvatarUrl = localStorage.getItem('userAvatarUrl') || localStorage.getItem('profilePicture');
      if (customAvatarUrl && customAvatarUrl.trim() !== "") {
        sidebarAvatar.src = customAvatarUrl;
      } else {
        sidebarAvatar.src = "images/Avatar 4.svg"; 
      }
    }

    // Rehydrate Formatted Role Badge Type Text from history traces
    if (sidebarUserRole) {
      const cachedRole = localStorage.getItem('selectedRole');
      if (cachedRole) {
        formatAndDisplayUserRoleLabel(cachedRole);
      }
    }
  }

  function formatAndDisplayUserRoleLabel(rawRoleString) {
    if (!sidebarUserRole) return;
    // Formats uppercase backend constants cleanly into readable names: 
    // "PROPERTY_SEEKER" -> "Property Seeker", "LANDLORD" -> "Landlord"
    const formattedRole = rawRoleString
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    sidebarUserRole.textContent = formattedRole;
  }

  // Execute the profile synchronization loop immediately upon layout mount completion
  fetchAndRehydrateProfile();


  /* ---------- 3. SECURE LOGOUT MANAGEMENT ---------- */
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Terminating dashboard session parameters...");
    
    // Clear auth credentials via global hook framework
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
    
    // Smooth replace navigation redirect to clean stack history tracking panels
    window.location.replace('login.html');
  });
});
