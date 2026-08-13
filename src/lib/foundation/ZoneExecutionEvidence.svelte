<script lang="ts">
	let {
		executions,
	}: {
		executions: readonly {
			organizationId: string;
			brandId: string;
			routeId: string;
			routePath: string;
			surface: string;
			policyVersion: string;
			expectedZoneIds: readonly string[];
			decisions: readonly {
				zoneId: string;
				terminal: string;
				resolution: { source: string; merchantAuthority?: string; hiddenReason?: string; policyProvenance: { preset: string; referenceState: string } };
				policy: { decisionMode: string; publicationMode: string };
			}[];
		}[];
	} = $props();

	let evidence = $derived(JSON.stringify(executions.map((execution) => ({
		organizationId: execution.organizationId,
		brandId: execution.brandId,
		routeId: execution.routeId,
		routePath: execution.routePath,
		surface: execution.surface,
		policyVersion: execution.policyVersion,
		expectedZoneIds: execution.expectedZoneIds,
		decisions: execution.decisions.map((decision) => ({
			zoneId: decision.zoneId,
			terminal: decision.terminal,
			source: decision.resolution.source,
			merchantAuthority: decision.resolution.merchantAuthority ?? null,
			hiddenReason: decision.resolution.hiddenReason ?? null,
			decisionMode: decision.policy.decisionMode,
			publicationMode: decision.policy.publicationMode,
			preset: decision.resolution.policyProvenance.preset,
			referenceState: decision.resolution.policyProvenance.referenceState,
		})),
	}))));
</script>

<!-- Non-visual capture substrate. Hidden zone content still emits no zone DOM. -->
<div hidden data-zone-execution={evidence}></div>
