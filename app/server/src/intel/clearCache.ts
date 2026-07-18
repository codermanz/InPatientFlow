// intel:clear — deletes cached LLM outputs (app/data/cache/*.json) ONLY.
// Real implementation (scaffold). Safe to run with an empty cache dir.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '../../../data/cache');

function clearCache(): void {
  if (!fs.existsSync(cacheDir)) {
    console.log(`[intel:clear] cache dir not found (${cacheDir}); nothing to do.`);
    return;
  }
  const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    fs.rmSync(path.join(cacheDir, f));
  }
  console.log(`[intel:clear] removed ${files.length} cached file(s) from ${cacheDir}`);
}

clearCache();
