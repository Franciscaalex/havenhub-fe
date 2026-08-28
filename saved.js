(function () {
  "use strict";

  let PROPERTIES = [];

  const STORAGE_KEY = "havenhub_saved_properties";

  const grid = document.getElementById("propertyGrid");
  const savedHeading = document.getElementById("savedHeading");
  const savedTabs = document.getElementById("savedTabs");
  const sortSelect = document.getElementById("sortSelect");

  let activeStatus = "all";
  let activeSort = "newest";

  // --------------------------------
  // Saved properties
  // --------------------------------

  function getSavedEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function setSavedEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function removeSavedProperty(id) {
    const entries = getSavedEntries();

    const updatedEntries = entries.filter((entry) => entry.id !== Number(id));

    setSavedEntries(updatedEntries);
  }

  // --------------------------------
  // Icons
  // --------------------------------

  function bedIcon() {
    return '<img src="Bed.png" alt="Bed">';
  }

  function bathIcon() {
    return '<img src="Shower.png" alt="Bath">';
  }

  function heartIcon() {
    return `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        fill="var(--accent-blue)"
        stroke="var(--accent-blue)"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  `;
  }
  // --------------------------------
  // Render card
  // --------------------------------

  function renderCard(property) {
    const wrap = document.createElement("div");

    wrap.className = "card-wrap";

    const statusClass = property.status === "Rented" ? "rented" : "available";

    wrap.innerHTML = `
      <article class="card">

        <div
          class="card-media"
          style="background-image:url('${property.img}')"
        >

          <button
            class="heart-btn"
            data-id="${property.id}"
            aria-pressed="true"
            aria-label="Remove from saved"
          >
            ${heartIcon()}
          </button>

        </div>

        <div class="card-body">

          <div class="price">
            $${property.price.toLocaleString()}/mo
          </div>

          <div class="address">
            ${property.address}
          </div>

          <div class="card-stats">

            <div
              class="stat-badge"
              title="${property.beds} Bedrooms"
            >
              <span class="stat-icon bed-icon">
                ${bedIcon()}
              </span>

              <span class="badge-count">
                ${property.beds}
              </span>
            </div>

            <div
              class="stat-badge"
              title="${property.baths} Bathrooms"
            >
              <span class="stat-icon">
                ${bathIcon()}
              </span>

              <span class="badge-count">
                ${property.baths}
              </span>
            </div>

            <span class="sqft-text">
              ${property.sqft.toLocaleString()} sqft
            </span>

          </div>

          <span class="status-badge ${statusClass}">
            ${property.status}
          </span>

        </div>

      </article>

      <div class="card-actions">

        <button
          class="detail-btn ${property.status === "Rented" ? "disabled" : ""}"
          type="button"
          data-id="${property.id}"
          ${property.status === "Rented" ? "disabled" : ""}
        >
          View Listing Details
        </button>

        ${
          property.status === "Available"
            ? `
              <button
                class="message-btn"
                type="button"
                data-id="${property.id}"
              >
                Message Landlord
              </button>
            `
            : ""
        }

      </div>
    `;

    return wrap;
  }

  // --------------------------------
  // Get saved properties
  // --------------------------------

  function getSavedProperties() {
    const entries = getSavedEntries();

    const savedMap = new Map(
      entries.map((entry) => [Number(entry.id), entry.savedAt]),
    );

    return PROPERTIES.filter((property) => savedMap.has(property.id)).map(
      (property) => ({
        ...property,
        savedAt: savedMap.get(property.id),
      }),
    );
  }

  // --------------------------------
  // Update counters
  // --------------------------------

  function updateCounters(saved) {
    const allCount = saved.length;

    const availableCount = saved.filter(
      (property) => property.status === "Available",
    ).length;

    const rentedCount = saved.filter(
      (property) => property.status === "Rented",
    ).length;

    savedHeading.textContent = `My Saved Properties (${allCount})`;

    savedTabs.querySelector('[data-status="all"]').textContent =
      `All (${allCount})`;

    savedTabs.querySelector('[data-status="Available"]').textContent =
      `Available (${availableCount})`;

    savedTabs.querySelector('[data-status="Rented"]').textContent =
      `Rented (${rentedCount})`;
  }

  // --------------------------------
  // Sorting
  // --------------------------------

  function sortProperties(list) {
    const sorted = [...list];

    switch (activeSort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
        break;
      case "price-low":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        break;
    }

    return sorted;
  }

  // --------------------------------
  // Render saved page
  // --------------------------------

  function render() {
    let saved = getSavedProperties();

    updateCounters(saved);

    if (activeStatus !== "all") {
      saved = saved.filter((property) => property.status === activeStatus);
    }

    saved = sortProperties(saved);

    grid.innerHTML = "";

    if (saved.length === 0) {
      showEmptyState();
      return;
    }

    saved.forEach((property) => {
      grid.appendChild(renderCard(property));
    });
  }

  // --------------------------------
  // Empty state
  // --------------------------------

  function showEmptyState() {
    grid.innerHTML = `
      <div class="empty-state">

        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M12 21s-7.5-4.9-10-9.3C.5 8.1 2.4 4.5 6 4.1c2.2-.2 4.1 1 6 3.1 1.9-2.1 3.8-3.3 6-3.1 3.6.4 5.5 4 4 7.6C19.5 16.1 12 21 12 21z"
          />
        </svg>

        <h3>No saved properties yet</h3>

        <p>
          Tap the heart on any listing in Browse Properties
          to bookmark it here.
        </p>

      </div>
    `;
  }

  // --------------------------------
  // Card actions
  // --------------------------------

  grid.addEventListener("click", (event) => {
    // Remove from saved
    const heartButton = event.target.closest(".heart-btn");

    if (heartButton) {
      const id = Number(heartButton.dataset.id);

      removeSavedProperty(id);
      render();

      return;
    }

    // --------------------------------
    // View Listing Details
    // --------------------------------

    const detailButton = event.target.closest(".detail-btn");

    if (detailButton && !detailButton.disabled) {
      const id = Number(detailButton.dataset.id);

      window.location.href = `property-details.html?id=${id}`;

      return;
    }

    // --------------------------------
    // Message Landlord
    // --------------------------------

    const messageButton = event.target.closest(".message-btn");

    if (messageButton) {
      const id = Number(messageButton.dataset.id);

      const property = PROPERTIES.find((item) => item.id === id);

      if (property) {
        window.openInquireModal(property);
      }
    }
  });

  // --------------------------------
  // Saved tabs
  // --------------------------------

  savedTabs.querySelectorAll(".saved-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeStatus = tab.dataset.status;

      savedTabs.querySelectorAll(".saved-tab").forEach((item) => {
        item.classList.toggle("active", item === tab);
      });

      render();
    });
  });

  // --------------------------------
  // Sort dropdown
  // --------------------------------

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      activeSort = sortSelect.value;
      render();
    });
  }

  // --------------------------------
  // Mobile menu
  // --------------------------------

  const menuToggle = document.getElementById("menuToggle");

  const mobileMenu = document.getElementById("mobileMenu");

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", isOpen);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.remove("open");

        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // --------------------------------
  // Profile picture
  // --------------------------------

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
        alert("Please select an image.");
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        const image = event.target.result;

        profileAvatar.src = image;

        localStorage.setItem(PROFILE_IMAGE_KEY, image);
      };

      reader.readAsDataURL(file);
    });
  }

  // --------------------------------
  // Load properties
  // --------------------------------

  grid.innerHTML = `
    <div class="empty-state">
      <p>Loading your saved properties…</p>
    </div>
  `;

  window.HavenHubAPI.getProperties()
    .then((data) => {
      PROPERTIES = data;

      render();
    })
    .catch(() => {
      grid.innerHTML = `
        <div class="empty-state">

          <h3>
            Couldn't load your saved properties
          </h3>

          <p>
            Please refresh the page to try again.
          </p>

        </div>
      `;
    });
})();
