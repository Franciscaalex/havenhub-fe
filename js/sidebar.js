/* ============================================================
   sidebar.js

   Loads sidebar.html into #sidebar-placeholder on any page that
   has one, then wires up:
   - Active-link highlighting (based on the current filename)
   - The "Coming Soon" tooltip
   - The mobile off-canvas open/close behavior (works together
     with the .dash-overlay element and .dash-menu-btn button
     that each page includes directly in its own HTML)

   Any page that wants the sidebar just needs:
   1. <div class="dash-overlay" id="dashOverlay"></div> near the
      top of <body>
   2. <div id="sidebar-placeholder"></div> as the first child
      inside .dash-shell
   3. A <button class="dash-menu-btn" id="dashMenuBtn"> somewhere
      in its topbar (for mobile)
   4. This script included after api.js/main.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', loadSidebar);

async function loadSidebar() {
  const placeholder = document.getElementById('sidebar-placeholder');
  if (!placeholder) return; // this page doesn't use the sidebar

  try {
    const res = await fetch('sidebar.html');
    if (!res.ok) throw new Error(`Failed to load sidebar.html: ${res.status}`);
    placeholder.innerHTML = await res.text();
  } catch (err) {
    console.error(err);
    return;
  }

  highlightActiveSidebarLink();
  initSidebarToggle();
  initSidebarTooltips();
  initSidebarProfile();
}

function highlightActiveSidebarLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.dash-nav-link[data-page]').forEach(link => {
    if (link.dataset.page === current) {
      link.classList.add('is-active');
    }
  });
}

function initSidebarToggle() {
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  const menuBtn = document.getElementById('dashMenuBtn');
  if (!sidebar || !overlay || !menuBtn) return;

  const openSidebar = () => {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
  };

  menuBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}

function initSidebarTooltips() {
  const tooltip = document.getElementById('dashTooltip');
  const triggers = document.querySelectorAll('.dash-nav-soon');
  if (!tooltip || !triggers.length) return;

  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const isSameAndOpen = tooltip.dataset.for === btn.dataset.tooltipLabel && !tooltip.hidden;
      tooltip.hidden = isSameAndOpen;
      tooltip.dataset.for = btn.dataset.tooltipLabel;
    });
  });

  document.addEventListener('click', (e) => {
    if (!tooltip.hidden && !e.target.closest('.dash-nav-soon') && !e.target.closest('#dashTooltip')) {
      tooltip.hidden = true;
    }
  });
}

function initSidebarProfile() {
  const nameEl = document.getElementById('sidebarUserName');
  const logoutBtn = document.getElementById('sidebarLogoutBtn');

  const username = window.HavenHubSession?.getCurrentUsername?.();
  if (nameEl && username) {
    nameEl.textContent = username;
  }

  logoutBtn?.addEventListener('click', () => {
    window.HavenHubSession?.logoutUser?.();
    window.location.href = 'login.html';
  });

  // Call the unread count loading protocol securely inside profile initialization
  loadUnreadCount();
}

/* ---------- FIXED: API-Aligned Unread Notification Loader ---------- */
async function loadUnreadCount() {
  try {
    // Queries your live backend message sub-resource endpoint route namespaces
    const response = await window.api.get('/messages/unread-count');
    
    // Safety check parsing either flat integers or standard data wrappers
    const dataPayload = response?.data || response;
    const unreadCount = Number(dataPayload?.count ?? dataPayload?.unreadCount ?? response?.count ?? 0);
    
    const badge = document.getElementById('unreadBadge');
    
    if (badge && unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.hidden = false;
      badge.style.display = 'inline-flex'; // Force display layer override formatting
    } else if (badge) {
      badge.hidden = true;
    }
  } catch (err) {
    console.error('Could not load unread count:', err);
  }
}
