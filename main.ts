/** Offline, deterministic competition entry. No clock, remote calls or installed packages. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, buildRadar, boardIssue, dataScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';
const root = fileURLToPath(new URL('.', import.meta.url));
function option(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find(v => v.startsWith(prefix));
  const index = process.argv.indexOf(`--${name}`);
  return inline ? inline.slice(prefix.length) : index >= 0 ? process.argv[index + 1] : fallback;
}
const source = option('input', '/input/snapshot.json');
const destination = option('output', process.env.MAKEFUN_OUTPUT_DIR || '/output');
const snapshot = parseSnapshot(readFileSync(source.endsWith('.json') ? source : join(source, 'snapshot.json'), 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue) throw Error(issue);
mkdirSync(destination, { recursive: true });
writeFileSync(join(destination, 'board.json'), JSON.stringify({ model: radar.model_version, as_of: snapshot.as_of, rows: board }) + '\n');
writeFileSync(join(destination, 'data.js'), dataScript(radar));
function copyTree(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const src = join(from, name), dst = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else copyFileSync(src, dst);
  }
}
for (const dir of ['dashboard', 'screenshots']) copyTree(join(root, dir), join(destination, dir));
writeFileSync(join(destination, 'dossier.json'), buildDossier(destination, { text_max_bytes: 65536 }));
console.log(`Atlas: ${board.length} ranked protocols; ${snapshot.watchlist.length}/${snapshot.watchlist.length} watchlist covered; ${radar.peer_count} independent valuation peers. Output: ${destination}`);
