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

  function bedIcon() {
    return '<img src="Bed.png" alt="Bed">';
  }
  function bathIcon() {
    return '<img src="Shower.png" alt="Bath">';
  }

  function heartIcon(isSaved) {
    return `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
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
    const statusClass = p.status === "Rented" ? "rented" : "available";
    card.innerHTML = `
      <div class="card-media" style="background-image:url('${p.img}')">
        <button class="heart-btn" data-id="${p.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove from saved" : "Save property"}">
          ${heartIcon(isSaved)}
        </button>
      </div>
      <div class="card-body">
        <div class="price">$${p.price.toLocaleString()}/mo</div>
        <div class="address">${p.address}</div>
        <div class="card-stats">
          <div class="stat-badge" title="${p.beds} Bedrooms">
            <span class="stat-icon bed-icon">${bedIcon()}</span>
            <span class="badge-count">${p.beds}</span>
          </div>
          <div class="stat-badge" title="${p.baths} Bathrooms">
            <span class="stat-icon">${bathIcon()}</span>
            <span class="badge-count">${p.baths}</span>
          </div>
          <span class="sqft-text">${p.sqft.toLocaleString()} sqft</span>
        </div>
        <span class="status-badge ${statusClass}">${p.status}</span>
      </div>
    `;
    return card;
  }

  function getFilteredProperties() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeSelect.value;
    const min = minSelect.value ? Number(minSelect.value) : null;
    const max = maxSelect.value ? Number(maxSelect.value) : null;
    const beds = bedsSelect.value ? Number(bedsSelect.value) : null;

    return PROPERTIES.filter((p) => {
      if (query && !p.address.toLowerCase().includes(query)) return false;
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
    grid.innerHTML = "";
    const savedIds = getSavedIds();

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>No properties match your filters</h3>
          <p>Try widening your price range or clearing a filter.</p>
        </div>`;
      return;
    }

    list.forEach((p) =>
      grid.appendChild(renderCard(p, savedIds.includes(p.id))),
    );
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".heart-btn");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const nowSaved = toggleSaved(id);
    btn.setAttribute("aria-pressed", nowSaved);
    btn.setAttribute(
      "aria-label",
      nowSaved ? "Remove from saved" : "Save property",
    );
    btn.innerHTML = heartIcon(nowSaved);
  });

  [typeSelect, minSelect, maxSelect, bedsSelect].forEach((el) =>
    el.addEventListener("change", applyFilters),
  );
  searchInput.addEventListener("input", applyFilters);
  searchBtn.addEventListener("click", applyFilters);

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    typeSelect.value = "";
    minSelect.value = "";
    maxSelect.value = "";
    bedsSelect.value = "";
    applyFilters();
  });

  function openFiltersDrawer() {
    filtersRow.classList.add("open");
    filterToggleBtn.classList.add("open");
    filterToggleBtn.setAttribute("aria-expanded", true);
  }
  function closeFiltersDrawer() {
    filtersRow.classList.remove("open");
    filterToggleBtn.classList.remove("open");
    filterToggleBtn.setAttribute("aria-expanded", false);
  }
  filterToggleBtn.addEventListener("click", () => {
    filtersRow.classList.contains("open")
      ? closeFiltersDrawer()
      : openFiltersDrawer();
  });
  filtersCollapseBtn.addEventListener("click", closeFiltersDrawer);
  applyBtn.addEventListener("click", () => {
    applyFilters();
    closeFiltersDrawer();
  });

  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  menuToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen);
  });
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", false);
    });
  });

  const desktopQuery = window.matchMedia("(min-width: 960px)");
  function updatePlaceholder(e) {
    searchInput.placeholder = e.matches
      ? "Search by location, e.g. Greenwood, Austin"
      : "Search location";
  }
  updatePlaceholder(desktopQuery);
  desktopQuery.addEventListener("change", updatePlaceholder);

  // ---------- Profile Picture ----------
  const profileBtn = document.getElementById("profileBtn");
  const profileImageInput = document.getElementById("profileImageInput");
  const profileAvatar = document.getElementById("profileAvatar");
  const PROFILE_IMAGE_KEY = "havenhub_profile_image";

  const savedProfileImage = localStorage.getItem(PROFILE_IMAGE_KEY);
  if (savedProfileImage && profileAvatar) {
    profileAvatar.src = savedProfileImage;
  }

  if (profileBtn && profileImageInput) {
    profileBtn.addEventListener("click", () => {
      profileImageInput.click();
    });
  }

  if (profileImageInput && profileAvatar) {
    profileImageInput.addEventListener("change", () => {
      const file = profileImageInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = function (event) {
        const imageData = event.target.result;
        profileAvatar.src = imageData;
        localStorage.setItem(PROFILE_IMAGE_KEY, imageData);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Load properties from the (mock) API ----------
  grid.innerHTML = `<div class="empty-state"><p>Loading properties…</p></div>`;
  window.HavenHubAPI.getProperties()
    .then((data) => {
      PROPERTIES = data;
      window.HAVENHUB_PROPERTIES = PROPERTIES; // kept for anything else that reads this global
      applyFilters();
    })
    .catch(() => {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Couldn't load properties</h3>
          <p>Please refresh the page to try again.</p>
        </div>`;
    });
})();
