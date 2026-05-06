#!/usr/bin/env node
// scripts/analytics/calibrate-rules.mjs
// Score each testable rule from src/lib/signals/inference.ts against the
// fingerprinted ground truth. Output: precision per persona target, fire-rate,
// support. Untestable rules (those requiring runtime fields not in the BQ
// extract — dwell, scroll, device, search-query content, cross-session state)
// are listed but not scored.

import { writeFile } from 'node:fs/promises';
import { loadSessions } from './load.mjs';
import { fingerprint, bucketReferrer } from './fingerprint.mjs';

// ─── Session feature derivation ─────────────────────────────────────
//
// Rules in inference.ts consume an InferenceContext at runtime. Most of those
// fields aren't in the BQ extract; here we derive the ones we can from session
// events. This is a deliberate, documented subset.

function deriveContext(events) {
  const f = {
    eventCount: events.length,
    distinctPdpCount: 0,
    productViewCount: 0,
    distinctCategoriesViewed: new Set(),
    categoryViewCount: 0,
    searchCount: 0,
    cartAddCount: 0,
    referrer: bucketReferrer(events[0]?.referrer ?? ''),
    referrerRaw: (events[0]?.referrer ?? '').toLowerCase(),
    hourOfDay: parseHour(events[0]?.ts ?? ''),
    sessionDistinctPdps: new Set(),
  };
  for (const e of events) {
    if (e.event === 'PRODUCT_PAGE_VIEWED') {
      f.productViewCount++;
      const slug = pdpSlug(e.path);
      if (slug) f.sessionDistinctPdps.add(slug);
    }
    if (e.event === 'SEARCH_PRODUCT') f.searchCount++;
    if (e.event === 'SHOPPER_CART_CREATED') f.cartAddCount++;
    if (e.event === 'SHOPPER_PAGE_VIEWED' || e.event === 'PRODUCT_PAGE_VIEWED') {
      const cat = pathCategory(e.path);
      if (cat) {
        f.distinctCategoriesViewed.add(cat);
        f.categoryViewCount++;
      }
    }
  }
  f.distinctPdpCount = f.sessionDistinctPdps.size;
  return f;
}

function pdpSlug(path) {
  const m = /^\/products\/([a-z0-9-]+)/i.exec(path || '');
  return m ? m[1] : null;
}

function pathCategory(path) {
  const p = (path || '').toLowerCase();
  if (p.startsWith('/mattresses')) return 'mattresses';
  if (p.startsWith('/pillows')) return 'pillows';
  if (p.startsWith('/bedding')) return 'bedding';
  if (p.startsWith('/accessories')) return 'accessories';
  if (p.startsWith('/bedroom')) return 'bedroom';
  if (p.startsWith('/sleep')) return 'sleep';
  return null;
}

function parseHour(ts) {
  const m = /T(\d{2}):/.exec(ts || '');
  return m ? Number(m[1]) : null;
}

// ─── Testable rule subset ───────────────────────────────────────────
//
// Each rule is `{ name, target, fires(ctx) -> bool }`. `target` is the persona
// the rule's evidence vector lifts most. We score: when this rule fires, what
// fraction of those sessions had ground-truth persona == target?

const TESTABLE_RULES = [
  {
    name: 'referrer-social',
    target: 'gatherer',
    note: 'Original matches pinterest|instagram|houzz; adapted to also include facebook (paid social in this dataset).',
    fires: (ctx) => /pinterest|instagram|houzz|facebook/.test(ctx.referrerRaw),
  },
  {
    name: 'referrer-deal-site',
    target: 'hunter',
    note: 'Pattern slickdeals|retailmenot|honey|google.com/shopping — never matches in this data.',
    fires: (ctx) => /slickdeals|retailmenot|honey|google\.com\/shopping/.test(ctx.referrerRaw),
  },
  {
    name: 'referrer-review-site',
    target: 'researcher',
    note: 'Pattern wirecutter|consumerreports|reddit — never matches in this data.',
    fires: (ctx) => /wirecutter|consumerreports|reddit/.test(ctx.referrerRaw),
  },
  {
    name: 'broad-category-browsing',
    target: 'gatherer',
    fires: (ctx) => ctx.distinctCategoriesViewed.size >= 3,
  },
  {
    name: 'rapid-cart-adds',
    target: 'hunter',
    note: 'Rule requires cartAddCount >= 2; cart events are 95.6% orphan in this data.',
    fires: (ctx) => ctx.cartAddCount >= 2,
  },
  {
    name: 'in-session-search',
    target: 'hunter',
    note: 'Rule lifts hunter and researcher equally; we score against hunter (the wider-net target). Re-score against researcher.',
    fires: (ctx) => ctx.searchCount >= 2,
  },
  {
    name: 'in-session-search-as-researcher',
    target: 'researcher',
    note: 'Same rule, scored against researcher target.',
    fires: (ctx) => ctx.searchCount >= 2,
  },
  {
    name: 'deep-product-exploration',
    target: 'researcher',
    fires: (ctx) => ctx.productViewCount >= 4,
  },
  {
    name: 'single-category-focus',
    target: 'hunter',
    fires: (ctx) => ctx.categoryViewCount >= 3 && ctx.distinctCategoriesViewed.size === 1,
  },
  {
    name: 'mobile-evening-impulse',
    target: 'hunter',
    note: 'Rule requires deviceType=mobile (not in BQ extract). Approximated by hour-of-day only — strips the device half of the rule.',
    fires: (ctx) => ctx.hourOfDay !== null && (ctx.hourOfDay >= 20 || ctx.hourOfDay <= 5),
  },
  {
    name: 'desktop-weekday-deliberate',
    target: 'researcher',
    note: 'Rule requires deviceType=desktop and dayOfWeek (1-5). Approximated by hour-of-day 9-17 only — strips device + weekday halves.',
    fires: (ctx) => ctx.hourOfDay !== null && ctx.hourOfDay >= 9 && ctx.hourOfDay <= 17,
  },
];

