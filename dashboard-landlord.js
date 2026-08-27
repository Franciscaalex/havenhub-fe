document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTooltips();
  loadDashboard();
});

/* ---------- Sidebar (mobile off-canvas) ---------- */

function initSidebar() {
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  const menuBtn = document.getElementById('dashMenuBtn');
  if (!sidebar || !overlay || !menuBtn) return;

  const openSidebar = () => {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
  };

  menuBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}

/* ---------- "Coming Soon" tooltip ---------- */

function initTooltips() {
  const tooltip = document.getElementById('dashTooltip');
  const triggers = document.querySelectorAll('.dash-nav-soon');
  if (!tooltip || !triggers.length) return;

  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const isSameAndOpen = tooltip.dataset.for === btn.dataset.tooltipLabel && !tooltip.hidden;
      tooltip.hidden = isSameAndOpen;
      tooltip.dataset.for = btn.dataset.tooltipLabel;
    });
  });

  document.addEventListener('click', (e) => {
    if (!tooltip.hidden && !e.target.closest('.dash-nav-soon') && !e.target.closest('#dashTooltip')) {
      tooltip.hidden = true;
    }
  });
}

async function loadDashboard() {
  const loadingEl = document.getElementById('dashLoading');
  const emptyEl = document.getElementById('dashEmptyState');
  const populatedEl = document.getElementById('dashPopulatedState');
  const welcomeTitle = document.getElementById('dashWelcomeTitle');

  const username = window.HavenHubSession?.getCurrentUsername?.();
  if (welcomeTitle) {
    welcomeTitle.textContent = username ? `Welcome ${username}!` : 'Welcome back!';
  }

  try {
    const response = await window.api.get('/properties');
    const properties = response.items || [];

    loadingEl.hidden = true;

    if (properties.length === 0) {
      emptyEl.hidden = false;
    } else {
      renderPopulatedDashboard(properties);
      populatedEl.hidden = false;
    }
  } catch (err) {
    console.error('Failed to load properties:', err);
    loadingEl.hidden = true;
    emptyEl.hidden = false;
  }

  wireAddPropertyButtons();
}

function wireAddPropertyButtons() {
  ['addPropertyBtnEmpty', 'addPropertyBtnPopulated'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      window.location.href = 'add-property.html';
    });
  });
}

/* ---------- Populated view ---------- */

function renderPopulatedDashboard(properties) {
  renderStats(properties);
  renderChart();
  renderActivity();
  renderListings(properties);
}

function renderStats(properties) {
  const stats = getMockStats(properties); // PLACEHOLDER — see note at top of file
  const statsRow = document.getElementById('statsRow');

  statsRow.innerHTML = stats.map(stat => `
    <div class="dash-stat-card">
      <span class="dash-stat-label">${stat.label}</span>
      <span class="dash-stat-value">${stat.value}</span>
      <span class="dash-stat-sub is-${stat.tone}">${stat.sub}</span>
    </div>
  `).join('');
}

function getMockStats(properties) {
  return [
    { label: 'Total Monthly Revenue', value: '$20,000', sub: '+10.5% vs last mo.', tone: 'positive' },
    { label: 'Occupancy Rate', value: '90%', sub: '15 / 20 Units Occupied', tone: 'neutral' },
    { label: 'Pending Maintenance', value: '5 Requests', sub: '3 High Priority', tone: 'warning' },
    { label: 'Overdue Rent', value: '$5,000', sub: '3 Tenants Pending', tone: 'negative' },
  ];
}

function renderChart() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const rentsData = [70, 75, 80, 65, 90, 60, 85, 78, 82];
  const expensesData = [35, 40, 30, 45, 38, 50, 32, 42, 36];

  const chartEl = document.getElementById('rentsChart');
  chartEl.innerHTML = months.map((month, i) => `
    <div class="dash-chart-col">
      <div class="dash-chart-bars">
        <div class="dash-bar dash-bar-rents" style="height:${rentsData[i]}%"></div>
        <div class="dash-bar dash-bar-expenses" style="height:${expensesData[i]}%"></div>
      </div>
      <span class="dash-chart-month">${month}</span>
    </div>
  `).join('');
}

function renderActivity() {
  const activity = [
    { color: 'var(--dash-green)', title: 'Lease signed', sub: 'John Doe signed 2 years lease', time: '2h ago' },
    { color: 'var(--dash-orange-dark)', title: 'New maintenance request', sub: 'Leaking pipe reported in Unit 5B', time: '5h ago' },
    { color: 'var(--dash-green)', title: 'Payment Received', sub: 'Sarah Doe paid $2,000 for Unit 2A', time: '15h ago' },
    { color: 'var(--dash-accent)', title: 'Rent Reminder Sent', sub: 'Automated notice sent to Unit 4C', time: '2d ago' },
  ];

  const list = document.getElementById('activityList');
  list.innerHTML = activity.map(item => `
    <li class="dash-activity-item">
      <span class="dash-activity-dot" style="background:${item.color}"></span>
      <span>
        <span class="dash-activity-title">${item.title}</span><br>
        <span class="dash-activity-sub">${item.sub}</span>
      </span>
      <span class="dash-activity-time">${item.time}</span>
    </li>
  `).join('');
}

function renderListings(properties) {
  const row = document.getElementById('listingsRow');

  row.innerHTML = properties.map(p => {
    const title = p.title ?? 'Untitled property';
    const isVacant = (p.vacantUnits ?? 0) > 0;
    const badgeText = p.status ?? (isVacant ? `${p.vacantUnits} Vacant` : 'Occupied');
    const sub = p.unitsSummary ?? p.location ?? '';

    return `
      <div class="dash-listing-card">
        <img class="dash-listing-img" src="${p.image ?? ''}" alt="${title}" onerror="this.style.display='none'">
        <div class="dash-listing-body">
          <div class="dash-listing-title">${title}</div>
          <div class="dash-listing-sub">${sub}</div>
          <span class="dash-listing-badge ${isVacant ? 'is-vacant' : ''}">${badgeText}</span>
        </div>
      </div>
    `;
  }).join('');
}