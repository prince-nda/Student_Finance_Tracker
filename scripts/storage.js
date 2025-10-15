const KEY = 'finance:data';

export function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function importJSON(json) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) throw new Error('Invalid format');
    // Basic validation
    arr.forEach(rec => {
      if (!rec.id || !rec.description || typeof rec.amount !== "number" || !rec.category || !rec.date) {
        throw new Error('Missing fields');
      }
    });
    save(arr);
    return true;
  } catch (e) {
    return false;
  }
}

export function exportJSON() {
  return localStorage.getItem(KEY) || '[]';
}
