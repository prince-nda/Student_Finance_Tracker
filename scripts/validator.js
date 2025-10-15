export const regexRules = {
  description: /^\S(?:.*\S)?$/, // no leading/trailing spaces
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/, // valid currency
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, // YYYY-MM-DD
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/, // letters, spaces, hyphens
  duplicateWord: /\b(\w+)\s+\1\b/ // advanced: duplicate word
};
