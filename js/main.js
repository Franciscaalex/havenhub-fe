/* main.js */

async function loadPartial(url, placeholderId) {
  const el = document.getElementById(placeholderId);
  if (!el) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    el.innerHTML = await res.text();
  } catch (err) {
    console.error(err);
  }
}

/* Global session state */

function loginUser(username) {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('username', username);
}

function logoutUser() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  if (window.api && typeof window.api.clearSession === 'function') {
    window.api.clearSession(); // also drops the JWT (Developer 2's storage)
  }
}

function isUserLoggedIn() {
  return localStorage.getItem('isLoggedIn') === 'true';
}

function getCurrentUsername() {
  return localStorage.getItem('username');
}

/*  Nav / header behaviour  */

function highlightActiveNavLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.classList.add('active-link');
    }
  });
}

function updateHeaderAuthState() {
  const profileSlot = document.querySelector('.profile-icon');
  if (!profileSlot || !isUserLoggedIn()) return;

  profileSlot.innerHTML = `
    <span class="nav-username">Hi, ${getCurrentUsername()}</span>
    <button id="logoutBtn" class="btn-logout" type="button">Logout</button>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logoutUser();
    window.location.href = 'index.html';
  });
}

function setFooterYear() {
  const el = document.querySelector('.copy-right');
  if (el) el.textContent = new Date().getFullYear();
}

/*  Hamburger menu (mobile nav)  */

document.addEventListener('click', (e) => {
  console.log('Something was clicked:', e.target); // TEMP — remove once working

  const hamburgerBtn = e.target.closest('#hamburgerBtn');
  const navLinks = document.getElementById('navLinks');

  console.log('Is this the hamburger?', !!hamburgerBtn); // TEMP

  if (hamburgerBtn && navLinks) {
    const isOpen = navLinks.classList.toggle('nav-open');
    hamburgerBtn.classList.toggle('is-active', isOpen);
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    console.log('nav-open class now on navLinks?', navLinks.classList.contains('nav-open')); // TEMP
    return;
  }

  if (navLinks && e.target.closest('#navLinks a')) {
    navLinks.classList.remove('nav-open');
    document.getElementById('hamburgerBtn')?.classList.remove('is-active');
    document.getElementById('hamburgerBtn')?.setAttribute('aria-expanded', 'false');
  }
});

/* Explore page: render mock listings  */

async function renderProperties() {
  const container = document.getElementById('propertyList');
  if (!container) return; // not on explore.html

  try {
    console.log('Fetching properties from:', `${CONFIG.BASE_URL}/properties`);
    const response = await window.api.get('/properties');
    console.log('Raw API response:', response);

    const properties = response.items || [];

    if (properties.length === 0) {
      container.innerHTML = `<p>No properties listed yet.</p>`;
      return;
    }

    container.innerHTML = properties.map(p => `
      <article class="property-card">
        <h3>${p.title ?? 'Untitled property'}</h3>
        <p>${p.location ?? ''} — $${(p.price ?? 0).toLocaleString()}</p>
      </article>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="error-text" style="display:block;">Could not load listings: ${err.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPartial('header.html', 'header-placeholder');
  await loadPartial('footer.html', 'footer-placeholder');

  highlightActiveNavLink();
  updateHeaderAuthState();
  setFooterYear();
  renderProperties();
});


window.HavenHubSession = { loginUser, logoutUser, isUserLoggedIn, getCurrentUsername };