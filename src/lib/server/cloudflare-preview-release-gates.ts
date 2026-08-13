import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ArtifactIdentity {
	sha256: string;
	fileCount: number;
	totalBytes: number;
}

export interface RemoteWorkerInventory {
	state: 'absent' | 'present';
	secrets: Array<{ name?: string; type?: string } | string>;
	versions: Array<{ id?: string; bindings: Array<{ name?: string; type?: string; text?: string }> }>;
}

export function artifactIdentity(directory: string, excludedRelativePaths = new Set<string>()): ArtifactIdentity {
	if (!fs.existsSync(directory)) throw new Error(`Artifact directory is missing: ${directory}`);
	const entries = filesUnder(directory).flatMap((file) => {
		const relativePath = path.relative(directory, file).split(path.sep).join('/');
		if (excludedRelativePaths.has(relativePath)) return [];
		const stat = fs.lstatSync(file);
		if (!stat.isFile()) throw new Error(`Artifact contains a non-file entry: ${relativePath}`);
		const bytes = fs.readFileSync(file);
		return [{ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }];
	}).sort((left, right) => left.path.localeCompare(right.path));
	assert(entries.length > 0, `Artifact directory contains no deployable files: ${directory}`);
	return {
		sha256: sha256(Buffer.from(JSON.stringify(entries))),
		fileCount: entries.length,
		totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
	};
}

export function assertArtifactIdentity(
	expected: ArtifactIdentity | undefined,
	directory: string,
	label = 'Artifact',
	excludedRelativePaths = new Set<string>(),
): void {
	assert(expected !== undefined, `${label} identity is missing from the build receipt`);
	const actual = artifactIdentity(directory, excludedRelativePaths);
	assert(expected.sha256 === actual.sha256, `${label} changed after its receipt was written`);
	assert(expected.fileCount === actual.fileCount, `${label} file count changed after its receipt was written`);
	assert(expected.totalBytes === actual.totalBytes, `${label} byte count changed after its receipt was written`);
}

export function deriveBuildIdentity(receipt: {
	schemaVersion: string;
	brandId: string;
	wranglerEnvironment: string;
	worker: string;
	hostingProfile: string;
	fixture: string;
	gitCommit: string;
	deployableArtifact: ArtifactIdentity;
	adapterInputs?: ArtifactIdentity;
}): string {
	return sha256(Buffer.from(JSON.stringify({
		schemaVersion: receipt.schemaVersion,
		brandId: receipt.brandId,
		wranglerEnvironment: receipt.wranglerEnvironment,
		worker: receipt.worker,
		hostingProfile: receipt.hostingProfile,
		fixture: receipt.fixture,
		gitCommit: receipt.gitCommit,
		deployableArtifact: receipt.deployableArtifact,
		adapterInputs: receipt.adapterInputs,
	})));
}

export function assertAttestableSourceStatus(status: string): void {
	assert(status === '', `Refusing to attest dirty source; commit or remove these changes first:\n${status}`);
}

export function isWorkerNotFoundOutput(output: string): boolean {
	return /(?:\[code:\s*10007\]|"code"\s*:\s*10007)/.test(output);
}

export function assertRemoteWorkerInventory(
	inventory: RemoteWorkerInventory,
	brandId: string,
	brand: { worker: string },
): void {
	assert(inventory?.state === 'absent' || inventory?.state === 'present',
		`Remote Worker ${brand.worker} inventory state is invalid`);
	if (inventory.state === 'absent') return;
	assert(Array.isArray(inventory.secrets) && inventory.secrets.length === 0,
		`Remote Worker ${brand.worker} has stale secrets: ${inventory.secrets?.map((secret) => typeof secret === 'string' ? secret : secret.name).join(', ') || 'unknown'}`);
	assert(Array.isArray(inventory.versions) && inventory.versions.length > 0,
		`Remote Worker ${brand.worker} has no inspectable active versions`);

	const declaredText = new Map<string, string | null>([
		['BRAND_ID', brandId],
		['AISLES_PARITY_FIXTURE', 'v1'],
		['AISLES_HOSTING_PROFILE', 'current-main-preview-v1'],
		['AISLES_BUILD_ID', null],
		['AISLES_SOURCE_COMMIT', null],
	]);
	for (const version of inventory.versions) {
		assert(Array.isArray(version.bindings), `Remote Worker ${brand.worker} version ${version.id || 'unknown'} bindings are unavailable`);
		for (const binding of version.bindings) {
			if (binding.type === 'assets' && binding.name === 'ASSETS') continue;
			if (binding.type === 'plain_text' && binding.name && declaredText.has(binding.name)) {
				const declaredValue = declaredText.get(binding.name);
				assert(declaredValue === null || binding.text === declaredValue,
					`Remote Worker ${brand.worker} has mismatched ${binding.name} on version ${version.id || 'unknown'}`);
				continue;
			}
			throw new Error(
				`Remote Worker ${brand.worker} has undeclared binding ${binding.name || 'unknown'} (${binding.type || 'unknown'}) on version ${version.id || 'unknown'}`,
			);
		}
	}
}

function filesUnder(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Artifact contains a symbolic link: ${absolute}`);
		return entry.isDirectory() ? filesUnder(absolute) : [absolute];
	});
}

function sha256(value: Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
