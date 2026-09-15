/* admin-dashboard.js — HavenHub Admin Dashboard */

(function () {
  let targetRowListingId = null;

  const elements = {
    totalListings: document.querySelector('.stat-total .stat-value'),
    pendingReviews: document.querySelector('.stat-pending .stat-value'),
    flaggedListings: document.querySelector('.stat-flagged .stat-value'),
    reportedListings: document.querySelector('.stat-reported .stat-value'),
    tableBody: document.getElementById('pendingListingsBody'),
    activityList: document.querySelector('.activity-list'),
    reportList: document.querySelector('.report-list'),

    // Moderation modal
    overlay: document.getElementById('moderationOverlay'),
    reasonField: document.getElementById('moderationReason'),
    errorAlert: document.querySelector('.modal__error'),
    cancelBtn: document.querySelector('.btn--ghost'),
    rejectBtn: document.querySelector('.btn--reject'),
    approveBtn: document.querySelector('.btn--approve')
  };

  document.addEventListener('DOMContentLoaded', initDashboard);

  async function initDashboard() {
    if (!window.api) {
      console.error('Admin dashboard halted: window.api is missing. Make sure js/api.js loads before js/admin-dashboard.js.');
      return;
    }

    // Flagged/Reported have no backing data on the API right now — hide
    // those cards and the reports panel instead of showing fake zeros.
    hideUnsupportedUi();

    setupModalInteractions();

    await Promise.all([
      fetchModerationStats(),
      fetchPendingListings(),
      fetchAuditLogsAndPopulateActivity()
    ]);
  }

  function hideUnsupportedUi() {
    elements.flaggedListings?.closest('.stat-flagged')?.style.setProperty('display', 'none');
    elements.reportedListings?.closest('.stat-reported')?.style.setProperty('display', 'none');
    elements.reportList?.closest('section, .panel, div')?.style.setProperty('display', 'none');
  }

  // ---------------------------------------------------------------------
  // 1. Stat cards — sourced from the moderation stats endpoint
  // ---------------------------------------------------------------------
  async function fetchModerationStats() {
    try {
      const response = await window.api.get('/admin/moderation/properties/stats');
      const data = response?.data || response || {};

      const totalPending = numberOrZero(data.totalPending);
      const totalApproved = numberOrZero(data.totalApproved);
      const totalRejected = numberOrZero(data.totalRejected);

      if (elements.totalListings) {
        elements.totalListings.textContent = (totalPending + totalApproved + totalRejected).toLocaleString();
      }
      if (elements.pendingReviews) {
        elements.pendingReviews.textContent = String(totalPending);
      }
    } catch (err) {
      console.error('Failed to load moderation stats:', err.message);
      showToast('Could not refresh dashboard stats.', 'error');
    }
  }

  // ---------------------------------------------------------------------
  // 2. Pending listings table
  // ---------------------------------------------------------------------
  async function fetchPendingListings() {
    if (!elements.tableBody) return;

    elements.tableBody.innerHTML = row5('Loading listings…');

    try {
      const response = await window.api.get('/admin/moderation/properties?page=1&limit=5');
      const payload = response?.data || response || {};
      const listings = Array.isArray(payload) ? payload : (payload.items || payload.data || []);

      if (!listings.length) {
        elements.tableBody.innerHTML = row5('No properties pending review right now.');
        return;
      }

      elements.tableBody.innerHTML = listings.map(renderListingRow).join('');
    } catch (err) {
      console.error('Failed to load pending listings:', err.message);
      elements.tableBody.innerHTML = row5(`Unable to load properties: ${escapeHtml(err.message)}`);
      showToast('Could not load pending listings.', 'error');
    }
  }

  function renderListingRow(item) {
    const priceStr = item.price
      ? new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: item.currency || 'NGN',
          minimumFractionDigits: 0
        }).format(item.price)
      : '—';

    const landlordName = item.landlord
      ? `${item.landlord.firstName || ''} ${item.landlord.lastName || ''}`.trim() || 'Unknown Host'
      : 'Unknown Host';
    const hostRole = item.landlord?.role ? String(item.landlord.role).toUpperCase() : 'LANDLORD';
    const location = [item.location, item.city, item.state].filter(Boolean).join(', ') || 'Lagos';
    const timeStr = formatRelativeTime(item.createdAt);

    return `
      <tr data-id="${escapeHtml(item.id)}">
        <td>
          <div class="property-title-cell">${escapeHtml(item.title || 'Untitled property')}</div>
          <div class="property-price-cell">${escapeHtml(priceStr)} yearly</div>
        </td>
        <td>
          ${escapeHtml(landlordName)}
          <span class="role-subtext">${escapeHtml(hostRole)}</span>
        </td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(timeStr)}</td>
        <td>
          <button type="button" class="action-row-btn" data-id="${escapeHtml(item.id)}" aria-label="Review ${escapeHtml(item.title || 'listing')}">⋮</button>
        </td>
      </tr>
    `;
  }

  // Event delegation: works for every row, including ones rendered after
  // the initial load, without re-binding listeners on every refresh.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-row-btn');
    if (!btn || !elements.tableBody || !elements.tableBody.contains(btn)) return;
    e.stopPropagation();
    targetRowListingId = btn.getAttribute('data-id');
    openModerationModal();
  });

  // ---------------------------------------------------------------------
  // 3. Audit logs -> Recent Activities panel
  //    (Recent Reports panel is hidden — no reports endpoint exists yet)
  // ---------------------------------------------------------------------
  async function fetchAuditLogsAndPopulateActivity() {
    try {
      const response = await window.api.get('/admin/audit-logs?page=1&limit=10');
      const payload = response?.data || response || {};
      const logs = Array.isArray(payload) ? payload : (payload.items || []);

      const activities = logs.filter(log =>
        ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'PROPERTY_STATUS_UPDATED', 'PROPERTY_DELETED'].includes(log.action)
      );

      if (elements.activityList) {
        elements.activityList.innerHTML = activities.length
          ? activities.slice(0, 3).map(renderActivityItem).join('')
          : '<li class="empty-state">No recent activity.</li>';
      }
    } catch (err) {
      console.warn('Could not sync activity panel:', err.message);
    }
  }

  function renderActivityItem(log) {
    const kind = log.action === 'PROPERTY_APPROVED' ? 'approved'
      : log.action === 'PROPERTY_REJECTED' ? 'rejected'
      : 'updated';
    const iconChar = kind === 'approved' ? '✓' : kind === 'rejected' ? '✕' : '•';
    const actionText = kind === 'approved' ? 'Listing approved'
      : kind === 'rejected' ? 'Listing rejected'
      : (log.details || 'Listing status updated');
    const propTitle = log.metadata?.propertyTitle || 'Property listing';
    const logTime = log.createdAt ? formatRelativeTime(log.createdAt) : '';

    return `
      <li>
        <span class="activity-icon ${kind}">${iconChar}</span>
        <div>
          <p style="margin:0; font-weight:600;">${actionText}</p>
          <p class="activity-sub">${escapeHtml(propTitle)}</p>
        </div>
        <span class="activity-time">${escapeHtml(logTime)}</span>
      </li>
    `;
  }

  // ---------------------------------------------------------------------
  // 4. Moderation modal — Cancel closes it, Reject requires a reason,
  //    Approve/Reject both call the real API and refresh the dashboard.
  // ---------------------------------------------------------------------
  function setupModalInteractions() {
    if (!elements.overlay) return;

    elements.cancelBtn?.addEventListener('click', closeModerationModal);

    elements.overlay.addEventListener('click', (e) => {
      if (e.target === elements.overlay) closeModerationModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.overlay.style.display !== 'none') {
        closeModerationModal();
      }
    });

    elements.approveBtn?.addEventListener('click', async () => {
      if (!targetRowListingId) return;
      setButtonsBusy(true);
      await approveListing(targetRowListingId);
      setButtonsBusy(false);
    });

    elements.rejectBtn?.addEventListener('click', async () => {
      if (!targetRowListingId) return;
      const rejectionReason = elements.reasonField?.value.trim() || '';
      if (!rejectionReason) {
        if (elements.errorAlert) elements.errorAlert.style.display = 'block';
        elements.reasonField?.focus();
        return;
      }
      setButtonsBusy(true);
      await rejectListing(targetRowListingId, rejectionReason);
      setButtonsBusy(false);
    });
  }

  function setButtonsBusy(isBusy) {
    [elements.approveBtn, elements.rejectBtn, elements.cancelBtn].forEach(btn => {
      if (btn) btn.disabled = isBusy;
    });
  }

  async function approveListing(listingId) {
    try {
      await window.api.patch(`/admin/moderation/properties/${encodeURIComponent(listingId)}/approve`);
      onListingHandled(listingId, 'Listing approved and published.');
    } catch (err) {
      console.error('Approve failed:', err.message);
      showToast(`Could not approve listing: ${err.message}`, 'error');
    }
  }

  async function rejectListing(listingId, rejectionReason) {
    try {
      await window.api.patch(`/admin/moderation/properties/${encodeURIComponent(listingId)}/reject`, { rejectionReason });
      onListingHandled(listingId, 'Listing rejected.');
    } catch (err) {
      console.error('Reject failed:', err.message);
      showToast(`Could not reject listing: ${err.message}`, 'error');
    }
  }

  async function onListingHandled(listingId, successMessage) {
    closeModerationModal();

    const row = elements.tableBody?.querySelector(`tr[data-id="${cssEscape(listingId)}"]`);
    if (row) row.remove();

    showToast(successMessage, 'success');

    await Promise.all([
      fetchModerationStats(),
      fetchAuditLogsAndPopulateActivity()
    ]);

    if (elements.tableBody && !elements.tableBody.children.length) {
      await fetchPendingListings();
    }
  }

  function openModerationModal() {
    if (!elements.overlay) return;
    elements.overlay.style.display = 'flex';
    if (elements.reasonField) elements.reasonField.value = '';
    if (elements.errorAlert) elements.errorAlert.style.display = 'none';
    elements.reasonField?.focus();
  }

  function closeModerationModal() {
    if (!elements.overlay) return;
    elements.overlay.style.display = 'none';
    targetRowListingId = null;
  }

  // -
  // Helpers
  // 
  function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function row5(message) {
    return `<tr><td colspan="5" style="text-align:center; padding:20px;">${escapeHtml(message)}</td></tr>`;
  }

  function formatRelativeTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMs = Math.max(0, Date.now() - d.getTime());
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  // CSS.escape polyfill-safe wrapper, for building attribute selectors
  // out of listing IDs that may contain special characters.
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${type === 'success' ? '✓' : '!'}</span>
      <span class="toast__message">${escapeHtml(message)}</span>
      <button class="toast__dismiss" type="button" aria-label="Dismiss notification">×</button>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    toast.querySelector('.toast__dismiss').addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), 4000);
  }

  function removeToast(toast) {
    if (!toast) return;
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 250);
  }
})();