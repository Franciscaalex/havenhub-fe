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
  const preloadNextPage = (url) => {
    if (document.querySelector(`link[href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch'; 
    link.href = url;
    document.head.appendChild(link);
  };

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
      
      // Hits POST /api/v1/users/login cleanly matching your Swagger spec
      const result = await submitAuth('/users/login', payload);

      // 1. EXTRACT USER OBJECTS MULTI-NESTS LAYOUT CHECKS
      const userData = result.user || result.data?.user || result.data || result;
      
      let rawUserRole = userData?.role || localStorage.getItem('selectedRole') || '';
      let normalizedRole = rawUserRole.trim().toUpperCase();
      
      const firstName = userData?.firstName || '';
      const lastName = userData?.lastName || '';
      const displayName = firstName && lastName ? `${firstName} ${lastName}` : (userData?.name || emailValue);

      // 2. TESTING OVERRIDE: Automatically assigns LANDLORD if email contains 'landlord' keyword
      if (!normalizedRole || normalizedRole === "NULL" || normalizedRole === "UNDEFINED" || normalizedRole === "PROPERTY_SEEKER") {
        if (emailValue.toLowerCase().includes('landlord')) {
          normalizedRole = 'LANDLORD';
        } else {
          normalizedRole = 'PROPERTY_SEEKER';
        }
      }

      console.log("LOGIN ROUTER LIFE-CYCLE SUCCESS:", {
        resolvedRoleType: normalizedRole,
        activeDisplayName: displayName
      });

      // 3. PERSIST ESSENTIAL APPLICATION CONTEXT PARAMETERS
      window.api.setToken(result.token || result.data?.token, result.expiresIn || 3600);
      window.HavenHubSession.loginUser(displayName);

      localStorage.setItem('selectedRole', normalizedRole);
      localStorage.setItem('username', displayName);
      localStorage.setItem('isLoggedIn', 'true');

      setStatus(statusEl, 'Success! Redirecting…', false);

      /* ------------------------------------------------------------
         INTELLIGENT DUAL NAVIGATION ROUTER
         ------------------------------------------------------------ */
      if (normalizedRole === 'LANDLORD') {
        window.location.replace('landlord-dashboard.html');
      } else if (normalizedRole === 'PROPERTY_SEEKER' || normalizedRole === 'SEEKER') {
        window.location.replace('seeker-dashboard.html');
      } else if (normalizedRole === 'REAL_ESTATE_AGENT' || normalizedRole === 'AGENT') {
        window.location.replace('agent-dashboard.html');
      } else if (normalizedRole === 'PROPERTY_MANAGER' || normalizedRole === 'MANAGER') {
        window.location.replace('manager-dashboard.html');
      } else if (normalizedRole === 'ADMIN') {
        window.location.replace('admin-dashboard.html');
      } else {
        window.location.replace('seeker-dashboard.html'); 
      }

    } catch (err) {
      console.error("Login session failed to establish:", err);
      setStatus(statusEl, err.message || "Invalid email or password. Please try again.", true);
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

    try {
      setStatus(statusEl, 'Checking account details…', false);

      /*  ANTI-ABUSE CHECK: VERIFY IF THE EMAIL ALREADY EXISTS */
       try {
        const checkPayload = { email: emailValue, password: password.value.trim() };
        await submitAuth('/users/login', checkPayload);
      
        setStatus(statusEl, 'You already have an existing account', true);
        return;
      } catch (loginErr) {
        const errorMsg = loginErr.message?.toLowerCase() || '';
      
        if (errorMsg.includes('password') || errorMsg.includes('taken') || errorMsg.includes('exist')) {
          setStatus(statusEl, 'You already have an existing account', true);
          return;
        }
      }

      /* STAGING FOR STEP 2 (ROLES PAGE) */
      const partialPayload = {
        email: emailValue,
        password: password.value.trim(),
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim()
      };

      sessionStorage.setItem('pendingUser', JSON.stringify(partialPayload));

      setStatus(statusEl, 'Proceeding to role selection…', false);
      
      window.location.href = 'roles.html';

    } catch (err) {
      console.error("Pre-registration verification step failed:", err);
      setStatus(statusEl, err.message || "An error occurred. Please try again.", true);
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
