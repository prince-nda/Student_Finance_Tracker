import { getRecords, getSettings, saveSettings, defaultSettings, addRecord, updateRecord, deleteRecord, setRecords } from './state.js';
import { compileRegex, highlight, filterRecords } from './search.js';

// Currency symbols
const currencySymbols = {
  USD: "$", EUR: "€", RWF: "RWF", NGN: "₦", GHS: "₵", UGX: "USh"
};

// Sorting state
let currentSort = { field: 'date', direction: 'desc' };

function formatAmount(amount, currency) {
  const settings = getSettings();
  let convertedAmount = amount;
  
  // Apply currency conversion if needed
  if (currency !== settings.baseCurrency && settings.rates[currency]) {
    convertedAmount = convertAmount(amount, settings.baseCurrency, currency, settings.rates);
  }
  
  return `${currencySymbols[currency] || currency} ${convertedAmount.toFixed(2)}`;
}

// Currency conversion
function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to USD first (base), then to target
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / rates[fromCurrency];
  const convertedAmount = toCurrency === 'USD' ? amountInUSD : amountInUSD * rates[toCurrency];
  
  return parseFloat(convertedAmount.toFixed(2));
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

// Records table with edit/delete functionality
function renderRecordsTable() {
  const records = getRecords();
  const tbody = document.querySelector('#records-table tbody');
  const searchPattern = document.getElementById('search').value;
  const caseInsensitive = document.getElementById('search-case').checked;
  
  // Use your existing filter function
  const filteredRecords = filterRecords(records, searchPattern, caseInsensitive);
  const currentRegex = compileRegex(searchPattern, caseInsensitive ? 'i' : '');
  
  tbody.innerHTML = filteredRecords.map(record => `
    <tr data-id="${record.id}">
      <td>${record.date}</td>
      <td>${highlight(record.description, currentRegex)}</td>
      <td>${formatAmount(record.amount, getSettings().baseCurrency)}</td>
      <td>${highlight(record.category, currentRegex)}</td>
      <td>
        <button class="edit-btn" aria-label="Edit ${record.description}">Edit</button>
        <button class="delete-btn" aria-label="Delete ${record.description}">Delete</button>
      </td>
    </tr>
  `).join('');
  
  // Add event listeners for edit/delete
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const recordId = e.target.closest('tr').dataset.id;
      editRecord(recordId);
    });
  });
  
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const recordId = e.target.closest('tr').dataset.id;
      deleteRecordHandler(recordId);
    });
  });
}

// Edit record functionality
function editRecord(id) {
  const records = getRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;
  
  // Populate form with record data
  document.getElementById('desc').value = record.description;
  document.getElementById('amt').value = record.amount;
  document.getElementById('cat').value = record.category;
  document.getElementById('date').value = record.date;
  
  // Change form to update mode
  const form = document.getElementById('record-form');
  form.dataset.editingId = id;
  form.querySelector('button').textContent = 'Update';
  
  // Scroll to form
  document.getElementById('add').scrollIntoView({ behavior: 'smooth' });
}

// Delete record with confirmation
function deleteRecordHandler(id) {
  const records = getRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;
  
  if (confirm(`Are you sure you want to delete "${record.description}"?`)) {
    deleteRecord(id);
    refreshDashboard();
    renderRecordsTable();
  }
}

// Sorting functionality
function setupSorting() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      // Toggle direction if same field, otherwise default to desc
      currentSort.direction = currentSort.field === field 
        ? (currentSort.direction === 'asc' ? 'desc' : 'asc')
        : 'desc';
      currentSort.field = field;
      
      // Update visual indicators
      document.querySelectorAll('th[data-sort]').forEach(header => {
        header.classList.remove('asc', 'desc');
      });
      th.classList.add(currentSort.direction);
      
      sortRecords();
      renderRecordsTable();
    });
  });
}

