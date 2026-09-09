/* main.js */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check routing limits early
  checkRouteGuard();

  // 2. Verify placeholders exist on the current page before attempting to fetch fragments
  const loadingPromises = [];

  if (document.getElementById('sidebar-placeholder')) {
    loadingPromises.push(loadPartial('sidebar.html', 'sidebar-placeholder'));
  }
  if (document.getElementById('header-placeholder')) {
    loadingPromises.push(loadPartial('header.html', 'header-placeholder'));
  }
  if (document.getElementById('footer-placeholder')) {
    loadingPromises.push(loadPartial('footer.html', 'footer-placeholder'));
  }

  // Wait until all layout template files are completely loaded into the placeholders
  await Promise.all(loadingPromises);

  // 3. Hydrate standard baseline metadata metrics ONLY after layouts are safe in the DOM
  highlightActiveNavLink();
  updateHeaderAuthState();
  setFooterYear();
  renderProperties();
  syncAllProfileAvatars(); // NEW: hydrate any .user-avatar-sync images on this page
});

  async function loadPartial(url, placeholderId) {
  const el = document.getElementById(placeholderId);
  if (!el) return;

  const cacheKey = `partial:${url}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    el.innerHTML = cached;
    if (placeholderId === 'header-placeholder') {
      updateHeaderAuthState();
      highlightActiveNavLink();
    }
    if (placeholderId === 'sidebar-placeholder') {
      window.dispatchEvent(new Event('partialsLoaded'));
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const html = await res.text();

    if (cached === html) return;

    el.innerHTML = html;
    sessionStorage.setItem(cacheKey, html);

    if (placeholderId === 'header-placeholder') {
      updateHeaderAuthState();
      highlightActiveNavLink();
    }

    if (placeholderId === 'sidebar-placeholder') {
      window.dispatchEvent(new Event('partialsLoaded'));
    }
  } catch (err) {
    console.error(`Failed to refresh partial fragment [${url}]:`, err.message);
  }
}

/* Global session state synchronized with api.js tokens */

function loginUser(username) {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('username', username);
}

function logoutUser() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('selectedRole'); // Clear role choice on logout
  if (window.api && typeof window.api.clearSession === 'function') {
    window.api.clearSession();
  }
}

function isUserLoggedIn() {
  if (window.api && typeof window.api.isAuthenticated === 'function') {
    return window.api.isAuthenticated();
  }
  return localStorage.getItem('isLoggedIn') === 'true';
}

function getCurrentUsername() {
  return localStorage.getItem('username') || 'User';
}

/*  Nav / header behaviour  */

function highlightActiveNavLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .dash-nav-link').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.classList.add('active-link');
    }
  });
}

function updateHeaderAuthState() {
  const profileSlot = document.querySelector('.profile-icon');
  if (!profileSlot || !isUserLoggedIn()) return;

  profileSlot.innerHTML = `
    <span class="nav-username" style="margin-right:12px; font-weight:600;">Hi, ${getCurrentUsername()}</span>
    <button id="logoutBtn" class="btn-logout" type="button" style="cursor:pointer;">Logout</button>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logoutUser();
    window.location.href = 'signup.html'; // Safe fallback redirect target
  });
}

function setFooterYear() {
  const el = document.querySelector('.copy-right');
  if (el) el.textContent = new Date().getFullYear();
}

/*  Hamburger menu (mobile nav)  */

document.addEventListener('click', (e) => {
  const hamburgerBtn = e.target.closest('#hamburgerBtn');
  const navLinks = document.getElementById('navLinks');

  if (hamburgerBtn && navLinks) {
    const isOpen = navLinks.classList.toggle('nav-open');
    hamburgerBtn.classList.toggle('is-active', isOpen);
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    return;
  }

  if (navLinks && e.target.closest('#navLinks a')) {
    navLinks.classList.remove('nav-open');
    const burger = document.getElementById('hamburgerBtn');
    if (burger) {
      burger.classList.remove('is-active');
      burger.setAttribute('aria-expanded', 'false');
    }
  }
});

/* Explore page: render listings */

async function renderProperties() {
  const container = document.getElementById('propertyList');
  if (!container) return;

  try {
    const response = await window.api.get('/properties');
    const dataPayload = response?.data || response;
    const properties = dataPayload.items || response.items || [];

    if (properties.length === 0) {
      container.innerHTML = `<p>No properties listed yet.</p>`;
      return;
    }

    container.innerHTML = properties.map(p => `
      <article class="property-card">
        <h3>${p.title ?? 'Untitled property'}</h3>
        <p>${p.location || p.address || ''} — $${(p.price ?? 0).toLocaleString()}/mo</p>
      </article>
    `).join('');
  } catch (err) {
    console.error("Property Feed Failure:", err);
    container.innerHTML = `<p class="error-text" style="display:block;">Could not load listings: ${err.message}</p>`;
  }
}

/* ============================================================
   SHARED AVATAR SYNC
   Any <img> anywhere in the app — sidebar, dashboard banners,
   inbox message threads, etc. — can opt in to staying in sync
   with the user's uploaded photo by adding this class:

     <img class="user-avatar-sync" alt="...">

   No per-page JS needed. This runs automatically on every page
   load (via DOMContentLoaded below) and again immediately after
   a successful upload on the Settings page.
   ============================================================ */

function syncAllProfileAvatars(url) {
  const avatarUrl = url || localStorage.getItem('userAvatarUrl') || localStorage.getItem('profilePicture');
  if (!avatarUrl) return;
  document.querySelectorAll('.user-avatar-sync').forEach(img => {
    img.src = avatarUrl;
  });
}

window.HavenHubSession = { loginUser, logoutUser, isUserLoggedIn, getCurrentUsername, syncAllProfileAvatars };

/* ============================================================
   ROLE-AWARE ROUTE GUARD
   ============================================================ */
function checkRouteGuard() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const isLoggedIn = isUserLoggedIn();
  const activeRole = localStorage.getItem('selectedRole') || '';

  const securePages = [
    'landlord-dashboard.html',
    'seeker-dashboard.html',
    'add-property.html'
  ];

  if (securePages.includes(currentPath) && !isLoggedIn) {
    console.warn("Intercepted unauthenticated access. Redirecting to login frame.");
    window.location.replace('login.html');
    return;
  }

  if (isLoggedIn && activeRole) {
    const normalizedRole = activeRole.toUpperCase().trim();

    if (currentPath === 'landlord-dashboard.html' && normalizedRole !== 'LANDLORD') {
      console.warn("Cross-role anomaly caught. Forcing Seeker dashboard view.");
      window.location.replace('seeker-dashboard.html');
    }
    else if (currentPath === 'seeker-dashboard.html' && normalizedRole === 'LANDLORD') {
      console.warn("Cross-role anomaly caught. Forcing Landlord dashboard view.");
      window.location.replace('landlord-dashboard.html');
    }
  }
}