/** Atlas model: comparable circulating capitalizations, never launch probabilities or FDV. */
export type Protocol = {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
};
export type Snapshot = { as_of: string; source: string; floor_usd: number; protocols: Protocol[]; watchlist: string[] };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const version = /\s([Vv]\d+(\.\d+)?|\d+\.\d+)$/;
const excluded = new Set(['Bridge', 'Cross Chain Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX', 'Stablecoin Wrapper', 'Anchor BTC']);
const product = /\b(wrapped|staked|staking)\b|^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i;
export function ageDays(s: Snapshot, p: Protocol) {
  return p.listed_at ? Math.max(0, Math.floor((Date.parse(s.as_of) - Date.parse(p.listed_at)) / 86400000)) : null;
}
function quantile(values: number[], q: number) {
  const a = [...values].sort((x, y) => x - y), i = (a.length - 1) * q;
  return a[Math.floor(i)] + (a[Math.ceil(i)] - a[Math.floor(i)]) * (i % 1);
}
export function parseSnapshot(text: string): Snapshot {
  const s = JSON.parse(text);
  if (!Array.isArray(s.protocols) || !Array.isArray(s.watchlist) || !Number.isFinite(Date.parse(s.as_of))) throw Error('Invalid sealed snapshot');
  const seen = new Set();
  for (const p of s.protocols) {
    if (seen.has(p.slug) || !(p.tvl_usd > 0) || !Array.isArray(p.chains)) throw Error('Invalid protocol: ' + p.slug);
    seen.add(p.slug);
  }
  if (s.watchlist.some((slug: string) => !seen.has(slug))) throw Error('Missing watchlist protocol');
  return s;
}
/** Sample activity budgets, not observed fees or confirmed qualification rules. */
export function farmPlan(p: Protocol, age: number | null) {
  const chain = p.chains.find(c => ['Base', 'Arbitrum', 'Solana', 'Optimism'].includes(c)) || p.chains[0] || 'the listed network';
  const budget = p.tvl_usd >= 1e9 ? 250 : p.tvl_usd >= 5e7 ? 100 : 50;
  const gas = chain === 'Ethereum' ? '$10–40' : chain === 'Bitcoin' ? '$5–25' : '$1–10';
  const days = age === null || age < 180 ? 30 : 21;
  const c = (p.category || '').toLowerCase();
  let action: string, repeat: string, risk: string, unwind: string;
  if (c.includes('curator')) {
    action = `Find a vault explicitly curated by ${p.name} on ${chain}; verify the manager and accepted asset, then supply up to $${budget} without borrowing. A curator is not necessarily a standalone deposit app.`;
    repeat = `Keep the ${p.name}-curated vault shares for ${days} days; inspect allocations and utilization weekly. If the host app publishes points, verify that this exact vault and chain qualify; never infer curator rewards from host rewards.`;
    risk = 'Vault borrower defaults, curator allocation changes and withdrawal queues';
    unwind = 'Request redemption of the vault shares; allow for utilization-dependent liquidity and verify the received underlying asset';
  } else if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    action = `In ${p.name} on ${chain}, inspect a supported collateral or supply market and deposit up to $${budget} of an asset you already hold. Use supply-only first; do not assume USDC is supported.`;
    repeat = `Over ${days} days, check ${p.name}'s utilization and supply rewards once a week. Only if you need credit, borrow below 20% of collateral value and track health daily; a borrow may add activity but also interest and liquidation risk.`;
    risk = 'Collateral depegs, bad debt, oracle failures and liquidation if borrowing';
    unwind = 'Repay any debt and interest first, then redeem collateral or supplied assets; test a small withdrawal before scaling';
  } else if (c.includes('dex') || c.includes('liquidity')) {
    action = `On ${chain}, inspect ${p.name}'s deepest supported pair. Make a $10–20 genuine swap with a slippage limit; if liquidity provision fits your holdings, allocate at most $${budget} across both pool assets.`;
    repeat = `Keep any ${p.name} LP position for ${days} days and inspect fee earnings weekly. For concentrated liquidity, check the range every 2–3 days; use organic swaps only, since circular volume can cost fees without qualifying.`;
    risk = 'Impermanent loss, out-of-range liquidity, thin pools and adverse execution';
    unwind = 'Remove liquidity, collect fees and inspect the two asset balances; swap only what you need, checking price impact first';
  } else if (c.includes('derivative') || c.includes('options') || c.includes('prediction')) {
    action = `Inspect ${p.name}'s supported markets on ${chain} and deposit no more than $${budget} of accepted margin. If appropriate, make one $10 notional trade at low or no leverage; skip if there is no market you understand.`;
    repeat = `Review ${p.name}'s margin, funding and published volume rules weekly for ${days} days. Close speculative exposure promptly; avoid wash trades and never keep a leveraged position open solely to accumulate activity.`;
    risk = 'Funding costs, liquidation, market resolution disputes and trading losses';
    unwind = 'Close all open orders and positions, settle funding or resolution, then withdraw the remaining margin';
  } else if (c.includes('rwa') || c.includes('cedefi')) {
    action = `Check ${p.name}'s investor eligibility, issuer documents and subscription minimum on ${chain}. If a $${budget} test is permitted, subscribe to one supported asset; otherwise research only and do not bypass restrictions.`;
    repeat = `Read ${p.name}'s redemption calendar before holding for ${days} days. Check NAV and issuer notices weekly; verify any published participation program separately. A tokenized asset holding does not establish a future governance-token claim.`;
    risk = 'Issuer and custody exposure, eligibility limits, NAV staleness and delayed redemption';
    unwind = 'Submit redemption within the issuer window and retain the subscription receipt until cash or the underlying asset arrives';
  } else if (c.includes('basis')) {
    action = `Read ${p.name}'s strategy and accepted deposit assets on ${chain}; inspect its hedge, custody and redemption terms before placing at most $${budget} in a supported basis vault.`;
    repeat = `For ${days} days inspect ${p.name}'s NAV and funding exposure weekly. Keep receipt shares if suitable; if a points page exists, check whether locked and liquid shares accrue differently before extending a lock.`;
    risk = 'Negative funding, hedge breakdown, exchange counterparty exposure and redemption delays';
    unwind = 'Redeem vault shares through the documented request process and check any settlement delay before committing further capital';
  } else if (c.includes('stak') || c.includes('decentralized btc')) {
    action = `On ${chain}, inspect ${p.name}'s supported collateral, operator and unbonding rules. Delegate or deposit at most $${budget} equivalent of a supported native asset; never assume an EVM stablecoin deposit is available.`;
    repeat = `For ${days} days check ${p.name}'s operator uptime and reward status weekly. Review slashing and lock extensions before any additional delegation; use only explicitly published rewards rules, if any.`;
    risk = 'Slashing, native-asset volatility, operator failure and unbonding locks';
    unwind = 'Start undelegation or unbonding, record the unlock date and withdraw only after the chain reports settlement';
  } else if (c.includes('payment') || c.includes('card') || c === 'chain') {
    action = `Verify ${p.name}'s wallet and network support for ${chain}. Start with a $5 transfer to your own verified receiving address, then use up to $${budget} for a real payment or a supported ecosystem application.`;
    repeat = `Over ${days} days, make only useful ${p.name} payments or ecosystem transactions and keep receipts. Check official eligibility notices weekly; transaction count alone is not evidence of a future token or points program.`;
    risk = 'Wrong-network transfers, channel or bridge liquidity, custodial limits and native gas volatility';
    unwind = 'Close any payment channel or withdraw from the used application; confirm final settlement to a wallet you control';
  } else if (c.includes('insurance')) {
    action = `On ${chain}, read ${p.name}'s cover or underwriting product terms, exclusions and claims process. Only buy protection you need or allocate up to $${budget} to a supported underwriting pool after reading loss exposure.`;
    repeat = `Keep ${p.name} receipts through the chosen cover term; review pool losses and any published reward rules weekly for ${days} days. Premiums may be non-refundable and underwriting capital can be impaired.`;
    risk = 'Denied claims, underwriting losses, coverage exclusions and locked capital';
    unwind = 'Let cover expire or request underwriting withdrawal at the allowed window; verify pending claims before treating the capital as liquid';
  } else {
    action = `Inspect ${p.name}'s ${p.category || 'vault'} product on ${chain}; verify supported assets, strategy, fees and lock terms. If suitable, deposit no more than $${budget} into one unleveraged vault and retain the receipt shares.`;
    repeat = `Hold suitable ${p.name} shares for ${days} days and inspect strategy exposure weekly. If a rewards page is published, verify whether time-weighted balance or a lock is counted; avoid looping deposits solely for a transaction counter.`;
    risk = 'Strategy loss, share-price depegs, performance fees and withdrawal queues';
    unwind = 'Redeem receipt shares using the documented exit route, check any cooldown, and revoke unneeded approvals after settlement';
  }
  const steps = [
    `Research ${p.name} (${p.slug}) on ${chain}: use a verified official app, check current token and campaign status, and confirm the product is open. The sealed record cannot verify points or launch plans. Budget: $0; time: 15–25 min.`,
    `${action} Budget: $${budget} capital plus ${gas} estimated network fees; time: 15–30 min.`,
    `${repeat} Budget: capital remains exposed; optional actions incur network and product fees; time: 10 min/week.`,
    `${risk} are the main ${p.name} risks. ${unwind}. Reserve ${gas} for exit; time: 10–20 min plus any product lock.`,
  ];
  return { steps, chain, capital: budget, gas, days, risk };
}

