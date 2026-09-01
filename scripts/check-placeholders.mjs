// Fails a production build if the draft legal wording still has [[REPLACE: ...]]
// markers in it. Paul has to review terms and privacy before go-live; this makes
// forgetting impossible rather than merely unlikely.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'src/content/copy';
const found = [];

for (const file of await readdir(dir)) {
  if (!file.endsWith('.md')) continue;
  const text = await readFile(join(dir, file), 'utf8');
  for (const [, marker] of text.matchAll(/\[\[REPLACE:([^\]]*)\]\]/g)) {
    found.push(`${dir}/${file}: [[REPLACE:${marker}]]`);
  }
}

if (found.length === 0) {
  console.log('[placeholders] none left. Good to go live.');
  process.exit(0);
}

const isProduction = process.env.CONTEXT === 'production';
const heading = isProduction
  ? '[placeholders] BUILD BLOCKED — draft wording still contains placeholders:'
  : '[placeholders] Draft wording still contains placeholders (fine for now):';

console[isProduction ? 'error' : 'warn'](heading);
for (const f of found) console[isProduction ? 'error' : 'warn']('  ' + f);

if (isProduction) {
  console.error('\nEdit the files above, or set ALLOW_PLACEHOLDERS=true to deploy anyway.');
  process.exit(process.env.ALLOW_PLACEHOLDERS === 'true' ? 0 : 1);
}
