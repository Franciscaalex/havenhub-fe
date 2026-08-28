/* forms.js */

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Cross-page navigation (login <-> signup) ---------- */
  const switchToSignup = document.getElementById('switchToSignup');
  const switchToLogin = document.getElementById('switchToLogin');

  switchToSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'signup.html';
  });

  switchToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'login.html';
  });

  /* ---------- Password visibility toggle ---------- */
  document.querySelectorAll('.toggle-password-img').forEach(img => {
    img.addEventListener('click', () => {
      const input = document.getElementById(img.getAttribute('data-target'));
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      img.src = isPassword ? 'images/Eye.png' : 'images/EyeClosed.png';
    });
  });

  /* ---------- SOCIAL AUTHENTICATION (Google & Apple) ---------- */
  // FIXED: Pointing straight to your verified live Render backend domain root
  const API_BASE_URL = 'https://onrender.com';

  const googleBtn = document.getElementById('googleSignUpBtn');
  const appleBtn = document.getElementById('appleSignInBtn');

  googleBtn?.addEventListener('click', () => {
    window.location.href = `${API_BASE_URL}/users/google`;
  });

  appleBtn?.addEventListener('click', () => {
    window.location.href = `${API_BASE_URL}/users/apple`;
  });

   /* ---------- LOGIN FORM ---------- */
  const loginForm = document.getElementById('loginForm');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const statusEl = document.getElementById('loginStatus');
    let isValid = true;

    // ... Keep your standard validation code block here ...

    if (!isValid) return;

    const payload = { email: emailValue, password: passwordInput.value.trim() };

    try {
      setStatus(statusEl, 'Signing in…', false);
      const result = await submitAuth('/users/login', payload);

      // Save token states directly into api.js
      window.api.setToken(result.token, result.expiresIn);
      window.HavenHubSession.loginUser(result.user?.name || emailValue);

      setStatus(statusEl, 'Success! Redirecting…', false);

      /* ------------------------------------------------------------
         FIXED: INTELLIGENT LOGIN ROUTER
         Reads your selected role and routes you straight to your dashboard!
         ------------------------------------------------------------ */
      const activeRole = localStorage.getItem('selectedRole') || result.user?.role || '';
      const normalizedRole = activeRole.trim().toLowerCase();

      if (normalizedRole === 'landlord') {
        window.location.href = 'landlord-dashboard.html';
      } else if (normalizedRole === 'seeker') {
        window.location.href = 'seeker-dashboard.html';
      } else if (normalizedRole === 'agent') {
        window.location.href = 'agent-dashboard.html';
      } else if (normalizedRole === 'manager') {
        window.location.href = 'manager-dashboard.html';
      } else {
        window.location.href = 'index.html'; // Default safety fallback
      }

    } catch (err) {
      setStatus(statusEl, err.message, true);
    }
  });


  /* ---------- SIGNUP FORM ---------- */
  const signupForm = document.getElementById('signupForm');

  signupForm?.addEventListener('submit', async (e) => {
    // FIXED: Enforce bulletproof submission lock to prevent form reload flash
    e.preventDefault();
    e.stopPropagation();

    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('signupEmail');
    const password = document.getElementById('signupPassword');
    const terms = document.getElementById('terms');
    const statusEl = document.getElementById('signupStatus');

    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (firstName.value.trim() === '') { showError(firstName, 'First name is required'); isValid = false; }
    else setValid(firstName);

    if (lastName.value.trim() === '') { showError(lastName, 'Last name is required'); isValid = false; }
    else setValid(lastName);

    const emailValue = email.value.trim();
    if (emailValue === '') { showError(email, 'Email address is required'); isValid = false; }
    else if (!emailRegex.test(emailValue)) { showError(email, 'Incorrect email'); isValid = false; }
    else setValid(email);

    if (password.value.trim() === '') { showError(password, 'Password is required'); isValid = false; }
    else setValid(password);

    const termsGroup = terms.closest('.terms-group') || terms.parentElement;
    if (!terms.checked) {
      termsGroup?.classList.add('has-error');
      isValid = false;
    } else {
      termsGroup?.classList.remove('has-error');
    }

    if (!isValid) return false;

    const payload = {
      email: emailValue,
      password: password.value.trim(),
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      role: "PROPERTY_SEEKER" // Matches your backend's verified schema rule requirements
    };

    try {
      setStatus(statusEl, 'Creating your account…', false);
      const result = await submitAuth('/users/register', payload);

      // 1. Force clear any lingering role data from past test runs
      localStorage.removeItem('selectedRole');

      // 2. Store the fresh new session parameters with wrapper layer support checks
      const token = result.token || result.data?.token;
      const expiresIn = result.expiresIn || result.data?.expiresIn || 3600;

      window.api.setToken(token, expiresIn);
      window.HavenHubSession.loginUser(result.user?.firstName ? `${result.user.firstName} ${result.user.lastName}` : `${payload.firstName} ${payload.lastName}`);

      setStatus(statusEl, 'Account created! Redirecting…', false);
      
      // 3. Move forward safely to Step 2
      window.location.href = 'roles.html';
    } catch (err) {
      console.error("Full Registration Failure Details:", err);
      setStatus(statusEl, err.message || "Registration failed. Try a stronger password.", true);
    }
  }); // FIXED: Restored missing closing structural brace layout tokens

});

/* ---------- Hand-off api.js ---------- */
async function submitAuth(endpoint, payload) {
  if (!window.api) {
    throw new Error('api.js not loaded — check script order');
  }
  return window.api.post(endpoint, payload);
}

/* ---------- Validation helpers ---------- */

function showError(inputElement, message) {
  inputElement.classList.remove('is-valid');
  inputElement.classList.add('is-invalid');

  const formGroup = inputElement.closest('.form-group') || inputElement.parentElement;
  if (formGroup) {
    formGroup.classList.add('has-error');
    const errorTarget = formGroup.querySelector('.error-message') || formGroup.querySelector('.error-text');
    if (errorTarget && message) errorTarget.textContent = message;
  }
}

function setValid(inputElement) {
  inputElement.classList.remove('is-invalid');
  inputElement.classList.add('is-valid');
  (inputElement.closest('.form-group') || inputElement.parentElement)?.classList.remove('has-error');
}

function setStatus(el, message, isError) {
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#E53E3E' : '#34D399';
}
