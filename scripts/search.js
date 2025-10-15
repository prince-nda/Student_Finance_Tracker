export function compileRegex(input, flags='i') {
  try {
    return input ? new RegExp(input, flags) : null;
  } catch {
    return null;
  }
}

export function highlight(text, re) {
  if (!re) return text;
  return text.replace(re, m => `<mark>${m}</mark>`);
}

export function filterRecords(records, pattern, caseInsensitive) {
  const re = compileRegex(pattern, caseInsensitive ? 'i' : '');
  if (!re) return records;
  return records.filter(rec =>
    re.test(rec.description) ||
    re.test(rec.category) ||
    re.test(String(rec.amount)) ||
    re.test(rec.date)
  );
}
