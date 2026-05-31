import { mkdir, writeFile, access, constants } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'public', 'assets', 'forest');
const PH = 'https://dl.polyhaven.org/file/ph-assets';

const FILES = [
  // HDRI
  { url: `${PH}/HDRIs/hdr/1k/forest_slope_1k.hdr`,                    out: 'env/forest_slope_1k.hdr' },
  // Mud forest ground
  { url: `${PH}/Textures/jpg/1k/mud_forest/mud_forest_diff_1k.jpg`,   out: 'ground/mud_forest_diff_1k.jpg' },
  { url: `${PH}/Textures/jpg/1k/mud_forest/mud_forest_nor_gl_1k.jpg`, out: 'ground/mud_forest_nor_gl_1k.jpg' },
  { url: `${PH}/Textures/jpg/1k/mud_forest/mud_forest_arm_1k.jpg`,    out: 'ground/mud_forest_arm_1k.jpg' },
  // Bark (used by procedural tree trunks for a photoreal close-up)
  { url: `${PH}/Textures/jpg/1k/bark_brown_02/bark_brown_02_diff_1k.jpg`,   out: 'bark/bark_brown_02_diff_1k.jpg' },
  { url: `${PH}/Textures/jpg/1k/bark_brown_02/bark_brown_02_nor_gl_1k.jpg`, out: 'bark/bark_brown_02_nor_gl_1k.jpg' }
];

async function exists(path) {
  try { await access(path, constants.F_OK); return true; }
  catch { return false; }
}

async function downloadOne(url, outAbs) {
  await mkdir(dirname(outAbs), { recursive: true });
  if (await exists(outAbs)) {
    console.log(`  skip (exists): ${outAbs}`);
    return;
  }
  console.log(`  GET  ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outAbs, buf);
  console.log(`  ok   ${(buf.length / 1024).toFixed(0)} KB → ${outAbs}`);
}

(async () => {
  console.log(`fetch-assets → ${ROOT}`);
  let failed = 0;
  for (const f of FILES) {
    try {
      await downloadOne(f.url, join(ROOT, f.out));
    } catch (err) {
      console.error(`  FAIL ${f.url}\n        ${err.message}`);
      failed++;
    }
  }
  if (failed) {
    console.error(`\n${failed} asset(s) failed to download.`);
    process.exit(1);
  }
  console.log('\nAll assets ready.');
})();
