/**
 * Portal registry — fetch the network list and build navigation URLs.
 * Works with any deployed portals service (same shape as /portals.json).
 */

/**
 * @param {string} registryUrlOrBase — Full URL to portals.json, or origin/base (…/portals.json is appended)
 * @returns {Promise<Array<{ slug: string, url: string, title?: string, [k: string]: unknown }>>}
 */
export async function fetchPortalsRegistry(registryUrlOrBase) {
  const raw = registryUrlOrBase.trim();
  const url = raw.includes('portals.json')
    ? raw
    : `${raw.replace(/\/$/, '')}/portals.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Portals registry: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Build a destination URL with portal handoff query params (ref, username, avatar).
 *
 * @param {{ url: string }} portal — Entry from the registry
 * @param {object} [options]
 * @param {string} [options.ref] — Defaults to current page (browser only)
 * @param {string | null} [options.username]
 * @param {string | null} [options.avatarUrl]
 */
export function buildPortalUrl(portal, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('buildPortalUrl is for browser environments');
  }
  const ref = options.ref ?? window.location.href;
  const url = new URL(portal.url);
  url.searchParams.set('portal', 'true');
  url.searchParams.set('ref', ref);
  if (options.username) url.searchParams.set('username', options.username);
  if (options.avatarUrl) url.searchParams.set('avatar_url', options.avatarUrl);
  return url.toString();
}
