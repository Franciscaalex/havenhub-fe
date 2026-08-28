/* ============================================================
   role-select.js
   Handles the "choose your role" screen safely with clean scoping
   ============================================================ */

// 1. GLOBAL SCOPE DECLARATIONS: Placed at the very top so they are never "undefined"
const STORAGE_KEY = 'selectedRole';

document.addEventListener('DOMContentLoaded', () => {
  const roleCards = document.querySelectorAll('.role-card');
  const registerBtn = document.getElementById('registerBtn');
  const backBtn = document.getElementById('backBtn');
  const roleHint = document.getElementById('roleHint');

  console.log("Role selection engine successfully initialized.");

  // Restore previous selection states smoothly on page refresh
  const savedRole = localStorage.getItem(STORAGE_KEY);
  if (savedRole) {
    console.log("Restoring previously saved role from memory:", savedRole);
    const match = document.querySelector(`.role-card[data-role="${savedRole}"]`);
    if (match) match.classList.add('selected');
  }

  // Handle Card Selections
  roleCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Strip out the highlight modifier from alternative options
      roleCards.forEach(c => c.classList.remove('selected'));
      
      // Apply class trigger to the clicked card node
      card.classList.add('selected');
      
      // Safely saves the string attribute value
      localStorage.setItem(STORAGE_KEY, card.dataset.role);
      if (roleHint) roleHint.textContent = '';
      
      console.log("Card selection changed to role attribute:", card.dataset.role);
    });
  });

  // Handle Back Button Navigation
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.history.back();
    });
  }

  // Handle Dashboard Redirection Steps
  if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const activeRole = localStorage.getItem(STORAGE_KEY);
      console.log("Register button clicked! Retrieved active storage value:", activeRole);

      if (!activeRole) {
        console.warn("Navigation halted: No active role selection found in localStorage memory.");
        if (roleHint) roleHint.textContent = 'Please choose a role above to continue.';
        return;
      }

      const normalizedRole = activeRole.trim().toLowerCase();
      console.log(`Executing redirect protocol route for role string: [${normalizedRole}]`);

      // Clean, bulletproof relative paths
      if (normalizedRole === 'seeker') {
        window.location.href = 'seeker-dashboard.html';
      } else if (normalizedRole === 'landlord') {
        window.location.href = 'landlord-dashboard.html';
      } else if (normalizedRole === 'agent') {
        window.location.href = 'agent-dashboard.html';
      } else if (normalizedRole === 'manager') {
        window.location.href = 'manager-dashboard.html';
      } else {
        console.log("Unmatched string detected. Falling back safely to homepage.");
        window.location.href = 'index.html';
      }
    });
  } else {
    console.error("Critical Markup Error: No element found matching selector '#registerBtn'");
  }
});