const UNTESTABLE_RULES = [
  { name: 'intent-param', why: 'Runtime URL param; not derivable from BQ session events.' },
  { name: 'search-hunter-keywords', why: 'Requires search-query string content; BQ extract has SEARCH_PRODUCT events without query text.' },
  { name: 'search-researcher-keywords', why: 'Same as above.' },
  { name: 'search-gifter-keywords', why: 'Same as above.' },
  { name: 'search-gatherer-keywords', why: 'Same as above.' },
  { name: 'utm-gift-campaign', why: 'UTM columns dropped in 2026-05-06 schema update.' },
  { name: 'utm-sale-campaign', why: 'Same.' },
  { name: 'returning-same-category', why: 'Cross-session state (storedPersona, storedCategory); BQ extract has no longitudinal user identity.' },
  { name: 'returning-different-category', why: 'Same.' },
  { name: 'repeat-visitor-familiarity', why: 'Requires visitCount across sessions; BQ session_id is per-session-only.' },
  { name: 'returning-shopper-apparel', why: 'Same as above + apparel-specific category list (not sleep retail).' },
  { name: 'comparison-browsing', why: 'Requires backNavigationCount; BQ events are page hits, not navigation actions.' },
  { name: 'refinement-chat-engaged', why: 'Requires refineMessageCount (chat interactions); not present in BQ.' },
  { name: 'deep-scroll-exploration', why: 'Requires maxScrollDepth; not present in BQ.' },
  { name: 'long-product-dwell', why: 'Requires longDwellCount and avgDwellTimeMs; BQ timestamps are hour-bucketed, no dwell measurement.' },
  { name: 'quick-product-scanning', why: 'Same as above.' },
  { name: 'quick-bounce-pattern', why: 'Same as above.' },
  { name: 'cart-removal-indecision', why: 'Requires cartRemovalCount; BQ has SHOPPER_CART_UPDATED but no add-vs-remove distinction (and 95.6% orphan).' },
];

// ─── Driver ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const outputArg = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--'))) ?? 'docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-rule-scoring.md';
  const { sessions } = await loadSessions();

  // Build session → fingerprint table
  const labels = new Map();
  for (const [sid, events] of sessions) {
    const fp = fingerprint(events);
    labels.set(sid, fp.persona);
  }

  // Score each rule
  const results = [];
  for (const rule of TESTABLE_RULES) {
    let fires = 0;
    const personaCounts = { researcher: 0, hunter: 0, gatherer: 0, gifter: 0, unknown: 0 };
    for (const [sid, events] of sessions) {
      const ctx = deriveContext(events);
      if (!rule.fires(ctx)) continue;
      fires++;
      const label = labels.get(sid) ?? 'unknown';
      personaCounts[label]++;
    }
    const labeledFires = fires - personaCounts.unknown;
    const targetCount = personaCounts[rule.target] ?? 0;
    const precision = labeledFires === 0 ? null : targetCount / labeledFires;
    const fireRate = fires / sessions.size;
    results.push({ ...rule, fires, labeledFires, personaCounts, precision, fireRate });
  }

  const out = renderReport(results, sessions.size);
  await writeFile(outputArg, out, 'utf8');
  console.log(`Wrote ${outputArg}`);
  console.log('');
  console.log('Top-line:');
  for (const r of results) {
    const pStr = r.precision === null ? '   n/a' : (r.precision * 100).toFixed(1).padStart(5) + '%';
    console.log(`  ${r.name.padEnd(40)} fires=${r.fires.toString().padStart(5)}  labeled=${r.labeledFires.toString().padStart(4)}  ${pStr} ${r.target}`);
  }
}

