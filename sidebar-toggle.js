/**
 * Mobile hamburger menu — opens the sidebar as a full-screen overlay
 * on small screens. Works on admindash.html and moderation.html.
 */
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("sidebarToggleBtn");
  const sidebar = document.querySelector(".admin-sidebar");
  if (!toggleBtn || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add("mobile-open");
    toggleBtn.classList.add("is-active");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    sidebar.classList.remove("mobile-open");
    toggleBtn.classList.remove("is-active");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("sidebar-open");
  }

  toggleBtn.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("mobile-open");
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  sidebar.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  // Tapping outside the sidebar (on the dimmed backdrop) closes it too.
  document.addEventListener("click", (e) => {
    const isOpen = sidebar.classList.contains("mobile-open");
    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedToggleBtn = toggleBtn.contains(e.target);
    if (isOpen && !clickedInsideSidebar && !clickedToggleBtn) {
      closeSidebar();
    }
  });
});
