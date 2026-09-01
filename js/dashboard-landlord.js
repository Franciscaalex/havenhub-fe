/* ============================================================
   js/dashboard-landlord.js
   Real-Time API-Driven Landlord Dashboard State Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const dashWelcomeTitle = document.getElementById('dashWelcomeTitle');
  const emptyStateView = document.getElementById('dashEmptyState');
  const populatedStateView = document.getElementById('dashPopulatedState');
  const loadingSkeleton = document.getElementById('dashLoading');

  // 1. DYNAMIC TOPBAR GREETING: Pull first name from local auth cache
  const cachedUser = localStorage.getItem('username') || 'John';
  if (dashWelcomeTitle) {
    dashWelcomeTitle.textContent = `Welcome ${cachedUser.split(' ')[0]}!`;
  }

  // 2. LINK INTERACTIVE BUTTONS: Navigate to the creation form
  const bindNavigationCta = (elementId) => {
    document.getElementById(elementId)?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'add-property.html';
    });
  };
  bindNavigationCta('addPropertyBtnEmpty');
  bindNavigationCta('addPropertyBtnPopulated');

  try {
    if (!window.api) {
      throw new Error("api.js core manager is missing or loaded out of order.");
    }

    // 3. FETCH REAL PROPERTIES LIST FROM LIVE BACKEND API
    // This targets your endpoint to load your live properties list array
    const response = await window.api.get('/properties');
    const propertiesList = response?.items || response?.data?.items || response?.data || response || [];

    // Hide the initial loading placeholder if it exists on the page
    if (loadingSkeleton) loadingSkeleton.hidden = true;

    // 4. AUTOMATED SWITCHBOARD LAYOUT CONTROLLER
    if (propertiesList.length === 0) {
      /* ------------------------------------------------------------
         STATE A: ACCOUNT HAS NO PROPERTIES YET (Show Empty Board)
         ------------------------------------------------------------ */
      if (emptyStateView) emptyStateView.hidden = false;
      if (populatedStateView) populatedStateView.hidden = true;
      
      // Keep metrics zeroed out as seen on your new user interface image mockup
      updateDashboardMetricsRow(0, 0, 0, 0);

    } else {
      /* ------------------------------------------------------------
         STATE B: ACTIVE DATA PRESENT (Show Real-Time Metric Feeds)
         ------------------------------------------------------------ */
      
      // Calculate dynamic mathematical aggregations from live array objects
      const totalUnits = propertiesList.length;
      
      // Count rented spaces based on status strings returned by server model
      const rentedUnits = propertiesList.filter(p => p.status?.toUpperCase() === 'RENTED').length;
      
      // Occupancy Rate Arithmetic
      const occupancyRate = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;
      
      // Sum up monthly pricing parameters from rented units to build true revenue streams
      const computedMonthlyRevenue = propertiesList
        .filter(p => p.status?.toUpperCase() === 'RENTED')
        .reduce((sum, p) => sum + (Number(p.price) || 0), 0);

      // Count units currently sitting in verification review queues (where isApproved is falsy)
      const pendingMaintenanceOrReview = propertiesList.filter(p => !p.isApproved || p.status?.toUpperCase() === 'PENDING').length;

      // Simulated overdue balance (Can be linked to custom billing endpoints later)
      const computedOverdueRent = totalUnits > 0 ? 0 : 0;

      // Swap HTML panel wrappers view targets
      if (emptyStateView) emptyStateView.hidden = true;
      if (populatedStateView) populatedStateView.hidden = false;

      // 5. HYDRATE CORES DATA INTO ROWS VISUAL CONTAINERS
      updateDashboardMetricsRow(computedMonthlyRevenue, occupancyRate, pendingMaintenanceOrReview, computedOverdueRent);
      
      // If your populated panels container contains sub-modules, run chart painters
      if (typeof renderDynamicChartBars === 'function') renderDynamicChartBars();
      if (typeof renderLiveApprovedTimelineLogs === 'function') renderLiveApprovedTimelineLogs();
      if (typeof renderPropertiesGrid === 'function') renderPropertiesGrid(propertiesList);
    }

  } catch (err) {
    console.error("Failed to query live dashboard api feed metrics:", err);
    // Silent fail protection: if backend server fails to ping, show zeroed base states layout
    updateDashboardMetricsRow(0, 0, 0, 0);
  }
});

/* ---------- SHARED CARD VALUE RENDERING AGENT LAYER ---------- */
function updateDashboardMetricsRow(revenue, occupancy, maintenance, overdue) {
  // Select target cards blocks inside your dashboard views grids
  // Dynamically works whether your structural parent ID is #statsRow or #statsRowEmpty
  const targetRows = document.querySelectorAll('.dash-stats-row');
  
  targetRows.forEach(row => {
    // Format numeric revenue data into pristine currency representations ($2,500)
    const formattedRevenue = revenue > 0 ? `$${revenue.toLocaleString()}` : "$0";
    const formattedOccupancy = occupancy > 0 ? `${occupancy}%` : "-";
    const formattedOverdue = overdue > 0 ? `$${overdue.toLocaleString()}` : "$0";

    row.innerHTML = `
      <div class="dash-stat-card">
        <span class="dash-stat-label">Total Monthly Revenue</span>
        <span class="dash-stat-value">${formattedRevenue}</span>
      </div>
      <div class="dash-stat-card">
        <span class="dash-stat-label">Occupancy Rate</span>
        <span class="dash-stat-value">${formattedOccupancy}</span>
      </div>
      <div class="dash-stat-card">
        <span class="dash-stat-label">Pending Maintenance</span>
        <span class="dash-stat-value">${maintenance}</span>
      </div>
      <div class="dash-stat-card">
        <span class="dash-stat-label">Overdue Rent</span>
        <span class="dash-stat-value">${formattedOverdue}</span>
      </div>
    `;
  });
}
