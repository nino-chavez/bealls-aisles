#!/usr/bin/env node
// scripts/analytics/fingerprint.mjs
// Persona fingerprinting heuristic for sleepcountry session-event traces.
// Pure function from session events to {persona, confidence, evidence}.
//
// Calibrated to the realities of this dataset (see
// docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-data-quirks.md):
// - Half of sessions have 1-2 events (Unknown will dominate).
// - Cart/checkout events are 95.6% orphan; only 4.4% of sessions have any
//   attributable cart event. Hunter heuristic doesn't *require* cart.
// - Timestamps are hour-bucketed; in-session ordering is unreliable.
// - Duplicate PDP-views are common in the source pipeline; dedupe before
//   counting "distinct" PDPs.

import { writeFile } from 'node:fs/promises';
import { loadSessions } from './load.mjs';

// ─── Path classification ────────────────────────────────────────────

const PRODUCT_PATH_RE = /^\/products\/([a-z0-9-]+)/i;

function classifyPath(path) {
  if (!path) return { kind: 'unknown', category: null, productSlug: null };
  const p = path.toLowerCase();

  if (p.startsWith('/products/') || p === '/products.php') {
    const m = PRODUCT_PATH_RE.exec(p);
    return { kind: 'pdp', category: inferCategoryFromSlug(m?.[1] ?? ''), productSlug: m?.[1] ?? null };
  }
  if (p.startsWith('/search')) return { kind: 'search', category: null, productSlug: null };
  if (p.startsWith('/mattresses')) return { kind: 'category', category: 'mattresses', productSlug: null };
  if (p.startsWith('/pillows')) return { kind: 'category', category: 'pillows', productSlug: null };
  if (p.startsWith('/bedding')) return { kind: 'category', category: 'bedding', productSlug: null };
  if (p.startsWith('/accessories')) return { kind: 'category', category: 'accessories', productSlug: null };
  if (p.startsWith('/bedroom')) return { kind: 'category', category: 'bedroom', productSlug: null };
  if (p.startsWith('/sleep')) return { kind: 'category', category: 'sleep', productSlug: null };
  if (p.startsWith('/internalapi/') || p.startsWith('/remote/v1/')) return { kind: 'checkout-api', category: null, productSlug: null };
  if (p === '/' || p === '') return { kind: 'home', category: null, productSlug: null };
  if (p.startsWith('/api/')) return { kind: 'api', category: null, productSlug: null };
  return { kind: 'other', category: null, productSlug: null };
}

const SLUG_CATEGORY_HINTS = [
  ['mattress', 'mattresses'],
  ['pillow', 'pillows'],
  ['comforter', 'bedding'],
  ['duvet', 'bedding'],
  ['sheet', 'bedding'],
  ['blanket', 'bedding'],
  ['box-spring', 'mattresses'],
  ['protector', 'accessories'],
  ['frame', 'bedroom'],
  ['wedge', 'pillows'],
];

function inferCategoryFromSlug(slug) {
  for (const [hint, cat] of SLUG_CATEGORY_HINTS) {
    if (slug.includes(hint)) return cat;
  }
  return null;
}

// ─── Referrer bucketing ─────────────────────────────────────────────

export function bucketReferrer(domain) {
  if (!domain || domain === '(direct)') return 'direct';
  const d = domain.toLowerCase();
  if (d.includes('facebook')) return 'facebook';
  if (d.includes('instagram')) return 'instagram';
  if (d.includes('google')) return 'google';
  if (d.includes('youtube')) return 'youtube';
  if (d.includes('dormezvous')) return 'dormezvous';
  if (d.includes('sleepcountry') || d === 'internal') return 'internal';
  return 'other';
}

// ─── Feature extraction ─────────────────────────────────────────────

function extractFeatures(events) {
  const eventTypes = new Set();
  const eventCounts = new Map();
  const distinctPdps = new Set();
  const distinctCategories = new Set();
  const pdpCategories = new Map();
  let searchCount = 0;
  let cartEventCount = 0;
  let checkoutCompleted = false;

  for (const e of events) {
    eventTypes.add(e.event);
    eventCounts.set(e.event, (eventCounts.get(e.event) ?? 0) + 1);
    if (e.event === 'SEARCH_PRODUCT') searchCount++;
    if (e.event.startsWith('SHOPPER_CART_')) cartEventCount++;
    if (e.event === 'STOREFRONT_CHECKOUT_ORDER_CREATED' || e.event === 'SHOPPER_CHECKOUT_COMPLETED') checkoutCompleted = true;

    const klass = classifyPath(e.path);
    if (klass.kind === 'pdp' && klass.productSlug) {
      distinctPdps.add(klass.productSlug);
      if (klass.category) {
        pdpCategories.set(klass.category, (pdpCategories.get(klass.category) ?? 0) + 1);
        distinctCategories.add(klass.category);
      }
    } else if (klass.kind === 'category' && klass.category) {
      distinctCategories.add(klass.category);
    }
  }

  const entry = events[0] ?? null;
  const referrer = bucketReferrer(entry?.referrer ?? '');

  return {
    eventCount: events.length,
    eventTypes,
    eventCounts,
    distinctPdpCount: distinctPdps.size,
    distinctCategoryCount: distinctCategories.size,
    distinctCategories,
    pdpCategories,
    searchCount,
    cartEventCount,
    checkoutCompleted,
    referrer,
    postal: entry?.postal ?? '',
  };
}

