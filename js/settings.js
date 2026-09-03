/* ============================================================
   settings.js

   Wires every button on the Settings page to the API:
   - Loads current profile on page load (GET) & syncs sidebar
   - Save changes → PUT (updates first/last name + phone)
   - Change Photo → file picker → upload (POST, multipart)
   - Change Password → opens modal → Update Password → PUT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  wireCloseSettings();
  wireProfileForm();
  wirePhotoUpload();
  wirePasswordModal();
});

/* ---------- Load current profile into the form & sidebar ---------- */

async function loadProfile() {
  const statusEl = document.getElementById('profileStatus');
  try {
    const user = await window.api.get('/users/me');

    // Populate Settings Form
    document.getElementById('firstName').value = user.firstName ?? '';
    document.getElementById('lastName').value = user.lastName ?? '';
    document.getElementById('emailAddress').value = user.email ?? '';
    document.getElementById('phoneNumber').value = user.phone ?? '';

    if (user.avatarUrl) {
      document.getElementById('avatarPreview').src = user.avatarUrl;
    }

    // Sync Sidebar Display
    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName && user.firstName) {
      sidebarName.textContent = user.firstName;
    }

    const sidebarAvatar = document.querySelector('.dash-profile-avatar');
    if (sidebarAvatar && user.avatarUrl) {
      sidebarAvatar.src = user.avatarUrl;
    }

  } catch (err) {
    console.error('Could not load profile:', err);
    setStatus(statusEl, 'Could not load your saved profile. You can still edit and save below.', 'error');
  }
}

/* ---------- Close (X) button ---------- */

function wireCloseSettings() {
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'index.html';
    }
  });
}

/* ---------- Personal information form ---------- */

function wireProfileForm() {
  const form = document.getElementById('profileForm');
  const saveBtn = document.getElementById('saveChangesBtn');
  const statusEl = document.getElementById('profileStatus');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();

    if (!firstName || !lastName) {
      setStatus(statusEl, 'First and last name are required.', 'error');
      return;
    }

    saveBtn.disabled = true;
    setStatus(statusEl, 'Saving…', '');

    try {
      await window.api.put('/users/me', { firstName, lastName, phone });
      setStatus(statusEl, 'Changes saved.', 'success');

      // Keep sidebar name synced when saved
      const sidebarName = document.getElementById('sidebarUserName');
      if (sidebarName) sidebarName.textContent = firstName;

    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

/* ---------- Change Photo ---------- */

function wirePhotoUpload() {
  const changeBtn = document.getElementById('changePhotoBtn');
  const fileInput = document.getElementById('photoInput');
  const preview = document.getElementById('avatarPreview');
  const statusEl = document.getElementById('photoStatus');

  changeBtn?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isValidType = ['image/jpeg', 'image/png'].includes(file.type);
    const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB

    if (!isValidType) {
      setStatus(statusEl, 'Please choose a JPG or PNG file.', 'error');
      return;
    }
    if (!isValidSize) {
      setStatus(statusEl, 'File is too large — max 5MB.', 'error');
      return;
    }

    // Show local preview immediately
    const localPreviewUrl = URL.createObjectURL(file);
    const previousSrc = preview.src;
    preview.src = localPreviewUrl;

    changeBtn.disabled = true;
    setStatus(statusEl, 'Uploading…', '');

    try {
      await uploadPhoto(file);
      setStatus(statusEl, 'Photo updated.', 'success');
    } catch (err) {
      preview.src = previousSrc; // Roll back preview if upload fails
      setStatus(statusEl, err.message, 'error');
    } finally {
      changeBtn.disabled = false;
      fileInput.value = '';
    }
  });
}

async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);

  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const baseUrl = CONFIG.USE_MOCK_DATA ? CONFIG.MOCK_BASE_PATH : CONFIG.BASE_URL;
  const url = `${baseUrl}/users/me/photo`;

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch (_) { /* response wasn't JSON */ }
    throw new Error(message);
  }

  const data = await response.json();

  // Update profile and sidebar image elements directly
  const newAvatarUrl = data.avatarUrl || data.url;
  if (newAvatarUrl) {
    document.getElementById('avatarPreview').src = newAvatarUrl;
    const sidebarAvatar = document.querySelector('.dash-profile-avatar');
    if (sidebarAvatar) sidebarAvatar.src = newAvatarUrl;
  }

  return data;
}

/* ---------- Change Password modal ---------- */

function wirePasswordModal() {
  const overlay = document.getElementById('passwordModalOverlay');
  const openBtn = document.getElementById('openPasswordModalBtn');
  const closeBtn = document.getElementById('closePasswordModalBtn');
  const cancelBtn = document.getElementById('cancelPasswordBtn');
  const form = document.getElementById('passwordForm');
  const statusEl = document.getElementById('passwordStatus');
  const updateBtn = document.getElementById('updatePasswordBtn');

  const openModal = () => {
    overlay.hidden = false;
    document.getElementById('currentPassword').focus();
  };

  const closeModal = () => {
    overlay.hidden = true;
    form.reset();
    setStatus(statusEl, '', '');
    clearInvalid('currentPassword', 'newPassword', 'confirmPassword');
  };

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    clearInvalid('currentPassword', 'newPassword', 'confirmPassword');

    const strongPasswordRegex = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`]).{8,}$/;

    let isValid = true;

    if (!currentPassword) {
      markInvalid('currentPassword');
      isValid = false;
    }

    if (!strongPasswordRegex.test(newPassword)) {
      markInvalid('newPassword');
      isValid = false;
    }

    if (confirmPassword !== newPassword || !confirmPassword) {
      markInvalid('confirmPassword');
      isValid = false;
    }

    if (!isValid) {
      setStatus(statusEl, 'Please fix the highlighted fields.', 'error');
      return;
    }

    updateBtn.disabled = true;
    setStatus(statusEl, 'Updating…', '');

    try {
      await window.api.put('/users/me/password', { currentPassword, newPassword });
      setStatus(statusEl, 'Password updated. Redirecting to login…', 'success');
      setTimeout(() => {
        window.HavenHubSession?.logoutUser?.();
        window.location.href = 'login.html';
      }, 1500);
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    } finally {
      updateBtn.disabled = false;
    }
  });
}

/* ---------- Shared helpers ---------- */

function setStatus(el, message, tone) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('is-error', 'is-success');
  if (tone === 'error') el.classList.add('is-error');
  if (tone === 'success') el.classList.add('is-success');
}

function markInvalid(id) {
  document.getElementById(id)?.classList.add('is-invalid');
}

function clearInvalid(...ids) {
  ids.forEach(id => document.getElementById(id)?.classList.remove('is-invalid'));
}