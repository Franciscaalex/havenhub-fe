/* ============================================================
   saved-properties.js
   Extracts favorited list arrays and populates the saved views grid
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const savedGrid = document.getElementById('propertyGrid'); // Make sure your saved layout has this ID
  const STORAGE_KEY = "havenhub_saved_properties";

  // Helper selectors to fetch bookmarked database indices from storage context
  function getSavedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).map(item => item.id) : [];
    } catch (e) {
      return [];
    }
  }

  // Handle local removal of items directly from the saved page array
  function removeSavedId(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      let entries = JSON.parse(raw);
      entries = entries.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error(e);
    }
  }

  // Visual text icons builder tags template matching main script file structures
  const bedIcon = () => '<img src="Bed.png" alt="Bed">';
  const bathIcon = () => '<img src="Shower.png" alt="Bath">';
  const heartIcon = (isSaved) => `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
            fill="${isSaved ? "#0E7490" : "transparent"}" stroke="#0E7490" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;

  try {
    const savedIds = getSavedIds();

    if (savedIds.length === 0) {
      if (savedGrid) {
        savedGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 0;">
            <h3>Your saved collection is empty</h3>
            <p>Go back to the exploration dashboard page to bookmark properties.</p>
            <button onclick="window.location.href='seeker-dashboard.html'" class="apply-btn" style="margin-top:16px;">Browse Properties</button>
          </div>`;
      }
      return;
    }

    if (savedGrid) {
      savedGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Loading your saved listings…</p></div>`;
    }

    // Call your primary production API catalog endpoint matrix feed
    if (!window.api) throw new Error("api.js module missing.");
    const response = await window.api.get('/properties?limit=100');
    const apiItems = response?.items || response || [];

    // Filter properties down to only display the specific items favorited by the user
    const favoritedProperties = apiItems.filter(item => {
      const targetId = item._id || item.id;
      return savedIds.includes(targetId) || savedIds.includes(Number(targetId));
    });

    if (favoritedProperties.length === 0) {
      savedGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center;"><p>No active properties match your saved items.</p></div>`;
      return;
    }

    // Populate the saved listings grid
    savedGrid.innerHTML = "";
    favoritedProperties.forEach(p => {
      const card = document.createElement("article");
      card.className = "card";
      
      const pId = p._id || p.id;
      const statusClass = p.status?.toLowerCase() === "rented" ? "rented" : "available";
      const displayPrice = p.price ? Number(p.price).toLocaleString() : 0;
      const displaySqft = p.squareFeet || p.sqft || 0;

      card.innerHTML = `
        <a href="property-details.html?id=${pId}" class="card-media-link">
          <div class="card-media" style="background-image:url('${p.imageUrl || (p.images && p.images) || 'images/property-placeholder.png'}')"></div>
        </a>
        <button class="heart-btn inline-saved-trigger" data-id="${pId}">
          ${heartIcon(true)}
        </button>
        <div class="card-body">
          <div class="price">$${displayPrice}/mo</div>
          <div class="address">${p.address || `${p.city}, ${p.state}`}</div>
          <div class="card-stats">
            <div class="stat-badge" title="${p.bedrooms || p.beds} Bedrooms">
              <span class="stat-icon bed-icon">${bedIcon()}</span>
              <span class="badge-count">${p.bedrooms || p.beds}</span>
            </div>
            <div class="stat-badge" title="${p.bathrooms || p.baths} Bathrooms">
              <span class="stat-icon">${bathIcon()}</span>
              <span class="badge-count">${p.bathrooms || p.baths}</span>
            </div>
            <span class="sqft-text">${displaySqft} sqft</span>
          </div>
          <span class="status-badge ${statusClass}">${p.status || 'Available'}</span>
        </div>
      `;

      // Handle un-liking/removing item instantly from the saved view panel grid
      card.querySelector('.inline-saved-trigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        removeSavedId(pId);
        card.remove(); // Instantly sweeps card off layout DOM smoothly
        
        // Check if layout grid has completely emptied out to display fallback prompts
        if (savedGrid.children.length === 0) {
          location.reload();
        }
      });

      savedGrid.appendChild(card);
    });

  } catch (err) {
    console.error("Saved page runtime rendering exception error:", err);
    if (savedGrid) {
      savedGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center;"><p>Error pulling bookmarks. Please reload the page.</p></div>`;
    }
  }
});
