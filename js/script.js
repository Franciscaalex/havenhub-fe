/* ============================================================
   js/script.js
   Full Property Catalog Search, Filtering & Bookmark System
   ============================================================ */
(function () {
  let PROPERTIES = [];

  const grid = document.getElementById("propertyGrid");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("searchBtn");
  const typeSelect = document.getElementById("filter-type");
  const minSelect = document.getElementById("filter-min");
  const maxSelect = document.getElementById("filter-max");
  const bedsSelect = document.getElementById("filter-beds");
  const clearBtn = document.getElementById("clearBtn");
  const applyBtn = document.getElementById("applyBtn");
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  const filtersCollapseBtn = document.getElementById("filtersCollapseBtn");
  const filtersRow = document.getElementById("filtersRow");

  const STORAGE_KEY = "havenhub_saved_properties";

  // 1. LOCAL STORAGE PERSISTENCE SYNC
  function getSavedEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setSavedEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function getSavedIds() {
    return getSavedEntries().map((e) => e.id);
  }

  window.HavenHubSaved = {
    getSavedEntries,
    setSavedEntries,
    getSavedIds,
    STORAGE_KEY,
  };

  function toggleSaved(id) {
    const entries = getSavedEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx > -1) {
      entries.splice(idx, 1);
    } else {
      entries.push({ id, savedAt: new Date().toISOString() });
    }
    setSavedEntries(entries);
    document.dispatchEvent(
      new CustomEvent("property:saved-changed", {
        detail: { id, saved: idx === -1 },
      }),
    );
    return idx === -1;
  }

  // 2. MARKUP ICON AND TEMPLATE GENERATORS
  function bedIcon() {
    return '<img src="Bed.png" alt="Bed">';
  }
  function bathIcon() {
    return '<img src="Shower.png" alt="Bath">';
  }

  function heartIcon(isSaved) {
    return `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        fill="${isSaved ? "var(--accent-blue)" : "transparent"}"
        stroke="var(--accent-blue)"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>`;
  }

  function renderCard(p, isSaved) {
    const card = document.createElement("article");
    card.className = "card";
    const statusClass = p.status?.toLowerCase() === "rented" ? "rented" : "available";
    
    const displayPrice = typeof p.price === 'number' ? p.price.toLocaleString() : p.price;
    const displaySqft = typeof p.sqft === 'number' ? p.sqft.toLocaleString() : p.sqft;

    card.innerHTML = `
      <!-- INTERACTIVE IMAGE LINK: Navigates cleanly to details -->
      <a href="property-details.html?id=${p.id}" class="card-media-link" aria-label="View details for ${p.address}">
        <div class="card-media" style="background-image:url('${p.img || 'images/property-placeholder.png'}')"></div>
      </a>
      
      <!-- HEART BOOKMARK KEYLESS TRIGGER VALUE -->
      <button class="heart-btn" data-id="${p.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove from saved" : "Save property"}">
        ${heartIcon(isSaved)}
      </button>

      <div class="card-body">
        <div class="price">$${displayPrice}/mo</div>
        <div class="address">${p.address || 'Location Unavailable'}</div>
        <div class="card-stats">
          <div class="stat-badge" title="${p.beds} Bedrooms">
            <span class="stat-icon bed-icon">${bedIcon()}</span>
            <span class="badge-count">${p.beds}</span>
          </div>
          <div class="stat-badge" title="${p.baths} Bathrooms">
            <span class="stat-icon">${bathIcon()}</span>
            <span class="badge-count">${p.baths}</span>
          </div>
          <span class="sqft-text">${displaySqft} sqft</span>
        </div>
        <span class="status-badge ${statusClass}">${p.status}</span>
      </div>
    `;
    return card;
  }

  // 3. FILTER LOGIC DATA EXTRACTION PIPELINE
  function getFilteredProperties() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeSelect.value;
    const min = minSelect.value ? Number(minSelect.value) : null;
    const max = maxSelect.value ? Number(maxSelect.value) : null;
    const beds = bedsSelect.value ? Number(bedsSelect.value) : null;

    return PROPERTIES.filter((p) => {
      const addressString = p.address || '';
      if (query && !addressString.toLowerCase().includes(query)) return false;
      if (type && p.type !== type) return false;
      if (min !== null && p.price < min) return false;
      if (max !== null && p.price > max) return false;
      if (beds !== null && p.beds < beds) return false;
      return true;
    });
  }

  function applyFilters() {
    redraw(getFilteredProperties());
  }

  function redraw(list) {
    if (!grid) return;
    grid.innerHTML = "";
    const savedIds = getSavedIds();

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>No properties match your filters</h3>
          <p>Try widening your price range or clearing a filter.</p>
        </div>`;
      return;
    }

    list.forEach((p) =>
      grid.appendChild(renderCard(p, savedIds.includes(p.id)))
    );
  }

  /* ============================================================
     4. DELEGATE INTERACTION EVENTS & SLIDER EVENT BINDINGS
     ============================================================ */
  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest(".heart-btn");
    if (!btn) return;
    
    const id = btn.dataset.id;
    const resolvedId = isNaN(Number(id)) ? id : Number(id);

    const nowSaved = toggleSaved(resolvedId);
    btn.setAttribute("aria-pressed", nowSaved);
    btn.setAttribute(
      "aria-label",
      nowSaved ? "Remove from saved" : "Save property"
    );
    btn.innerHTML = heartIcon(nowSaved);
  });

  [typeSelect, minSelect, maxSelect, bedsSelect].forEach((el) => {
    el?.addEventListener("change", applyFilters);
  });
  
  searchInput?.addEventListener("input", applyFilters);
  searchBtn?.addEventListener("click", applyFilters);

  clearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (typeSelect) typeSelect.value = "";
    if (minSelect) minSelect.value = "";
    if (maxSelect) maxSelect.value = "";
    if (bedsSelect) bedsSelect.value = "";
    applyFilters();
  });

  /* ============================================================
     5. FILTERS DRAWER AND SLIDER INTERACTION CONTROLLERS
     ============================================================ */
  function openFiltersDrawer() {
    if (!filtersRow) return;
    filtersRow.classList.add("open");
    filterToggleBtn?.classList.add("open");
    filterToggleBtn?.setAttribute("aria-expanded", "true");
  }

  function closeFiltersDrawer() {
    if (!filtersRow) return;
    filtersRow.classList.remove("open");
    filterToggleBtn?.classList.remove("open");
    filterToggleBtn?.setAttribute("aria-expanded", "false");
  }

  filterToggleBtn?.addEventListener("click", () => {
    if (!filtersRow) return;
    filtersRow.classList.contains("open") ? closeFiltersDrawer() : openFiltersDrawer();
  });

  filtersCollapseBtn?.addEventListener("click", closeFiltersDrawer);
  
  applyBtn?.addEventListener("click", () => {
    applyFilters();
    closeFiltersDrawer();
  });

  /* ============================================================
     6. MOBILE MENU ACCESSIBILITY DRIVER
     ============================================================ */
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  
  menuToggle?.addEventListener("click", () => {
    if (!mobileMenu) return;
    const isOpen = mobileMenu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen);
  });

  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
    });
  });

  /* ============================================================
     7. RESPONSIVE DESKTOP SEARCH PLACEHOLDER SWITCHER
     ============================================================ */
  const desktopQuery = window.matchMedia("(min-width: 960px)");
  function updatePlaceholder(e) {
    if (!searchInput) return;
    searchInput.placeholder = e.matches
      ? "Search by location, e.g. Greenwood, Austin"
      : "Search location";
  }
  updatePlaceholder(desktopQuery);
  desktopQuery.addEventListener("change", updatePlaceholder);

  /* ============================================================
     8. PROFILE PICTURE LOCAL STORAGE UPLOADER LAYOUT HANDLERS
     ============================================================ */
  const profileBtn = document.getElementById("profileBtn");
  const profileImageInput = document.getElementById("profileImageInput");
  const profileAvatar = document.getElementById("profileAvatar");
  const PROFILE_IMAGE_KEY = "havenhub_profile_image";

  const savedProfileImage = localStorage.getItem(PROFILE_IMAGE_KEY);
if (savedProfileImage && profileAvatar) {
    profileAvatar.src = savedProfileImage;
  }

  profileBtn?.addEventListener("click", () => {
    profileImageInput?.click();
  });

  profileImageInput?.addEventListener("change", () => {
    const file = profileImageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
      const imageData = event.target.result;
      if (profileAvatar) profileAvatar.src = imageData;
      localStorage.setItem(PROFILE_IMAGE_KEY, imageData);
      
      // Update top header profile avatar as well if present on layout
      const headerAvatar = document.getElementById("headerAvatarImg");
      if (headerAvatar) headerAvatar.src = imageData;
    };
    reader.readAsDataURL(file);
  });

  /* ============================================================
     9. DYNAMIC PROPERTIES REAL-TIME API SYNC LIFECYCLE
     ============================================================ */
  if (grid) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Loading properties…</p></div>`;
  }

  // Uses your established API module wrapper securely instead of mock strings
  const loadPropertiesFromAPI = async () => {
    try {
       if (!window.api) {
        throw new Error("api.js gateway module not detected in runtime hierarchy.");
      }

      // Query listings array records cleanly matching your Swagger spec
      const response = await window.api.get('/properties?limit=50');
      const apiItems = response?.items || response || [];

      // Re-map keys smoothly into the client-side variable array fields
      PROPERTIES = apiItems.map(item => {
        // Resolve status string constants from server payload models
        const rawStatus = (item.status || 'AVAILABLE').toUpperCase();
        let finalStatus = 'Available';

        if (rawStatus === 'APPROVED' || rawStatus === 'AVAILABLE') {
          finalStatus = 'Available';
        } else if (rawStatus === 'RENTED') {
          finalStatus = 'Rented';
           } else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_REVIEW') {
          finalStatus = 'Pending';
        }

        return {
          id: item._id || item.id,
          price: item.price || 0,
          address: item.address || `${item.city || 'HavenHub'}, ${item.state || 'Property'}`,
          beds: item.bedrooms || item.beds || 0,
          baths: item.bathrooms || item.baths || 0,
          sqft: item.squareFeet || item.sqft || 0,
          type: item.propertyType || item.type || 'Apartment',
          status: finalStatus,
          // STRICT LIVE MODE: Only load genuine images returning from API array blocks
          img: item.imageUrl || (item.images && item.images[0]) || 'images/property-placeholder.png'
        };
      });
 window.HAVENHUB_PROPERTIES = PROPERTIES; // Keep backward compatibility context intact
      applyFilters();

    } catch (err) {
      console.error("Discovery grid extraction layer initialization broken:", err);
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 0;"> 
            <h3 style="color: #EF4444;">Couldn't load properties</h3>
            <p style="color: #64748B;">Please refresh the page to try again.</p> 
          </div>`;
      }
    }
  };

  // Launch execution pipeline parameters natively
  loadPropertiesFromAPI();
})();