import { copyFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist', 'portfolio', 'browser');

async function findIndex(dir) {
  const entries = await readdir(dir);
  for (const name of entries) {
    if (name === 'index.html') return join(dir, name);
  }
  // Angular static output may put index.html one level deeper.
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      const found = await findIndex(full);
      if (found) return found;
    }
  }
  return null;
}

(async () => {
  const index = await findIndex(DIST);
  if (!index) {
    console.error(`gh-pages-postbuild: index.html not found under ${DIST}`);
    process.exit(1);
  }
  const dir = dirname(index);
  await copyFile(index, join(dir, '404.html'));
  await writeFile(join(dir, '.nojekyll'), '');
  console.log(`gh-pages-postbuild: wrote 404.html and .nojekyll in ${dir}`);
})();
