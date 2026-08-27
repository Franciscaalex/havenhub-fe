/* ============================================================
   settings.js

   Wires every button on the Settings page to the API:
   - Loads the current profile on page load (GET)
   - Save changes → PUT (updates first/last name + phone)
   - Change Photo → file picker → upload (POST, multipart)
   - Change Password → opens modal → Update Password → PUT
   - Cancel / X buttons close the modal or leave the page

   IMPORTANT — endpoint paths marked ASSUMPTION below are not yet
   confirmed against the live Swagger docs (only GET /properties
   and the general API shape have been verified so far in this
   project). Update the path/response-field names in each function
   once confirmed; the request-sending logic itself won't need to
   change.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  wireCloseSettings();
  wireProfileForm();
  wirePhotoUpload();
  wirePasswordModal();
});

/* ---------- Load current profile into the form ---------- */

async function loadProfile() {
  const statusEl = document.getElementById('profileStatus');
  try {
    // ASSUMPTION: GET /users/me — not yet confirmed. Expected shape:
    // { firstName, lastName, email, phone, avatarUrl }
    const user = await window.api.get('/users/me');

    document.getElementById('firstName').value = user.firstName ?? '';
    document.getElementById('lastName').value = user.lastName ?? '';
    document.getElementById('emailAddress').value = user.email ?? '';
    document.getElementById('phoneNumber').value = user.phone ?? '';

    if (user.avatarUrl) {
      document.getElementById('avatarPreview').src = user.avatarUrl;
    }
  } catch (err) {
    // Not fatal — the form just stays blank/prefilled from whatever
    // was already in the HTML, and the person can still fill it in.
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
      // ASSUMPTION: PUT /users/me — not yet confirmed. Email is
      // intentionally excluded from the payload since it's read-only
      // in this form.
      await window.api.put('/users/me', { firstName, lastName, phone });
      setStatus(statusEl, 'Changes saved.', 'success');
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

    // Show the new photo immediately, before the upload finishes
    const localPreviewUrl = URL.createObjectURL(file);
    const previousSrc = preview.src;
    preview.src = localPreviewUrl;

    changeBtn.disabled = true;
    setStatus(statusEl, 'Uploading…', '');

    try {
      await uploadPhoto(file);
      setStatus(statusEl, 'Photo updated.', 'success');
    } catch (err) {
      preview.src = previousSrc; // roll back the optimistic preview
      setStatus(statusEl, err.message, 'error');
    } finally {
      changeBtn.disabled = false;
      fileInput.value = ''; // allows re-selecting the same file later
    }
  });
}

async function uploadPhoto(file) {
  // File uploads need multipart/form-data, which the shared
  // api.post()/api.put() helpers in api.js can't send (they always
  // JSON.stringify the body). This talks to fetch() directly instead,
  // reusing the same CONFIG and token that api.js already set up
  // (CONFIG is a plain global const, so it's visible here too since
  // both files load as classic, non-module scripts).
  const formData = new FormData();
  formData.append('photo', file);

  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url = CONFIG.USE_MOCK_DATA
    ? `${CONFIG.MOCK_BASE_PATH}/users/me/photo`
    : `${CONFIG.BASE_URL}/users/me/photo`; // ASSUMPTION — not yet confirmed

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // No Content-Type header here on purpose — the browser sets the
  // correct multipart boundary automatically for FormData bodies.

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) { /* response wasn't JSON */ }
    throw new Error(message);
  }

  return response.json();
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

  // Clicking the dark backdrop (not the card itself) also closes it
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Esc key closes it too
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    clearInvalid('currentPassword', 'newPassword', 'confirmPassword');

    // Matches the hint text: at least 8 characters, a number, and a
    // special character.
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
      // ASSUMPTION: PUT /users/me/password — not yet confirmed.
      await window.api.put('/users/me/password', { currentPassword, newPassword });
      setStatus(statusEl, 'Password updated.', 'success');
      setTimeout(closeModal, 1200);
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