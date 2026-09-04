/* ============================================================
   dashboard-landlord.js
   STRICT REAL-TIME SEPARATION MODE — NO BLINKING REFRESH LOOPS
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('dashLoading');
  const emptyState = document.getElementById('dashEmptyState');
  const populatedState = document.getElementById('dashPopulatedState');
  const statsRowEmpty = document.getElementById('statsRowEmpty');
  const addPropertyBtnEmpty = document.getElementById('addPropertyBtnEmpty');
  const welcomeTitle = document.getElementById('dashWelcomeTitle');
  
  const statsRowPopulated = document.getElementById('statsRow');
  const panelsRow = document.getElementById('panelsRow');
  const listingsRow = document.getElementById('listingsRow');

  // Strict initial display synchronization to eliminate visual popping
  if (populatedState) populatedState.style.setProperty('display', 'none', 'important');
  if (emptyState) emptyState.style.setProperty('display', 'none', 'important');
  if (loadingState) loadingState.style.setProperty('display', 'block', 'important');

  if (addPropertyBtnEmpty) {
    addPropertyBtnEmpty.addEventListener('click', () => {
      window.location.href = 'add-property.html';
    });
  }

  try {
    if (!window.api) throw new Error("api.js frame missing.");

    const listingsData = await window.api.get('/properties?limit=20');
    const properties = listingsData?.items || listingsData || [];

    let totalRevenue = '$0';
    let occupancyRate = '-';
    let pendingMaintenance = '0';
    let overdueRent = '$0';
    let statsResponse = null;
    let hasFinancialActivity = false;

    try {
      statsResponse = await window.api.get('/properties/my-listings/stats');
      if (statsResponse) {
        if (statsResponse.totalRevenue !== undefined) totalRevenue = `$${Number(statsResponse.totalRevenue).toLocaleString()}`;
        if (statsResponse.occupancyRate !== undefined) occupancyRate = `${statsResponse.occupancyRate}%`;
        if (statsResponse.pendingMaintenance !== undefined) pendingMaintenance = statsResponse.pendingMaintenance;
        if (statsResponse.overdueRent !== undefined) overdueRent = `$${Number(statsResponse.overdueRent).toLocaleString()}`;
        
        if (Number(statsResponse.totalRevenue) > 0 || Number(statsResponse.overdueRent) > 0) {
          hasFinancialActivity = true;
        }
      }
    } catch (e) {
      console.warn("Stats servers offline. Falling back to default baseline values.");
    }

    const healthClass = hasFinancialActivity ? 'financial-active-health' : 'financial-idle-health';
    const cleanStatCardsHTML = `
      <div class="dash-stat-card ${healthClass}">
        <p class="stat-card-title">Total Monthly Revenue</p>
        <h3 class="stat-card-value text-green-healthy">${totalRevenue}</h3>
        ${hasFinancialActivity ? '<span class="stat-card-subtitle">Current Tracked Earnings</span>' : ''}
      </div>
      <div class="dash-stat-card ${healthClass}">
        <p class="stat-card-title">Occupancy Rate</p>
        <h3 class="stat-card-value">${occupancyRate}</h3>
        ${hasFinancialActivity ? '<span class="stat-card-subtitle">Active Leases</span>' : ''}
      </div>
      <div class="dash-stat-card ${healthClass}">
        <p class="stat-card-title">Pending Maintenance</p>
        <h3 class="stat-card-value">${pendingMaintenance}</h3>
        ${hasFinancialActivity ? '<span class="stat-card-subtitle">Open Tickets</span>' : ''}
      </div>
      <div class="dash-stat-card ${healthClass}">
        <p class="stat-card-title">Overdue Rent</p>
        <h3 class="stat-card-value text-red-overdue">${overdueRent}</h3>
        ${hasFinancialActivity ? '<span class="stat-card-subtitle">Action Required</span>' : ''}
      </div>
    `;

    if (properties.length === 0) {
      // STATE 1: Empty state panel matches the target dashboard reference mockup exactly
      if (statsRowEmpty) statsRowEmpty.innerHTML = cleanStatCardsHTML;
      if (panelsRow) panelsRow.innerHTML = '';
      if (listingsRow) listingsRow.innerHTML = '';
      
      if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
      if (populatedState) populatedState.style.setProperty('display', 'none', 'important');
      if (emptyState) emptyState.style.setProperty('display', 'block', 'important');

    } else {
      // STATES 2, 3, & 4: Properties exist
      if (statsRowPopulated) statsRowPopulated.innerHTML = cleanStatCardsHTML;

      renderLiveOverviewPanels(statsResponse?.chartData || [], statsResponse?.recentActivities || [], hasFinancialActivity);
      renderLivePropertyGrid(properties);

      if (loadingState) loadingState.style.setProperty('display', 'none', 'important');
      if (emptyState) emptyState.style.setProperty('display', 'none', 'important');
      if (populatedState) populatedState.style.setProperty('display', 'block', 'important');

      if (properties.length > 4) {
        initializeCarouselAnimation();
      }
    }

  } catch (err) {
    console.error("Pipeline Breakdown Error Details:", err);
  }

  function renderLiveOverviewPanels(chartData, activities, showChart) {
    if (!panelsRow) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullYearChartDataset = months.map((_, index) => chartData[index] || 0);

    const chartPanelHTML = showChart ? `
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
    ` : '';

    const layoutModifierClass = showChart ? 'full-dashboard-grid' : 'narrow-activity-only-grid';
    panelsRow.className = `dash-panels-row ${layoutModifierClass}`;
    
    panelsRow.innerHTML = `
      ${chartPanelHTML}
      <div class="dash-activity-panel">
        <div class="activity-header-row">
          <h3>Recent Activity</h3>
          <button class="add-property-btn-top" id="addPropertyTopBtn">Add a New Property</button>
        </div>
        <div class="activity-timeline">
          ${activities.length === 0 ? `<p class="no-activity-text text-muted">No recent operations logged.</p>` : activities.map(act => `
            <div class="activity-item">
              <p><strong>${act.title || 'Update'}</strong><br>${act.description || ''}</p>
              <span class="activity-time">${act.timeAgo || 'just now'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.getElementById('addPropertyTopBtn')?.addEventListener('click', () => { window.location.href = 'add-property.html'; });
  }

  function renderLivePropertyGrid(propertiesList) {
    if (!listingsRow) return;
    listingsRow.innerHTML = propertiesList.map(item => {
      const statusRaw = (item.status || 'PENDING_REVIEW').toUpperCase();
      let badgeText = 'Pending';
      let badgeClass = 'badge-figma-pending';

      if (statusRaw === 'APPROVED' || statusRaw === 'AVAILABLE') { 
        badgeText = 'Available'; 
        badgeClass = 'badge-figma-available'; 
      } else if (statusRaw === 'RENTED') { 
        badgeText = 'Rented'; 
        badgeClass = 'badge-figma-rented'; 
      }

      const liveImg = item.imageUrl
        || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null)
        || 'images/property-placeholder.png';

      return `
        <div class="property-figma-card">
          <img class="property-figma-img" src="${liveImg}" alt="Real estate photo">
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
  }

  function initializeCarouselAnimation() {
    if (!listingsRow) return;
    listingsRow.classList.add('carousel-active-fluid');
    const duplicateContent = listingsRow.innerHTML;
    listingsRow.innerHTML = duplicateContent + duplicateContent;
    let currentOffset = 0;
    
    function cycle() {
      currentOffset += 0.8;
      if (currentOffset >= listingsRow.scrollWidth / 2) currentOffset = 0;
      listingsRow.scrollLeft = currentOffset;
      requestAnimationFrame(cycle);
    }
    requestAnimationFrame(cycle);
  }
});
