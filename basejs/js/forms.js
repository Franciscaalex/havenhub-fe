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
      img.src = isPassword ? 'assets/Eye.png' : 'assets/EyeClosed.png';
    });
  });

  /* ---------- LOGIN FORM ---------- */
  const loginForm = document.getElementById('loginForm');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const statusEl = document.getElementById('loginStatus');
    let isValid = true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValue = emailInput.value.trim();

    if (emailValue === '') {
      showError(emailInput, 'Email address is required');
      isValid = false;
    } else if (!emailRegex.test(emailValue)) {
      showError(emailInput, 'Incorrect email address');
      isValid = false;
    } else {
      setValid(emailInput);
    }

    if (passwordInput.value.trim() === '') {
      showError(passwordInput, 'Password is required');
      isValid = false;
    } else {
      setValid(passwordInput);
    }

    if (!isValid) return;

    // Package the validated data and hand off to api.js
    const payload = { email: emailValue, password: passwordInput.value.trim() };

    try {
      setStatus(statusEl, 'Signing in…', false);
      const result = await submitAuth('/auth/login', payload);

      window.api.setToken(result.token, result.expiresIn);
      window.HavenHubSession.loginUser(result.user?.name || emailValue);

      setStatus(statusEl, 'Success! Redirecting…', false);
      window.location.href = 'index.html';
    } catch (err) {
      setStatus(statusEl, err.message, true);
    }
  });

  /* ---------- SIGNUP FORM ---------- */
  const signupForm = document.getElementById('signupForm');

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

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

    const termsGroup = terms.closest('.terms-group');
    if (!terms.checked) {
      termsGroup?.classList.add('has-error');
      isValid = false;
    } else {
      termsGroup?.classList.remove('has-error');
    }

    if (!isValid) return;

    const payload = {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: emailValue,
      password: password.value.trim(),
    };

    try {
      setStatus(statusEl, 'Creating your account…', false);
      const result = await submitAuth('/auth/signup', payload);

      window.api.setToken(result.token, result.expiresIn);
      window.HavenHubSession.loginUser(result.user?.name || `${payload.firstName} ${payload.lastName}`);

      setStatus(statusEl, 'Account created! Redirecting…', false);
      window.location.href = 'index.html';
    } catch (err) {
      setStatus(statusEl, err.message, true);
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

  const formGroup = inputElement.closest('.form-group');
  if (formGroup) {
    formGroup.classList.add('has-error');
    const errorTarget = formGroup.querySelector('.error-message') || formGroup.querySelector('.error-text');
    if (errorTarget && message) errorTarget.textContent = message;
  }
}

function setValid(inputElement) {
  inputElement.classList.remove('is-invalid');
  inputElement.classList.add('is-valid');
  inputElement.closest('.form-group')?.classList.remove('has-error');
}

function setStatus(el, message, isError) {
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#E53E3E' : '#34D399';
}