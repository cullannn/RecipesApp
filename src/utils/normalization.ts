function stripPunctuation(value: string): string {
  return value.replace(/[^a-z0-9\s]/g, ' ');
}

function stemToken(token: string): string {
  if (token.endsWith('ies') && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('es') && token.length > 2) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && token.length > 1) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeName(value: string): string {
  const cleaned = stripPunctuation(value.toLowerCase());
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(stemToken);
  return tokens.join(' ').trim();
}

export function normalizeTokens(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean);
}
