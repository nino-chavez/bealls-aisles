#!/usr/bin/env node
/**
 * Regenerate BC Storefront API tokens for every brand in
 * `bc-tokens.config.mjs`. Reads the canonical allowed_cors_origins from
 * that config so re-issuance is deterministic and idempotent.
 *
 * Run: node scripts/regen-storefront-tokens.mjs
 *
 * Requires:
 *   BIGCOMMERCE_STORE_HASH — store identifier (in .env)
 *   BIGCOMMERCE_ACCESS_TOKEN — admin V2/V3 token with auth_tokens scope
 *
 * Updates .env in place. Restart any running dev server afterward.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_TOKENS, TOKEN_LIFETIME_SECONDS } from './bc-tokens.config.mjs';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const ADMIN_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');

if (!STORE) {
	console.error('BIGCOMMERCE_STORE_HASH not set in environment');
	process.exit(1);
}
if (!ADMIN_TOKEN) {
	console.error('BIGCOMMERCE_ACCESS_TOKEN not set in environment');
	process.exit(1);
}

const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;

async function issueToken(channelId, allowedOrigins) {
	const body = {
		channel_id: channelId,
		expires_at: expiresAt,
		allowed_cors_origins: allowedOrigins,
	};
	const res = await fetch(`https://api.bigcommerce.com/stores/${STORE}/v3/storefront/api-token`, {
		method: 'POST',
		headers: {
			'X-Auth-Token': ADMIN_TOKEN,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`HTTP ${res.status}: ${text}`);
	}
	const json = await res.json();
	return json.data.token;
}

function decodeJwtClaims(jwt) {
	const payload = jwt.split('.')[1];
	const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
	return JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
}

function updateEnv(envKey, newToken) {
	let content = fs.readFileSync(ENV_PATH, 'utf8');
	const re = new RegExp(`^${envKey}=.*$`, 'm');
	if (!re.test(content)) {
		content += (content.endsWith('\n') ? '' : '\n') + `${envKey}=${newToken}\n`;
	} else {
		content = content.replace(re, `${envKey}=${newToken}`);
	}
	fs.writeFileSync(ENV_PATH, content);
}

function backupEnv() {
	const backup = `${ENV_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
	fs.copyFileSync(ENV_PATH, backup);
	return backup;
}

console.log('Regenerating BC Storefront API tokens.');
console.log(`  Store: ${STORE}`);
console.log(`  Lifetime: ${TOKEN_LIFETIME_SECONDS / 86400} days`);

const backupPath = backupEnv();
console.log(`  .env backed up to ${path.basename(backupPath)}`);
console.log('');

let failed = 0;
for (const { brand, channelId, envKey, origins } of BRAND_TOKENS) {
	process.stdout.write(`  ${brand.padEnd(15)} channel=${channelId} envKey=${envKey} ... `);
	try {
		const token = await issueToken(channelId, origins);
		updateEnv(envKey, token);
		const claims = decodeJwtClaims(token);
		console.log('OK');
		console.log(`    cors: ${JSON.stringify(claims.cors)}`);
		console.log(`    expires: ${new Date(claims.eat * 1000).toISOString()}`);
	} catch (err) {
		console.log('FAIL');
		console.log(`    ${err.message}`);
		failed++;
	}
}

console.log('');
if (failed > 0) {
	console.log(`${failed} token(s) failed. .env partial state — see backup at ${backupPath}`);
	process.exit(1);
}
console.log('All tokens regenerated. Restart dev server to pick up the new keys.');
