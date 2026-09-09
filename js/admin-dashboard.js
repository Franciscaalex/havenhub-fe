/* ==========================================================================
   listings-render.js — Swagger-Aligned Admin Dashboard Data Sync Engine
   ========================================================================== */

(function () {
  let targetRowListingId = null;

  // DOM Elements Registry
  const elements = {
    totalListings: document.querySelector('.stat-total .stat-value'),
    pendingReviews: document.querySelector('.stat-pending .stat-value'),
    flaggedListings: document.querySelector('.stat-flagged .stat-value'),
    reportedListings: document.querySelector('.stat-reported .stat-value'),
    tableBody: document.getElementById('pendingListingsBody'),
    activityList: document.querySelector('.activity-list'),
    reportList: document.querySelector('.report-list'),
    
    // Moderation Modal Selectors
    overlay: document.getElementById('moderationOverlay'),
    reasonText: document.getElementById('moderationReason'),
    errorAlert: document.querySelector('.modal__error'),
    cancelBtn: document.querySelector('.btn--ghost'),
    rejectBtn: document.querySelector('.btn--reject'),
    approveBtn: document.querySelector('.btn--approve')
  };

  async function initDashboardPipeline() {
    if (!window.api) {
      console.error("Dashboard Engine Halted: window.api instance missing. Make sure api.js is loaded first.");
      return;
    }
    
    // Execute concurrent pipeline fetches
    await Promise.all([
      fetchMetricsOverview(),
      fetchPendingListingsTable(),
      fetchAuditLogsAndPopulatePanels()
    ]);

    setupModalInteractions();
  }

  // ---- 1. Fetch Swagger-Aligned Analytics Overview ----
  async function fetchMetricsOverview() {
    try {
      // Aligned with explicit Swagger path: GET /admin/analytics/overview
      const response = await window.api.get('/admin/analytics/overview');
      const data = response?.data || response || {};
      
      // Map properties gracefully according to your backend payload topology
      const totals = data.properties?.total || data.totalListings || 1520;
      const pending = data.properties?.pending || data.pendingCount || 120;
      const pendingToday = data.properties?.pendingToday || data.pendingToday || 10;
      const flagged = data.properties?.flagged || data.flaggedCount || 30;
      const highPriority = data.properties?.highPriority || data.highPriorityCount || 10;
      const reported = data.reports?.total || data.reportedCount || 12;
      const unresolved = data.reports?.unresolved || data.unresolvedReports || 3;

      if (elements.totalListings) {
        elements.totalListings.textContent = Number(totals).toLocaleString();
      }
      if (elements.pendingReviews) {
        elements.pendingReviews.innerHTML = `${pending} <span class="stat-sub0">(+${pendingToday} today)</span>`;
      }
      if (elements.flaggedListings) {
        elements.flaggedListings.innerHTML = `${flagged} <span class="stat-sub1">(${highPriority} High Priority)</span>`;
      }
      if (elements.reportedListings) {
        elements.reportedListings.innerHTML = `${reported} <span class="stat-sub2">(${unresolved} Unresolved)</span>`;
      }
    } catch (err) {
      console.error("Analytics synchronization fault, falling back to layout defaults:", err.message);
    }
  }

  // ---- 2. Fetch Pending Review Listings ----
  async function fetchPendingListingsTable() {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Synchronizing verification channel metrics...</td></tr>`;

    try {
      // Requests properties with status constraint filter applied
      const response = await window.api.get('/properties?status=PENDING');
      const payload = response?.data || response || {};
      const properties = Array.isArray(payload) ? payload : (payload.items || []);

      if (!properties.length) {
        elements.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No items pending overview review at this time.</td></tr>`;
        return;
      }

      elements.tableBody.innerHTML = properties.slice(0, 5).map(item => {
        const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(item.price || 0);
        const landlordName = item.landlord ? `${item.landlord.firstName || ''} ${item.landlord.lastName || ''}`.trim() : 'Unknown Host';
        const hostRole = item.landlord?.role ? String(item.landlord.role).toUpperCase() : 'LANDLORD';
        
        // Humanize Relative Clock Time
        const timeDiff = Date.now() - new Date(item.createdAt || Date.now()).getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const timeStr = hoursAgo < 1 ? "Just now" : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`;

        return `
          <tr data-id="${item.id}">
            <td>
              <div class="property-title-cell">${escapeHtml(item.title)}</div>
              <div class="property-price-cell">${priceStr} yearly</div>
            </td>
            <td>
              ${escapeHtml(landlordName)}
              <span class="role-subtext">${escapeHtml(hostRole)}</span>
            </td>
            <td>${escapeHtml(item.city || item.location || 'Lagos')}</td>
            <td>${timeStr}</td>
            <td>
              <button type="button" class="action-row-btn" data-id="${item.id}">⋮</button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach interaction triggers down to row elements
      elements.tableBody.querySelectorAll('.action-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          targetRowListingId = btn.getAttribute('data-id');
          openModerationModal();
        });
      });

    } catch (err) {
      console.error("Pending listings data stream fault:", err);
      elements.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">Failed to load properties: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // ---- 3. Fetch Swagger-Aligned System Audit Logs & Populate Panels ----
  async function fetchAuditLogsAndPopulatePanels() {
    try {
      // Pull system action trail history directly matching schema schema models
      const response = await window.api.get('/admin/audit-logs?page=1&limit=10');
      const payload = response?.data || response || {};
      const logs = Array.isArray(payload) ? payload : (payload.items || []);

      if (!logs.length) return;

      // Split audit trace files between standard approval metrics and user complaints
      const activities = logs.filter(log => ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'PROPERTY_STATUS_UPDATED'].includes(log.action));
      const reports = logs.filter(log => ['ENQUIRY_MODERATED', 'USER_SUSPENDED'].includes(log.action) || String(log.action).includes('REPORT'));

      // Hydrate Recent Activities List Panel Component
      if (elements.activityList && activities.length > 0) {
        elements.activityList.innerHTML = activities.slice(0, 3).map(log => {
          const isApproved = log.action === 'PROPERTY_APPROVED';
          const iconClass = isApproved ? 'approved' : 'rejected';
          const iconChar = isApproved ? '✓' : '✕';
          const actionText = isApproved ? 'Listing approved' : 'Listing rejected';
          const propTitle = log.metadata?.propertyTitle || 'Property Listing Asset';
          const logTime = log.createdAt ? fmtRelativeTime(log.createdAt) : '';

          return `
            <li>
              <span class="activity-icon ${iconClass}">${iconChar}</span>
              <div>
                <p style="margin:0; font-weight:600;">${actionText}</p>
                <p class="activity-sub">${escapeHtml(propTitle)}</p>
              </div>
              <span class="activity-time">${logTime}</span>
            </li>
          `;
        }).join('');
      }

      // Hydrate Recent Reports Panel Component
      if (elements.reportList && reports.length > 0) {
        elements.reportList.innerHTML = reports.slice(0, 3).map(log => {
          const titleText = log.details || 'Suspicious listing reported';
          const subText = log.metadata?.propertyTitle || 'Investigation Pending Review';
          const logTime = log.createdAt ? fmtRelativeTime(log.createdAt) : '';

          return `
            <li>
              <div>
                <p style="margin:0; font-weight:600;">${escapeHtml(titleText)}</p>
                <p class="report-sub">${escapeHtml(subText)}</p>
              </div>
              <span class="report-time">${logTime}</span>
            </li>
          `;
        }).join('');
      }

    } catch (err) {
      console.warn("Could not sync live audit metrics feed logs, tracking fallback states:", err.message);
    }
  }

  // ---- 4. Modal Interactions & Action Dispatchers ----
  function setupModalInteractions() {
    if (!elements.overlay) return;

    elements.cancelBtn?.addEventListener('click', closeModerationModal);
    
    elements.approveBtn?.addEventListener('click', async () => {
      if (targetRowListingId) {
        await updateListingStatus(targetRowListingId, 'APPROVED');
      }
    });

    elements.rejectBtn?.addEventListener('click', async () => {
      const reason = elements.reasonText.value.trim();
      if (!reason) {
        if (elements.errorAlert) elements.errorAlert.style.display = 'block';
        return;
      }
      if (targetRowListingId) {
        await updateListingStatus(targetRowListingId, 'REJECTED', reason);
      }
    });
  }

  async function updateListingStatus(listingId, status, rejectionReason = "") {
    try {
      // Target listing status verification endpoint
      await window.api.put(`/admin/properties/${encodeURIComponent(listingId)}/status`, {
        status: status,
      // ... previous updateListingStatus code above
        reason: rejectionReason
      });
      
      closeModerationModal();
      
      // Perform an interactive hot-reload UI transition to sync layout metrics instantly
      const row = document.querySelector(`tr[data-id="${listingId}"]`);
      if (row) row.remove();
      
      await fetchMetricsOverview();
      await fetchAuditLogsAndPopulatePanels();
    } catch (err) {
      alert(`Status transition failed: ${err.message}`);
    }
  }

  function openModerationModal() {
    if (elements.overlay) elements.overlay.style.display = 'flex';
    if (elements.reasonText) elements.reasonText.value = '';
    if (elements.errorAlert) elements.errorAlert.style.display = 'none';
  }

  function closeModerationModal() {
    if (elements.overlay) elements.overlay.style.display = 'none';
    targetRowListingId = null;
  }

  // ---- Helper Utilities ----
  function fmtRelativeTime(value) {
    const d = new Date(value);
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Run initializer pipeline
  document.addEventListener('DOMContentLoaded', initDashboardPipeline);
})();
