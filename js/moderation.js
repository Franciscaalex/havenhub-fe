/* moderation.js — HavenHub Moderation Queue */

(function () {
  const SUPPORTED_TABS = ['pending'];
  const TAB_TITLES = {
    pending: 'Pending Listings'
  };

  let activeTab = 'pending';
  let targetRowListingId = null;

  const els = {
    tabs: document.getElementById('modTabs'),
    panelTitle: document.getElementById('modPanelTitle'),
    tableBody: document.getElementById('modTableBody'),

    overlay: document.getElementById('moderationOverlay'),
    reasonField: document.getElementById('moderationReason'),
    errorAlert: document.querySelector('.modal__error'),
    cancelBtn: document.querySelector('.btn--ghost'),
    rejectBtn: document.querySelector('.btn--reject'),
    approveBtn: document.querySelector('.btn--approve')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!window.api) {
      console.error('Moderation queue halted: window.api is missing. Make sure js/api.js loads first.');
      return;
    }

    setupTabs();
    setupModal();

    if (els.panelTitle) els.panelTitle.textContent = TAB_TITLES[activeTab];

    await Promise.all([
      refreshTabCounts(),
      loadTab(activeTab)
    ]);
  }

  // ---------------------------------------------------------------------
  // Tabs — only "Pending" is backed by a real endpoint right now, so the
  // other tab buttons (All / Flagged / Reported) are hidden rather than
  // wired to fake data.
  // ---------------------------------------------------------------------
  function setupTabs() {
    els.tabs?.querySelectorAll('.mod-tab').forEach(tab => {
      const key = tab.getAttribute('data-tab');

      if (!SUPPORTED_TABS.includes(key)) {
        tab.style.display = 'none';
        return;
      }

      tab.addEventListener('click', async () => {
        if (key === activeTab) return;

        els.tabs.querySelectorAll('.mod-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
        tab.setAttribute('aria-selected', 'true');

        activeTab = key;
        if (els.panelTitle) els.panelTitle.textContent = TAB_TITLES[key];
        await loadTab(key);
      });
    });
  }

  async function refreshTabCounts() {
    try {
      const response = await window.api.get('/admin/moderation/properties/stats');
      const data = response?.data || response || {};

      setCount('pending', numberOrZero(data.totalPending));
    } catch (err) {
      console.warn('Could not load tab counts:', err.message);
    }
  }

  function setCount(tab, value) {
    const el = els.tabs?.querySelector(`.mod-tab-count[data-count="${tab}"]`);
    if (el) el.textContent = value > 0 ? String(value) : '';
  }

  // ---------------------------------------------------------------------
  // Table data
  // ---------------------------------------------------------------------
  async function loadTab(tab) {
    if (!els.tableBody) return;
    els.tableBody.innerHTML = statusRow('Loading listings…');

    try {
      // Only 'pending' is reachable (see setupTabs), but keep this a
      // switch so re-enabling a tab later is a one-line change.
      const rows = (await fetchPendingModerationQueue()).map(normalizeProperty);

      if (!rows.length) {
        els.tableBody.innerHTML = statusRow('No pending properties found.');
        return;
      }

      els.tableBody.innerHTML = rows.map(renderRow).join('');
    } catch (err) {
      console.error(`Failed to load ${tab} listings:`, err.message);
      els.tableBody.innerHTML = statusRow(`Couldn't load listings: ${escapeHtml(err.message)}`);
    }
  }

  async function fetchPendingModerationQueue() {
    const response = await window.api.get('/admin/moderation/properties?page=1&limit=20');
    const payload = response?.data || response || {};
    return Array.isArray(payload) ? payload : (payload.items || payload.data || []);
  }

  function normalizeProperty(item) {
    return {
      id: item.id,
      title: item.title || 'Untitled property',
      price: item.price,
      currency: item.currency,
      landlordName: item.landlord
        ? `${item.landlord.firstName || ''} ${item.landlord.lastName || ''}`.trim() || 'Unknown Host'
        : 'Unknown Host',
      hostRole: item.landlord?.role ? String(item.landlord.role).toUpperCase() : 'LANDLORD',
      location: [item.location, item.city, item.state].filter(Boolean).join(', ') || 'Lagos',
      submittedAt: item.createdAt,
      priority: item.priority || (item.highPriority ? 'HIGH' : 'NORMAL')
    };
  }

  function renderRow(row) {
    const priceStr = row.price
      ? new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: row.currency || 'NGN',
          minimumFractionDigits: 0
        }).format(row.price)
      : '—';
    const priorityClass = String(row.priority).toUpperCase() === 'HIGH'
      ? 'mod-priority-badge--high'
      : String(row.priority).toUpperCase() === 'MEDIUM'
        ? 'mod-priority-badge--medium'
        : 'mod-priority-badge--normal';
    const priorityLabel = String(row.priority).charAt(0) + String(row.priority).slice(1).toLowerCase();

    return `
      <tr data-id="${escapeHtml(row.id)}">
        <td>
          <div class="mod-property-title">${escapeHtml(row.title)}</div>
          <div class="mod-property-price">${escapeHtml(priceStr)}${row.price ? ' yearly' : ''}</div>
        </td>
        <td>
          ${escapeHtml(row.landlordName)}
          <span class="mod-owner-role">${escapeHtml(row.hostRole)}</span>
        </td>
        <td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(formatRelativeTime(row.submittedAt))}</td>
        <td><span class="mod-priority-badge ${priorityClass}">${escapeHtml(priorityLabel)}</span></td>
        <td><button type="button" class="mod-action-btn" data-id="${escapeHtml(row.id)}" aria-label="Review ${escapeHtml(row.title)}">⋮</button></td>
      </tr>
    `;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mod-action-btn');
    if (!btn || !els.tableBody || !els.tableBody.contains(btn)) return;
    e.stopPropagation();
    targetRowListingId = btn.getAttribute('data-id');
    openModal();
  });

  // ---------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------
  function setupModal() {
    if (!els.overlay) return;

    els.cancelBtn?.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.overlay.style.display !== 'none') closeModal();
    });

    els.approveBtn?.addEventListener('click', async () => {
      if (!targetRowListingId) return;
      setBusy(true);
      await approveListing(targetRowListingId);
      setBusy(false);
    });

    els.rejectBtn?.addEventListener('click', async () => {
      if (!targetRowListingId) return;
      const rejectionReason = els.reasonField?.value.trim() || '';
      if (!rejectionReason) {
        if (els.errorAlert) els.errorAlert.style.display = 'block';
        els.reasonField?.focus();
        return;
      }
      setBusy(true);
      await rejectListing(targetRowListingId, rejectionReason);
      setBusy(false);
    });
  }

  function setBusy(isBusy) {
    [els.approveBtn, els.rejectBtn, els.cancelBtn].forEach(btn => { if (btn) btn.disabled = isBusy; });
  }

  async function approveListing(id) {
    try {
      await window.api.patch(`/admin/moderation/properties/${encodeURIComponent(id)}/approve`);
      closeModal();
      showToast('Listing approved.', 'success');
      await Promise.all([refreshTabCounts(), loadTab(activeTab)]);
    } catch (err) {
      console.error('Approve failed:', err.message);
      showToast(`Could not approve listing: ${err.message}`, 'error');
    }
  }

  async function rejectListing(id, rejectionReason) {
    try {
      await window.api.patch(`/admin/moderation/properties/${encodeURIComponent(id)}/reject`, { rejectionReason });
      closeModal();
      showToast('Listing rejected.', 'success');
      await Promise.all([refreshTabCounts(), loadTab(activeTab)]);
    } catch (err) {
      console.error('Reject failed:', err.message);
      showToast(`Could not reject listing: ${err.message}`, 'error');
    }
  }

  function openModal() {
    if (!els.overlay) return;
    els.overlay.style.display = 'flex';
    if (els.reasonField) els.reasonField.value = '';
    if (els.errorAlert) els.errorAlert.style.display = 'none';
    els.reasonField?.focus();
  }

  function closeModal() {
    if (!els.overlay) return;
    els.overlay.style.display = 'none';
    targetRowListingId = null;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function statusRow(message) {
    return `<tr><td colspan="6" class="mod-table-status">${escapeHtml(message)}</td></tr>`;
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
    return `${Math.floor(hr / 24)}d ago`;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
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