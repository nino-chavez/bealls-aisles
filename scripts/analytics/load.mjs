#!/usr/bin/env node
// scripts/analytics/load.mjs
// Reads the sanitized + filtered Sleep Country event CSV into a session-grouped
// in-memory shape. With --summary, prints a sanity dump (event-type histogram,
// session-length distribution, referrer mix, postal coverage). Used as the
// foundation for fingerprint.mjs (Stream 1) and derive-cohort-priors.mjs (Stream 2).

import { streamCsv } from './lib/csv.mjs';

const DEFAULT_INPUT = 'data/sleepcountry-events.csv';

export async function loadSessions(inputPath = DEFAULT_INPUT) {
  const sessions = new Map();
  let totalEvents = 0;
  let orphanRows = 0;
  const orphanByEvent = new Map();

  for await (const row of streamCsv(inputPath)) {
    const sid = row.session_id_hashed;
    if (!sid) {
      orphanRows++;
      orphanByEvent.set(row.event, (orphanByEvent.get(row.event) ?? 0) + 1);
      continue;
    }
    if (!sessions.has(sid)) sessions.set(sid, []);
    sessions.get(sid).push({
      event: row.event,
      ts: row.timestamp_hour,
      referrer: row.referrer_domain || '',
      path: row.request_path || '',
      postal: row.postal_prefix || '',
    });
    totalEvents++;
  }

  return { sessions, totalEvents, orphanRows, orphanByEvent };
}

function summarize({ sessions, totalEvents, orphanRows, orphanByEvent }) {
  const eventTypes = new Map();
  const sessionLengths = [];
  const referrers = new Map();
  const postalBuckets = new Map();
  const hours = new Map();
  let sessionsWithAnyCart = 0;
  let sessionsWithAnyPostal = 0;
  let sessionsWithCheckout = 0;

  for (const events of sessions.values()) {
    sessionLengths.push(events.length);
    let sawCart = false;
    let sawPostal = false;
    let sawCheckout = false;
    for (const e of events) {
      eventTypes.set(e.event, (eventTypes.get(e.event) ?? 0) + 1);
      if (e.event.startsWith('SHOPPER_CART_')) sawCart = true;
      if (e.event === 'SHOPPER_CHECKOUT_COMPLETED' || e.event === 'STOREFRONT_CHECKOUT_ORDER_CREATED') sawCheckout = true;
      if (e.postal) sawPostal = true;
    }
    if (sawCart) sessionsWithAnyCart++;
    if (sawPostal) sessionsWithAnyPostal++;
    if (sawCheckout) sessionsWithCheckout++;
    const first = events[0];
    if (first) {
      const ref = bucketReferrer(first.referrer);
      referrers.set(ref, (referrers.get(ref) ?? 0) + 1);
      const pBucket = first.postal || '(empty)';
      postalBuckets.set(pBucket, (postalBuckets.get(pBucket) ?? 0) + 1);
      const hour = parseHour(first.ts);
      if (hour !== null) hours.set(hour, (hours.get(hour) ?? 0) + 1);
    }
  }

  sessionLengths.sort((a, b) => a - b);
  const p = (q) => sessionLengths[Math.floor(sessionLengths.length * q)];

  console.log('=== Sleep Country events: ingest summary ===');
  console.log(`Total events:    ${totalEvents.toLocaleString()} (attached to a session)`);
  console.log(`Orphan rows:     ${orphanRows.toLocaleString()} (no session_id — server-side events)`);
  console.log(`Total sessions:  ${sessions.size.toLocaleString()}`);
  console.log(`Avg events/sess: ${(totalEvents / sessions.size).toFixed(2)}`);
  console.log('');
  console.log(`Session length  p50=${p(0.5)}  p75=${p(0.75)}  p90=${p(0.9)}  p99=${p(0.99)}  max=${sessionLengths[sessionLengths.length - 1]}`);
  console.log('');
  console.log('Event types (attached only):');
  for (const [name, count] of [...eventTypes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${name}`);
  }
  console.log('');
  console.log('Orphan rows by event (top 5):');
  for (const [name, count] of [...orphanByEvent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${count.toString().padStart(6)}  ${name}`);
  }
  console.log('');
  console.log('Entry referrer (bucketed):');
  for (const [name, count] of [...referrers.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${name}`);
  }
  console.log('');
  console.log(`Sessions with any cart event: ${sessionsWithAnyCart.toLocaleString()} (${pct(sessionsWithAnyCart, sessions.size)})`);
  console.log(`Sessions reaching checkout:   ${sessionsWithCheckout.toLocaleString()} (${pct(sessionsWithCheckout, sessions.size)})`);
  console.log(`Sessions with any postal:     ${sessionsWithAnyPostal.toLocaleString()} (${pct(sessionsWithAnyPostal, sessions.size)})`);
  console.log('');
  console.log('Postal prefix (entry):');
  for (const [name, count] of [...postalBuckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${name}`);
  }
  console.log('');
  console.log('Hour distribution (UTC):');
  for (let h = 0; h < 24; h++) {
    const n = hours.get(h) ?? 0;
    const bar = '#'.repeat(Math.round((n / sessions.size) * 200));
    console.log(`  ${h.toString().padStart(2, '0')}  ${n.toString().padStart(5)}  ${bar}`);
  }
}

function pct(n, total) {
  return `${((n / total) * 100).toFixed(1)}%`;
}

function bucketReferrer(domain) {
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

function parseHour(ts) {
  if (!ts) return null;
  const m = /T(\d{2}):/.exec(ts);
  return m ? Number(m[1]) : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--')) ?? DEFAULT_INPUT;
  const result = await loadSessions(input);
  if (args.includes('--summary')) summarize(result);
  else console.log(`Loaded ${result.totalEvents.toLocaleString()} events into ${result.sessions.size.toLocaleString()} sessions from ${input}.`);
}
