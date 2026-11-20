/** Real Chromium interaction checks; no browser automation dependencies. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile = mkdtempSync(join(tmpdir(), 'atlas-browser-'));
const chrome = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1440,1000', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
  const browserUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    chrome.stderr.on('data', chunk => { stderr += chunk; const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolve(m[1]); });
    chrome.on('error', reject);
    setTimeout(() => reject(Error('Chrome startup timeout')), 10000).unref();
  });
  const port = new URL(browserUrl).port;
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0; const pending = new Map(), errors = [], network = [];
  ws.addEventListener('message', message => {
    const m = JSON.parse(message.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); } }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Network.requestWillBeSent') network.push(m.params.request.url);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await call('Runtime.enable'); await call('Network.enable'); await call('Page.enable');
  const load = async hash => {
    await call('Page.navigate', { url: 'about:blank' });
    await call('Page.navigate', { url: 'file:///output/dashboard/index.html' + hash });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && !!document.querySelector(".sidebar")')) return;
      await new Promise(r => setTimeout(r, 20));
    }
    throw Error('Dashboard did not load');
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const select = (selector, value) => evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  await load('');
  assert.match(await text('.result-line'), /176 protocols/);
  assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 12);
  await click('[data-sort="tvl_usd"]');
  assert.match(await text('tbody tr:first-child'), /Steakhouse/);
  await click('[data-sort="tvl_usd"]');
  const ascendingTvl = await evaluate('[...document.querySelectorAll("tbody tr")].map(r=>r.querySelectorAll("td")[3].textContent)');
  assert.notEqual(ascendingTvl[0], '$2.75B');
  await click('#next'); assert.match(await text('.table-footer'), /Showing 13–24/);
  await click('#reset');
  await select('#category', 'Lending'); await select('#chain', 'Solana'); await select('#band', '$5M–$50M');
  assert.match(await text('.result-line'), /Lending · Solana/);
  assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), await evaluate('RADAR.rows.filter(r=>r.category==="Lending"&&r.chains.includes("Solana")&&r.tvl_usd>=5e6&&r.tvl_usd<5e7).length'));
  await evaluate(`{const e=document.querySelector('#search');e.value='Project 0';e.dispatchEvent(new Event('input',{bubbles:true}));}`);
  assert.match(await text('.result-line'), /^1 protocols/);
  await click('.row-name'); assert.equal(await text('h1'), 'Project 0');
  await click('#back'); assert.match(await text('#search'), /^$/); // value is retained, textContent is empty.
  assert.equal(await evaluate('document.querySelector("#search").value'), 'Project 0');
  await evaluate(`{const e=document.querySelector('#search');e.value='no-such-protocol';e.dispatchEvent(new Event('input',{bubbles:true}));}`);
  assert.match(await text('.empty'), /No matching protocols/); await click('#empty-reset');
  await click('[data-scope="Watchlist"]'); assert.match(await text('.result-line'), /40 protocols/);
  await click('[data-view="live"]'); assert.match(await text('.result-line'), /416 token records/);
  await click('[data-view="method"]'); assert.match(await text('h1'), /take apart/);
  await click('[data-view="radar"]');
  // Every protocol opens the same data-backed detail component; verify all 176 records.
  const slugs = await evaluate('RADAR.rows.map(r=>r.slug)');
  for (const slug of slugs) {
    await load('#p=' + encodeURIComponent(slug));
    assert.equal(await evaluate('document.querySelectorAll(".steps li").length'), 4);
    assert.equal(await text('h1'), await evaluate(`RADAR.rows.find(r=>r.slug===${JSON.stringify(slug)}).name`));
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await load('');
  for (const [hash, file] of [['', '1-board.png'], ['#p=gauntlet', '2-detail.png'], ['#scope=Below+floor&category=Lending&band=%245M%E2%80%93%2450M', '3-filtered.png']]) {
    await load(hash);
    const image = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join('screenshots', file), Buffer.from(image.data, 'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await load('#p=curvance');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(network.some(url => /^https?:/.test(url)), false, 'Dashboard made a network request');
  console.log('PASS: controls, ascending/descending sort, pagination, combined filters, search, empty/reset, watchlist, live records, methodology, all 176 details, mobile layout; no JS errors or network requests. Three screenshots captured.');
} finally {
  ws?.close(); chrome.kill('SIGTERM');
  await new Promise(resolve => chrome.once('exit', resolve));
  rmSync(profile, { recursive: true, force: true });
}
