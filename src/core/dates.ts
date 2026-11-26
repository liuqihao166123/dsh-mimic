// Recognize whole system date-carrier lines, not user text or ordinary dated prose.
const CARRIER = /^\s*(?:(?:today['’]s date|the current date|current date)\s*(?:is|:|=)|today\s+is)\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*[.!]?\s*$/i;

export function normalizeSystemDateCarriers(value: string): string {
  return value.split(/(\r?\n)/).map(line => {
    const candidate = line.replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, ' ').replace(/[^\S\r\n]+/g, ' ');
    const match = CARRIER.exec(candidate);
    if (!match) return line;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year < 1000 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return line;
    return "Today's date is " + match[1] + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') + '.';
  }).join('');
}
