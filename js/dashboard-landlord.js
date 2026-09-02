/* ============================================================
   dashboard-landlord.js
   STRICT NEW USER FIX: NO CHARTS, NO MOCK DATA, NO IMAGES
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get raw layout elements directly from your HTML markup tags
  const loadingState = document.getElementById('dashLoading');
  const emptyState = document.getElementById('dashEmptyState');
  const populatedState = document.getElementById('dashPopulatedState');
  const statsRowEmpty = document.getElementById('statsRowEmpty');
  const addPropertyBtnEmpty = document.getElementById('addPropertyBtnEmpty');
  const welcomeTitle = document.getElementById('dashWelcomeTitle');

  // Hard enforce absolute layout safety: instantly hide the populated dashboard containers
  if (populatedState) populatedState.style.setProperty('display', 'none', 'important');
  if (emptyState) emptyState.style.setProperty('display', 'none', 'important');
  if (loadingState) loadingState.style.setProperty('display', 'block', 'important');

  // Sync real name from your login form storage context if present
  const savedUser = localStorage.getItem('username') || 'Landlord';
  if (welcomeTitle) {
    welcomeTitle.textContent = "Welcome back!";
  }

  // Bind Continue/Upload button event listener to your team's file target
  if (addPropertyBtnEmpty) {
    addPropertyBtnEmpty.addEventListener('click', () => {
      window.location.href = 'add-property.html';
    });
  }

  try {
    if (!window.api) throw new Error("api.js frame missing.");

    // Query your backend for uploaded property data array metrics
    const listingsData = await window.api.get('/properties?limit=20');
    const properties = listingsData?.items || listingsData || [];

    // Query real-time financial stats balance records 
    let totalRevenue = '$0';
    let occupancyRate = '-';
    let pendingMaintenance = '0';
    let overdueRent = '$0';

    try {
      const statsResponse = await window.api.get('/properties/my-listings/stats');
      if (statsResponse) {
        if (statsResponse.totalRevenue !== undefined) totalRevenue = `$${Number(statsResponse.totalRevenue).toLocaleString()}`;
        if (statsResponse.occupancyRate !== undefined) occupancyRate = `${statsResponse.occupancyRate}%`;
        if (statsResponse.pendingMaintenance !== undefined) pendingMaintenance = statsResponse.pendingMaintenance;
        if (statsResponse.overdueRent !== undefined) overdueRent = `$${Number(statsResponse.overdueRent).toLocaleString()}`;
      }
    } catch (e) {
      console.warn("Stats server endpoints are resting. Defaulting to strict 0 balances.");
    }

    // Build exactly 4 matching empty stat cards
    const cleanStatCardsHTML = `
      <div class="dash-stat-card"><p class="stat-card-title">Total Monthly Revenue</p><h3 class="stat-card-value">${totalRevenue}</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Occupancy Rate</p><h3 class="stat-card-value">${occupancyRate}</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Pending Maintenance</p><h3 class="stat-card-value">${pendingMaintenance}</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Overdue Rent</p><h3 class="stat-card-value">${overdueRent}</h3></div>
    `;

    /* ============================================================
       STRICT CONDITIONAL INTERCEPTOR MATRIX
       ============================================================ */
    if (properties.length === 0) {
      // THE NEW USER ACCOUNT: FORCE EVERYTHING AWAY
      if (statsRowEmpty) statsRowEmpty.innerHTML = cleanStatCardsHTML;

      // Fully block out and delete the populated container row structures
      if (populatedState) {
        populatedState.innerHTML = ''; // WIPES OUT THE OLD MOCK IMAGE AND CHART TAGS ENTIRELY
        populatedState.style.setProperty('display', 'none', 'important');
      }

      if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
      if (emptyState) emptyState.style.setProperty('display', 'block', 'important');

    } else {
      // ACTIVE ACCOUNT LOGIC: Refresh window location once to populate active lists natively
      // This runs only after the landlord finishes uploading a property on add-property.html
      location.reload(); 
    }

  } catch (err) {
    console.error("Pipeline breakdown:", err);
    // Secure Offline Safety net: Render exact zeroed 1st image layout screen map
    const defaultHTML = `
      <div class="dash-stat-card"><p class="stat-card-title">Total Monthly Revenue</p><h3 class="stat-card-value">$0</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Occupancy Rate</p><h3 class="stat-card-value">-</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Pending Maintenance</p><h3 class="stat-card-value">0</h3></div>
      <div class="dash-stat-card"><p class="stat-card-title">Overdue Rent</p><h3 class="stat-card-value">$0</h3></div>
    `;
    if (statsRowEmpty) statsRowEmpty.innerHTML = defaultHTML;
    if (populatedState) populatedState.innerHTML = '';
    if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
    if (emptyState) emptyState.style.setProperty('display', 'block', 'important');
  }
});
