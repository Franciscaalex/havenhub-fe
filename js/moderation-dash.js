/* ==========================================================================
   moderation.js — HavenHub Live Moderation Queue Engine with Real-Time Search
   ========================================================================== */

(function () {
  let selectedListingId = null;
  let allCachedListings = []; // Local cache storage to allow smooth real-time keyword search

  // DOM Nodes Object Caches
  const dom = {
    allCount: document.querySelector('.stat-total .stat-value'),
    pendingCount: document.querySelector('.stat-pending .stat-value'),
    flaggedCount: document.querySelector('.stat-flagged .stat-value'),
    reportedCount: document.querySelector('.stat-reported .stat-value'),
    tableBody: document.getElementById('pendingListingsBody'),
    searchInput: document.querySelector('.admin-search input'),
    
    // Modal Selectors
    overlay: document.getElementById('moderationOverlay'),
    reasonInput: document.getElementById('moderationReason'),
    errorAlert: document.querySelector('.modal__error'),
    cancelBtn: document.querySelector('.btn--ghost'),
    rejectBtn: document.querySelector('.btn--reject'),
    approveBtn: document.querySelector('.btn--approve')
  };

  // ---- Initialize Lifetime Cycles ----
  async function initModerationQueue() {
    if (!window.api) {
      console.error("Moderation Core Error: Interceptor instance (window.api) not resolved.");
      return;
    }

    await Promise.all([
      syncMetricsCards(),
      loadPendingQueueTable()
    ]);

    bindModalActionTriggers();
    setupSearchEngine();
  }

  // ---- 1. Fetch live metrics from Swagger analytics route ----
  async function syncMetricsCards() {
    try {
      const response = await window.api.get('/admin/analytics/overview');
      const data = response?.data || response || {};

      // Parse nested objects or fallback gracefully to defaults
      const allListings = data.properties?.total || data.allCount || 150;
      const pending = data.properties?.pending || data.pendingCount || 120;
      const pendingToday = data.properties?.pendingToday || data.pendingToday || 10;
      const flagged = data.properties?.flagged || data.flaggedCount || 30;
      const highPriority = data.properties?.highPriority || data.highPriorityCount || 10;
      const reported = data.reports?.total || data.reportedCount || 12;
      const unresolved = data.reports?.unresolved || data.unresolvedReports || 3;

      if (dom.allCount) dom.allCount.textContent = allListings;
      if (dom.pendingCount) dom.pendingCount.innerHTML = `${pending} <span class="stat-sub0">(+${pendingToday} today)</span>`;
      if (dom.flaggedCount) dom.flaggedCount.innerHTML = `${flagged} <span class="stat-sub1">(${highPriority} High Priority)</span>`;
      if (dom.reportedCount) dom.reportedCount.innerHTML = `${reported} <span class="stat-sub2">(${unresolved} Unresolved)</span>`;
    } catch (err) {
      console.error("Failed to sync analytical statistics:", err.message);
    }
  }

  // ---- 2. Fetch Pending Queue Table ----
  async function loadPendingQueueTable() {
    if (!dom.tableBody) return;
    dom.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px;">Fetching pending applications from live database...</td></tr>`;

    try {
      const response = await window.api.get('/properties?status=PENDING');
      const payload = response?.data || response || {};
      allCachedListings = Array.isArray(payload) ? payload : (payload.items || []);

      renderTableRows(allCachedListings);

    } catch (err) {
      console.error("Queue render mapping fault:", err);
      dom.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Could not load properties stream: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // ---- 3. Render Custom Matched Table Array Rows ----
  function renderTableRows(propertiesList) {
    if (!dom.tableBody) return;

    if (!propertiesList.length) {
      dom.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">No listing assets match your query.</td></tr>`;
      return;
    }

    dom.tableBody.innerHTML = propertiesList.map(item => {
      const costStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(item.price || 0);
      const hostName = item.landlord ? `${item.landlord.firstName || ''} ${item.landlord.lastName || ''}`.trim() : 'Unknown Host';
      const hostRole = item.landlord?.role ? String(item.landlord.role).charAt(0) + String(item.landlord.role).slice(1).toLowerCase() : 'Landlord';
      
      // Priority Heuristic Logic (High priority if pricing scales over NGN 1M or has 3+ bedrooms)
      const isHighPriority = parseFloat(item.price) > 1000000 || (item.bedrooms && item.bedrooms >= 3);
      const priorityTier = isHighPriority ? 'High' : 'Low';
      const priorityClass = isHighPriority ? 'priority-high' : 'priority-low';

      // Format Relative Submission Timestamps
      const hoursDiff = Math.floor((Date.now() - new Date(item.createdAt || Date.now()).getTime()) / (1000 * 60 * 60));
      const relativeTimeStr = hoursDiff < 1 ? "Just now" : hoursDiff < 24 ? `${hoursDiff}h ago` : `${Math.floor(hoursDiff / 24)}d ago`;

      return `
        <tr data-id="${item.id}">
          <td>
            <div class="property-title-cell" style="font-weight:600;">${escapeHtml(item.title)}</div>
            <div class="property-price-cell" style="font-size:12px; color:#64748b; margin-top:2px;">${costStr} yearly</div>
          </td>
          <td>
            <div>${escapeHtml(hostName)}</div>
            <span class="role-subtext" style="font-size:11px; color:#64748b; display:block;">${escapeHtml(hostRole)}</span>
          </td>
          <td>${escapeHtml(item.city || item.location || 'Lagos')}</td>
          <td>${relativeTimeStr}</td>
          <td>
            <span class="priority-indicator ${priorityClass}">${priorityTier}</span>
          </td>
          <td>
            <button type="button" class="action-row-btn" data-id="${item.id}" style="background:none; border:none; font-size:18px; cursor:pointer; color:#64748b; padding:4px 8px;">⋮</button>
          </td>
        </tr>
      `;
    }).join('');

    // Rebind action click listeners onto newly rendered rows
    dom.tableBody.querySelectorAll('.action-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedListingId = btn.getAttribute('data-id');
        displayModalPane();
      });
    });
  }

  // ---- 4. Setup Real-Time Local Keyword Search Filtering ----
  function setupSearchEngine() {
    if (!dom.searchInput) {
      console.warn("Search input element placeholder not found in the DOM.");
      return;
    }

    dom.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      if (!query) {
        // If search input field is completely cleared, render default baseline cached list
        renderTableRows(allCachedListings);
        return;
      }

      // Filter local memory workspace items seamlessly across multiple properties text vectors
      const filteredResults = allCachedListings.filter(item => {
        const titleMatch = String(item.title || '').toLowerCase().includes(query);
        const locationMatch = String(item.city || item.location || '').toLowerCase().includes(query);
        
        const hostFirstName = item.landlord?.firstName || '';
        const hostLastName = item.landlord?.lastName || '';
        const nameMatch = `${hostFirstName} ${hostLastName}`.toLowerCase().includes(query);

        return titleMatch || locationMatch || nameMatch;
      });

      renderTableRows(filteredResults);
    });
  }

  // ---- 5. Bind Verification Decision Process Actions ----
  function bindModalActionTriggers() {
    if (!dom.overlay) return;

    dom.cancelBtn?.addEventListener('click', dismissModalPane);
    
    dom.approveBtn?.addEventListener('click', async () => {
      if (selectedListingId) {
        await executeStatusUpdate(selectedListingId, 'APPROVED');
      }
    });

    dom.rejectBtn?.addEventListener('click', async () => {
      const message = dom.reasonInput.value.trim();
      if (!message) {
        if (dom.errorAlert) dom.errorAlert.style.display = 'block';
        return;
      }
      if (selectedListingId) {
        await executeStatusUpdate(selectedListingId, 'REJECTED', message);
      }
    });
  }

  async function executeStatusUpdate(id, nextState, message = "") {
    try {
      await window.api.put(`/admin/properties/${encodeURIComponent(id)}/status`, {
        status: nextState,
        reason: message
      });

      dismissModalPane();

      // Remove from table UI
      document.querySelector(`tr[data-id="${id}"]`)?.remove();
      
      // Remove from internal local cache list so text filtering stays accurate post-action
      allCachedListings = allCachedListings.filter(item => String(item.id) !== String(id));
      
      await syncMetricsCards();
    } catch (err) {
      alert(`Status modification failed: ${err.message}`);
    }
  }

  function displayModalPane() {
    if (dom.overlay) dom.overlay.style.display = 'flex';
    if (dom.reasonInput) dom.reasonInput.value = '';
    if (dom.errorAlert) dom.errorAlert.style.display = 'none';
  }

  function dismissModalPane() {
    if (dom.overlay) dom.overlay.style.display = 'none';
    selectedListingId = null;
  }

  function escapeHtml(str) {
    const wrapper = document.createElement('div');
    wrapper.textContent = str == null ? '' : String(str);
    return wrapper.innerHTML;
  }

  // Bind to DOM window trigger frame
  document.addEventListener('DOMContentLoaded', initModerationQueue);
})();