// ─── Fingerprinting rules ───────────────────────────────────────────

export function fingerprint(events) {
  if (!events || events.length === 0) {
    return { persona: 'unknown', confidence: 0, evidence: ['no events'] };
  }

  const f = extractFeatures(events);
  const candidates = [];

  // Researcher: deep mattress comparison. The high-stakes-purchase signature.
  // Mattresses are sleepcountry's flagship category — multi-PDP browsing in
  // /mattresses/* is the textbook researcher pattern.
  {
    const mattressPdps = f.pdpCategories.get('mattresses') ?? 0;
    const evidence = [];
    let conf = 0;
    if (f.distinctPdpCount >= 4 && mattressPdps >= 3) {
      evidence.push(`${f.distinctPdpCount} distinct PDPs, ${mattressPdps} mattress PDPs`);
      conf += 0.5;
    } else if (f.distinctPdpCount >= 3 && mattressPdps >= 2) {
      evidence.push(`${f.distinctPdpCount} distinct PDPs, ${mattressPdps} mattress PDPs`);
      conf += 0.35;
    }
    if (f.searchCount >= 3) {
      evidence.push(`${f.searchCount} search events`);
      conf += 0.2;
    } else if (f.searchCount >= 1 && f.distinctPdpCount >= 3) {
      evidence.push(`${f.searchCount} search + ${f.distinctPdpCount} PDPs`);
      conf += 0.1;
    }
    if (conf > 0) candidates.push({ persona: 'researcher', confidence: Math.min(conf, 0.95), evidence });
  }

  // Hunter: direct intent, often via paid social. Cart attribution is rare in
  // this data, so we don't require cart — strong signal is "social referrer +
  // entered directly on a PDP + short focused session".
  {
    const evidence = [];
    let conf = 0;
    const socialReferrer = f.referrer === 'facebook' || f.referrer === 'instagram';
    const entryIsPdp = classifyPath(events[0]?.path ?? '').kind === 'pdp';
    if (socialReferrer && entryIsPdp) {
      evidence.push(`entered via ${f.referrer} on a PDP`);
      conf += 0.45;
    } else if (socialReferrer) {
      evidence.push(`entered via ${f.referrer}`);
      conf += 0.2;
    } else if (entryIsPdp && f.referrer === 'direct') {
      evidence.push('entered directly on a PDP');
      conf += 0.15;
    }
    if (f.cartEventCount >= 1) {
      evidence.push(`${f.cartEventCount} cart events`);
      conf += 0.3;
    }
    // Focused: ≤2 distinct categories, ≤4 distinct PDPs
    if (f.distinctPdpCount >= 1 && f.distinctPdpCount <= 4 && f.distinctCategoryCount <= 2) {
      evidence.push('focused PDP traffic');
      conf += 0.1;
    }
    if (conf >= 0.4) candidates.push({ persona: 'hunter', confidence: Math.min(conf, 0.95), evidence });
  }

  // Gatherer: multi-category browse, no checkout, no cart. Window-shopping.
  {
    const evidence = [];
    let conf = 0;
    if (f.distinctCategoryCount >= 3 && !f.checkoutCompleted) {
      evidence.push(`browsed ${f.distinctCategoryCount} categories`);
      conf += 0.4;
    } else if (f.distinctCategoryCount >= 2 && f.eventCount >= 4 && f.cartEventCount === 0 && !f.checkoutCompleted) {
      evidence.push(`browsed ${f.distinctCategoryCount} categories, no cart`);
      conf += 0.25;
    }
    // Reduce confidence if the session looks researcher-y instead
    const mattressPdps = f.pdpCategories.get('mattresses') ?? 0;
    if (mattressPdps >= 3) {
      conf -= 0.2;
      evidence.push('-: mattress-heavy (looks more like researcher)');
    }
    if (conf >= 0.25) candidates.push({ persona: 'gatherer', confidence: Math.min(conf, 0.85), evidence });
  }

  // Gifter: completed a small-ticket checkout (not a mattress). Pillow / bedding
  // / accessories purchase. Treat as gifter when the only PDPs viewed are in
  // those categories.
  {
    const evidence = [];
    let conf = 0;
    if (f.checkoutCompleted) {
      const mattressPdps = f.pdpCategories.get('mattresses') ?? 0;
      const giftablePdps =
        (f.pdpCategories.get('pillows') ?? 0) +
        (f.pdpCategories.get('bedding') ?? 0) +
        (f.pdpCategories.get('accessories') ?? 0);
      if (mattressPdps === 0 && giftablePdps >= 1) {
        evidence.push(`checkout completed, ${giftablePdps} non-mattress PDPs`);
        conf += 0.55;
      } else if (mattressPdps === 0 && f.distinctPdpCount >= 1) {
        evidence.push('checkout completed, non-mattress purchase');
        conf += 0.3;
      }
    }
    if (conf > 0) candidates.push({ persona: 'gifter', confidence: Math.min(conf, 0.9), evidence });
  }

  if (candidates.length === 0) {
    return {
      persona: 'unknown',
      confidence: 0,
      evidence: [`${f.eventCount} events, ${f.distinctPdpCount} distinct PDPs, ${f.distinctCategoryCount} categories`],
    };
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];
  const second = candidates[1];

  // If two personas score within 0.1 of each other, downgrade confidence.
  if (second && top.confidence - second.confidence < 0.1) {
    top.confidence = Math.max(0.3, top.confidence - 0.15);
    top.evidence.push(`(close call vs ${second.persona})`);
  }

  return top;
}

