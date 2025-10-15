import { load, save } from './storage.js';

export const defaultSettings = {
  baseCurrency: "USD",
  rates: {
    EUR: 0.93,
    RWF: 1250,
    NGN: 1500,
    GHS: 12.5,
    UGX: 3850
  },
  cap: 1000
};

let records = load();

export function getRecords() {
  return records;
}

export function addRecord(rec) {
  rec.id = 'txn_' + (Date.now() + Math.floor(Math.random() * 1000));
  rec.createdAt = new Date().toISOString();
  rec.updatedAt = rec.createdAt;
  records.push(rec);
  save(records);
}

export function updateRecord(id, updates) {
  const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
    save(records);
  }
}

export function deleteRecord(id) {
  records = records.filter(r => r.id !== id);
  save(records);
}

export function setRecords(newRecords) {
  records = newRecords;
  save(records);
}

// Settings logic
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('finance:settings')) || defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings) {
  localStorage.setItem('finance:settings', JSON.stringify(settings));
}
