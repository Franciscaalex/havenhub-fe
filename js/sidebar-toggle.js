/**
 * Mobile hamburger menu — opens the sidebar as a full-screen overlay
 * on small screens. Works on admindash.html and moderation.html.
 */
// document.addEventListener("DOMContentLoaded", () => {
//   const toggleBtn = document.getElementById("sidebarToggleBtn");
//   const sidebar = document.querySelector(".admin-sidebar");
//   if (!toggleBtn || !sidebar) return;

//   function openSidebar() {
//     sidebar.classList.add("mobile-open");
//     toggleBtn.classList.add("is-active");
//     toggleBtn.setAttribute("aria-expanded", "true");
//     document.body.classList.add("sidebar-open");
//   }

//   function closeSidebar() {
//     sidebar.classList.remove("mobile-open");
//     toggleBtn.classList.remove("is-active");
//     toggleBtn.setAttribute("aria-expanded", "false");
//     document.body.classList.remove("sidebar-open");
//   }

//   toggleBtn.addEventListener("click", () => {
//     const isOpen = sidebar.classList.contains("mobile-open");
//     if (isOpen) {
//       closeSidebar();
//     } else {
//       openSidebar();
//     }
//   });

//   sidebar.querySelectorAll(".nav-link").forEach((link) => {
//     link.addEventListener("click", closeSidebar);
//   });

//   // Tapping outside the sidebar (on the dimmed backdrop) closes it too.
//   document.addEventListener("click", (e) => {
//     const isOpen = sidebar.classList.contains("mobile-open");
//     const clickedInsideSidebar = sidebar.contains(e.target);
//     const clickedToggleBtn = toggleBtn.contains(e.target);
//     if (isOpen && !clickedInsideSidebar && !clickedToggleBtn) {
//       closeSidebar();
//     }
//   });
// });

/* sidenav-loader.js — fetches sidenav.html,*/

(function () {
  function loadSidenav() {
    var mount = document.getElementById('sidenav-placeholder');
    if (!mount) {
      console.error('sidenav-loader.js: #sidenav-placeholder not found on this page — add <div id="sidenav-placeholder"></div> where the sidebar should go.');
      return;
    }

    fetch('sidenav.html')
      .then(function (res) {
        if (!res.ok) throw new Error('sidenav.html responded ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var asideEl = doc.querySelector('aside.admin-sidebar') || doc.querySelector('aside');
        if (asideEl) {
          mount.replaceWith(asideEl);
        } else {
          mount.innerHTML = html;
        }
      })
      .then(function () {
        ['js/moderation-init.js', 'js/sidebar-toggle.js'].forEach(function (src) {
          var s = document.createElement('script');
          s.src = src;
          document.body.appendChild(s);
        });
      })
      .catch(function (err) {
        console.error('Could not load sidenav.html:', err);
        mount.innerHTML = '<div style="padding:16px;color:#b00;">Could not load the sidebar (' + err.message + ').</div>';
      });
  }

  // The mount div already exists in the HTML by the time this script tag is
  // reached (scripts run in document order), so no need to wait for
  // DOMContentLoaded — running immediately means the sidebar appears sooner.
  loadSidenav();
})();