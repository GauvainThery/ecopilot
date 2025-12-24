// VS Code API
const vscode = acquireVsCodeApi();

// State
let _dashboardData = null;

// Metrics configuration
const metricsConfig = [
  {
    id: 'totalEmissions',
    icon: '🌍',
    label: 'GWP Impact',
    getValue: (data) => {
      const val = data.totalEmissions || 0;
      return val >= 1000 ? (val / 1000).toFixed(2) : val.toFixed(4);
    },
    getUnit: (data) => (data.totalEmissions >= 1000 ? 'kg' : 'g'),
    getDescription: () => 'CO₂ equivalent',
  },
  {
    id: 'totalEnergy',
    icon: '⚡',
    label: 'Energy',
    getValue: (data) => {
      const val = data.totalEnergy || 0;
      return val >= 1000 ? (val / 1000).toFixed(4) : val.toFixed(4);
    },
    getUnit: (data) => (data.totalEnergy >= 1000 ? 'kWh' : 'Wh'),
    getDescription: () => 'Energy consumed',
  },
  {
    id: 'totalPE',
    icon: '🔥',
    label: 'Primary Energy',
    getValue: (data) => (data.totalPE || 0).toFixed(4),
    getUnit: () => 'MJ',
    getDescription: () => 'Primary energy',
  },
  {
    id: 'totalADPE',
    icon: '⛏️',
    label: 'ADPE',
    getValue: (data) => {
      const val = data.totalADPE || 0;
      return val >= 0.001 ? val.toFixed(4) : val.toExponential(2);
    },
    getUnit: () => 'kg Sb eq',
    getDescription: () => 'Abiotic depletion',
  },
  {
    id: 'totalTokens',
    icon: '🎫',
    label: 'Tokens',
    getValue: (data) => {
      const val = data.totalTokens || 0;
      return val >= 1000000
        ? `${(val / 1000000).toFixed(2)}M`
        : val >= 1000
          ? `${(val / 1000).toFixed(1)}K`
          : val.toString();
    },
    getUnit: () => '',
    getDescription: () => 'Total processed',
  },
  {
    id: 'totalRequests',
    icon: '📊',
    label: 'Requests',
    getValue: (data) => data.totalRequests || '0',
    getUnit: () => '',
    getDescription: () => 'API calls made',
  },
];

