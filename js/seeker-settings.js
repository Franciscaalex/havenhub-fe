/* settings.js */

(function () {
  "use strict";

  // --------------------------------
  // Elements
  // --------------------------------

  const headerAvatar = document.getElementById("profileAvatar");
  const settingsAvatar = document.getElementById("settingsAvatar");
  const profileBtn = document.getElementById("profileBtn");
  const profileImageInput = document.getElementById("profileImageInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  const personalInfoForm = document.getElementById("personalInfoForm");
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("emailAddress");
  const phoneInput = document.getElementById("phoneNumber");

  const togglePasswordPanel = document.getElementById("togglePasswordPanel");
  const passwordPanel = document.getElementById("passwordPanel");
  const closePasswordPanel = document.getElementById("closePasswordPanel");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
  const passwordForm = document.getElementById("passwordForm");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const passwordFormError = document.getElementById("passwordFormError");

  const logoutBtn = document.getElementById("logoutBtn");

  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.api) {
      console.error("Settings page halted: window.api is missing. Make sure js/api.js loads before this file.");
      return;
    }
    loadProfile();
  });

  // --------------------------------
  // Load current profile from the API
  // --------------------------------

  async function loadProfile() {
    try {
      const user = await window.api.get('/users/me');

      if (firstNameInput) firstNameInput.value = user.firstName ?? '';
      if (lastNameInput) lastNameInput.value = user.lastName ?? '';
      if (emailInput) emailInput.value = user.email ?? '';
      if (phoneInput) phoneInput.value = user.phoneNumber ?? '';

      if (user.avatarUrl) {
        if (headerAvatar) headerAvatar.src = user.avatarUrl;
        if (settingsAvatar) settingsAvatar.src = user.avatarUrl;
        localStorage.setItem('userAvatarUrl', user.avatarUrl);
      }
    } catch (err) {
      console.error('Could not load profile:', err);
      // No dedicated status element on this page — surface it without
      // blocking the rest of the page from working.
      console.warn('Showing empty fields; you can still edit and save below.');
    }
  }

  // --------------------------------
  // Change photo — now uploads to the API instead of storing a
  // base64 data URL in localStorage
  // --------------------------------

  function openFilePicker() {
    if (profileImageInput) profileImageInput.click();
  }

  if (profileBtn) profileBtn.addEventListener("click", openFilePicker);
  if (changePhotoBtn) changePhotoBtn.addEventListener("click", openFilePicker);

  if (profileImageInput) {
    profileImageInput.addEventListener("change", async () => {
      const file = profileImageInput.files[0];
      if (!file) return;

      const isValidType = ['image/jpeg', 'image/png'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB

      if (!isValidType) {
        alert("Please select a JPG or PNG image.");
        return;
      }
      if (!isValidSize) {
        alert("Image is too large. Please choose a file under 5MB.");
        return;
      }

      const localPreviewUrl = URL.createObjectURL(file);
      const previousHeaderSrc = headerAvatar?.src;
      const previousSettingsSrc = settingsAvatar?.src;
      if (headerAvatar) headerAvatar.src = localPreviewUrl;
      if (settingsAvatar) settingsAvatar.src = localPreviewUrl;

      if (changePhotoBtn) changePhotoBtn.disabled = true;

      try {
        const newAvatarUrl = await uploadPhoto(file);
        if (newAvatarUrl) {
          if (headerAvatar) headerAvatar.src = newAvatarUrl;
          if (settingsAvatar) settingsAvatar.src = newAvatarUrl;
          localStorage.setItem('userAvatarUrl', newAvatarUrl);
          window.HavenHubSession?.syncAllProfileAvatars?.(newAvatarUrl);
        }
      } catch (err) {
        if (headerAvatar && previousHeaderSrc) headerAvatar.src = previousHeaderSrc;
        if (settingsAvatar && previousSettingsSrc) settingsAvatar.src = previousSettingsSrc;
        alert(`Photo upload failed: ${err.message}`);
      } finally {
        if (changePhotoBtn) changePhotoBtn.disabled = false;
        profileImageInput.value = '';
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
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { method: 'POST', headers, body: formData });

    if (!response.ok) {
      let message = `Upload failed with status ${response.status}`;
      try {
        const body = await response.json();
        message = body.message || body.error || message;
      } catch (_) { /* not JSON */ }
      throw new Error(message);
    }

    const data = await response.json();
    return data.avatarUrl || data.url || data.secure_url || data.photoUrl || null;
  }

  // --------------------------------
  // Save personal info — now PUTs to the API instead of localStorage
  // --------------------------------

  if (personalInfoForm) {
    personalInfoForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const phoneNumber = phoneInput.value.trim();

      if (!firstName || !lastName) {
        alert('First and last name are required.');
        return;
      }

      const saveBtn = personalInfoForm.querySelector(".save-btn");
      const originalText = saveBtn ? saveBtn.textContent : '';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
      }

      try {
        await window.api.put('/users/me', { firstName, lastName, phoneNumber });
        if (saveBtn) saveBtn.textContent = "Saved ✓";
      } catch (err) {
        alert(`Could not save changes: ${err.message}`);
        if (saveBtn) saveBtn.textContent = originalText;
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          setTimeout(() => { saveBtn.textContent = originalText; }, 1500);
        }
      }
    });
  }

  // --------------------------------
  // Password panel toggle
  // --------------------------------

  function openPasswordPanel() {
    passwordPanel.classList.add("open");
  }

  function closePasswordPanelFn() {
    passwordPanel.classList.remove("open");
    passwordForm.reset();
    passwordFormError.style.display = "none";
  }

  if (togglePasswordPanel) {
    togglePasswordPanel.addEventListener("click", () => {
      passwordPanel.classList.contains("open")
        ? closePasswordPanelFn()
        : openPasswordPanel();
    });
  }
  if (closePasswordPanel) closePasswordPanel.addEventListener("click", closePasswordPanelFn);
  if (cancelPasswordBtn) cancelPasswordBtn.addEventListener("click", closePasswordPanelFn);

  // --------------------------------
  // Password validation + submit — now PUTs to the API
  // --------------------------------

  function isStrongPassword(pw) {
    const hasMinLength = pw.length >= 8;
    const hasNumber = /\d/.test(pw);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(pw);
    return hasMinLength && hasNumber && hasSpecialChar;
  }

  function showPasswordError(message) {
    passwordFormError.textContent = message;
    passwordFormError.style.display = "block";
  }

  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      passwordFormError.style.display = "none";

      const current = currentPasswordInput.value;
      const next = newPasswordInput.value;
      const confirm = confirmPasswordInput.value;

      if (!current || !next || !confirm) {
        showPasswordError("Please fill in all password fields.");
        return;
      }

      if (!isStrongPassword(next)) {
        showPasswordError(
          "New password must be at least 8 characters, including a number and a special character.",
        );
        return;
      }

      if (next !== confirm) {
        showPasswordError("New password and confirmation do not match.");
        return;
      }

      const updateBtn = passwordForm.querySelector(".save-btn");
      const originalText = updateBtn ? updateBtn.textContent : '';
      if (updateBtn) updateBtn.disabled = true;

      try {
        await window.api.put('/users/me/password', { currentPassword: current, newPassword: next });
        if (updateBtn) updateBtn.textContent = "Updated ✓";
        setTimeout(() => {
          if (updateBtn) updateBtn.textContent = originalText;
          closePasswordPanelFn();
          window.api.clearSession?.();
          window.location.href = "login.html";
        }, 1200);
      } catch (err) {
        showPasswordError(err.message);
      } finally {
        if (updateBtn) updateBtn.disabled = false;
      }
    });
  }

  // --------------------------------
  // Log out — now actually clears the session instead of just firing
  // a CustomEvent
  // --------------------------------

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.api.clearSession?.();
      window.location.href = "index.html";
    });
  }

  // --------------------------------
  // Mobile menu
  // --------------------------------

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", isOpen);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
})();