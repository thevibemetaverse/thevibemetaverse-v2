#!/usr/bin/env node
/**
 * Copy ../portals into vendor/portals for local-only workflows (optional).
 *
 * Default setup: index.html imports @vibe/portals from GitHub main via jsDelivr, so you do not
 * need vendor/portals for the portal design to match main.
 *
 * Use this when you want to point the import map at /vendor/portals/sdk/index.js to test
 * uncommitted changes in a sibling ../portals folder, or to work offline.
 *
 * Usage (from thevibemetaversev2/):
 *   npm run sync-portals              # sdk/*.js only
 *   npm run sync-portals -- --mesh    # also copy portal-mesh.js
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = join(root, '..', 'portals');
const dest = join(root, 'vendor', 'portals');

const withMesh = process.argv.includes('--mesh');

if (!existsSync(source)) {
  console.error(
    '[sync-portals] Missing sibling folder:',
    source,
    '\nClone or place the portals package next to thevibemetaversev2 (…/metaverse/portals).'
  );
  process.exit(1);
}

mkdirSync(join(dest, 'sdk'), { recursive: true });

const sdkFiles = ['index.js', 'hub.js', 'registry.js', 'network.js'];
for (const f of sdkFiles) {
  const from = join(source, 'sdk', f);
  if (!existsSync(from)) {
    console.error('[sync-portals] Missing', from);
    process.exit(1);
  }
  cpSync(from, join(dest, 'sdk', f));
  console.log('[sync-portals]', f);
}

if (withMesh) {
  const mesh = join(source, 'portal-mesh.js');
  if (!existsSync(mesh)) {
    console.error('[sync-portals] Missing', mesh);
    process.exit(1);
  }
  cpSync(mesh, join(dest, 'portal-mesh.js'));
  console.log('[sync-portals] portal-mesh.js');
} else {
  console.log('[sync-portals] skipped portal-mesh.js (pass --mesh to copy)');
}

console.log('[sync-portals] done →', dest);
