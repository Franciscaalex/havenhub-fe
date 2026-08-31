/* ============================================================
   js/sidebar.js
   Handles responsive drawer triggers and authenticates profile parameters
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('dashSidebar');
  const toggleBtn = document.getElementById('sidebarMobileToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRole = document.querySelector('.dash-profile-role');
  const sidebarAvatar = document.querySelector('.dash-profile-avatar'); // Target image reference node

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


  /* ---------- 2. DYNAMIC PROFILE INFO & AVATAR REHYDRATION ---------- */
  
  // Rehydrate Profile Username Label
  if (sidebarUserName) {
    const cachedName = localStorage.getItem('username');
    if (cachedName) {
      sidebarUserName.textContent = cachedName;
    } else if (window.HavenHubSession && typeof window.HavenHubSession.getCurrentUsername === 'function') {
      sidebarUserName.textContent = window.HavenHubSession.getCurrentUsername();
    }
  }

  // Rehydrate Profile Settings Avatar Image
  if (sidebarAvatar) {
    // Looks for a customized uploaded profile image string from profile settings panel state saves
    const customAvatarUrl = localStorage.getItem('userAvatarUrl') || localStorage.getItem('profilePicture');
    
    if (customAvatarUrl && customAvatarUrl.trim() !== "") {
      sidebarAvatar.src = customAvatarUrl;
    } else {
      // Standard brand image fallback assets if user hasn't initialized an upload template profile yet
      sidebarAvatar.src = "images/Avatar 4.svg"; 
    }
  }

  // Rehydrate Formatted Role Badge Type Text
  if (sidebarUserRole) {
    const cachedRole = localStorage.getItem('selectedRole');
    if (cachedRole) {
      // Formats "PROPERTY_SEEKER" -> "Property Seeker", "REAL_ESTATE_AGENT" -> "Real Estate Agent"
      const formattedRole = cachedRole
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      sidebarUserRole.textContent = formattedRole;
    }
  }


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
    
    // Smooth replace navigation redirect
    window.location.replace('login.html');
  });
});
