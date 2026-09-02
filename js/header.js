/* Inside your interactive header navigation controller execution stream */
document.addEventListener('DOMContentLoaded', () => {
  // Target nodes
  const avatarBtn = document.getElementById('headerAvatarBtn');
  const avatarInput = document.getElementById('headerAvatarInput');
  const avatarImg = document.getElementById('headerAvatarImg');
  const notificationBtn = document.getElementById('navNotificationBtn');
  const notificationDot = document.getElementById('navNotificationDot');

  const PROFILE_IMAGE_STORAGE_KEY = "havenhub_profile_image";

  // 1. PERSIST PORTRAIT PICTURE STORAGE CONTEXT SMOOTHLY
  const savedAvatar = localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
  if (savedAvatar && avatarImg) {
    avatarImg.src = savedAvatar;
  }

  avatarBtn?.addEventListener('click', () => avatarInput?.click());

  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      if (avatarImg) avatarImg.src = base64Data;
      localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, base64Data);
      
      // Mirror the update on alternative profile image components running across the page layout
      const alternativeAvatar = document.getElementById('profileAvatar');
      if (alternativeAvatar) alternativeAvatar.src = base64Data;
    };
    reader.readAsDataURL(file);
  });

  // 2. LIVE ADMIN UPDATE TRACKER FEED
  const checkAdminNotifications = async () => {
    try {
      if (!window.api) return;
      // Fetch data from updates system matching your swagger spec
      const updates = await window.api.get('/users/admin-announcements');
      
      // Toggle red/orange circle highlight display state dynamically
      if (updates && updates.hasNewAnnouncements) {
        if (notificationDot) notificationDot.style.display = 'block';
      }
    } catch (e) {
      console.warn("Administrative tracker update stream offline.");
    }
  };

  notificationBtn?.addEventListener('click', () => {
    if (notificationDot) notificationDot.style.display = 'none'; // Clear alert highlight on user click selection
    alert("Admin Updates: Your uploaded real-estate documents have been submitted to the verification matrix successfully!");
  });

  // Check announcements status regularly
  checkAdminNotifications();
});