export function buildRadar(s: Snapshot) {
  // Deduplicate by token id: a shared token capitalization cannot be counted for every version.
  // Highest-TVL representative avoids giving a small sibling an inflated capitalization/TVL ratio.
  const tokens = new Map<string, Protocol>();
  for (const p of s.protocols) {
    if (!p.gecko_id || !(p.mcap_usd! > 0) || excluded.has(p.category || '') || product.test(p.name)) continue;
    const old = tokens.get(p.gecko_id);
    if (!old || p.tvl_usd > old.tvl_usd) tokens.set(p.gecko_id, p);
  }
  const peers = [...tokens.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const ratios = peers.map(p => p.mcap_usd! / p.tvl_usd);
  if (!ratios.length) throw Error('No usable valuation peers');
  const global = quantile(ratios, .5);
  const categories = [...new Set(s.protocols.map(p => p.category || 'Other'))].sort().map(category => {
    const group = peers.filter(p => (p.category || 'Other') === category);
    const raw = group.map(p => p.mcap_usd! / p.tvl_usd);
    const weight = raw.length / (raw.length + 5);
    const blend = (q: number) => Math.exp(weight * Math.log(raw.length ? quantile(raw, q) : global) + (1 - weight) * Math.log(quantile(ratios, q)));
    return { category, n: raw.length, weight, median: raw.length ? quantile(raw, .5) : null, multiple: blend(.5), low: blend(.25), high: blend(.75), peers: group.map(p => ({ name: p.name, slug: p.slug, tvl: p.tvl_usd, mcap: p.mcap_usd, ratio: p.mcap_usd! / p.tvl_usd })) };
  });
  const byCategory = new Map(categories.map(c => [c.category, c]));
  const selected = s.protocols.filter(p => s.watchlist.includes(p.slug) || (
    p.tvl_usd < s.floor_usd && !p.gecko_id && !p.symbol && p.mcap_usd === null &&
    !excluded.has(p.category || '') && !product.test(p.name) && !version.test(p.name)));
  const board = selected.map(p => {
    const c = byCategory.get(p.category || 'Other')!;
    const age = ageDays(s, p);
    const momentum = 1 + .3 * clamp(p.change_7d ?? 0, -50, 50) / 100;
    // Tracking tenure is evidence of persistence, not proof of a tokenless operating history.
    const maturity = age === null ? .85 : .75 + .25 * Math.min(age / 730, 1);
    const breadth = 1 + .02 * Math.min(Math.max(p.chains.length - 1, 0), 5);
    const adjustment = momentum * maturity * breadth;
    const implied = Math.max(1, Math.round(p.tvl_usd * c.multiple * adjustment));
    const confidence = c.n >= 8 && age !== null && p.change_7d !== null ? 'Moderate' : 'Low';
    const plan = farmPlan(p, age);
    const confidence_note = `${c.n} independent category token peers; ${Math.round(c.weight * 100)}% category weight, remainder global. ${age === null ? 'Tracking date missing; 0.85× tenure default.' : `${age} days tracked; not verified protocol age.`} ${p.change_7d === null ? '7-day TVL change missing; neutral momentum.' : 'TVL change includes price effects, not just net flows.'} No launch or reward evidence in snapshot.`;
    return { ...p, rank: 0, category: p.category || 'Other', scope: s.watchlist.includes(p.slug) ? 'Watchlist' : 'Below floor', token_status: 'No token recorded', age_days: age, implied_value_usd: implied,
      low_usd: Math.max(1, Math.round(p.tvl_usd * Math.min(c.low, c.multiple * .65) * adjustment * .8)),
      high_usd: Math.max(implied, Math.round(p.tvl_usd * Math.max(c.high, c.multiple * 1.5) * adjustment * 1.2)),
      confidence, confidence_note, model: { multiple: c.multiple, peer_count: c.n, category_weight: c.weight, momentum, maturity, breadth, adjustment },
      plan, farm_steps: plan.steps };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  board.forEach((r, i) => r.rank = i + 1);
  return { board, radar: { rows: board, categories, global_multiple: global, peer_count: peers.length, as_of: s.as_of, source: s.source, watchlist_size: s.watchlist.length, floor_usd: s.floor_usd,
    early_size: board.length - s.watchlist.length, live_size: s.protocols.filter(p => p.gecko_id || p.symbol || p.mcap_usd !== null).length,
    live: s.protocols.filter(p => p.gecko_id || p.symbol || p.mcap_usd !== null).sort((a, b) => (b.mcap_usd || 0) - (a.mcap_usd || 0)), model_version: 'Atlas / 1.0' } };
}
export function boardIssue(board: ReturnType<typeof buildRadar>['board'], s: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return 'Row count outside gate';
  if (new Set(board.map(r => r.slug)).size !== board.length) return 'Duplicate slugs';
  if (s.watchlist.some(slug => !board.some(r => r.slug === slug))) return 'Watchlist coverage';
  for (const [i, r] of board.entries()) {
    if (r.rank !== i + 1 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return 'Invalid rank/value';
    if (i && r.implied_value_usd > board[i - 1].implied_value_usd) return 'Value order';
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12 || r.farm_steps.some(t => t.trim().length < 20 || t.trim().length > 600)) return 'Farm plan length: ' + r.slug;
  }
  return board[0].implied_value_usd === board.at(-1)!.implied_value_usd ? 'No value differentiation' : null;
}
export const dataScript = (radar: ReturnType<typeof buildRadar>['radar']) => `window.RADAR=${JSON.stringify(radar).replace(/</g, '\\u003c')};\n`;
