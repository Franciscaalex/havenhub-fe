(function () {
  "use strict";

  const PROFILE_IMAGE_KEY = "havenhub_profile_image";
  const PROFILE_FIRST_NAME_KEY = "havenhub_first_name";
  const PROFILE_LAST_NAME_KEY = "havenhub_last_name";
  const PROFILE_EMAIL_KEY = "havenhub_email";
  const PROFILE_PHONE_KEY = "havenhub_phone";

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

  // --------------------------------
  // Load saved profile data (falls back to placeholder demo values
  // matching the Figma mock if nothing has been saved yet)
  // --------------------------------

  function loadProfile() {
    const savedImage = localStorage.getItem(PROFILE_IMAGE_KEY);

    if (savedImage) {
      if (headerAvatar) headerAvatar.src = savedImage;
      if (settingsAvatar) settingsAvatar.src = savedImage;
    }

    firstNameInput.value = localStorage.getItem(PROFILE_FIRST_NAME_KEY) || "";

    lastNameInput.value = localStorage.getItem(PROFILE_LAST_NAME_KEY) || "";

    emailInput.value = localStorage.getItem(PROFILE_EMAIL_KEY) || "";

    phoneInput.value = localStorage.getItem(PROFILE_PHONE_KEY) || "";
  }
  loadProfile();

  // --------------------------------
  // Change photo (updates both the header avatar and the big
  // settings-page avatar, same pattern as script.js / saved.js)
  // --------------------------------

  function openFilePicker() {
    if (profileImageInput) profileImageInput.click();
  }

  if (profileBtn) profileBtn.addEventListener("click", openFilePicker);
  if (changePhotoBtn) changePhotoBtn.addEventListener("click", openFilePicker);

  if (profileImageInput) {
    profileImageInput.addEventListener("change", () => {
      const file = profileImageInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please select a JPG or PNG image.");
        return;
      }

      const MAX_BYTES = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_BYTES) {
        alert("Image is too large. Please choose a file under 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        if (headerAvatar) headerAvatar.src = imageData;
        if (settingsAvatar) settingsAvatar.src = imageData;
        localStorage.setItem(PROFILE_IMAGE_KEY, imageData);
      };
      reader.readAsDataURL(file);
    });
  }

  // --------------------------------
  // Save personal info
  // --------------------------------

  if (personalInfoForm) {
    personalInfoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      localStorage.setItem(PROFILE_FIRST_NAME_KEY, firstNameInput.value.trim());
      localStorage.setItem(PROFILE_LAST_NAME_KEY, lastNameInput.value.trim());
      localStorage.setItem(PROFILE_PHONE_KEY, phoneInput.value.trim());

      const saveBtn = personalInfoForm.querySelector(".save-btn");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saved ✓";
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 1500);
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
  if (closePasswordPanel)
    closePasswordPanel.addEventListener("click", closePasswordPanelFn);
  if (cancelPasswordBtn)
    cancelPasswordBtn.addEventListener("click", closePasswordPanelFn);

  // --------------------------------
  // Password validation + submit
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
    passwordForm.addEventListener("submit", (e) => {
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

      // Replace with a real POST to the auth/password-change API

      document.dispatchEvent(
        new CustomEvent("havenhub:password-change", {
          detail: { currentPassword: current, newPassword: next },
        }),
      );

      const updateBtn = passwordForm.querySelector(".save-btn");
      const originalText = updateBtn.textContent;
      updateBtn.textContent = "Updated ✓";
      setTimeout(() => {
        updateBtn.textContent = originalText;
        closePasswordPanelFn();
      }, 1200);
    });
  }

  // --------------------------------
  // Log out
  // --------------------------------

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // TODO: replace with a real call to the auth API to invalidate
      // the session/JWT once the backend is ready.
      document.dispatchEvent(new CustomEvent("havenhub:logout"));
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
