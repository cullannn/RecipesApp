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

function applySynonyms(tokens: string[]): string[] {
  const normalized: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if ((token === 'spring' || token === 'green') && next === 'onion') {
      normalized.push('green', 'onion');
      i += 1;
      continue;
    }
    if (token === 'scallion') {
      normalized.push('green', 'onion');
      continue;
    }
    normalized.push(token);
  }
  return normalized;
}

export function normalizeName(value: string): string {
  const cleaned = stripPunctuation(value.toLowerCase());
  const tokens = applySynonyms(
    cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(stemToken)
  );
  return tokens.join(' ').trim();
}

export function normalizeTokens(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean);
}
