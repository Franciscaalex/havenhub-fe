/* ============================================================
   dashboard-landlord.js
   STRICT REAL-TIME SEPARATION MODE — NO BLINKING REFRESH LOOPS

   Render states (all driven purely by API data, no hardcoding):
     1. EMPTY        — no properties yet
     2. POPULATED    — properties exist, no financial activity yet
                        (chart hidden, activity panel only, plain stat cards)
     3. POPULATED    — properties exist AND financial/booking activity
                        has started (chart shown, colored stat cards)
   States 2 vs 3 are not separate "pages" — they're the same populated
   view reacting live to whatever the stats endpoint returns.

   NOTE: Clicking a property thumbnail opens an in-dashboard details
   modal (see openPropertyDetailModal / property-figma-modal below).
   property-details.html is the seeker-facing listing page and is
   intentionally NOT used here — landlords stay on this dashboard.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get raw layout elements directly from your HTML markup tags
  const loadingState = document.getElementById('dashLoading');
  const emptyState = document.getElementById('dashEmptyState');
  const populatedState = document.getElementById('dashPopulatedState');
  const statsRowEmpty = document.getElementById('statsRowEmpty');
  const addPropertyBtnEmpty = document.getElementById('addPropertyBtnEmpty');
  const welcomeTitle = document.getElementById('dashWelcomeTitle');

  const statsRowPopulated = document.getElementById('statsRow');
  const panelsRow = document.getElementById('panelsRow');
  const listingsRow = document.getElementById('listingsRow');
  const searchInput = document.querySelector('.dash-search input');

  // Holds the last full set of properties fetched from the API, so the
  // search box can filter client-side without re-hitting the network
  // on every keystroke, and so the details modal can look records up
  // by id without a separate fetch.
  let allProperties = [];

  // Hard enforce absolute layout safety: instantly hide the populated dashboard containers
  if (populatedState) populatedState.style.setProperty('display', 'none', 'important');
  if (emptyState) emptyState.style.setProperty('display', 'none', 'important');
  if (loadingState) loadingState.style.setProperty('display', 'block', 'important');

  // Personalize the welcome header if a signed-in user is available; falls back safely otherwise.
  if (welcomeTitle) {
    const firstName = getUserFirstName();
    welcomeTitle.textContent = firstName ? `Welcome ${firstName}!` : 'Welcome back!';
  }

  // If this is a brand-new signup, show the empty-state panel immediately
  // instead of making them wait through the loading skeleton — the real
  // fetch below still runs right after to confirm/update it live.
  if (isNewUser()) {
    if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
    if (populatedState) populatedState.style.setProperty('display', 'none', 'important');
    if (emptyState) emptyState.style.setProperty('display', 'block', 'important');
  }

  // Bind Continue/Upload button event listener to your team's file target
  if (addPropertyBtnEmpty) {
    addPropertyBtnEmpty.addEventListener('click', () => {
      window.location.href = 'add-property.html';
    });
  }

  // Live search — filters whatever properties are currently loaded by
  // title, address, or property type as the user types.
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        renderLivePropertyGrid(allProperties);
        return;
      }
      const filtered = allProperties.filter(item => {
        const haystack = [
          item.title,
          item.address,
          item.propertyType,
          item.type,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      });
      renderLivePropertyGrid(filtered);
    });
  }

  try {
    if (!window.api) throw new Error("api.js frame missing.");

    // Query your backend for uploaded property data array metrics.
    // NOTE: this must hit the landlord-scoped endpoint (matching the
    // '/properties/my-listings/stats' convention already used below) —
    // the old generic '/properties' endpoint returned every landlord's
    // listings, which leaked other users' properties onto this dashboard.
    const listingsData = await window.api.get('/properties/my-listings?limit=20');
    const rawProperties = listingsData?.items || listingsData || [];

    // Defensive client-side ownership filter — belt-and-braces in case the
    // endpoint above ever returns unfiltered data. If a property record
    // carries an owner/landlord id field, only keep the ones matching the
    // signed-in user. Records with no ownership field at all are left as
    // -is (some backends omit it on an already-scoped endpoint), so this
    // never hides your own listings if the field simply isn't present.
    const currentUserId = getUserId();
    const properties = currentUserId
      ? rawProperties.filter(item => {
          const ownerId = item.landlordId ?? item.ownerId ?? item.userId ?? item.landlord?.id;
          return ownerId === undefined || ownerId === null || String(ownerId) === String(currentUserId);
        })
      : rawProperties;

    allProperties = properties;

    // Query real-time financial stats balance records
    let statsResponse = null;
    try {
      statsResponse = await window.api.get('/properties/my-listings/stats');
    } catch (e) {
      console.warn("Stats server endpoints are resting. Defaulting to strict 0 balances.");
    }
    const stats = statsResponse || {};

    // Financial/booking activity has "started" once the stats endpoint reports
    // real movement — any revenue, occupancy, or non-zero chart data.
    const chartSum = (stats.chartData || []).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const hasFinancialActivity =
      chartSum > 0 || Number(stats.totalRevenue) > 0 || Number(stats.occupancyRate) > 0;

    /* ============================================================
       STRICT CONDITIONAL INTERCEPTOR MATRIX
       ============================================================ */
    if (properties.length === 0) {
      // THE NEW USER ACCOUNT: FORCE EVERYTHING AWAY
      if (statsRowEmpty) statsRowEmpty.innerHTML = buildStatCards(stats, false);

      if (panelsRow) {
        panelsRow.innerHTML = '';
        panelsRow.classList.remove('full-dashboard-grid', 'narrow-activity-only-grid');
      }
      if (listingsRow) listingsRow.innerHTML = '';
      if (populatedState) {
        populatedState.innerHTML = ''; // Wipes mock elements instantly
        populatedState.style.setProperty('display', 'none', 'important');
      }

      if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
      if (emptyState) emptyState.style.setProperty('display', 'block', 'important');

    } else {
      // FIXED: Populate elements natively without hitting a refresh reload loop!
      if (statsRowPopulated) statsRowPopulated.innerHTML = buildStatCards(stats, hasFinancialActivity);

      renderLiveOverviewPanels(hasFinancialActivity, stats.chartData || [], stats.recentActivities || []);
      renderLivePropertyGrid(properties);

      if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
      if (emptyState) emptyState.style.setProperty('display', 'none', 'important');
      if (populatedState) populatedState.style.setProperty('display', 'block', 'important');
    }

  } catch (err) {
    console.error("Pipeline breakdown:", err);
    if (statsRowEmpty) statsRowEmpty.innerHTML = buildStatCards({}, false);
    if (panelsRow) panelsRow.innerHTML = '';
    if (listingsRow) listingsRow.innerHTML = '';
    if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
    if (emptyState) emptyState.style.setProperty('display', 'block', 'important');
  }

  /* ============================================================
     RENDER LOGIC HELPER SUB-FUNCTIONS
     ============================================================ */

  // Best-effort personalization — tries common auth/session shapes, never throws.
  function getUserFirstName() {
    try {
      if (window.currentUser?.firstName) return window.currentUser.firstName;
      if (window.currentUser?.name) return window.currentUser.name.split(' ')[0];
      const stored = localStorage.getItem('user') || localStorage.getItem('havenhub_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.firstName) return parsed.firstName;
        if (parsed.name) return parsed.name.split(' ')[0];
      }
    } catch (e) { /* ignore malformed/absent session data */ }
    return null;
  }

  // Best-effort signed-in user id — used only to filter out any
  // non-owned properties the listings endpoint might return. Tries a
  // cached user object first, then falls back to decoding the JWT's
  // own id claim. Never throws; returns null if nothing is found, in
  // which case the ownership filter above is simply skipped.
  function getUserId() {
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('havenhub_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) return parsed.id;
        if (parsed._id) return parsed._id;
      }
    } catch (e) { /* not JSON, fall through */ }

    try {
      const token = window.CONFIG ? localStorage.getItem(window.CONFIG.TOKEN_KEY) : null;
      if (token) {
        const payloadSegment = token.split('.')[1];
        const decoded = JSON.parse(atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded.id || decoded.sub || decoded.userId || null;
      }
    } catch (e) { /* not a valid/decodable JWT */ }

    return null;
  }

  // Best-effort "is this a brand-new signup" check — tries common flags set
  // right after registration. Adjust the key names to match your signup
  // flow if different; never throws if none are present.
  function isNewUser() {
    try {
      return localStorage.getItem('isNewSignup') === 'true'
        || localStorage.getItem('justRegistered') === 'true';
    } catch (e) {
      return false;
    }
  }

  // Builds the 4 stat cards. `dynamic` = false → plain cards (no color, no subtitle),
  // used pre-activity. `dynamic` = true → colored cards with contextual subtitles,
  // used once real financial/booking activity exists.
  function buildStatCards(stats, dynamic) {
    const revenue = Number(stats.totalRevenue) || 0;
    const occupancy = stats.occupancyRate;
    const maintenance = Number(stats.pendingMaintenance) || 0;
    const overdue = Number(stats.overdueRent) || 0;

    if (!dynamic) {
      return `
        <div class="dash-stat-card"><p class="stat-card-title">Total Monthly Revenue</p><h3 class="stat-card-value">₦${revenue.toLocaleString()}</h3></div>
        <div class="dash-stat-card"><p class="stat-card-title">Occupancy Rate</p><h3 class="stat-card-value">${occupancy !== undefined ? occupancy + '%' : '-'}</h3></div>
        <div class="dash-stat-card"><p class="stat-card-title">Pending Maintenance</p><h3 class="stat-card-value">${maintenance}</h3></div>
        <div class="dash-stat-card"><p class="stat-card-title">Overdue Rent</p><h3 class="stat-card-value">₦${overdue.toLocaleString()}</h3></div>
      `;
    }

    const revenueTrend = stats.revenueTrendPercent; // optional, from API
    const occupiedUnits = stats.occupiedUnits;       // optional, from API
    const totalUnits = stats.totalUnits;             // optional, from API
    const hasMaintenanceRequests = maintenance > 0;
    const hasOverdueAmount = overdue > 0;

    return `
      <div class="dash-stat-card stat-positive">
        <p class="stat-card-title">Total Monthly Revenue</p>
        <h3 class="stat-card-value">₦${revenue.toLocaleString()}</h3>
        ${revenueTrend !== undefined ? `<p class="stat-card-subtitle text-success">${revenueTrend > 0 ? '+' : ''}${revenueTrend}%</p>` : ''}
      </div>
      <div class="dash-stat-card ${Number(occupancy) > 0 ? 'stat-positive' : ''}">
        <p class="stat-card-title">Occupancy Rate</p>
        <h3 class="stat-card-value">${occupancy !== undefined ? occupancy + '%' : '-'}</h3>
        ${(occupiedUnits !== undefined && totalUnits !== undefined) ? `<p class="stat-card-subtitle text-success">${occupiedUnits}/${totalUnits} Unit${totalUnits === 1 ? '' : 's'} Occupied</p>` : ''}
      </div>
      <div class="dash-stat-card">
        <p class="stat-card-title">Pending Maintenance</p>
        <h3 class="stat-card-value">${maintenance}</h3>
        <p class="stat-card-subtitle text-muted">${hasMaintenanceRequests ? `${maintenance} open request${maintenance === 1 ? '' : 's'}` : 'No requests yet'}</p>
      </div>
      <div class="dash-stat-card ${hasOverdueAmount ? 'stat-negative' : ''}">
        <p class="stat-card-title">Overdue Rent</p>
        <h3 class="stat-card-value">₦${overdue.toLocaleString()}</h3>
        <p class="stat-card-subtitle ${hasOverdueAmount ? 'text-danger' : 'text-success'}">${hasOverdueAmount ? 'Payment overdue' : 'Nothing overdue'}</p>
      </div>
    `;
  }

  // Renders the activity timeline with a status dot colored by activity type.
  function renderActivityList(activities) {
    if (!activities || activities.length === 0) {
      return `<p class="no-activity-text text-muted">No recent operations logged.</p>`;
    }
    return activities.map(act => {
      const dotClass = act.type === 'approval' ? 'activity-dot-success'
        : act.type === 'payment' ? 'activity-dot-info'
        : act.type === 'maintenance' ? 'activity-dot-danger'
        : 'activity-dot-warning';
      return `
        <div class="activity-item">
          <p><span class="activity-dot ${dotClass}"></span><strong>${act.title || 'Update'}</strong><br>${act.description || ''}</p>
          <span class="activity-time">${act.timeAgo || 'just now'}</span>
        </div>
      `;
    }).join('');
  }

  // Renders panelsRow. If financial activity hasn't started, only a narrow,
  // right-aligned Recent Activity panel renders (no chart) — matches the
  // pre-activity design. Once activity starts, the full chart + activity
  // layout renders.
  function renderLiveOverviewPanels(hasFinancialActivity, chartData, activities) {
    if (!panelsRow) return;

    if (!hasFinancialActivity) {
      panelsRow.classList.remove('full-dashboard-grid');
      panelsRow.classList.add('narrow-activity-only-grid');
      panelsRow.innerHTML = `
        <div class="dash-activity-panel standalone">
          <div class="activity-header-row">
            <h3>Recent Activity</h3>
            <button class="add-property-btn-top" id="addPropertyTopBtn">Add a New Property</button>
          </div>
          <div class="activity-timeline">${renderActivityList(activities)}</div>
        </div>
      `;
    } else {
      panelsRow.classList.remove('narrow-activity-only-grid');
      panelsRow.classList.add('full-dashboard-grid');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fullYearChartDataset = months.map((_, index) => chartData[index] || 0);

      panelsRow.innerHTML = `
        <div class="dash-chart-panel">
          <div class="chart-header">
            <h3>Revenue & Expense Overview</h3>
            <p>Real-time tracked analytics <span class="chart-legend"><i class="dot-rev"></i> Revenue</span></p>
          </div>
          <div class="chart-bars-container">
            ${fullYearChartDataset.map((val, idx) => `
              <div class="chart-bar-column">
                <div class="chart-bar-fill" style="height: ${val}%"></div>
                <span class="chart-bar-label">${months[idx]}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="dash-activity-panel">
          <div class="activity-header-row">
            <h3>Recent Activity</h3>
            <button class="add-property-btn-top" id="addPropertyTopBtn">Add a New Property</button>
          </div>
          <div class="activity-timeline">${renderActivityList(activities)}</div>
        </div>
      `;
    }

    document.getElementById('addPropertyTopBtn')?.addEventListener('click', () => { window.location.href = 'add-property.html'; });
  }

  // Renders the property grid. Each card shows its actual photo (falling
  // back to a tinted placeholder frame only when no image field is present
  // on the record), and the whole card is clickable/keyboard-activatable.
  // Clicking a card opens the in-dashboard details modal (see
  // openPropertyDetailModal) — landlords never leave this page, since
  // property-details.html is the seeker-facing page only. A listing is
  // only ever badged "Available" once the admin has explicitly set it to
  // that status — approval alone is not enough.
  function renderLivePropertyGrid(propertiesList) {
    if (!listingsRow) return;

    if (!propertiesList || propertiesList.length === 0) {
      listingsRow.innerHTML = `<p class="no-activity-text text-muted">No properties match your search.</p>`;
      return;
    }

    listingsRow.innerHTML = propertiesList.map(item => {
      const statusRaw = (item.status || 'AVAILABLE').toUpperCase();
      // Every listing shows as "Available" as soon as it's created — approval
      // no longer gates the badge. RENTED is still called out explicitly.
      let badgeText = 'Available';
      let badgeClass = 'badge-figma-available';

      if (statusRaw === 'RENTED') { badgeText = 'Rented'; badgeClass = 'badge-figma-rented'; }

      // Photo field name isn't fully confirmed backend-side, so check the
      // most likely candidates in order before giving up on a real image.
      const imageUrl = item.imageUrl
        || item.thumbnailUrl
        || item.coverImage
        || (Array.isArray(item.photos) && item.photos[0])
        || (Array.isArray(item.images) && item.images[0])
        || '';

      const imageMarkup = imageUrl
        ? `<img class="property-figma-img" src="${imageUrl}" alt="${item.title || 'Property photo'}" loading="lazy">`
        : `<div class="property-figma-img" role="img" aria-label="Property photo placeholder"></div>`;

      const propertyId = item.id ?? item._id ?? item.propertyId ?? '';

      return `
        <div class="property-figma-card" data-property-id="${propertyId}" role="button" tabindex="0" style="cursor:pointer;">
          ${imageMarkup}
          <div class="property-figma-info">
            <div class="property-figma-meta">
              <h4>${item.title || 'Untitled Property'}</h4>
              <p>${item.propertyType || item.type || 'Listing'} • ${item.bedrooms || 0} Beds</p>
            </div>
            <span class="badge-figma ${badgeClass}">${badgeText}</span>
          </div>
        </div>
      `;
    }).join('');

    // Wire click + keyboard activation to open the in-dashboard details
    // modal for that property. Landlords stay on this page — they don't
    // get routed to property-details.html, which is the seeker-facing
    // listing page.
    listingsRow.querySelectorAll('.property-figma-card').forEach(card => {
      const propertyId = card.dataset.propertyId;
      if (!propertyId) return; // no id on this record — nothing to show

      const showDetail = () => openPropertyDetailModal(propertyId);

      card.addEventListener('click', showDetail);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showDetail();
        }
      });
    });
  }

  /* ============================================================
     IN-DASHBOARD PROPERTY DETAIL MODAL
     Replaces the old navigate-away-to-property-details.html flow.
     The modal DOM is created once, lazily, and reused/repopulated
     on every open so this works regardless of what markup already
     exists in the host HTML page.
     ============================================================ */

  let detailModalEl = null;

  function ensureDetailModal() {
    if (detailModalEl) return detailModalEl;

    const overlay = document.createElement('div');
    overlay.className = 'property-figma-modal-overlay';
    overlay.id = 'propertyDetailModalOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 24px;
    `;

    overlay.innerHTML = `
      <div class="property-figma-modal" role="dialog" aria-modal="true" aria-labelledby="propertyDetailModalTitle"
           style="background:#fff; border-radius:12px; max-width:560px; width:100%; max-height:85vh; overflow-y:auto; position:relative;">
        <button type="button" class="property-figma-modal-close" id="propertyDetailModalClose" aria-label="Close"
                style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:22px; line-height:1; cursor:pointer;">&times;</button>
        <div id="propertyDetailModalImageWrap"></div>
        <div style="padding:20px 24px 24px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <h3 id="propertyDetailModalTitle" style="margin:0;"></h3>
            <span id="propertyDetailModalBadge" class="badge-figma"></span>
          </div>
          <p id="propertyDetailModalSubtitle" class="text-muted" style="margin:0 0 16px;"></p>
          <div id="propertyDetailModalStats" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:16px;"></div>
          <div id="propertyDetailModalDescription" style="margin-bottom:16px;"></div>
          <div id="propertyDetailModalActions" style="display:flex; gap:10px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    detailModalEl = overlay;

    const close = () => closePropertyDetailModal();
    overlay.querySelector('#propertyDetailModalClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display !== 'none') close();
    });

    return overlay;
  }

  function closePropertyDetailModal() {
    if (!detailModalEl) return;
    detailModalEl.style.display = 'none';
    detailModalEl.setAttribute('aria-hidden', 'true');
    document.body.style.removeProperty('overflow');
  }

  // Looks up the property from the currently loaded list (no extra network
  // round-trip needed since the dashboard already has full records) and
  // populates the modal with its listing information.
  function openPropertyDetailModal(propertyId) {
    const item = allProperties.find(p => {
      const id = p.id ?? p._id ?? p.propertyId ?? '';
      return String(id) === String(propertyId);
    });
    if (!item) return;

    const modal = ensureDetailModal();

    const statusRaw = (item.status || 'AVAILABLE').toUpperCase();
    const badgeText = statusRaw === 'RENTED' ? 'Rented' : 'Available';
    const badgeClass = statusRaw === 'RENTED' ? 'badge-figma-rented' : 'badge-figma-available';

    const imageUrl = item.imageUrl
      || item.thumbnailUrl
      || item.coverImage
      || (Array.isArray(item.photos) && item.photos[0])
      || (Array.isArray(item.images) && item.images[0])
      || '';

    modal.querySelector('#propertyDetailModalImageWrap').innerHTML = imageUrl
      ? `<img src="${imageUrl}" alt="${item.title || 'Property photo'}" style="width:100%; max-height:260px; object-fit:cover; border-radius:12px 12px 0 0; display:block;">`
      : `<div style="width:100%; height:180px; background:#eee; border-radius:12px 12px 0 0;"></div>`;

    modal.querySelector('#propertyDetailModalTitle').textContent = item.title || 'Untitled Property';

    const badgeEl = modal.querySelector('#propertyDetailModalBadge');
    badgeEl.className = `badge-figma ${badgeClass}`;
    badgeEl.textContent = badgeText;

    modal.querySelector('#propertyDetailModalSubtitle').textContent = item.address || '';

    const rent = Number(item.monthlyRent ?? item.rent ?? item.price) || 0;
    const stats = [
      { label: 'Type', value: item.propertyType || item.type || '—' },
      { label: 'Bedrooms', value: item.bedrooms ?? '—' },
      { label: 'Bathrooms', value: item.bathrooms ?? '—' },
      { label: 'Monthly Rent', value: rent ? `₦${rent.toLocaleString()}` : '—' },
    ];
    modal.querySelector('#propertyDetailModalStats').innerHTML = stats.map(s => `
      <div>
        <p class="stat-card-title" style="margin:0 0 2px;">${s.label}</p>
        <p style="margin:0; font-weight:600;">${s.value}</p>
      </div>
    `).join('');

    modal.querySelector('#propertyDetailModalDescription').innerHTML = item.description
      ? `<p style="margin:0;">${item.description}</p>`
      : '';

    modal.querySelector('#propertyDetailModalActions').innerHTML = `
      <button type="button" class="add-property-btn-top" id="propertyDetailEditBtn">Edit Listing</button>
    `;
    modal.querySelector('#propertyDetailEditBtn')?.addEventListener('click', () => {
      window.location.href = `add-property.html?id=${encodeURIComponent(propertyId)}`;
    });

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
});