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
  // Saved/Wishlist — the server (GET/POST/DELETE /saved-properties, tied to
  // the logged-in user) is the source of truth; localStorage is kept only
  // as an optimistic same-tab cache, same STORAGE_KEY as script.js and
  // saved.js.
  // --------------------------------
  function getLocalSavedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).map(item => item.id) : [];
    } catch (e) {
      return [];
    }
  }

  // Confirmed response shape for GET /saved-properties: a bare array of
  // bookmark rows, each shaped like { id: <bookmarkId>, userId, propertyId,
  // property: {...full property...}, createdAt }.
  function extractSavedIds(raw) {
    const list = Array.isArray(raw) ? raw : (raw?.items || raw?.data || []);
    return list
      .map(entry => {
        if (typeof entry === 'string') return entry;
        return entry?.property?._id || entry?.property?.id
          || entry?.propertyId || entry?._id || entry?.id || null;
      })
      .filter(Boolean)
      .map(String);
  }

  async function isSavedOnServer(id) {
    try {
      if (!window.api) return null;
      const raw = await window.api.get('/saved-properties');
      return extractSavedIds(raw).includes(String(id));
    } catch (err) {
      console.error('Could not load saved status from server:', err);
      return null;
    }
  }

  async function toggleSaved(id) {
    const raw = localStorage.getItem(STORAGE_KEY);
    let entries = raw ? JSON.parse(raw) : [];
    const idx = entries.findIndex(e => e.id === id);
    const willSave = idx === -1;

    try {
      if (willSave) {
        await window.api.post(`/saved-properties/${id}`);
      } else {
        await window.api.delete(`/saved-properties/${id}`);
      }
    } catch (err) {
      const alreadyInSync = willSave
        ? /already bookmarked/i.test(err.message)
        : /not bookmarked/i.test(err.message);
      if (!alreadyInSync) throw err;
    }

    if (willSave) {
      entries.push({ id, savedAt: new Date().toISOString() });
    } else {
      entries.splice(idx, 1);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    document.dispatchEvent(new CustomEvent('property:saved-changed', { detail: { id, saved: willSave } }));
    return willSave;
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
    const amenities = Array.isArray(property.amenities) && property.amenities.length > 0
      ? property.amenities.map(formatAmenity)
      : null; // No fake fallback list — render "No amenities listed" instead.

    const monthlyPrice = Number(property.price) || 0;
    const annualPrice = monthlyPrice * 12;

    // These fields aren't confirmed to exist on the real API — shown only
    // if actually present, never fabricated with placeholder numbers.
    const depositParts = [];
    if (property.securityDeposit) depositParts.push(`Security Deposit: $${Number(property.securityDeposit).toLocaleString()}`);
    if (property.minLeaseTerm) depositParts.push(`Min. Lease: ${property.minLeaseTerm}`);
    const depositLine = depositParts.join(' • ');

    const landlordName = [property.landlord?.firstName, property.landlord?.lastName].filter(Boolean).join(' ') || 'Verified Landlord';
    // Instant best-guess from the local cache — reconciled against the
    // server's answer right after render (see reconcileSavedState below).
    const isSavedInitially = getLocalSavedIds().includes(propertyId) || getLocalSavedIds().includes(Number(propertyId));

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

            <!-- Key Highlights Box — the header itself is the AI-summarize
                 trigger. No content shows until the seeker clicks it, and
                 what appears is generated from this specific listing's
                 real description — never generic filler text. -->
            <div class="details-highlights">
              <button type="button" id="aiSummarizeBtn" class="details-highlights-title ai-summarize-trigger">
                <span class="details-highlights-title-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L15 9.5L22 10L16.5 15L18.5 22L12 18L5.5 22L7.5 15L2 10L9 9.5L12 2Z"/>
                  </svg>
                  Key Highlights
                </span>
                <span class="ai-summarize-cta">✨ Generate with AI</span>
              </button>
              <div id="keyHighlightsContent" class="details-highlights-empty">
                Click above to generate AI highlights from this listing's description.
              </div>
            </div>

            <div class="details-section">
              <h3>About this Property</h3>
              <p>${property.description ?? 'No description provided.'}</p>
            </div>
            <div class="details-section">
              <h3>Amenities</h3>
              ${amenities
                ? `<p class="details-amenities">${amenities.map((amenity) => `<span>${amenity}</span>`).join("")}</p>`
                : `<p class="details-amenities-empty">No amenities listed for this property.</p>`
              }
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
    reconcileSavedState();
  }

  // Patches the Save button to match the server's answer, in case the
  // local cache (used for the instant first paint above) was stale or
  // simply didn't exist yet on this browser/origin.
  async function reconcileSavedState() {
    const btn = document.getElementById('saveWishlistBtn');
    if (!btn) return;
    const serverSaved = await isSavedOnServer(propertyId);
    if (serverSaved === null || serverSaved === btn.classList.contains('is-saved')) return;
    applySavedUi(btn, serverSaved);
  }

  function applySavedUi(btn, nowSaved) {
    btn.classList.toggle('is-saved', nowSaved);
    const label = btn.querySelector('span');
    if (label) label.textContent = nowSaved ? 'Saved' : 'Save to Wishlist';
    const icon = btn.querySelector('svg');
    if (icon) icon.setAttribute('fill', nowSaved ? 'currentColor' : 'none');
  }

  // --------------------------------
  // Event Actions
  // --------------------------------
  function wireInteractionButtons(property) {
    document.getElementById('saveWishlistBtn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      let nowSaved;
      try {
        nowSaved = await toggleSaved(propertyId);
      } catch (err) {
        console.error('Could not update saved list:', err);
        btn.disabled = false;
        alert(`Couldn't update saved properties: ${err.message}`);
        return;
      }
      btn.disabled = false;
      applySavedUi(btn, nowSaved);
    });

    document.getElementById('enquireNowBtn')?.addEventListener('click', () => {
      openInquireModal(property);
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
  // Inquire Now modal — real property data, real POST /enquiries call.
  // --------------------------------
  function normalizeStatus(rawStatus) {
    const status = (rawStatus || 'PENDING_REVIEW').toUpperCase();
    if (status === 'APPROVED' || status === 'AVAILABLE') return 'Available';
    if (status === 'RENTED') return 'Rented';
    return 'Pending';
  }

  function injectInquireModal() {
    if (document.getElementById('inquireOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'inquireOverlay';
    overlay.className = 'inquire-overlay';
    overlay.innerHTML = `
      <div class="inquire-modal">
        <div class="inquire-header">
          <h2>Inquire Now</h2>
          <button type="button" class="inquire-close" id="inquireCloseBtn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </button>
        </div>

        <div class="inquire-property" id="inquirePropertyCard"></div>

        <label class="inquire-label" for="inquireMessage">Message</label>
        <textarea id="inquireMessage" rows="4" placeholder="Introduce yourself and ask any questions about this property…"></textarea>

        <p class="inquire-disclaimer">Your information is shared securely with the landlord.</p>
        <p class="inquire-send-status" id="inquireSendStatus" hidden></p>

        <div class="inquire-actions">
          <button type="button" class="clear-btn" id="inquireCancelBtn">Cancel</button>
          <button type="button" class="apply-btn inquire-send" id="inquireSendBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send message
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('inquireCloseBtn').addEventListener('click', closeInquireModal);
    document.getElementById('inquireCancelBtn').addEventListener('click', closeInquireModal);
    // Click on the dimmed backdrop (not the modal itself) also closes it.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInquireModal(); });
  }

  function openInquireModal(property) {
    injectInquireModal();

    const overlay = document.getElementById('inquireOverlay');
    const card = document.getElementById('inquirePropertyCard');
    const statusText = normalizeStatus(property.status);
    const statusClass = statusText.toLowerCase();
    const img = Array.isArray(property.images) && property.images[0];

    // Real API image only — no placeholder file, matching the rest of
    // the app. Falls back to a plain tinted frame if there's no photo.
    card.innerHTML = `
      ${img
        ? `<img src="${img}" alt="${property.title || 'Property photo'}">`
        : `<div class="inquire-property-photo-empty"></div>`}
      <div class="inquire-property-info">
        <span class="inquire-property-name">${property.title || 'Untitled Property'}</span>
        <span class="inquire-property-location">${property.address || property.location || ''}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
    `;

    const textarea = document.getElementById('inquireMessage');
    textarea.value = '';
    hideInquireStatus();
    overlay.classList.add('open');
    textarea.focus();

    // Re-bind fresh each open so the closure always has the current property.
    document.getElementById('inquireSendBtn').onclick = () => handleSendInquiry(property);
  }

  function closeInquireModal() {
    document.getElementById('inquireOverlay')?.classList.remove('open');
  }

  function showInquireStatus(message) {
    const el = document.getElementById('inquireSendStatus');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideInquireStatus() {
    const el = document.getElementById('inquireSendStatus');
    if (el) el.hidden = true;
  }

  async function handleSendInquiry(property) {
    const textarea = document.getElementById('inquireMessage');
    const sendBtn = document.getElementById('inquireSendBtn');
    const message = textarea.value.trim();

    if (!message) {
      showInquireStatus('Please enter a message before sending.');
      return;
    }

    sendBtn.disabled = true;
    hideInquireStatus();

    try {
      // Confirmed via Swagger: POST /enquiries takes { propertyId, message }.
      await window.api.post('/enquiries', { propertyId, message });

      const threadParams = new URLSearchParams({ propertyId });
      if (property.landlordId) threadParams.set('landlordId', property.landlordId);
      window.location.href = `thread.html?${threadParams.toString()}`;

    } catch (err) {
      console.error('Failed to send enquiry:', err);
      showInquireStatus(`Couldn't send your message: ${err.message}`);
      sendBtn.disabled = false;
    }
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
    const ctaLabel = btn?.querySelector('.ai-summarize-cta');
    const contentEl = document.getElementById('keyHighlightsContent');
    if (!btn || !ctaLabel || !contentEl) return;

    const description = property.description || '';
    if (!description.trim()) {
      contentEl.textContent = 'This listing has no description to summarize.';
      return;
    }

    const originalLabel = ctaLabel.textContent;
    btn.disabled = true;
    ctaLabel.textContent = 'Summarizing…';
    contentEl.textContent = 'Generating highlights from this listing…';

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

      contentEl.innerHTML = `<ul>${items.map(h => `<li>${h}</li>`).join('')}</ul>`;
      ctaLabel.textContent = '✨ Regenerate';

    } catch (err) {
      console.error('AI summarize failed:', err);
      contentEl.textContent = `Couldn't generate highlights: ${err.message}`;
      ctaLabel.textContent = originalLabel;
    } finally {
      btn.disabled = false;
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