// Equivalents configuration (based on EcoLogits methodology)
const equivalentsConfig = [
  {
    icon: '🚗',
    getValue: (data) => {
      // Average car emits ~120g CO2/km
      const km = (data.totalEmissions || 0) / 120;
      return km >= 1 ? km.toFixed(2) : (km * 1000).toFixed(0);
    },
    getUnit: (data) => {
      const km = (data.totalEmissions || 0) / 120;
      return km >= 1 ? 'km' : 'm';
    },
    getDescription: () => 'driven by car',
  },
  {
    icon: '✈️',
    getValue: (data) => {
      // Average flight emits ~285g CO2/km per passenger
      const km = (data.totalEmissions || 0) / 285;
      return km >= 1 ? km.toFixed(2) : (km * 1000).toFixed(0);
    },
    getUnit: (data) => {
      const km = (data.totalEmissions || 0) / 285;
      return km >= 1 ? 'km' : 'm';
    },
    getDescription: () => 'flight distance',
  },
  {
    icon: '📱',
    getValue: (data) => {
      // Smartphone charge ~15Wh
      const charges = (data.totalEnergy || 0) / 15;
      return charges.toFixed(2);
    },
    getUnit: () => '',
    getDescription: () => 'smartphone charges',
  },
  {
    icon: '💻',
    getValue: (data) => {
      // Laptop charge ~50Wh
      const charges = (data.totalEnergy || 0) / 50;
      return charges.toFixed(2);
    },
    getUnit: () => '',
    getDescription: () => 'laptop charges',
  },
  {
    icon: '💡',
    getValue: (data) => {
      // LED bulb 10W
      const hours = (data.totalEnergy || 0) / 10;
      return hours >= 1 ? hours.toFixed(2) : (hours * 60).toFixed(0);
    },
    getUnit: (data) => {
      const hours = (data.totalEnergy || 0) / 10;
      return hours >= 1 ? 'hours' : 'minutes';
    },
    getDescription: () => 'of LED bulb (10W)',
  },
  {
    icon: '🌳',
    getValue: (data) => {
      // One tree absorbs ~21kg CO2/year
      const trees = (data.totalEmissions || 0) / 1000 / 21;
      const days = trees * 365;
      return days >= 1 ? days.toFixed(1) : (days * 24).toFixed(0);
    },
    getUnit: (data) => {
      const trees = (data.totalEmissions || 0) / 1000 / 21;
      const days = trees * 365;
      return days >= 1 ? 'days' : 'hours';
    },
    getDescription: () => 'of tree absorption',
  },
  {
    icon: '💧',
    getValue: (data) => {
      // Approximate water usage: ~1L per Wh (data center cooling)
      const liters = data.totalEnergy || 0;
      return liters >= 1 ? liters.toFixed(2) : (liters * 1000).toFixed(0);
    },
    getUnit: (data) => {
      const liters = data.totalEnergy || 0;
      return liters >= 1 ? 'L' : 'mL';
    },
    getDescription: () => 'water (cooling)',
  },
  {
    icon: '🏠',
    getValue: (data) => {
      // Average home uses ~30kWh/day
      const days = (data.totalEnergy || 0) / 1000 / 30;
      const hours = days * 24;
      return hours >= 1 ? hours.toFixed(2) : (hours * 60).toFixed(0);
    },
    getUnit: (data) => {
      const days = (data.totalEnergy || 0) / 1000 / 30;
      const hours = days * 24;
      return hours >= 1 ? 'hours' : 'minutes';
    },
    getDescription: () => 'of home energy',
  },
];

// Breakdown configuration for Usage vs Embodied impacts
const breakdownConfig = [
  {
    label: 'Usage Phase',
    description: 'Energy consumed during model inference',
    metrics: [
      {
        label: 'GWP',
        getValue: (data) => (data.usageGWP || 0).toFixed(4),
        unit: 'g CO₂eq',
        percentage: (data) =>
          data.totalEmissions > 0 ? ((data.usageGWP / data.totalEmissions) * 100).toFixed(1) : '0',
      },
      {
        label: 'Energy',
        getValue: (data) => (data.usageEnergy || 0).toFixed(4),
        unit: 'Wh',
        percentage: (data) =>
          data.totalEnergy > 0 ? ((data.usageEnergy / data.totalEnergy) * 100).toFixed(1) : '0',
      },
    ],
  },
  {
    label: 'Embodied Phase',
    description: 'Manufacturing and infrastructure amortization',
    metrics: [
      {
        label: 'GWP',
        getValue: (data) => (data.embodiedGWP || 0).toFixed(4),
        unit: 'g CO₂eq',
        percentage: (data) =>
          data.totalEmissions > 0
            ? ((data.embodiedGWP / data.totalEmissions) * 100).toFixed(1)
            : '0',
      },
      {
        label: 'ADPE',
        getValue: (data) => {
          const val = data.embodiedADPE || 0;
          return val >= 0.001 ? val.toFixed(6) : val.toExponential(2);
        },
        unit: 'kg Sb eq',
        percentage: (data) =>
          data.totalADPE > 0 ? ((data.embodiedADPE / data.totalADPE) * 100).toFixed(1) : '0',
      },
    ],
  },
];