// ─── Driver ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flagValueIndices = new Set();
  for (const flag of ['--output', '--persona', '--limit', '--input']) {
    const i = args.indexOf(flag);
    if (i !== -1) flagValueIndices.add(i + 1);
  }
  const positional = args.filter((a, i) => !a.startsWith('--') && !flagValueIndices.has(i));
  const inputArg = argValue(args, '--input') ?? positional[0];
  const outputArg = argValue(args, '--output') ?? 'data/sleepcountry-fingerprinted.jsonl';
  const summary = args.includes('--summary');
  const personaFilter = argValue(args, '--persona');
  const limit = Number(argValue(args, '--limit') ?? '0') || 0;
  const verbose = args.includes('--verbose');

  const { sessions } = await loadSessions(inputArg);
  const lines = [];
  const dist = { researcher: 0, hunter: 0, gatherer: 0, gifter: 0, unknown: 0 };
  const confBuckets = [0, 0, 0, 0, 0]; // 0-.2, .2-.4, .4-.6, .6-.8, .8-1
  const referrerByPersona = new Map();
  let shown = 0;

  for (const [sid, events] of sessions) {
    const fp = fingerprint(events);
    dist[fp.persona] = (dist[fp.persona] ?? 0) + 1;
    const cb = Math.min(4, Math.floor(fp.confidence * 5));
    confBuckets[cb]++;

    const ref = bucketReferrer(events[0]?.referrer ?? '');
    if (!referrerByPersona.has(fp.persona)) referrerByPersona.set(fp.persona, new Map());
    const refMap = referrerByPersona.get(fp.persona);
    refMap.set(ref, (refMap.get(ref) ?? 0) + 1);

    const record = {
      session_id: sid,
      persona: fp.persona,
      confidence: Number(fp.confidence.toFixed(3)),
      event_count: events.length,
      entry: {
        referrer: ref,
        postal: events[0]?.postal ?? '',
        path: events[0]?.path ?? '',
      },
      evidence: fp.evidence,
    };
    lines.push(JSON.stringify(record));

    if (personaFilter && fp.persona === personaFilter && (!limit || shown < limit)) {
      console.log(`\n=== ${sid.slice(0, 16)} (${events.length} events, conf=${fp.confidence.toFixed(2)}) ===`);
      console.log(`evidence: ${fp.evidence.join(' | ')}`);
      if (verbose) {
        for (const e of events) {
          console.log(`  ${e.event.padEnd(34)} ref=${(e.referrer || '').padEnd(20)} ${e.path}`);
        }
      }
      shown++;
    }
  }

  if (!personaFilter) {
    await writeFile(outputArg, lines.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${lines.length} fingerprinted sessions to ${outputArg}`);
  }

  if (summary || personaFilter) {
    const total = sessions.size;
    console.log('\n=== Persona distribution ===');
    for (const p of ['researcher', 'hunter', 'gatherer', 'gifter', 'unknown']) {
      const n = dist[p] ?? 0;
      console.log(`  ${p.padEnd(11)} ${n.toString().padStart(5)}  ${((n / total) * 100).toFixed(1)}%`);
    }
    console.log('\n=== Confidence distribution ===');
    const bands = ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'];
    for (let i = 0; i < 5; i++) {
      console.log(`  ${bands[i]}  ${confBuckets[i].toString().padStart(5)}  ${((confBuckets[i] / total) * 100).toFixed(1)}%`);
    }
    console.log('\n=== Referrer × Persona (rows: persona) ===');
    const allRefs = new Set();
    for (const refMap of referrerByPersona.values()) for (const r of refMap.keys()) allRefs.add(r);
    const refList = [...allRefs].sort();
    console.log('persona      ' + refList.map((r) => r.padStart(11)).join(' '));
    for (const p of ['researcher', 'hunter', 'gatherer', 'gifter', 'unknown']) {
      const refMap = referrerByPersona.get(p) ?? new Map();
      const cells = refList.map((r) => (refMap.get(r) ?? 0).toString().padStart(11));
      console.log(`  ${p.padEnd(11)} ${cells.join(' ')}`);
    }
  }
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
