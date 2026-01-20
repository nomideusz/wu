<script lang="ts">
	// Props interface
	interface Props {
		finalReports?: number;
		draftReports?: number;
		totalCoverage?: number;
		totalLISAs?: number;
		totalGaps?: number;
		vehicleMetrics?: any[];
	}

	let { 
		finalReports = 0, 
		draftReports = 0, 
		totalCoverage = 0, 
		totalLISAs = 0, 
		totalGaps = 0,
		vehicleMetrics = []
	}: Props = $props();
</script>

<div class="stats-dashboard">
	<!-- Reports Section -->
	<div class="stats-section">
		<div class="stats-section-header">
			<h3>Reports</h3>
		</div>
		<div class="stats-section-content">
			<div class="stats-metric">
				<div class="stats-content">
					<div class="stats-value">{finalReports}</div>
					<div class="stats-label">Final Reports</div>
				</div>
			</div>
			
			<div class="stats-metric stats-metric--dimmed">
				<div class="stats-content">
					<div class="stats-value">{draftReports}</div>
					<div class="stats-label">Draft Reports</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Assets Section -->
	<div class="stats-section">
		<div class="stats-section-header">
			<h3>Assets (Final Reports)</h3>
		</div>
		<div class="stats-section-content">
			<div class="stats-metric">
				<div class="stats-content">
					<div class="stats-value">{totalCoverage.toFixed(1)}%</div>
					<div class="stats-label">Coverage</div>
				</div>
			</div>
			
			<div class="stats-metric">
				<div class="stats-content">
					<div class="stats-value">{totalLISAs}</div>
					<div class="stats-label">LISAs</div>
				</div>
			</div>
			
			<div class="stats-metric">
				<div class="stats-content">
					<div class="stats-value">{totalGaps}</div>
					<div class="stats-label">Gaps</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Vehicles Section -->
	<div class="stats-section">
		<div class="stats-section-header">
			<h3>Vehicles (Final Reports)</h3>
		</div>
		<div class="stats-section-content">
			{#if vehicleMetrics.length > 0}
				{#each vehicleMetrics as vehicle}
					<div class="stats-metric stats-metric--vehicle">
						<div class="stats-content">
							<div class="stats-value">{vehicle.final.toFixed(1)}</div>
							<div class="stats-label">{vehicle.name} (km)</div>
						</div>
					</div>
				{/each}
			{:else}
				<div class="stats-metric stats-metric--dimmed">
					<div class="stats-content">
						<div class="stats-label">No vehicles found</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Stats Dashboard */
	.stats-dashboard {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.stats-section {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.stats-section-header {
		background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
		padding: 1rem 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: white;
	}

	.stats-section-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.025em;
	}

	.stats-section-content {
		padding: 1.5rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
	}

	.stats-metric {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 6px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-secondary);
		transition: all 0.2s ease;
	}

	.stats-metric:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-primary);
	}

	.stats-metric--vehicle {
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
	}

	.stats-metric--dimmed {
		opacity: 0.6;
	}

	.stats-metric--dimmed .stats-value {
		color: var(--text-secondary);
	}

	.stats-metric--dimmed .stats-label {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	.stats-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--bg-tertiary);
		border-radius: 6px;
		flex-shrink: 0;
		border: 1px solid var(--border-secondary);
	}

	.stats-icon--success {
		background: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
		color: var(--success);
	}

	.stats-icon--warning {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.3);
		color: var(--warning);
	}

	.stats-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.stats-value {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1;
		color: var(--text-primary);
	}

	.stats-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.stats-sublabel {
		font-size: 0.75rem;
		color: var(--accent-primary);
		opacity: 0.9;
		margin-top: 0.25rem;
		font-weight: 500;
	}
</style> 