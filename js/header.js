/* header.js — */

(function () {
  const PROFILE_IMAGE_STORAGE_KEY = 'havenhub_profile_image';
  const TOKEN_STORAGE_KEY = 'havenhub_token';
  const USER_STORAGE_KEY = 'havenhub_user';
  const UPLOAD_TRIGGER_ID = 'changePhotoBtn'; // matches seekers-settings.html's real button id
  const SETTINGS_PREVIEW_ID = 'settingsAvatar'; // the larger photo preview on seekers-settings.html

  document.addEventListener('DOMContentLoaded', init);
  // If header.js is loaded dynamically *after* DOMContentLoaded already fired
  // (as thread.html does once it injects header.html), run immediately too.
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    init();
  }

  let initialized = false;
  function init() {
    if (initialized) return; // guard against double-init from the two triggers above
    const avatarBtn = document.getElementById('headerAvatarBtn');
    if (!avatarBtn) return; // header markup isn't in the DOM yet
    initialized = true;

    const avatarWrap = avatarBtn.closest('.header-avatar-wrap');
    const avatarInput = document.getElementById('headerAvatarInput');
    const avatarImg = document.getElementById('headerAvatarImg');
    const logoutBtn = document.getElementById('logoutBtn');
    const notificationBtn = document.getElementById('navNotificationBtn');
    const notificationDot = document.getElementById('navNotificationDot');

    // ---------------- 1. Profile photo: load + persist across pages ----------------

    const savedAvatar = localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
    if (savedAvatar) {
      if (avatarImg) avatarImg.src = savedAvatar;
      const settingsPreview = document.getElementById(SETTINGS_PREVIEW_ID);
      if (settingsPreview) settingsPreview.src = savedAvatar;
    }

    function applyUploadedPhoto(base64Data) {
      if (avatarImg) avatarImg.src = base64Data;
      try { localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, base64Data); } catch (e) {
        console.error('Could not save profile photo (localStorage full or unavailable):', e);
      }
      // Mirror onto the settings page's own larger preview image, if present.
      const settingsPreview = document.getElementById(SETTINGS_PREVIEW_ID);
      if (settingsPreview) settingsPreview.src = base64Data;
    }

    avatarInput?.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => applyUploadedPhoto(e.target.result);
      reader.readAsDataURL(file);
    });

    // Photo upload is triggered only by the settings page's own button,
    // never by clicking the avatar (see UPLOAD_TRIGGER_ID above).
    const uploadPhotoBtn = document.getElementById(UPLOAD_TRIGGER_ID);
    uploadPhotoBtn?.addEventListener('click', () => avatarInput?.click());

    // ---------------- 2. Avatar click: always toggles the account/logout menu ----------------

    if (logoutBtn) {
      logoutBtn.style.display = 'none'; // hidden until the avatar is clicked
      if (avatarWrap) {
        avatarWrap.style.position = avatarWrap.style.position || 'relative';
        logoutBtn.style.position = 'absolute';
        logoutBtn.style.top = 'calc(100% + 8px)';
        logoutBtn.style.right = '0';
        logoutBtn.style.zIndex = '50';
      }
    }

    function isMenuOpen() {
      return !!logoutBtn && logoutBtn.style.display !== 'none';
    }

    function openMenu() {
      if (!logoutBtn) return;
      logoutBtn.style.display = 'block';
      avatarBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      if (!logoutBtn) return;
      logoutBtn.style.display = 'none';
      avatarBtn.setAttribute('aria-expanded', 'false');
    }

    function logout() {
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch (e) { /* ignore */ }
      window.location.href = 'login.html';
    }

    avatarBtn.addEventListener('click', () => {
      if (isMenuOpen()) {
        logout();
      } else {
        openMenu();
      }
    });

    logoutBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      logout();
    });

    document.addEventListener('click', (e) => {
      if (!avatarWrap) return;
      if (isMenuOpen() && !avatarWrap.contains(e.target)) closeMenu();
    });

//     // ---------------- 3. Notifications ----------------

//     const checkAdminNotifications = async () => {
//       try {
//         if (!window.api) return;
//           const updates = await window.api.get('/admin/announcements');
//         if (updates && updates.hasNewAnnouncements) {
//           if (notificationDot) notificationDot.style.display = 'block';
//         }
//       } catch (e) {
//         console.warn('Administrative tracker update stream offline.');
//       }
//     };

//     notificationBtn?.addEventListener('click', () => {
//       if (notificationDot) notificationDot.style.display = 'none';
//       alert('Admin Updates: Your uploaded real-estate documents have been submitted to the verification matrix successfully!');
//     });

//     checkAdminNotifications();
//   }
// })();
    // ---------------- 3. Notifications ----------------

    const checkAdminNotifications = async () => {
      try {
        if (!window.api) return;

        // 1. Safety Guard: Check if the user is an admin.
        // Regular seekers and landlords don't have access to /admin endpoints.
        const currentRole = (localStorage.getItem('selectedRole') || '').toUpperCase().trim();
        if (currentRole !== 'ADMIN') {
          console.log('Skipping admin announcement synchronization for non-admin profile role.');
          return; 
        }
        
        // 2. Only make the network call if the user is authenticated as an Admin
        const response = await window.api.get('/admin/announcements');
        const updates = response?.data || response;
        
        if (updates && (updates.hasNewAnnouncements || updates.hasNew)) {
          if (notificationDot) notificationDot.style.display = 'block';
        }
      } catch (e) {
        console.warn('Administrative tracker updates bypassed:', e.message);
      }
    };

    notificationBtn?.addEventListener('click', () => {
      if (notificationDot) notificationDot.style.display = 'none';
      alert('Admin Updates: Your uploaded real-estate documents have been submitted to the verification matrix successfully!');
    });

    checkAdminNotifications();
  }
})();
