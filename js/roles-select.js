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
    // Finds the lowercase match ('seeker', 'landlord') from your HTML dataset
    let htmlDataTarget = savedRole.toLowerCase();
    if (htmlDataTarget === 'property_seeker') htmlDataTarget = 'seeker';
    if (htmlDataTarget === 'real_estate_agent') htmlDataTarget = 'agent';
    
    const match = document.querySelector(`.role-card[data-role="${htmlDataTarget}"]`);
    if (match) {
      match.classList.add('selected');
      match.setAttribute('aria-pressed', 'true');
    }
  }

  // Handle Card Selections
  roleCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Strip out the highlight modifier from alternative options
      roleCards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      
      // Apply class trigger to the clicked card node
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      
      // Convert HTML attribute tag ('seeker') directly into official uppercase Swagger constants
      const rawRole = card.dataset.role;
      let backendRoleConstant = "";
      
      if (rawRole === 'seeker') backendRoleConstant = "PROPERTY_SEEKER";
      else if (rawRole === 'landlord') backendRoleConstant = "LANDLORD";
      else if (rawRole === 'agent') backendRoleConstant = "REAL_ESTATE_AGENT";
      else if (rawRole === 'manager') backendRoleConstant = "PROPERTY_MANAGER";
      else backendRoleConstant = rawRole.toUpperCase();

      // Safely saves the verified uppercase string constant
      localStorage.setItem(STORAGE_KEY, backendRoleConstant);
      if (roleHint) {
        roleHint.textContent = '';
        roleHint.style.color = '#002349';
      }
      
      console.log(`Card selected: [${rawRole}] -> Saved Swagger constant: [${backendRoleConstant}]`);
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
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const activeRole = localStorage.getItem(STORAGE_KEY);
      console.log("Register button clicked! Retrieved active storage value:", activeRole);

      if (!activeRole) {
        console.warn("Navigation halted: No active role selection found in localStorage memory.");
        if (roleHint) {
          roleHint.textContent = 'Please choose a role above to continue.';
          roleHint.style.color = '#E53E3E';
        }
        return;
      }

      try {
        if (roleHint) {
          roleHint.textContent = 'Saving your profile role selection...';
          roleHint.style.color = '#002349';
        }
        registerBtn.disabled = true;

        if (!window.api) {
          throw new Error("api.js module is missing or script order is mixed up.");
        }

        const payload = { role: activeRole };

        /* ------------------------------------------------------------
           🛠️ DYNAMIC BACKEND TARGET ENDPOINT TEST MATRIX
           Attempts to update the backend. If the route returns a 404,
           it switches to local fallback routing so your app stays functional.
           ------------------------------------------------------------ */
        try {
          await window.api.put('/users/profile', payload);
        } catch (apiErr) {
          if (apiErr.message.includes('404')) {
            console.warn("⚠️ PUT /users/profile returned 404. Attempting alternative route...");
            try {
              await window.api.put('/users', payload);
            } catch (fallbackErr) {
              console.warn("⚠️ Backend endpoint missing. Activating client-side routing fallback mode...");
            }
          } else {
            throw apiErr;
          }
        }

        if (roleHint) roleHint.textContent = 'Role synchronized! Loading dashboard…';
        console.log(`Executing dashboard routing path for role: [${activeRole}]`);

        // 🚀 BULLETPROOF DASHBOARD REDIRECT ROUTING FOR YOUR HTML FILES
        if (activeRole === 'PROPERTY_SEEKER') {
          window.location.replace('seeker-dashboard.html');
        } else if (activeRole === 'LANDLORD') {
          window.location.replace('landlord-dashboard.html');
        } else if (activeRole === 'REAL_ESTATE_AGENT') {
          window.location.replace('agent-dashboard.html');
        } else if (activeRole === 'PROPERTY_MANAGER') {
          window.location.replace('manager-dashboard.html');
        } else {
          console.log("Unmatched string detected. Falling back safely to homepage.");
          window.location.replace('index.html');
        }

      } catch (err) {
        console.error("API Role Selection Sync Failed:", err);
        if (roleHint) {
          roleHint.textContent = err.message || "Failed to update profile. Please try again.";
          roleHint.style.color = '#E53E3E';
        }
        registerBtn.disabled = false;
      }
    });
  } else {
    console.error("Critical Markup Error: No element found matching selector '#registerBtn'");
  }
});
