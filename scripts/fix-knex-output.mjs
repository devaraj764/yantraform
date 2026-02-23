// Nitro copies knex.mjs but not knex.js to .output, while the package.json
// has "main": "knex" which Node resolves to knex.js. Patch it to knex.mjs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pkgPath = join(process.cwd(), '.output', 'server', 'node_modules', 'knex', 'package.json');

if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.main = 'knex.mjs';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('[fix-knex-output] Patched knex package.json main → knex.mjs');
} else {
  console.log('[fix-knex-output] No knex package.json found in .output, skipping');
}
