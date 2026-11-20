/* Atlas static client. The single data file is generated from board.json's exact rows.
   The model uses distinct-token category MCap/TVL medians, shrunk in log space toward
   the distinct-token global median with weight n/(n+5). Value = TVL × ratio × momentum
   × tracking-tenure × chain breadth. No field establishes launch timing or eligibility. */
(() => {
  'use strict';
  const D = window.RADAR;
  const app = document.querySelector('#app');
  if (!D) { app.textContent = 'Data missing. Run main.ts and open the dashboard inside its output directory.'; return; }
  const params = new URLSearchParams(location.hash.slice(1));
  const state = {
    view: params.get('view') || 'radar', scope: params.get('scope') || 'all',
    q: params.get('q') || '', category: params.get('category') || '',
    chain: params.get('chain') || '', band: params.get('band') || '',
    sort: params.get('sort') || (params.get('view') === 'live' ? 'mcap_usd' : 'implied_value_usd'), dir: Number(params.get('dir')) || -1,
    page: Math.max(0, Number(params.get('page')) || 0), selected: params.get('p') || ''
  };
  const pageSize = 12;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => n === null || n === undefined ? 'Not recorded' : n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
  const exact = n => '$' + Math.round(n).toLocaleString('en-US');
  const ratio = n => n.toFixed(3) + '×';
  const pct = n => n === null ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  const age = n => n === null ? 'Unknown' : n >= 365 ? (n / 365).toFixed(1) + 'y' : n + 'd';
  const growthClass = n => n === null ? '' : n >= 0 ? 'pos' : 'neg';
  const confidence = r => `<span class="confidence ${r.confidence === 'Moderate' ? 'moderate' : ''}" title="${esc(r.confidence_note)}">${esc(r.confidence)}</span>`;
  const avatar = r => `<span class="avatar tone${[...r.slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 4}" aria-hidden="true">${esc(r.name.slice(0, 1).toUpperCase())}</span>`;
  function save() {
    const p = new URLSearchParams();
    const defaults = { view: 'radar', scope: 'all', sort: 'implied_value_usd', dir: -1, page: 0 };
    for (const [key, value] of Object.entries(state)) {
      if (value !== '' && value !== defaults[key]) p.set(key === 'selected' ? 'p' : key, String(value));
    }
    history.replaceState(null, '', '#' + p.toString());
  }
  function change(key, value) {
    state[key] = value;
    if (key !== 'page' && key !== 'selected') state.page = 0;
    save(); render();
  }
  function navigate(view) {
    state.view = view; state.selected = ''; state.page = 0;
    if (view !== 'method') Object.assign(state, { q: '', category: '', chain: '', band: '', scope: 'all' });
    if (view !== 'live') state.sort = 'implied_value_usd';
    else state.sort = 'mcap_usd';
    state.dir = -1;
    save(); render(); window.scrollTo(0, 0);
  }
  function layout(content) {
    const nav = [['radar', '◉', 'Launch radar', D.rows.length], ['live', '▥', 'Token records', D.live.length], ['method', '≋', 'Methodology', '1.0']];
    return `<aside class="sidebar"><div class="brand"><span class="logo"></span>atlas</div><div class="brand-sub">Token intelligence</div>
      <div class="nav-title">Research workspace</div><nav class="nav" aria-label="Main navigation">${nav.map(([id, icon, title, count]) => `<button data-view="${id}" class="${state.view === id ? 'active' : ''}" ${state.view === id ? 'aria-current="page"' : ''}><span class="icon">${icon}</span>${title}<small>${count}</small></button>`).join('')}</nav>
      <div class="side-bottom"><strong><span class="offline"></span>Sealed snapshot</strong>${esc(D.as_of)} · DefiLlama<br>Offline research, reproducible.<br><br>Model estimates, not token prices.<br>No launch or reward is confirmed.</div></aside>
      <main class="main" id="content"><header class="topbar"><div class="breadcrumb">Research <span>/</span> <b>${state.view === 'method' ? 'Methodology' : state.view === 'live' ? 'Token records' : 'Launch radar'}</b></div><div class="sealed">◷ &nbsp; Snapshot ${esc(D.as_of)} &nbsp; · &nbsp; Atlas 1.0</div></header>${content}
      <footer class="footnote"><span>ATLAS RESEARCH &nbsp; / &nbsp; ${D.watchlist_size} watchlist protocols covered · ${D.rows.length} ranked records</span><span>Source: sealed DefiLlama protocol index · No network requests</span></footer></main>`;
  }
  function title(eyebrow, heading, subtitle, action = '') {
    return `<section class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${heading}</h1><p class="subtitle">${subtitle}</p></div>${action}</section>`;
  }
  function metrics() {
    const watch = D.rows.filter(r => r.scope === 'Watchlist');
    const total = watch.reduce((n, r) => n + r.tvl_usd, 0);
    return `<section class="metrics" aria-label="Research coverage">${[
      ['Watchlist coverage', `${watch.length}<small>/ ${D.watchlist_size}</small>`, 'All sealed watchlist protocols included'],
      ['Watchlist capital', money(total), 'TVL across the core research set'],
      ['Early discoveries', String(D.early_size), 'Additional candidates below $50M TVL'],
      ['Valuation peers', String(D.peer_count), 'Distinct tokens · category-adjusted ratios']
    ].map(([label, value, note]) => `<div class="metric"><label>${label}</label><strong>${value}</strong><p>${note}</p></div>`).join('')}</section>`;
  }
  function options(values, current, label) {
    return `<option value="">${label}</option>` + values.map(v => `<option value="${esc(v)}" ${current === v ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }
  function filters() {
    const rows = state.view === 'live' ? D.live : D.rows;
    const cats = [...new Set(rows.map(r => r.category || 'Other'))].sort();
    const chains = [...new Set(rows.flatMap(r => r.chains))].sort();
    return `<div class="filters"><div class="field"><label for="search">Search protocols</label><input id="search" type="search" placeholder="Name, ticker or keyword…" value="${esc(state.q)}"></div>
      <div class="field"><label for="category">Category</label><select id="category">${options(cats, state.category, 'All categories')}</select></div>
      <div class="field"><label for="chain">Network</label><select id="chain">${options(chains, state.chain, 'All chains')}</select></div>
      <div class="field"><label for="band">TVL band</label><select id="band">${options(['$5M–$50M', '$50M–$250M', '$250M–$1B', '$1B+'], state.band, 'Any TVL')}</select></div><button class="clear" id="reset">Reset</button></div>`;
  }
  function filteredRows() {
    const live = state.view === 'live';
    const bands = { '$5M–$50M': [5e6, 5e7], '$50M–$250M': [5e7, 25e7], '$250M–$1B': [25e7, 1e9], '$1B+': [1e9, Infinity] };
    const range = bands[state.band] || [0, Infinity];
    const q = state.q.trim().toLowerCase();
    return (live ? D.live : D.rows).filter(r =>
      (live || state.scope === 'all' || r.scope === state.scope) &&
      (!state.category || (r.category || 'Other') === state.category) &&
      (!state.chain || r.chains.includes(state.chain)) &&
      r.tvl_usd >= range[0] && r.tvl_usd < range[1] &&
      (!q || [r.name, r.slug, r.symbol, r.category, ...r.chains].join(' ').toLowerCase().includes(q))
    ).sort((a, b) => {
      const av = a[state.sort], bv = b[state.sort];
      if (av === null || av === undefined) return bv === null || bv === undefined ? a.slug.localeCompare(b.slug) : 1;
      if (bv === null || bv === undefined) return -1;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * state.dir || a.slug.localeCompare(b.slug);
    });
  }
  function th(label, key) {
    const active = state.sort === key;
    return `<th scope="col" ${key ? `aria-sort="${active ? state.dir < 0 ? 'descending' : 'ascending' : 'none'}"` : ''}>${key ? `<button data-sort="${key}">${label} ${active ? state.dir < 0 ? '↓' : '↑' : '↕'}</button>` : label}</th>`;
  }
  function table() {
    const live = state.view === 'live';
    const rows = filteredRows(), pages = Math.max(1, Math.ceil(rows.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const slice = rows.slice(state.page * pageSize, (state.page + 1) * pageSize);
    const label = [state.scope !== 'all' && !live ? state.scope : '', state.category, state.chain, state.band, state.q ? `“${state.q}”` : ''].filter(Boolean).join(' · ');
    const max = Math.max(...D.rows.map(r => r.implied_value_usd));
    return `<div class="result-line" aria-live="polite"><span>${rows.length} ${live ? 'token records' : 'protocols'} ${label ? '· ' + esc(label) : '· All categories and networks'}</span><span>${live ? 'Observed circulating market cap' : 'Ranked by implied circulating market cap · USD'}</span></div>
    ${rows.length ? `<div class="table-scroll"><table><thead><tr>${th('#', live ? '' : 'rank')}${th('Protocol', 'name')}${th('Category', 'category')}${th('TVL', 'tvl_usd')}${th('7D TVL', 'change_7d')}${th(live ? 'Market cap' : 'Implied value', live ? 'mcap_usd' : 'implied_value_usd')}${th(live ? 'Token' : 'Confidence', live ? 'symbol' : 'confidence')}${th('Network', '')}${th('', '')}</tr></thead><tbody>${slice.map((r, i) => `<tr>
      <td class="num rank">${live ? state.page * pageSize + i + 1 : String(r.rank).padStart(2, '0')}</td>
      <td><div class="protocol">${avatar(r)}<div><button class="row-name" data-protocol="${esc(r.slug)}">${esc(r.name)}</button><small>${live ? esc(r.symbol || 'Token id recorded') : `<span class="scope-tag ${r.scope === 'Below floor' ? 'early' : ''}">${r.scope}</span> &nbsp; No token recorded`}</small></div></div></td>
      <td>${esc(r.category || 'Other')}</td><td class="num">${money(r.tvl_usd)}</td><td class="num ${growthClass(r.change_7d)}">${pct(r.change_7d)}</td>
      <td class="num value" title="${live ? r.mcap_usd === null ? 'No market cap in snapshot' : exact(r.mcap_usd) : exact(r.implied_value_usd)}">${money(live ? r.mcap_usd : r.implied_value_usd)}${live ? '' : `<div class="value-line"><i style="width:${Math.max(4, Math.sqrt(r.implied_value_usd / max) * 100)}%"></i></div>`}</td>
      <td>${live ? esc(r.symbol || '—') : confidence(r)}</td><td class="chain" title="${esc(r.chains.join(', '))}">${esc(r.chains[0] || 'Unknown')}${r.chains.length > 1 ? ` <span class="scope-tag early">+${r.chains.length - 1}</span>` : ''}</td><td><button class="row-name arrow" data-protocol="${esc(r.slug)}" aria-label="Open ${esc(r.name)} research">↗</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><h3>No matching protocols</h3><p>Try a broader category, network or TVL band.</p><button class="button" id="empty-reset">Clear filters</button></div>`}
      <div class="table-footer"><span>${rows.length ? `Showing ${state.page * pageSize + 1}–${Math.min((state.page + 1) * pageSize, rows.length)} of ${rows.length}` : '0 results'} &nbsp; · &nbsp; ${live ? 'Token-bearing records are excluded from the launch ranking' : 'Select a protocol for its valuation and activity playbook'}</span><div class="pager"><button id="prev" ${state.page === 0 ? 'disabled' : ''} aria-label="Previous page">‹</button><span>${state.page + 1} / ${pages}</span><button id="next" ${state.page + 1 >= pages ? 'disabled' : ''} aria-label="Next page">›</button></div></div>`;
  }
  function boardPage() {
    const live = state.view === 'live';
    return title(live ? 'Market context' : 'Discover / compare / participate', live ? 'Already on the record.' : 'Find the signal before the launch.',
      live ? 'Protocols with a token identifier, ticker or market cap in the snapshot. These are context, excluded from the launch board.' : 'A valuation-led radar for protocols with no token recorded. Start with the watchlist, then explore below the floor.',
      `<button class="button" id="export">↓ &nbsp; Export filtered CSV</button>`) + (live ? '' : metrics()) +
      `<div class="research-note"><span class="note-icon">⊙</span><div><b>${live ? 'Observed, not estimated.' : 'A value estimate is not a launch prediction.'}</b> ${live ? 'Missing market caps stay unrecorded; we never substitute an implied value here.' : 'Category token peers anchor the model. Sparse evidence widens uncertainty; no airdrop is assumed.'}</div><button data-view="method">Read the methodology ↗</button></div>
      <section class="panel"><div class="panel-heading"><div><h2>${live ? 'Token-bearing protocols' : 'The launch board'}</h2><p>${live ? D.live.length + ' records · separate from the radar' : '40 core watchlist protocols + ' + D.early_size + ' candidates below $50M'}</p></div>${live ? '' : `<div class="scope-tabs" aria-label="Research universe">${[['all','All protocols'],['Watchlist','Watchlist · 40'],['Below floor','Below floor · ' + D.early_size]].map(([key, name]) => `<button data-scope="${key}" aria-pressed="${state.scope === key}" class="${state.scope === key ? 'active' : ''}">${name}</button>`).join('')}</div>`}</div>${filters()}<div id="table-content">${table()}</div></section>`;
  }
  function equation(r) {
    const m = r.model;
    return `<div class="equation">${[
      ['Snapshot TVL', exact(r.tvl_usd)], ['Shrunk category MCap / TVL', ratio(m.multiple)],
      ['7-day momentum · capped ±50%', ratio(m.momentum)], ['Tracking tenure · 0.75–1.00×', ratio(m.maturity)],
      ['Chain breadth · capped 1.10×', ratio(m.breadth)], ['Implied circulating market cap', money(r.implied_value_usd)]
    ].map(([k, v]) => `<div class="eq-row"><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>`;
  }
  function peerTable(category) {
    if (!category.peers.length) return '<p class="body-copy">No independent token peers in this category. The global peer distribution supplies the entire ratio. Treat this estimate as a weak cross-category analogy.</p>';
    return `<table class="peer-table"><thead><tr><th>Independent token peer</th><th>TVL</th><th>MCap</th><th>Ratio</th></tr></thead><tbody>${category.peers.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${money(p.tvl)}</td><td class="num">${money(p.mcap)}</td><td class="num">${ratio(p.ratio)}</td></tr>`).join('')}</tbody></table>`;
  }
  function detailPage(r) {
    const c = D.categories.find(c => c.category === r.category);
    const titles = ['Verify the opportunity', 'Put the product to work', 'Build useful, sustained activity', 'Manage risk and plan the exit'];
    return `<div style="padding-top:22px"><button class="back" id="back">← Back to ${state.view === 'live' ? 'token records' : 'launch board'}</button></div><section class="detail-top"><div class="detail-title">${avatar(r)}<div><div class="eyebrow">Protocol research / rank ${String(r.rank).padStart(2, '0')}</div><h1>${esc(r.name)}</h1><div class="detail-badges"><span class="scope-tag ${r.scope === 'Below floor' ? 'early' : ''}">${r.scope}</span>${esc(r.category)} <span>·</span> No token recorded</div></div></div><button class="button" id="print">Print research</button></section>
      <div class="detail-grid"><div class="stack"><section class="card valuation"><div class="eyebrow">Implied circulating market cap</div><div class="big num">${money(r.implied_value_usd)}</div><p>Comparable-value estimate · not FDV or an allocation</p><div class="range-track"></div><div class="range-labels"><span>${money(r.low_usd)}</span><span>Scenario range</span><span>${money(r.high_usd)}</span></div></section>
      <section class="card"><h3>Inside the estimate</h3>${equation(r)}<p class="body-copy" style="margin-top:12px">${r.model.peer_count} category peers · ${Math.round(r.model.category_weight * 100)}% category / ${Math.round((1-r.model.category_weight)*100)}% global weight. Global median: ${ratio(D.global_multiple)}.</p><details><summary>Inspect category peers and ratios</summary>${peerTable(c)}</details></section>
      <section class="card"><h3>Evidence quality &nbsp; ${confidence(r)}</h3><p class="body-copy">${esc(r.confidence_note)}</p><div class="input-grid"><div><label>7-day TVL change</label><b class="num ${growthClass(r.change_7d)}">${pct(r.change_7d)}</b></div><div><label>Tracking tenure</label><b>${age(r.age_days)} · ${esc(r.listed_at || 'date not reported')}</b></div><div style="grid-column:1/-1"><label>Snapshot networks (${r.chains.length})</label><b>${esc(r.chains.join(' · ') || 'Not reported')}</b></div></div></section></div>
      <section class="card"><div class="plan-head"><div><div class="eyebrow">Participation playbook</div><h2>How to use ${esc(r.name)}</h2></div><span class="scope-tag early">${esc(r.plan.chain)}</span></div><p class="body-copy" style="margin-top:8px">A category-informed plan. Product availability and campaign rules must be checked in the official app; this snapshot contains neither.</p>
      <div class="budget-strip"><div><label>Test capital</label><b>$${r.plan.capital}</b></div><div><label>Fees / entry or exit</label><b>${r.plan.gas}</b></div><div><label>Review horizon</label><b>${r.plan.days} days</b></div></div><ol class="steps">${r.farm_steps.map((step, i) => {
        const split = step.lastIndexOf('Budget:');
        return `<li><div><b>${titles[i]}</b>${esc(split >= 0 ? step.slice(0, split) : step)}${split >= 0 ? `<span class="step-cost">${esc(step.slice(split))}</span>` : ''}</div></li>`;
      }).join('')}</ol><div class="caution">No points, token launch or allocation is verified. Budgets are illustrative, not quoted fees. Skip any product whose minimum, restrictions or risk exceed your budget.</div></section></div>`;
  }
  function liveDetail(r) {
    return title('Token-bearing record', esc(r.name), 'This record is excluded from the launch radar. A token identifier, ticker or capitalization is already recorded.') +
      `<button id="back" class="button">← Back to token records</button><div class="card" style="margin-top:20px"><h2>Snapshot facts</h2><div class="input-grid">${[['Market cap', money(r.mcap_usd)], ['TVL', money(r.tvl_usd)], ['Symbol', r.symbol || 'Not recorded'], ['CoinGecko id', r.gecko_id || 'Not recorded'], ['Category', r.category], ['Networks', r.chains.join(' · ')]].map(([label, value]) => `<div><label>${label}</label><b>${esc(value)}</b></div>`).join('')}</div><p class="body-copy" style="margin-top:20px">A token record does not establish that rewards are available. No pre-launch farming recommendation is made for token-bearing records.</p></div>`;
  }
  function methodPage() {
    return title('Transparent by construction', 'An estimate you can take apart.', 'One sealed snapshot. A peer-calibrated model. No external claims, hidden name boosts or prediction of a token launch.') +
      `<div class="method-grid"><section class="card"><div class="eyebrow">01 / Comparable value</div><h2>Let the snapshot set the multiple</h2><p>Use positive market caps with CoinGecko identifiers and positive TVL. Exclude exchange, bridge and wrapped/staked-product categories and product names. Deduplicate by CoinGecko id, keeping the highest-TVL representative. The ${D.peer_count} remaining tokens each contribute once.</p><p>Take the median market-cap/TVL ratio in each exact category. Sparse categories shrink toward the global median of ${ratio(D.global_multiple)} in log space. Medians resist extreme ratios; shrinkage limits a single peer's influence. A category with zero peers uses the global distribution.</p><div class="formula">w = n / (n + 5)<br>multiple = exp(w × ln(category median)<br> &nbsp; + (1 − w) × ln(global median))</div></section>
      <section class="card"><div class="eyebrow">02 / Bounded adjustments</div><h2>Reward persistence, temper momentum</h2><p>Momentum = 1 + 0.30 × clamp(7-day TVL %, −50, 50) / 100. Its range is 0.85–1.15×. Missing change is neutral. TVL changes include asset prices and are not clean capital flows.</p><p>Tenure = 0.75 + 0.25 × min(days tracked / 730, 1). Missing dates use 0.85×. More time tracked is a limited persistence proxy, not a verified launch date or tokenless age. Breadth = 1 + 0.02 × min(chains − 1, 5), capped at 1.10×; network count is not user adoption.</p><div class="formula">Implied MCap = round(TVL × multiple<br> &nbsp; × momentum × tenure × breadth)</div></section>
      <section class="card"><div class="eyebrow">03 / Uncertainty</div><h2>Ranges are scenarios, not probabilities</h2><p>Lower scenario: TVL × min(shrunk category/global 25th percentile, 0.65 × central multiple) × adjustments × 0.8. Upper: TVL × max(shrunk 75th percentile, 1.5 × central multiple) × adjustments × 1.2. These deliberately broad valuation sensitivities are not statistical confidence intervals.</p><p>Moderate confidence requires at least eight independent category peers, a known tracking date and reported momentum. All other records are Low. No record receives High: market cap/TVL omits revenue, dilution, emissions and token-holder rights. TVL may overlap across protocols.</p></section>
      <section class="card"><div class="eyebrow">04 / Research boundaries</div><h2>Separate missing records from absence</h2><p>The 40 watchlist slugs are authoritative for core coverage. Extensions include all ${D.early_size} below-floor records with no token identifiers or market cap, excluding versioned names and obvious wrapped, staked, bridge and exchange products. Parent relationships are not in the snapshot; extension independence is unverified.</p><p>Token records (${D.live.length}) are kept in a separate view. A missing token record is never proof of no token. Activity playbooks infer useful actions from category and chains; they do not invent points programs. Capital and gas budgets are planning assumptions, not observations. No individual token price or airdrop payout is estimated.</p></section></div>
      <section class="panel method-table"><div class="panel-heading"><div><h2>The comparable set</h2><p>Exact category samples · inspect any category to see every peer</p></div><span class="scope-tag">Global median ${ratio(D.global_multiple)}</span></div><table><thead><tr><th>Category</th><th>Peers</th><th>Raw median</th><th>Category weight</th><th>Applied multiple</th></tr></thead><tbody>${D.categories.filter(c => D.rows.some(r => r.category === c.category)).map(c => `<tr><td><details><summary>${esc(c.category)}</summary>${peerTable(c)}</details></td><td class="num">${c.n}</td><td class="num">${c.median === null ? '—' : ratio(c.median)}</td><td class="num">${(c.weight * 100).toFixed(0)}%</td><td class="num value">${ratio(c.multiple)}</td></tr>`).join('')}</tbody></table></section><p class="subtitle" style="margin-top:15px">Snapshot provenance: ${esc(D.source)}. Every value is computed offline from this source; nothing is refreshed.</p>`;
  }
  function reset() {
    Object.assign(state, { q: '', category: '', chain: '', band: '', scope: 'all', page: 0 }); save(); render();
  }
  function openProtocol(slug) { state.selected = slug; save(); render(); window.scrollTo(0, 0); }
  function exportCsv() {
    const live = state.view === 'live';
    const keys = live ? ['slug','name','category','tvl_usd','change_7d','mcap_usd','symbol'] : ['rank','slug','name','scope','category','tvl_usd','change_7d','implied_value_usd','low_usd','high_usd','confidence','confidence_note','farm_steps'];
    const quote = v => '"' + String(Array.isArray(v) ? v.join(' | ') : v ?? '').replace(/"/g, '""') + '"';
    const text = [keys.join(','), ...filteredRows().map(r => keys.map(k => quote(r[k])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'atlas-' + D.as_of + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bindTable() {
    app.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
      const key = b.dataset.sort;
      state.dir = state.sort === key ? -state.dir : key === 'name' || key === 'category' ? 1 : -1;
      state.sort = key; state.page = 0; save(); refreshTable();
    });
    app.querySelectorAll('[data-protocol]').forEach(b => b.onclick = () => openProtocol(b.dataset.protocol));
    for (const [id, delta] of [['prev', -1], ['next', 1]]) {
      const b = app.querySelector('#' + id); if (b) b.onclick = () => { state.page += delta; save(); refreshTable(); };
    }
    const empty = app.querySelector('#empty-reset'); if (empty) empty.onclick = reset;
  }
  function refreshTable() { app.querySelector('#table-content').innerHTML = table(); bindTable(); }
  function render() {
    const record = D.rows.find(r => r.slug === state.selected);
    const live = D.live.find(r => r.slug === state.selected);
    const content = record ? detailPage(record) : live ? liveDetail(live) : state.view === 'method' ? methodPage() : boardPage();
    app.innerHTML = layout(content);
    app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => navigate(b.dataset.view));
    app.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => change('scope', b.dataset.scope));
    const search = app.querySelector('#search');
    if (search) search.oninput = () => { state.q = search.value; state.page = 0; save(); refreshTable(); };
    for (const key of ['category', 'chain', 'band']) { const node = app.querySelector('#' + key); if (node) node.onchange = () => change(key, node.value); }
    const handlers = { reset, back: () => change('selected', ''), export: exportCsv, print: () => window.print() };
    for (const [id, fn] of Object.entries(handlers)) { const node = app.querySelector('#' + id); if (node) node.onclick = fn; }
    bindTable();
  }
  window.addEventListener('popstate', () => location.reload());
  render();
})();
