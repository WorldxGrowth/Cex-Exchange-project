import { useEffect, useState } from 'react';

/**
 * Site Settings Hook — fetches public branding/config values
 * (site_logo, site_name, favicon, etc) from the public market API,
 * and caches them in localStorage so subsequent page loads/navigations
 * don't show a "logo pops in late" flash.
 *
 * Usage anywhere in the app:
 *   const { settings, loading } = useSiteSettings();
 *   <img src={settings.site_logo} />
 */

const CACHE_KEY = 'vdx_site_settings_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes - long enough to avoid
                                       // refetching on every navigation,
                                       // short enough that admin branding
                                       // changes show up reasonably soon

type SiteSettings = Record<string, string>;

let memoryCache: SiteSettings | null = null; // avoids even hitting localStorage
                                              // repeatedly within one session

function readCache(): SiteSettings | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    memoryCache = parsed.data;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: SiteSettings) {
  memoryCache = data;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function useSiteSettings() {
  const cached = readCache();
  const [settings, setSettings] = useState<SiteSettings>(cached || {});
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    // Always revalidate in the background even if we have a cache hit,
    // so branding changes propagate without needing a hard refresh -
    // but the UI never shows a blank/flash state because cached values
    // render immediately.
    fetch('/api/v1/market/settings/public')
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setSettings(d.data);
          writeCache(d.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { settings, loading };
}
