/* ============================================================
   navbar.js

   Loads navbar.html into any page's #navbar-placeholder. This is
   intentionally a separate file/partial from sidebar.js — the top
   navbar (brand strip) and the left sidebar are two independent
   components that happen to appear together on dashboard-style
   pages, not one combined unit.

   The mobile hamburger button (#dashMenuBtn) lives inside the
   navbar now rather than in each page's own topbar, since the
   navbar is the persistent element sitting above the sidebar. No
   changes were needed in sidebar.js for this — it already looks
   up #dashMenuBtn by id wherever it happens to be in the DOM.
   ============================================================ */

document.addEventListener('DOMContentLoaded', loadNavbar);

async function loadNavbar() {
  const placeholder = document.getElementById('navbar-placeholder');
  if (!placeholder) return; // this page doesn't use the top navbar

  try {
    const res = await fetch('navbar.html');
    if (!res.ok) throw new Error(`Failed to load navbar.html: ${res.status}`);
    placeholder.innerHTML = await res.text();
document.getElementById('navbarBackBtn')?.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'dashboard-landlord.html';
  }
});
  } catch (err) {
    console.error(err);
  }
}