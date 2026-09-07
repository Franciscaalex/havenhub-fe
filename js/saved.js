/* saved.js */

document.addEventListener('DOMContentLoaded', async () => {
  const savedGrid = document.getElementById('propertyGrid');
  const savedHeading = document.getElementById('savedHeading');
  const tabsContainer = document.getElementById('savedTabs');
  const sortSelect = document.getElementById('sortSelect');
  const STORAGE_KEY = "havenhub_saved_properties";

  let allFavorited = [];
  // id -> savedAt, so "Date Added" sorting has something to sort by.
  let savedAtById = new Map();

  // ---------- Storage helpers ----------
  function getSavedEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function getSavedIds() {
    return getSavedEntries().map(item => item.id);
  }

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

  // ---------- Icons ----------
  const bedIcon = () => '<img src="Bed.png" alt="Bed">';
  const bathIcon = () => '<img src="Shower.png" alt="Bath">';
  const heartIcon = (isSaved) => `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
            fill="${isSaved ? "#0E7490" : "transparent"}" stroke="#0E7490" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;

  function normalizeStatus(rawStatus) {
    const status = (rawStatus || 'PENDING_REVIEW').toUpperCase();
    if (status === 'APPROVED' || status === 'AVAILABLE') return 'Available';
    if (status === 'RENTED') return 'Rented';
    return 'Pending';
  }

  function badgeColor(status) {
    return status === 'Rented' ? '#DC2626' : '#16A34A'; // red / green
  }

  // ---------- Card markup ----------
  function buildCard(p) {
    const card = document.createElement("article");
    card.className = "card";

    const pId = p._id || p.id;
    const displayPrice = p.price ? Number(p.price).toLocaleString() : 0;
    const displaySqft = p.squareFeet || p.sqft || 0;
    const status = p._displayStatus;

    const realImg = p.imageUrl || (Array.isArray(p.images) && p.images[0]) || null;
    const mediaStyle = realImg
      ? `background-image:url('${realImg}');position:relative;`
      : 'background-color:#F1F5F9;position:relative;';

    card.innerHTML = `
      <a href="property-details.html?id=${pId}" class="card-media-link">
        <div class="card-media${realImg ? '' : ' card-media-empty'}" style="${mediaStyle}">
          <span class="status-badge-overlay" style="position:absolute;top:12px;left:12px;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:600;color:#fff;background-color:${badgeColor(status)};">${status}</span>
        </div>
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
        <button type="button" class="card-btn-view" data-id="${pId}"
          style="width:100%;margin-top:12px;padding:10px 0;border-radius:20px;border:none;background-color:#002349;color:#fff;font-weight:600;font-size:13px;cursor:pointer;">
          View Listing Details
        </button>
        <button type="button" class="card-btn-message" data-id="${pId}" data-landlord-id="${p.landlordId || ''}"
          style="width:100%;margin-top:8px;padding:10px 0;border-radius:20px;border:1.5px solid #002349;background-color:#fff;color:#002349;font-weight:600;font-size:13px;cursor:pointer;">
          Message Landlord
        </button>
      </div>
    `;

    // Un-like / remove from saved.
    card.querySelector('.inline-saved-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      removeSavedId(pId);
      loadSavedProperties();
    });

    card.querySelector('.card-btn-view')?.addEventListener('click', () => {
      window.location.href = `seeker-dashboard.html?id=${pId}`;
    });

    // "Message Landlord" — opens the message thread for this property.
    card.querySelector('.card-btn-message')?.addEventListener('click', (e) => {
      const landlordId = e.currentTarget.dataset.landlordId;
      const params = new URLSearchParams({ propertyId: pId });
      if (landlordId) params.set('landlordId', landlordId);
      window.location.href = `inquire.html?${params.toString()}`;
    });

    return card;
  }

  // ---------- Empty states ----------
  function renderNoSavedAtAll() {
    savedGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 0;">
        <h3>Your saved collection is empty</h3>
        <p>Go back to the exploration dashboard page to bookmark properties.</p>
        <button onclick="window.location.href='seeker-dashboard.html'" class="apply-btn" style="margin-top:16px;">Browse Properties</button>
      </div>`;
  }

  function renderNoneForTab(tabLabel) {
    savedGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 0;">
        <p>No ${tabLabel.toLowerCase()} saved properties.</p>
      </div>`;
  }

  // ---------- Tab + sort filtering (client-side, no re-fetch) ----------
  function getActiveTabStatus() {
    const activeTab = tabsContainer?.querySelector('.saved-tab.active');
    return activeTab?.dataset.status || 'all';
  }

  function applyTabAndSort() {
    if (!savedGrid) return;

    const activeStatus = getActiveTabStatus();
    let list = activeStatus === 'all'
      ? [...allFavorited]
      : allFavorited.filter(p => p._displayStatus === activeStatus);

    const sortValue = sortSelect?.value || 'newest';
    const pId = p => p._id || p.id;

    list.sort((a, b) => {
      if (sortValue === 'price-low') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortValue === 'price-high') return (Number(b.price) || 0) - (Number(a.price) || 0);

      const dateA = savedAtById.get(String(pId(a))) || 0;
      const dateB = savedAtById.get(String(pId(b))) || 0;
      return sortValue === 'oldest' ? dateA - dateB : dateB - dateA; // 'newest' default
    });

    if (list.length === 0) {
      const activeTabButton = tabsContainer?.querySelector('.saved-tab.active');
      renderNoneForTab(activeTabButton ? activeTabButton.textContent.replace(/\s*\(\d+\)\s*$/, '') : 'matching');
      return;
    }

    savedGrid.innerHTML = "";
    list.forEach(p => savedGrid.appendChild(buildCard(p)));
  }

  function updateCountsAndHeading() {
    const allCount = allFavorited.length;
    const availableCount = allFavorited.filter(p => p._displayStatus === 'Available').length;
    const rentedCount = allFavorited.filter(p => p._displayStatus === 'Rented').length;

    if (savedHeading) savedHeading.textContent = `My Saved Properties (${allCount})`;

    const allTabBtn = tabsContainer?.querySelector('.saved-tab[data-status="all"]');
    const availableTabBtn = tabsContainer?.querySelector('.saved-tab[data-status="Available"]');
    const rentedTabBtn = tabsContainer?.querySelector('.saved-tab[data-status="Rented"]');

    if (allTabBtn) allTabBtn.textContent = `All (${allCount})`;
    if (availableTabBtn) availableTabBtn.textContent = `Available (${availableCount})`;
    if (rentedTabBtn) rentedTabBtn.textContent = `Rented (${rentedCount})`;
  }

  tabsContainer?.querySelectorAll('.saved-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.saved-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyTabAndSort();
    });
  });

  sortSelect?.addEventListener('change', applyTabAndSort);

  // ---------- Main load ----------
  async function loadSavedProperties() {
    try {
      const savedEntries = getSavedEntries();
      const savedIds = savedEntries.map(e => e.id);

      savedAtById = new Map(
        savedEntries.map(e => [String(e.id), e.savedAt ? new Date(e.savedAt).getTime() : 0])
      );

      if (savedIds.length === 0) {
        allFavorited = [];
        updateCountsAndHeading();
        renderNoSavedAtAll();
        return;
      }

      if (savedGrid) {
        savedGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Loading your saved listings…</p></div>`;
      }

      if (!window.api) throw new Error("api.js module missing.");
      const response = await window.api.get('/properties?limit=100');
      const apiItems = response?.items || response || [];

      allFavorited = apiItems
        .filter(item => {
          const targetId = item._id || item.id;
          return savedIds.includes(targetId) || savedIds.includes(Number(targetId));
        })
        .map(item => ({ ...item, _displayStatus: normalizeStatus(item.status) }))
        .filter(item => item._displayStatus === 'Available' || item._displayStatus === 'Rented');

      updateCountsAndHeading();

      if (allFavorited.length === 0) {
        renderNoSavedAtAll();
        return;
      }

      applyTabAndSort();

    } catch (err) {
      console.error("Saved page runtime rendering exception error:", err);
      if (savedGrid) {
        savedGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center;"><p>Error pulling bookmarks. Please reload the page.</p></div>`;
      }
    }
  }

  await loadSavedProperties();
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) loadSavedProperties();
  });

  document.addEventListener('property:saved-changed', () => {
    loadSavedProperties();
  });
});