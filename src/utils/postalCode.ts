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

export function isGtaPostalCode(input: string): boolean {
  const normalized = normalizePostalCode(input);
  if (!normalized) {
    return false;
  }
  const prefix = normalized[0];
  return prefix === 'M' || prefix === 'L';
}

const gtaCityByFsa: Record<string, string> = {
  // Toronto
  M1A: 'Toronto',
  M2A: 'Toronto',
  M3A: 'Toronto',
  M4A: 'Toronto',
  M5A: 'Toronto',
  M6A: 'Toronto',
  M7A: 'Toronto',
  M8A: 'Toronto',
  M9A: 'Toronto',
  // Mississauga
  L4T: 'Mississauga',
  L4V: 'Mississauga',
  L4W: 'Mississauga',
  L4X: 'Mississauga',
  L4Y: 'Mississauga',
  L5A: 'Mississauga',
  L5B: 'Mississauga',
  L5C: 'Mississauga',
  L5E: 'Mississauga',
  L5G: 'Mississauga',
  L5H: 'Mississauga',
  L5J: 'Mississauga',
  L5K: 'Mississauga',
  L5L: 'Mississauga',
  L5M: 'Mississauga',
  L5N: 'Mississauga',
  L5P: 'Mississauga',
  L5R: 'Mississauga',
  L5S: 'Mississauga',
  L5T: 'Mississauga',
  L5V: 'Mississauga',
  L5W: 'Mississauga',
  // Brampton
  L6P: 'Brampton',
  L6R: 'Brampton',
  L6S: 'Brampton',
  L6T: 'Brampton',
  L6V: 'Brampton',
  L6W: 'Brampton',
  L6X: 'Brampton',
  L6Y: 'Brampton',
  L6Z: 'Brampton',
  // Markham
  L3P: 'Markham',
  L3R: 'Markham',
  L3S: 'Markham',
  L3T: 'Markham',
  L6B: 'Markham',
  L6C: 'Markham',
  L6E: 'Markham',
  L6G: 'Markham',
  // Vaughan
  L4H: 'Vaughan',
  L4J: 'Vaughan',
  L4K: 'Vaughan',
  L4L: 'Vaughan',
  L4M: 'Vaughan',
  L4S: 'Vaughan',
  L6A: 'Vaughan',
  // Richmond Hill
  L4B: 'Richmond Hill',
  L4C: 'Richmond Hill',
  L4E: 'Richmond Hill',
  // Oakville
  L6H: 'Oakville',
  L6J: 'Oakville',
  L6K: 'Oakville',
  L6L: 'Oakville',
  L6M: 'Oakville',
  // Burlington
  L7L: 'Burlington',
  L7M: 'Burlington',
  L7N: 'Burlington',
  L7P: 'Burlington',
  L7R: 'Burlington',
  L7S: 'Burlington',
  // Pickering
  L1V: 'Pickering',
  L1W: 'Pickering',
  L1X: 'Pickering',
  // Ajax
  L1S: 'Ajax',
  L1T: 'Ajax',
  // Whitby
  L1M: 'Whitby',
  L1N: 'Whitby',
  L1P: 'Whitby',
  L1R: 'Whitby',
  // Oshawa
  L1G: 'Oshawa',
  L1H: 'Oshawa',
  L1J: 'Oshawa',
  L1K: 'Oshawa',
  L1L: 'Oshawa',
};

export function getGtaCityForPostalCode(input: string): string | null {
  const normalized = normalizePostalCode(input);
  if (!normalized) {
    return null;
  }
  const fsa = normalized.slice(0, 3);
  return gtaCityByFsa[fsa] ?? (isGtaPostalCode(normalized) ? 'GTA' : null);
}