// Render functions
function renderMetrics(data) {
  const grid = document.getElementById('metrics-grid');
  grid.innerHTML = metricsConfig
    .map(
      (metric) => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span class="card-icon">${metric.icon}</span>
          ${metric.label}
        </div>
      </div>
      <div class="card-content">
        <div class="metric-value">${metric.getValue(data)}</div>
        <div class="metric-label">${metric.getUnit(data)}</div>
        <div class="metric-label">${metric.getDescription(data)}</div>
      </div>
    </div>
  `
    )
    .join('');
}

function renderActivityTable(data) {
  const tbody = document.querySelector('#activity-table tbody');

  if (!data.recentActivity || data.recentActivity.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: var(--muted-foreground);">No activity yet</td></tr>';
    return;
  }

  tbody.innerHTML = data.recentActivity
    .map(
      (activity) => `
    <tr>
      <td>${new Date(activity.timestamp).toLocaleTimeString()}</td>
      <td>${activity.model || 'Unknown'}</td>
      <td>${activity.tokens || 0}</td>
      <td>${(activity.energy || 0).toFixed(6)}</td>
      <td>${(activity.gwp || 0).toFixed(6)}</td>
      <td>${(activity.pe || 0).toFixed(6)}</td>
    </tr>
  `
    )
    .join('');
}

function renderEquivalents(data) {
  const grid = document.getElementById('equivalents-grid');
  grid.innerHTML = equivalentsConfig
    .map(
      (equiv) => `
    <div class="card">
      <div class="equivalent-item">
        <div class="equivalent-icon">${equiv.icon}</div>
        <div class="equivalent-content">
          <div class="equivalent-value">${equiv.getValue(data)} ${equiv.getUnit ? equiv.getUnit(data) : ''}</div>
          <div class="equivalent-description">${equiv.getDescription()}</div>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

function renderBreakdown(data) {
  const grid = document.getElementById('breakdown-grid');
  grid.innerHTML = breakdownConfig
    .map(
      (section) => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${section.label}</div>
        <div class="metric-label">${section.description}</div>
      </div>
      <div class="card-content">
        ${section.metrics
          .map(
            (metric) => `
          <div style="margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500;">${metric.label}:</span>
              <span>${metric.getValue(data)} ${metric.unit}</span>
            </div>
            <div style="font-size: 0.85em; color: var(--muted-foreground); margin-top: 2px;">
              ${metric.percentage(data)}% of total
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('');
}

function renderDashboard(data) {
  _dashboardData = data;
  renderMetrics(data);
  renderBreakdown(data);
  renderEquivalents(data);
  renderActivityTable(data);
}

// Initialize when DOM is ready
function initialize() {
  console.log('[Dashboard] Initializing...');

  // Event listeners
  const refreshBtn = document.getElementById('refresh-btn');
  console.log('[Dashboard] Refresh button:', refreshBtn);
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('[Dashboard] Refresh clicked');
      vscode.postMessage({ command: 'refresh' });
    });
  }

  const resetSessionBtn = document.getElementById('reset-session-btn');
  console.log('[Dashboard] Reset session button:', resetSessionBtn);
  if (resetSessionBtn) {
    resetSessionBtn.addEventListener('click', () => {
      console.log('[Dashboard] Reset session clicked - sending message');
      vscode.postMessage({ command: 'resetSession' });
    });
  }

  const resetAllBtn = document.getElementById('reset-all-btn');
  console.log('[Dashboard] Reset all button:', resetAllBtn);
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      console.log('[Dashboard] Reset all clicked - sending message');
      vscode.postMessage({ command: 'resetAll' });
    });
  }

  // Request initial data
  console.log('[Dashboard] Requesting initial data');
  vscode.postMessage({ command: 'ready' });
}

// Message handler
window.addEventListener('message', (event) => {
  const message = event.data;
  console.log('[Dashboard] Received message:', message.command);
  if (message.command === 'updateData') {
    console.log('[Dashboard] Updating data:', message.data);
    renderDashboard(message.data);
  }
});

// Initialize when DOM is loaded
console.log('[Dashboard] Script loaded, readyState:', document.readyState);
if (document.readyState === 'loading') {
  console.log('[Dashboard] Waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  console.log('[Dashboard] DOM already loaded, initializing now');
  initialize();
}
