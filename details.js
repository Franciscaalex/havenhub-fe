(function () {
  "use strict";

  const root = document.getElementById("detailsRoot");

  // --------------------------------
  // Gallery Renderer
  // --------------------------------

  function renderGallery(property) {
    const photos =
      property.photos && property.photos.length > 0
        ? property.photos
        : [property.img];

    const mainPhoto = photos[0];

    // Single Image Layout
    if (photos.length <= 1) {
      return `
        <div class="details-gallery single-image">
          <div
            class="details-gallery-main"
            style="background-image:url('${mainPhoto}')"
          ></div>
        </div>
      `;
    }

    const extraThumbs = photos.slice(1, 5);
    const remainingCount = Math.max(0, photos.length - 5);

    return `
      <div class="details-gallery multi-image">
        <div
          class="details-gallery-main"
          style="background-image:url('${mainPhoto}')"
        ></div>

        <div class="details-gallery-thumbs">
          ${extraThumbs
            .map((src, index) => {
              const isLast =
                index === extraThumbs.length - 1 && remainingCount > 0;

              return `
                <div
                  class="details-gallery-thumb${isLast ? " more" : ""}"
                  style="background-image:url('${src}')"
                  ${isLast ? `data-more="+${remainingCount} Photos"` : ""}
                ></div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  // --------------------------------
  // Render Main Layout
  // --------------------------------

  function renderProperty(property) {
    // Dynamic fallbacks if API fields are missing
    const keyHighlights = property.keyHighlights || [
      `Prime Location: 5 mins drive from local business hub with 24/7 security.`,
      `Excellent Value: Rent includes water treatment and dedicated underground parking spot.`,
      `Tenant Rating: Rated 4.9/5 for landlord responsiveness and neighbourhood quietness.`,
    ];

    const amenities = property.amenities || [
      "Swimming Pool",
      "Fitness Center",
      "24/7 Power Backup",
      "Gated Security",
      "Reserved Parking",
      "High-Speed WIFI",
    ];

    root.innerHTML = `
      <div class="details-container">

        <!-- Gallery -->
        ${renderGallery(property)}

        <!-- 2-Column Responsive Layout -->
        <div class="details-content-grid">

          <!-- Left Column -->
          <div class="details-main-info">

            <h1 class="details-title">
              ${property.title}
            </h1>

            <div class="details-location">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>

              ${property.address} · Verified Listing
            </div>

            <div class="details-price">
              $${property.price.toLocaleString()}/mo
            </div>

            <div class="details-badges">

              <span class="details-badge">
                <img src="Bed.png" alt="" />
                ${property.beds}
                Bedroom${property.beds === 1 ? "" : "s"}
              </span>

              <span class="details-badge">
                <img src="Shower.png" alt="" />
                ${property.baths}
                Bathroom${property.baths === 1 ? "" : "s"}
              </span>

            </div>

            <!-- Key Highlights Box -->
            <div class="details-highlights">

              <div class="details-highlights-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 2L15 9.5L22 10L16.5 15L18.5 22L12 18L5.5 22L7.5 15L2 10L9 9.5L12 2Z"/>
                </svg>

                Key Highlights
              </div>

              <ul>
                ${keyHighlights
                  .map((highlight) => `<li>${highlight}</li>`)
                  .join("")}
              </ul>

            </div>

          </div>

          <!-- Right Column -->
          <div class="details-side-info">

            <div class="details-section">

              <h3>About this Property</h3>

              <p>
                ${property.description}
              </p>

            </div>

            <div class="details-section">

              <h3>Amenities</h3>

              <p class="details-amenities">
                ${amenities
                  .map((amenity) => `<span>${amenity}</span>`)
                  .join("")}
              </p>

            </div>

          </div>

        </div>

      </div>
    `;
  }

  // --------------------------------
  // States
  // --------------------------------

  function showLoading() {
    root.innerHTML = `
      <div class="details-container">
        <div class="empty-state">
          <p>Loading property…</p>
        </div>
      </div>
    `;
  }

  function showNotFound() {
    root.innerHTML = `
      <div class="details-container">
        <div class="empty-state">
          <h3>Property not found</h3>
          <a href="index.html">Back to Browse</a>
        </div>
      </div>
    `;
  }

  // --------------------------------
  // Load Property
  // --------------------------------

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    showNotFound();
    return;
  }

  showLoading();

  window.HavenHubAPI.getPropertyById(id)
    .then((property) => {
      if (!property) {
        showNotFound();
        return;
      }

      renderProperty(property);
    })
    .catch(() => {
      showNotFound();
    });
})();