function sortRecords() {
  const records = getRecords();
  records.sort((a, b) => {
    let aVal = a[currentSort.field];
    let bVal = b[currentSort.field];
    
    // Handle different data types
    if (currentSort.field === 'amount') {
      aVal = parseFloat(aVal);
      bVal = parseFloat(bVal);
    } else if (currentSort.field === 'date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  setRecords(records);
}

// Form validation and submission
async function validateRecord(record) {
  const { regexRules } = await import('./validator.js');
  const errors = {};
  
  if (!regexRules.description.test(record.description)) {
    errors.description = "Description cannot have leading/trailing spaces";
  }
  
  if (!regexRules.amount.test(record.amount.toString())) {
    errors.amount = "Amount must be a valid number with up to 2 decimal places";
  }
  
  if (!regexRules.category.test(record.category)) {
    errors.category = "Category can only contain letters, spaces, and hyphens";
  }
  
  if (!regexRules.date.test(record.date)) {
    errors.date = "Date must be in YYYY-MM-DD format";
  }
  
  // Advanced validation: duplicate words
  if (regexRules.duplicateWord.test(record.description)) {
    errors.description = "Description contains duplicate words";
  }
  
  return errors;
}

function showErrors(errors) {
  clearErrors();
  Object.keys(errors).forEach(field => {
    const errorElement = document.getElementById(`${field}-error`);
    if (errorElement) {
      errorElement.textContent = errors[field];
      const input = document.getElementById(field === 'description' ? 'desc' : field === 'amount' ? 'amt' : field === 'category' ? 'cat' : field);
      if (input) {
        input.setAttribute('aria-invalid', 'true');
      }
    }
  });
}

function clearErrors() {
  document.querySelectorAll('.error').forEach(el => {
    el.textContent = '';
  });
  document.querySelectorAll('input').forEach(input => {
    input.setAttribute('aria-invalid', 'false');
  });
}

// Export/Import functionality
function setupExportImport() {
  const exportBtn = document.getElementById('export-json');
  const importBtn = document.getElementById('import-json-btn');
  const importInput = document.getElementById('import-json');
  const importStatus = document.getElementById('import-status');

  // Export functionality
  exportBtn.addEventListener('click', () => {
    const records = getRecords();
    const dataStr = JSON.stringify(records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-records-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show success message
    importStatus.textContent = 'Export completed successfully!';
    importStatus.style.color = 'green';
    setTimeout(() => {
      importStatus.textContent = '';
    }, 3000);
  });

  // Import button triggers file input
  importBtn.addEventListener('click', () => {
    importInput.click();
  });

  // Handle file selection
  importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/json') {
      importStatus.textContent = 'Error: Please select a JSON file';
      importStatus.style.color = 'red';
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const { importJSON } = await import('./storage.js');
        const success = importJSON(e.target.result);
        
        if (success) {
          importStatus.textContent = 'Import completed successfully!';
          importStatus.style.color = 'green';
          refreshDashboard();
          renderRecordsTable();
          
          // Clear file input
          importInput.value = '';
        } else {
          importStatus.textContent = 'Error: Invalid file format';
          importStatus.style.color = 'red';
        }
      } catch (error) {
        importStatus.textContent = 'Error: Failed to import file';
        importStatus.style.color = 'red';
        console.error('Import error:', error);
      }
      
      // Clear status after 3 seconds
      setTimeout(() => {
        importStatus.textContent = '';
      }, 3000);
    };

    reader.onerror = () => {
      importStatus.textContent = 'Error: Failed to read file';
      importStatus.style.color = 'red';
    };

    reader.readAsText(file);
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
  renderRecordsTable();
});

// Record form submission
const recordForm = document.getElementById('record-form');
recordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(recordForm);
  const record = {
    description: formData.get('description').trim(),
    amount: parseFloat(formData.get('amount')),
    category: formData.get('category'),
    date: formData.get('date')
  };
  
  // Validate using your validator
  const errors = await validateRecord(record);
  
  if (Object.keys(errors).length === 0) {
    // No errors - save record
    if (recordForm.dataset.editingId) {
      // Update existing record
      updateRecord(recordForm.dataset.editingId, record);
      delete recordForm.dataset.editingId;
      recordForm.reset();
      recordForm.querySelector('button').textContent = 'Save';
    } else {
      // Add new record
      addRecord(record);
      recordForm.reset();
    }
    
    clearErrors();
    refreshDashboard();
    renderRecordsTable();
  } else {
    // Show errors
    showErrors(errors);
  }
});

// Search functionality
const searchInput = document.getElementById('search');
const searchCase = document.getElementById('search-case');

searchInput.addEventListener('input', () => {
  renderRecordsTable();
});

searchCase.addEventListener('change', () => {
  renderRecordsTable();
});

// Refresh dashboard after loading/updating records/settings
function refreshDashboard() {
  const records = getRecords();
  const settings = getSettings();
  renderDashboard(records, settings);
  renderTrendChart(records);
}

// Initialize everything
function initializeApp() {
  refreshDashboard();
  renderRecordsTable();
  setupSorting();
  setupExportImport();
  
  // Initialize form
  const recordForm = document.getElementById('record-form');
  recordForm.reset();
  
  // Load settings into form
  const settings = getSettings();
  settingsForm.baseCurrency.value = settings.baseCurrency;
  settingsForm.rateEur.value = settings.rates.EUR;
  settingsForm.rateRwf.value = settings.rates.RWF;
  settingsForm.rateNgn.value = settings.rates.NGN;
  settingsForm.rateGhs.value = settings.rates.GHS;
  settingsForm.rateUgx.value = settings.rates.UGX;
  settingsForm.cap.value = settings.cap || '';
}

// Listen for theme changes and re-render chart
window.addEventListener('themeChanged', () => {
  const records = getRecords();
  renderTrendChart(records);
});

window.addEventListener('DOMContentLoaded', initializeApp);
