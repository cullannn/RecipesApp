import { useEffect, useRef, useState } from 'react';

const imageCache = new Map<string, string>();
const AI_BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'http://localhost:8787';
const DEALS_BASE_URL = process.env.EXPO_PUBLIC_DEALS_SERVER_URL ?? 'http://localhost:8790';
const REQUEST_TIMEOUT_MS = 15000;

type RemoteImageOptions = {
  kind?: 'deal' | 'recipe';
};

function normalizeLocalImageUrl(url: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    if (url.startsWith('/')) {
      return new URL(url, base).toString();
    }
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/api/image-file/')) {
      return url;
    }
    if (parsed.host === base.host) {
      return url;
    }
    parsed.host = base.host;
    parsed.protocol = base.protocol;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function useRemoteImage(
  query?: string,
  initialUrl?: string | null,
  options?: RemoteImageOptions
): string | null {
  const baseUrl = options?.kind === 'deal' ? DEALS_BASE_URL : AI_BASE_URL;
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialUrl ? normalizeLocalImageUrl(initialUrl, baseUrl) : null
  );
  const currentUrlRef = useRef<string | null>(
    initialUrl ? normalizeLocalImageUrl(initialUrl, baseUrl) : null
  );

  useEffect(() => {
    let mounted = true;
    const normalized = query?.trim().toLowerCase();
    const kind = options?.kind ?? 'recipe';
    if (!normalized) {
      setImageUrl(initialUrl ?? null);
      return;
    }
    const cacheKey = `${kind}:${normalized}`;
    if (initialUrl) {
      const normalizedUrl = normalizeLocalImageUrl(initialUrl, baseUrl);
      imageCache.set(cacheKey, normalizedUrl);
      setImageUrl(normalizedUrl);
      currentUrlRef.current = normalizedUrl;
      if (kind !== 'recipe' || !normalizedUrl.includes('unsplash.com')) {
        return;
      }
    }
    const cached = imageCache.get(cacheKey);
    if (cached) {
      const normalizedCached = normalizeLocalImageUrl(cached, baseUrl);
      if (normalizedCached !== cached) {
        imageCache.set(cacheKey, normalizedCached);
      }
      setImageUrl(normalizedCached);
      currentUrlRef.current = normalizedCached;
      if (kind !== 'recipe') {
        return;
      }
    }

    const fetchImage = async () => {
      try {
        const url = new URL('/api/images', baseUrl);
        url.searchParams.set('query', normalized);
        url.searchParams.set('kind', kind);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const response = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data?.imageUrl && mounted) {
          const normalizedUrl = normalizeLocalImageUrl(data.imageUrl);
          imageCache.set(cacheKey, normalizedUrl);
          setImageUrl(normalizedUrl);
          currentUrlRef.current = normalizedUrl;
        }
      } catch {
        // Ignore image lookup errors.
      }
    };

    fetchImage();
    if (kind === 'recipe') {
      let attempts = 0;
      const maxAttempts = 30;
      const refreshIds = [
        setTimeout(fetchImage, 2500),
        setTimeout(fetchImage, 15000),
        setTimeout(fetchImage, 45000),
      ];
      const intervalId = setInterval(() => {
        attempts += 1;
        if (attempts > maxAttempts) {
          clearInterval(intervalId);
          return;
        }
        const currentUrl = currentUrlRef.current;
        if (currentUrl && currentUrl.includes('unsplash.com')) {
          fetchImage();
        } else {
          clearInterval(intervalId);
        }
      }, 5000);
      return () => {
        mounted = false;
        refreshIds.forEach((id) => clearTimeout(id));
        clearInterval(intervalId);
      };
    }
    return () => {
      mounted = false;
    };
  }, [query, initialUrl, options?.kind]);

  return imageUrl;
}