function renderReport(results, totalSessions) {
  const lines = [];
  lines.push('# Sleep Country — inference-rule scoring');
  lines.push('');
  lines.push(`**Captured:** 2026-05-06`);
  lines.push(`**Source:** scoring \`src/lib/signals/inference.ts\` rules against the fingerprinted ground truth in \`data/sleepcountry-fingerprinted.jsonl\` (11,629 sessions).`);
  lines.push(`**Run:** \`node scripts/analytics/calibrate-rules.mjs\``);
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push('For each testable rule, derive the relevant InferenceContext fields from session events (per `deriveContext()` in the script), determine whether the rule fires, and bucket fires by ground-truth persona label.');
  lines.push('');
  lines.push('**Precision** is computed against the rule\'s primary persona target (the persona whose probability gets the largest lift in the rule\'s adjustment vector), restricted to *labeled* fires (excluding fires where the fingerprinter returned "unknown").');
  lines.push('');
  lines.push('Sessions whose fingerprint label is "unknown" are excluded from the precision denominator. An "unknown" outcome means the heuristic couldn\'t support a label, not that the rule was wrong.');
  lines.push('');
  lines.push('## Testable rules');
  lines.push('');
  lines.push('| Rule | Target | Fires | Labeled | Precision (target persona) | Persona breakdown |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    const breakdown = ['researcher', 'hunter', 'gatherer', 'gifter']
      .map((p) => `${p[0].toUpperCase()}=${r.personaCounts[p]}`)
      .join(' ');
    const pStr = r.precision === null ? 'n/a' : `${(r.precision * 100).toFixed(1)}%`;
    lines.push(`| \`${r.name}\` | ${r.target} | ${r.fires} (${(r.fireRate * 100).toFixed(1)}%) | ${r.labeledFires} | ${pStr} | ${breakdown} |`);
  }
  lines.push('');
  lines.push('## Per-rule notes');
  lines.push('');
  for (const r of results) {
    lines.push(`### \`${r.name}\``);
    lines.push('');
    if (r.note) {
      lines.push(`> ${r.note}`);
      lines.push('');
    }
    if (r.fires === 0) {
      lines.push('Never fires on this dataset.');
    } else {
      const labeledFires = r.labeledFires;
      const target = r.personaCounts[r.target];
      if (labeledFires === 0) {
        lines.push(`Fires ${r.fires} times but no labeled-persona fires (all fingerprinted as "unknown"). Cannot evaluate.`);
      } else {
        const pStr = `${(r.precision * 100).toFixed(1)}%`;
        const verdict = r.precision >= 0.6 ? '**Strong signal** — keep' : r.precision >= 0.4 ? 'Moderate signal — keep with reduced weight' : r.precision >= 0.2 ? 'Weak signal — re-evaluate or adapt' : '**Off-target** — does not transfer to sleep retail';
        lines.push(`Fires ${r.fires} times across all sessions. Of ${labeledFires} labeled fires, ${target} were ${r.target} (precision ${pStr}). ${verdict}.`);
      }
    }
    lines.push('');
    lines.push('Persona distribution among fires:');
    lines.push('');
    lines.push('| Persona | Count | Share of labeled fires |');
    lines.push('|---|---|---|');
    const labeled = r.labeledFires || 1;
    for (const p of ['researcher', 'hunter', 'gatherer', 'gifter']) {
      const n = r.personaCounts[p];
      lines.push(`| ${p} | ${n} | ${((n / labeled) * 100).toFixed(1)}% |`);
    }
    lines.push(`| (unknown — excluded from precision) | ${r.personaCounts.unknown} | — |`);
    lines.push('');
  }

  lines.push('## Untestable rules');
  lines.push('');
  lines.push('The following rules cannot be evaluated against this dataset — the InferenceContext fields they require are not present in the BQ session-event extract.');
  lines.push('');
  lines.push('| Rule | Why untestable |');
  lines.push('|---|---|');
  for (const u of UNTESTABLE_RULES) {
    lines.push(`| \`${u.name}\` | ${u.why} |`);
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('1. **Circular validation risk.** The fingerprinter and several inference rules consume similar low-level signals (referrer, multi-PDP browsing, search count). High precision on a rule may reflect that both the rule and the fingerprinter agree, not that the rule is independently correct. Where the rule fires on a signal the fingerprinter also uses to label, treat precision numbers as internal-consistency checks, not external validation.');
  lines.push('2. **Adapted rules are flagged.** Two rules (`mobile-evening-impulse`, `desktop-weekday-deliberate`) had their device-type half stripped because device data is absent; their precision applies to a degraded version of the rule, not the production version.');
  lines.push('3. **`in-session-search` is dual-target.** The original rule lifts hunter and researcher equally. It is scored twice (against each target).');
  lines.push('4. **Sample sizes vary.** Some rules fire on a few hundred sessions; others on a few. Treat precision numbers with low fire counts as directional, not significant. The report does not compute confidence intervals; eyeball n>100 as the threshold for taking a precision number at face value.');
  lines.push('');
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
