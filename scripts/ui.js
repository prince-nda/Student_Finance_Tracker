import { getRecords, getSettings, saveSettings, defaultSettings } from './state.js';

// Currency symbols
const currencySymbols = {
  USD: "$", EUR: "€", RWF: "FRw", NGN: "₦", GHS: "₵", UGX: "USh"
};

function formatAmount(amount, currency) {
  return `${currencySymbols[currency] || currency} ${amount.toFixed(2)}`;
}

// Dashboard rendering
function renderDashboard(records, settings) {
  document.getElementById('stat-total').textContent = records.length;
  const totalSpent = records.reduce((sum, r) => sum + r.amount, 0);
  document.getElementById('stat-spent').textContent = formatAmount(totalSpent, settings.baseCurrency);

  // Top Category
  const cats = {};
  records.forEach(r => cats[r.category] = (cats[r.category] || 0) + 1);
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  document.getElementById('stat-category').textContent = topCat;

  // Last 7 Days trend
  const now = new Date();
  let trend = 0, prev = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const daySum = records.filter(r => r.date === ds).reduce((a, r) => a + r.amount, 0);
    if (i < 3) trend += daySum;
    else prev += daySum;
  }
  const percent = prev ? Math.round(((trend - prev) / prev) * 100) : 0;
  document.getElementById('stat-trend').textContent = (percent >= 0 ? '+' : '') + percent + '%';

  // Progress Bar
  const cap = settings.cap || 0;
  let percentCap = cap ? Math.min(100, Math.round((totalSpent / cap) * 100)) : 0;
  document.getElementById('progress-fill').style.width = percentCap + '%';

  // Cap status
  const capStatus = document.getElementById('cap-status');
  if (cap) {
    const remaining = cap - totalSpent;
    capStatus.setAttribute('aria-live', remaining >= 0 ? 'polite' : 'assertive');
    capStatus.textContent = remaining >= 0
      ? `Good job! Remaining under cap: ${formatAmount(remaining, settings.baseCurrency)}`
      : `Warning: Over cap by ${formatAmount(Math.abs(remaining), settings.baseCurrency)}`;
  } else {
    capStatus.textContent = '';
  }
}

// Trend chart (bar chart)
function renderTrendChart(records) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Get theme colors
  const colors = window.getThemeColors ? window.getThemeColors() : {
    primary: '#1565c0',
    text: '#222',
    background: '#fff'
  };
  
  // Clear with transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const now = new Date();
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    data.push(records.filter(r => r.date === ds).reduce((a, r) => a + r.amount, 0));
  }
  
  const barWidth = 40;
  const maxVal = Math.max(...data, 1);
  
  data.forEach((val, i) => {
    // Use theme-aware colors
    ctx.fillStyle = colors.primary;
    ctx.fillRect(i * (barWidth + 10), canvas.height - (val / maxVal * canvas.height), barWidth, (val / maxVal * canvas.height));
    
    ctx.fillStyle = colors.text;
    ctx.font = '12px system-ui';
    ctx.fillText(val.toFixed(2), i * (barWidth + 10) + 8, canvas.height - (val / maxVal * canvas.height) - 5);
  });
}

// Settings form logic
const settingsForm = document.getElementById('settings-form');
settingsForm.addEventListener('submit', e => {
  e.preventDefault();
  const settings = {
    baseCurrency: settingsForm.baseCurrency.value,
    rates: {
      EUR: parseFloat(settingsForm.rateEur.value) || defaultSettings.rates.EUR,
      RWF: parseFloat(settingsForm.rateRwf.value) || defaultSettings.rates.RWF,
      NGN: parseFloat(settingsForm.rateNgn.value) || defaultSettings.rates.NGN,
      GHS: parseFloat(settingsForm.rateGhs.value) || defaultSettings.rates.GHS,
      UGX: parseFloat(settingsForm.rateUgx.value) || defaultSettings.rates.UGX
    },
    cap: parseFloat(settingsForm.cap.value) || defaultSettings.cap
  };
  saveSettings(settings);
  refreshDashboard();
});

// Refresh dashboard after loading/updating records/settings
function refreshDashboard() {
  const records = getRecords();
  const settings = getSettings();
  renderDashboard(records, settings);
  renderTrendChart(records);
}

// Listen for theme changes and re-render chart
window.addEventListener('themeChanged', () => {
  const records = getRecords();
  renderTrendChart(records);
});

window.addEventListener('DOMContentLoaded', () => {
  refreshDashboard();
  // ... (add other initializations)
});

