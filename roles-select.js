/* ============================================================
   role-select.js
   Handles the "choose your role" screen:
   - Clicking a card selects it (only one at a time) and shows the checkmark
   - The selection is saved so login.html knows which dashboard to send
     the user to after they log in
   - Register button won't proceed until a role is chosen
   - Back button just goes to the previous page in history
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const roleCards = document.querySelectorAll('.role-card');
  const registerBtn = document.getElementById('registerBtn');
  const backBtn = document.getElementById('backBtn');
  const roleHint = document.getElementById('roleHint');

  const STORAGE_KEY = 'selectedRole';

  // If the user picked a role before (e.g. came back to this page),
  // restore that selection instead of starting blank every time.
  const savedRole = localStorage.getItem(STORAGE_KEY);
  if (savedRole) {
    const match = document.querySelector(`.role-card[data-role="${savedRole}"]`);
    if (match) selectCard(match);
  }

  function selectCard(card) {
    roleCards.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
    localStorage.setItem(STORAGE_KEY, card.dataset.role);
    roleHint.textContent = '';
  }

  roleCards.forEach(card => {
    card.addEventListener('click', () => selectCard(card));
  });

  registerBtn.addEventListener('click', () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      roleHint.textContent = 'Please choose a role above to continue.';
      return;
    }
    window.location.href = 'login.html';
  });

  backBtn?.addEventListener('click', () => {
    // Falls back to the homepage if there's no real history to go back to
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'index.html';
    }
  });
});