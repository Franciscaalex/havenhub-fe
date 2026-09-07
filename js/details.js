(function () {
  "use strict";

  const root = document.getElementById("detailsRoot");
  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get("id");

  const STORAGE_KEY = "havenhub_saved_properties";

  if (!propertyId) {
    showNotFound();
    return;
  }

  // --------------------------------
  // Saved/Wishlist — localStorage, same STORAGE_KEY as script.js and
  // saved.js, so this page stays in sync with the rest of the app
  // instead of depending on an unconfirmed server-side save endpoint.
  // --------------------------------
  function getSavedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).map(item => item.id) : [];
    } catch (e) {
      return [];
    }
  }

  function toggleSavedLocal(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let entries = raw ? JSON.parse(raw) : [];
      const idx = entries.findIndex(e => e.id === id);
      let nowSaved;
      if (idx > -1) {
        entries.splice(idx, 1);
        nowSaved = false;
      } else {
        entries.push({ id, savedAt: new Date().toISOString() });
        nowSaved = true;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      document.dispatchEvent(new CustomEvent('property:saved-changed', { detail: { id, saved: nowSaved } }));
      return nowSaved;
    } catch (e) {
      console.error('Could not update saved list:', e);
      return null;
    }
  }

  // --------------------------------
  // Small formatting helpers
  // --------------------------------
  function formatAmenity(raw) {
    return String(raw)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function landlordAvatarHtml(landlord) {
    const name = [landlord?.firstName, landlord?.lastName].filter(Boolean).join(' ') || 'Landlord';
    if (landlord?.avatarUrl) {
      return `<img class="sidebar-landlord-avatar" src="${landlord.avatarUrl}" alt="${name}">`;
    }
    // No fake photo when the API has none — an initials circle instead,
    // consistent with the "real API images only" rule used elsewhere.
    const initials = ((landlord?.firstName?.[0] || '') + (landlord?.lastName?.[0] || '')).toUpperCase() || '?';
    return `<div class="sidebar-landlord-avatar sidebar-landlord-avatar-initials">${initials}</div>`;
  }

  // --------------------------------
  // Gallery Component
  // --------------------------------
  function renderGallery(property) {
    // Real API field is "images" (array of URL strings) — not "photos"
    // or "img", which don't exist on the raw property object returned
    // by GET /properties/{id}.
    const photos = Array.isArray(property.images) ? property.images : [];

    if (photos.length === 0) {
      return `
        <div class="details-gallery single-image">
          <div class="details-gallery-main details-gallery-empty"></div>
        </div>
      `;
    }

    const mainPhoto = photos[0];

    if (photos.length === 1) {
      return `
        <div class="details-gallery single-image">
          <div class="details-gallery-main" style="background-image:url('${mainPhoto}')"></div>
        </div>
      `;
    }

    const extraThumbs = photos.slice(1, 5);
    const remainingCount = Math.max(0, photos.length - 5);

    return `
      <div class="details-gallery multi-image">
        <div class="details-gallery-main" style="background-image:url('${mainPhoto}')"></div>
        <div class="details-gallery-thumbs">
          ${extraThumbs.map((src, index) => {
            const isLast = index === extraThumbs.length - 1 && remainingCount > 0;
            return `
              <div class="details-gallery-thumb${isLast ? " more" : ""}" 
                   style="background-image:url('${src}')" 
                   ${isLast ? `data-more="+${remainingCount} Photos"` : ""}>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // --------------------------------
  // Combined Layout Generator
  // --------------------------------
  function renderProperty(property) {
    const keyHighlights = property.keyHighlights || [
      `Prime Location: 5 mins drive from local business hub with 24/7 security.`,
      `Excellent Value: Rent includes water treatment and dedicated underground parking spot.`,
      `Tenant Rating: Rated 4.9/5 for landlord responsiveness and neighbourhood quietness.`,
    ];

    const amenities = Array.isArray(property.amenities) && property.amenities.length > 0
      ? property.amenities.map(formatAmenity)
      : ["Swimming Pool", "Fitness Center", "24/7 Power Backup", "Gated Security", "Reserved Parking", "High-Speed WIFI"];

    const monthlyPrice = Number(property.price) || 0;
    const annualPrice = monthlyPrice * 12;

    // These fields aren't confirmed to exist on the real API — shown only
    // if actually present, never fabricated with placeholder numbers.
    const depositParts = [];
    if (property.securityDeposit) depositParts.push(`Security Deposit: $${Number(property.securityDeposit).toLocaleString()}`);
    if (property.minLeaseTerm) depositParts.push(`Min. Lease: ${property.minLeaseTerm}`);
    const depositLine = depositParts.join(' • ');

    const landlordName = [property.landlord?.firstName, property.landlord?.lastName].filter(Boolean).join(' ') || 'Verified Landlord';
    const isSavedInitially = getSavedIds().includes(propertyId) || getSavedIds().includes(Number(propertyId));

    root.innerHTML = `
      <div class="details-container">
        <!-- Gallery -->
        ${renderGallery(property)}

        <!-- 2-Column Responsive Layout -->
        <div class="details-content-grid">
          <!-- Left Column: everything about the property itself -->
          <div class="details-main-info">
            <h1 class="details-title">${property.title ?? 'Untitled Property'}</h1>

            <div class="details-location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${property.address || property.location || 'No location address listed'} · Verified Listing
            </div>

            <div class="details-price">$${monthlyPrice.toLocaleString()}/mo</div>

            <div class="details-badges">
              <span class="details-badge">
                <span class="badge-icon-circle"><img src="Bed.png" alt="" /></span>
                ${property.bedrooms ?? 0} Bedroom${property.bedrooms === 1 ? "" : "s"}
              </span>
              <span class="details-badge">
                <span class="badge-icon-circle"><img src="Shower.png" alt="" /></span>
                ${property.bathrooms ?? 0} Bathroom${property.bathrooms === 1 ? "" : "s"}
              </span>
            </div>

            <!-- Key Highlights Box -->
            <div class="details-highlights">
              <div class="details-highlights-title">
                <span class="details-highlights-title-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L15 9.5L22 10L16.5 15L18.5 22L12 18L5.5 22L7.5 15L2 10L9 9.5L12 2Z"/>
                  </svg>
                  Key Highlights
                </span>
                <button type="button" id="aiSummarizeBtn" class="ai-summarize-btn">
                  ✨ AI Summarize
                </button>
              </div>
              <ul id="keyHighlightsList">
                ${keyHighlights.map((highlight) => `<li>${highlight}</li>`).join("")}
              </ul>
            </div>

            <div class="details-section">
              <h3>About this Property</h3>
              <p>${property.description ?? 'No description provided.'}</p>
            </div>
            <div class="details-section">
              <h3>Amenities</h3>
              <p class="details-amenities">
                ${amenities.map((amenity) => `<span>${amenity}</span>`).join("")}
              </p>
            </div>
          </div>

          <!-- Right Column: pricing, landlord, and actions card -->
          <div class="details-side-info">
            <div class="details-sidebar-card">
              <div class="sidebar-annual-price">$${annualPrice.toLocaleString()}/yr</div>
              ${depositLine ? `<div class="sidebar-lease-meta">${depositLine}</div>` : ''}

              <div class="sidebar-landlord-label">Listed by Landlord</div>
              <div class="sidebar-landlord-row">
                ${landlordAvatarHtml(property.landlord)}
                <div class="sidebar-landlord-info">
                  <div class="sidebar-landlord-name">${landlordName}</div>
                  ${property.landlord?.isVerified ? `<div class="sidebar-verified-badge">Verified Owner</div>` : ''}
                </div>
              </div>

              <button id="enquireNowBtn" class="sidebar-enquire-btn">
                Enquire Now
              </button>

              <div class="sidebar-secondary-actions">
                <button id="saveWishlistBtn" class="sidebar-ghost-btn ${isSavedInitially ? 'is-saved' : ''}">
                  <svg viewBox="0 0 24 24" fill="${isSavedInitially ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                  </svg>
                  <span>${isSavedInitially ? 'Saved' : 'Save to Wishlist'}</span>
                </button>
                <button id="shareListingBtn" class="sidebar-ghost-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
                  </svg>
                  <span>Share listing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    wireInteractionButtons(property);
  }

  // --------------------------------
  // Event Actions
  // --------------------------------
  function wireInteractionButtons(property) {
    document.getElementById('saveWishlistBtn')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const nowSaved = toggleSavedLocal(propertyId);
      if (nowSaved === null) return; // storage write failed — leave UI as-is
      btn.classList.toggle('is-saved', nowSaved);
      const label = btn.querySelector('span');
      if (label) label.textContent = nowSaved ? 'Saved' : 'Save to Wishlist';
      const icon = btn.querySelector('svg');
      if (icon) icon.setAttribute('fill', nowSaved ? 'currentColor' : 'none');
    });

    document.getElementById('enquireNowBtn')?.addEventListener('click', () => {
      const threadParams = new URLSearchParams({ propertyId });
      if (property.landlordId) threadParams.set('landlordId', property.landlordId);
      window.location.href = `thread.html?${threadParams.toString()}`;
    });

    document.getElementById('shareListingBtn')?.addEventListener('click', async () => {
      const shareData = { title: property.title || 'Property listing', url: window.location.href };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
          alert('Link copied to clipboard!');
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      }
    });

    document.getElementById('aiSummarizeBtn')?.addEventListener('click', () => handleAiSummarize(property));
  }

  // --------------------------------
  // AI Summarize (POST /ai/summarize)
  // --------------------------------
  // Confirmed via Swagger: request body takes { description } (matching
  // its sibling GET convenience endpoint's query param of the same name).
  // The response shape wasn't shown in the docs though, so this tries
  // several likely field names and logs the raw response — if none of
  // the guesses match, check the console log and the real shape will be
  // right there to fix in one line, same as we did for generatedDescription
  // earlier.
  async function handleAiSummarize(property) {
    const btn = document.getElementById('aiSummarizeBtn');
    const listEl = document.getElementById('keyHighlightsList');
    if (!btn || !listEl) return;

    const description = property.description || '';
    if (!description.trim()) {
      alert('This listing has no description to summarize.');
      return;
    }

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Summarizing…';

    try {
      const data = await window.api.post('/ai/summarize', { description });
      console.log('AI summarize raw response:', data);

      const highlights =
        data?.highlights ??
        data?.data?.highlights ??
        data?.keyHighlights ??
        data?.summary ??
        data?.result;

      let items = [];
      if (Array.isArray(highlights)) {
        items = highlights;
      } else if (typeof highlights === 'string' && highlights.trim()) {
        items = [highlights];
      }

      if (items.length === 0) {
        throw new Error('AI response did not include any highlights.');
      }

      listEl.innerHTML = items.map(h => `<li>${h}</li>`).join('');

    } catch (err) {
      console.error('AI summarize failed:', err);
      alert(`Couldn't generate highlights: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  // --------------------------------
  // State Handlers
  // --------------------------------
  function showLoading() {
    root.innerHTML = `<div class="details-container"><div class="empty-state"><p>Loading property…</p></div></div>`;
  }

  function showNotFound() {
    root.innerHTML = `<div class="details-container"><div class="empty-state"><h3>Property not found</h3><a href="seeker-dashboard.html">Back to Browse</a></div></div>`;
  }

  // --------------------------------
  // Main Execution Block
  // --------------------------------
  showLoading();

  // NOTE: api.js's base URL already includes '/api/v1' — do NOT repeat
  // it here. The previous '/api/v1/properties/...' call was hitting
  // '/api/v1/api/v1/properties/...' and 404ing on every property,
  // which is why "Property not found" was showing up regardless of
  // which listing was clicked.
  window.api.get(`/properties/${propertyId}`)
    .then((property) => {
      if (!property) {
        showNotFound();
        return;
      }
      renderProperty(property);
    })
    .catch((err) => {
      console.error('API Error:', err);
      showNotFound();
    });
})();