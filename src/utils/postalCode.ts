const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

export function normalizePostalCode(input: string): string | null {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!postalCodeRegex.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function formatPostalCode(input: string): string {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, '');
  if (normalized.length <= 3) {
    return normalized;
  }
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

export function isValidCanadianPostalCode(input: string): boolean {
  return normalizePostalCode(input) !== null;
}
