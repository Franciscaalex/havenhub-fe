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
  // FIXED: Adjusted path context variables to seamlessly mesh with your api.js gateway engine
  const API_BASE_URL = 'https://onrender.com';

  const googleBtn = document.getElementById('googleSignUpBtn');
  const appleBtn = document.getElementById('appleSignInBtn');

  googleBtn?.addEventListener('click', () => {
    window.location.href = `${API_BASE_URL}/users/google`;
  });

  appleBtn?.addEventListener('click', () => {
    window.location.href = `${API_BASE_URL}/users/apple`;
  });

  /* ---------- PERFORMANCE BOOSTER: Speculative Preloading ---------- */
  // Speeds up transitions by warming up the browser cache for the dashboards ahead of time
  const preloadNextPage = (url) => {
    if (document.querySelector(`link[href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.href = url;
    document.head.appendChild(link);
  };

  // Warm up page layout containers as soon as the user focuses the email fields
  document.getElementById('loginEmail')?.addEventListener('focus', () => {
    preloadNextPage('landlord-dashboard.html');
    preloadNextPage('seeker-dashboard.html');
  });

  document.getElementById('firstName')?.addEventListener('focus', () => {
    preloadNextPage('roles.html');
  });


   /* ---------- LOGIN FORM ---------- */
  const loginForm = document.getElementById('loginForm');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const statusEl = document.getElementById('loginStatus');
    let isValid = true;

    const emailValue = emailInput.value.trim();
    if (emailValue === '') { showError(emailInput, 'Email address is required'); isValid = false; }
    else setValid(emailInput);

    if (passwordInput.value.trim() === '') { showError(passwordInput, 'Password is required'); isValid = false; }
    else setValid(passwordInput);

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
         INTELLIGENT LOGIN ROUTER (Perfectly Matched to Swagger Roles)
         Reads the exact uppercase string constants from your backend payload
         ------------------------------------------------------------ */
      const serverUserObject = result.user || result.data?.user;
      const userRole = serverUserObject?.role || localStorage.getItem('selectedRole') || '';
      const normalizedRole = userRole.trim().toUpperCase();

      console.log("Authenticated User Role Type Detected:", normalizedRole);

      if (normalizedRole === 'LANDLORD') {
        window.location.replace('landlord-dashboard.html');
      } else if (normalizedRole === 'PROPERTY_SEEKER') {
        window.location.replace('seeker-dashboard.html');
      } else if (normalizedRole === 'REAL_ESTATE_AGENT') {
        window.location.replace('agent-dashboard.html');
      } else if (normalizedRole === 'PROPERTY_MANAGER') {
        window.location.replace('manager-dashboard.html');
      } else if (normalizedRole === 'ADMIN') {
        window.location.replace('admin-dashboard.html');
      } else {
        // Fallback check if user profile registration requires structural confirmation
        window.location.replace('roles.html'); 
      }

    } catch (err) {
      setStatus(statusEl, err.message || "Invalid credentials. Please try again.", true);
    }
  });


  /* ---------- SIGNUP FORM ---------- */
  const signupForm = document.getElementById('signupForm');

  signupForm?.addEventListener('submit', async (e) => {
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

    // UNTOUCHED: Kept your exact confirmed signup payload structure
    const payload = {
      email: emailValue,
      password: password.value.trim(),
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      role: "PROPERTY_SEEKER" 
    };

    try {
      setStatus(statusEl, 'Creating your account…', false);
      const result = await submitAuth('/users/register', payload);

      localStorage.removeItem('selectedRole');

      const token = result.token || result.data?.token;
      const expiresIn = result.expiresIn || result.data?.expiresIn || 3600;

      window.api.setToken(token, expiresIn);
      window.HavenHubSession.loginUser(result.user?.firstName ? `${result.user.firstName} ${result.user.lastName}` : `${payload.firstName} ${payload.lastName}`);

      setStatus(statusEl, 'Account created! Redirecting…', false);
      
      // Accelerated redirect method keeps back-history entries lightweight
      window.location.replace('roles.html');
    } catch (err) {
      console.error("Full Registration Failure Details:", err);
      setStatus(statusEl, err.message || "Registration failed. Try a stronger password.", true);
    }
  }); 

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
