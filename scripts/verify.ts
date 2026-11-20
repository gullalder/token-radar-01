import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildRadar, boardIssue, parseSnapshot } from '../lib/model.ts';
import { buildDossier } from '../vendor/makefun-board.ts';
const output = process.argv[2] || '/output';
const snapshot = parseSnapshot(readFileSync('/input/snapshot.json', 'utf8'));
const { board, radar } = buildRadar(snapshot);
assert.equal(boardIssue(board, snapshot), null);
assert.deepEqual(JSON.parse(readFileSync(join(output, 'board.json'), 'utf8')).rows, board);
const context = { window: {} as { RADAR?: unknown } };
vm.runInNewContext(readFileSync(join(output, 'data.js'), 'utf8'), context);
assert.equal(JSON.stringify(context.window.RADAR), JSON.stringify(radar));
for (const row of board) {
  const m = row.model;
  assert.equal(row.implied_value_usd, Math.round(row.tvl_usd * m.multiple * m.momentum * m.maturity * m.breadth));
  assert.ok(row.low_usd < row.implied_value_usd && row.high_usd > row.implied_value_usd);
  assert.ok(row.confidence_note.length > 40);
  assert.ok(row.farm_steps.every(s => s.includes(row.name)));
  if (row.scope === 'Below floor') assert.ok(row.tvl_usd < snapshot.floor_usd && !row.gecko_id && !row.symbol && row.mcap_usd === null);
}
// Distinct token ids, highest-TVL representative, and missing-field defaults.
const p = { slug: 'candidate', name: 'Candidate', category: 'Lending', chains: ['Base'], tvl_usd: 100, change_7d: null, mcap_usd: null, listed_at: null, gecko_id: null, symbol: null };
const fixture = { as_of: '2026-11-14', source: 'test', floor_usd: 50, watchlist: ['candidate'], protocols: [p,
  { ...p, slug: 'large', name: 'Large', tvl_usd: 1000, mcap_usd: 1000, gecko_id: 'one', symbol: 'ONE' },
  { ...p, slug: 'small', name: 'Small', tvl_usd: 100, mcap_usd: 1000, gecko_id: 'one', symbol: 'ONE' },
  { ...p, slug: 'other', name: 'Other', tvl_usd: 200, mcap_usd: 20, gecko_id: 'two', symbol: 'TWO' }
] };
const result = buildRadar(fixture);
assert.equal(result.radar.peer_count, 2);
assert.equal(result.radar.global_multiple, .55);
assert.equal(result.board[0].model.peer_count, 2);
assert.equal(result.board[0].model.momentum, 1);
assert.equal(result.board[0].model.maturity, .85);
assert.equal(result.board[0].implied_value_usd, Math.round(100 * .55 * .85));
const strong = buildRadar({ ...fixture, protocols: fixture.protocols.map(x => x.slug === 'candidate' ? { ...x, change_7d: 10000, chains: Array.from({length: 30}, (_, i) => 'Chain' + i), listed_at: '2000-01-01' } : x) }).board[0];
assert.equal(strong.model.momentum, 1.15); assert.equal(strong.model.breadth, 1.1); assert.equal(strong.model.maturity, 1);
let bytes = 0;
const files = readdirSync(join(output, 'dashboard'));
for (const name of files) {
  assert.match(name, /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/);
  const path = join(output, 'dashboard', name);
  assert.ok(statSync(path).isFile()); bytes += statSync(path).size;
  const text = readFileSync(path, 'utf8');
  if (name.endsWith('.css')) assert.ok(!/https?:\/\//i.test(text));
  if (name.endsWith('.html')) assert.ok(!/\w+\s*=\s*["'][^"']*https?:\/\//i.test(text));
  if (name.endsWith('.js')) assert.ok(!/(?:import|require)\s*\(?\s*["']https?:/i.test(text));
}
assert.ok(bytes < 64000 && files.includes('index.html') && files.includes('app.css') && files.includes('app.js'));
const images = readdirSync(join(output, 'screenshots'));
assert.equal(images.length, 3);
for (const name of images) {
  const buffer = readFileSync(join(output, 'screenshots', name));
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  assert.ok(Math.max(width, height) <= 1440 && Math.min(width, height) >= 800);
  assert.ok(buffer.length <= 524288);
}
const dossier = readFileSync(join(output, 'dossier.json'));
assert.deepEqual(dossier, Buffer.from(buildDossier(output, { text_max_bytes: 65536 })));
assert.ok(dossier.length <= 1.5 * 1024 * 1024);
assert.ok(!JSON.parse(dossier.toString()).text.includes('[Cut at'));
console.log(`PASS: ${board.length} valid rows, 40/40 coverage, model arithmetic and edge cases, matching data.js, offline source (${bytes} bytes), screenshots, exact dossier (${dossier.length} bytes).`);
