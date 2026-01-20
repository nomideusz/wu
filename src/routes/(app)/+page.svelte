<svelte:options runes={true} />

<script lang="ts">
	import '$lib/styles/tables.css';
	import '$lib/styles/dashboard.css';
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { authContext } from '$lib/auth';
	import { formatDate, formatDateTime } from '$lib/pocketbase';
	import type { DashboardData, Report, SyncStatus } from './+page';
	import { IsMounted } from 'runed';
	import { get } from 'svelte/store';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	// Import Lucide icons
	import TrendingUp from 'lucide-svelte/icons/trending-up';
	import Car from 'lucide-svelte/icons/car';
	import Truck from 'lucide-svelte/icons/truck';
	import FileText from 'lucide-svelte/icons/file-text';
	import FileCheck from 'lucide-svelte/icons/file-check';
	import Activity from 'lucide-svelte/icons/activity';
import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
import Calendar from 'lucide-svelte/icons/calendar';
import RefreshCw from 'lucide-svelte/icons/refresh-cw';

	// Recommended way to access data in SvelteKit with Svelte 5
	const { data } = $props();

	// Pre-populate with empty values to ensure immediate rendering with skeletons
	let reports = $state<Report[]>([]);
	let recentReports = $state<Report[]>([]);
	let dailyStats = $state<any[]>([]);
	let loading = $state(true);
	let statsLoading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');
	let syncInfo = $state<SyncStatus | null>(null);

	// Statistics with default values for immediate rendering
	let totalReports = $state(0);
	let finalReports = $state(0);
	let draftReports = $state(0);
	let totalDistance = $state(0);
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let car3Distance = $state(0);
	let car4Distance = $state(0);
	let totalDraftDistance = $state(0);
	let car1DraftDistance = $state(0);
	let car2DraftDistance = $state(0);
	let car3DraftDistance = $state(0);
	let car4DraftDistance = $state(0);
	let totalIndications = $state(0);
	let totalGaps = $state(0);
	let car1LisaCount = $state(0);
	let car2LisaCount = $state(0);
	let car3LisaCount = $state(0);
	let car4LisaCount = $state(0);
	let totalLisaPerKm = $state(0);
	let car1LisaPerKm = $state(0);
	let car2LisaPerKm = $state(0);
	let car3LisaPerKm = $state(0);
	let car4LisaPerKm = $state(0);
	
	// Dynamic vehicle metrics
	let vehicleMetrics = $state<any[]>([]);
	let weeklyTargetKm = $state(200);
	let dailyTargetKm = $state(40);
	let weeklyProgress = $state(0);
	let dailyProgress = $state(0);
	let timePeriod = $state('all');
	let meta = $state<DashboardData['meta']>(null);

	// Use IsMounted to safely access the context
	const isMounted = new IsMounted();
	
	// Handle time period change
	async function handleTimePeriodChange(period: string) {
		timePeriod = period;
		await reloadDashboardData(period);
	}
	
	// Reload dashboard data with time filter
	async function reloadDashboardData(period: string = 'all') {
		try {
			statsLoading = true;
			
			// Fetch data with time period filter
			const response = await fetch(`/api/v1/reports?timePeriod=${period}&finalOnly=false&includeUnitDesc=true&withSurveys=true`);
			if (!response.ok) throw new Error('Failed to fetch reports');
			
			const apiData = await response.json();
			
			// Update stats with new data
			if (apiData.stats) {
				// Calculate stats from the filtered reports data (since we're using withSurveys filter)
				totalReports = apiData.reports?.length || 0;
				finalReports = apiData.reports?.filter((report: any) => 
					report.report_final === true || 
					report.report_final === 1 || 
					report.report_final === '1'
				).length || 0;
				draftReports = totalReports - finalReports;
				totalDistance = apiData.stats.totalDistance || 0;
				car1Distance = apiData.stats.car1Distance || 0;
				car2Distance = apiData.stats.car2Distance || 0;
				car3Distance = apiData.stats.car3Distance || 0;
				car4Distance = apiData.stats.car4Distance || 0;
				totalDraftDistance = apiData.stats.totalDraftDistance || 0;
				car1DraftDistance = apiData.stats.car1DraftDistance || 0;
				car2DraftDistance = apiData.stats.car2DraftDistance || 0;
				car3DraftDistance = apiData.stats.car3DraftDistance || 0;
				car4DraftDistance = apiData.stats.car4DraftDistance || 0;
				totalIndications = apiData.stats.totalIndications || 0;
				totalGaps = apiData.stats.totalGaps || 0;
				car1LisaCount = apiData.stats.car1LisaCount || 0;
				car2LisaCount = apiData.stats.car2LisaCount || 0;
				car3LisaCount = apiData.stats.car3LisaCount || 0;
				car4LisaCount = apiData.stats.car4LisaCount || 0;
				totalLisaPerKm = apiData.stats.totalLisaPerKm || 0;
				car1LisaPerKm = apiData.stats.car1LisaPerKm || 0;
				car2LisaPerKm = apiData.stats.car2LisaPerKm || 0;
				car3LisaPerKm = apiData.stats.car3LisaPerKm || 0;
				car4LisaPerKm = apiData.stats.car4LisaPerKm || 0;
				weeklyTargetKm = apiData.stats.weeklyTargetKm || 200;
				dailyTargetKm = apiData.stats.dailyTargetKm || 40;
				weeklyProgress = apiData.stats.weeklyProgress || 0;
				dailyProgress = apiData.stats.dailyProgress || 0;
			}
			
			// Update reports data
			if (apiData.reports) {
				reports = apiData.reports;
				processDailyStats(apiData.reports);
				processVehicleMetrics(apiData.reports);
			}
			
			statsLoading = false;
		} catch (error) {
			console.error('Error reloading dashboard data:', error);
			statsLoading = false;
		}
	}
	
	// Process reports into daily statistics
	function processDailyStats(reportsData: any[]) {
		// Group reports by date
		const dateGroups = new Map<string, any[]>();
		
		reportsData.forEach((report: any) => {
			const rawDate = report.report_date;
			if (!rawDate) return;
			
			// Normalize date to YYYY-MM-DD format to ensure consistent grouping
			const date = new Date(rawDate).toISOString().split('T')[0];
			
			if (!dateGroups.has(date)) {
				dateGroups.set(date, []);
			}
			dateGroups.get(date)!.push(report);
		});
		
		// Sort dates and create daily stats
		const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
		const stats: any[] = [];
		
		let currentWeekStart: Date | null = null;
		let weeklyData = {
			totalDistance: 0,
			finalDistance: 0,
			draftDistance: 0,
			finalReports: 0,
			draftReports: 0,
			totalLisas: 0,
			totalGaps: 0,
			totalLinearAssetLength: 0,
			coveredLinearAssetLength: 0,
			vehicles: new Map() // Will store { total, final, draft } for each vehicle
		};
		
		sortedDates.forEach((date, index) => {
			const reportsForDate = dateGroups.get(date);
			if (!reportsForDate) return;
			
			const dateObj = new Date(date);
			const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
			
			// Check if we need to start a new week
			const weekStart = getWeekStart(dateObj);
			if (currentWeekStart && weekStart.getTime() !== currentWeekStart.getTime()) {
				// Add weekly summary
				if (weeklyData.totalLinearAssetLength > 0) {
					const weekStartDateStr = currentWeekStart ? currentWeekStart.toISOString().split('T')[0] : '';
					const weeklyAvgCoverage = (weeklyData.coveredLinearAssetLength / weeklyData.totalLinearAssetLength) * 100;
					stats.push({
						isWeeklySummary: true,
						weekLabel: `Week of ${formatDate(weekStartDateStr)}`,
						totalDistance: weeklyData.totalDistance,
						finalDistance: weeklyData.finalDistance,
						draftDistance: weeklyData.draftDistance,
						avgCoverage: weeklyAvgCoverage,
						finalReports: weeklyData.finalReports,
						draftReports: weeklyData.draftReports,
						totalLisas: weeklyData.totalLisas,
						totalGaps: weeklyData.totalGaps,
						vehicles: sortVehiclesByCarNumber(weeklyData.vehicles)
					});
				}
				
				// Reset weekly data
				weeklyData = {
					totalDistance: 0,
					finalDistance: 0,
					draftDistance: 0,
					finalReports: 0,
					draftReports: 0,
					totalLisas: 0,
					totalGaps: 0,
					totalLinearAssetLength: 0,
					coveredLinearAssetLength: 0,
					vehicles: new Map()
				};
			}
			currentWeekStart = weekStart;
			
			// Calculate daily statistics by aggregating all reports for this date
			let totalDistance = 0;
			let finalDistance = 0;
			let draftDistance = 0;
			let finalReports = 0;
			let draftReports = 0;
			let totalLisas = 0;
			let totalGaps = 0;
			const vehicles = new Map();
			
			let totalLinearAssetLength = 0;
			let coveredLinearAssetLength = 0;
			
			// Process all reports for this date
			reportsForDate.forEach(report => {
				const distance = Number(report.dist_mains_covered_length || 0);
				const assetLength = Number(report.dist_mains_length || 0);
				const lisas = Number(report.indicationsCount || 0);
				const gaps = Number(report.fieldOfViewGapsCount || 0);
				const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
				const vehicle = report.surveyor_unit_desc || 'Unknown';
				
				// Aggregate daily totals
				totalDistance += distance;
				if (isFinal) {
					finalDistance += distance;
					finalReports++;
					// Only use final reports for coverage calculation
					totalLinearAssetLength += assetLength;
					coveredLinearAssetLength += distance;
					// Only count LISAs and gaps from final reports
					totalLisas += lisas;
					totalGaps += gaps;
				} else {
					draftDistance += distance;
					draftReports++;
				}
				
				// Vehicle tracking - aggregate by vehicle with final/draft breakdown
				if (!vehicles.has(vehicle)) {
					vehicles.set(vehicle, { total: 0, final: 0, draft: 0 });
				}
				const vehicleData = vehicles.get(vehicle)!;
				vehicleData.total += distance;
				if (isFinal) {
					vehicleData.final += distance;
				} else {
					vehicleData.draft += distance;
				}
				
				// Weekly accumulation
				weeklyData.totalDistance += distance;
				if (isFinal) {
					weeklyData.finalDistance += distance;
					weeklyData.finalReports++;
					// Weekly coverage calculation from final reports only
					weeklyData.totalLinearAssetLength += assetLength;
					weeklyData.coveredLinearAssetLength += distance;
					// Only count LISAs and gaps from final reports
					weeklyData.totalLisas += lisas;
					weeklyData.totalGaps += gaps;
				} else {
					weeklyData.draftDistance += distance;
					weeklyData.draftReports++;
				}
				
				// Weekly vehicle tracking with final/draft breakdown
				if (!weeklyData.vehicles.has(vehicle)) {
					weeklyData.vehicles.set(vehicle, { total: 0, final: 0, draft: 0 });
				}
				const weeklyVehicleData = weeklyData.vehicles.get(vehicle)!;
				weeklyVehicleData.total += distance;
				if (isFinal) {
					weeklyVehicleData.final += distance;
				} else {
					weeklyVehicleData.draft += distance;
				}
			});
			
			// Calculate daily coverage from final reports only
			const dailyCoverage = totalLinearAssetLength > 0 ? (coveredLinearAssetLength / totalLinearAssetLength) * 100 : 0;
			
			stats.push({
				date,
				weekday,
				totalDistance,
				finalDistance,
				draftDistance,
				finalReports,
				draftReports,
				totalLisas,
				totalGaps,
				avgCoverage: dailyCoverage,
				vehicles: sortVehiclesByCarNumber(vehicles),
				isWeeklySummary: false
			});
		});
		
		// Add final weekly summary if needed
		if (currentWeekStart && (weeklyData.totalDistance > 0 || weeklyData.totalLinearAssetLength > 0)) {
			const weekStartDate = (currentWeekStart as Date).toISOString().split('T')[0];
			const finalWeeklyAvgCoverage = weeklyData.totalLinearAssetLength > 0 
				? (weeklyData.coveredLinearAssetLength / weeklyData.totalLinearAssetLength) * 100 
				: 0;
			stats.push({
				isWeeklySummary: true,
				weekLabel: `Week of ${formatDate(weekStartDate)}`,
				totalDistance: weeklyData.totalDistance,
				finalDistance: weeklyData.finalDistance,
				draftDistance: weeklyData.draftDistance,
				avgCoverage: finalWeeklyAvgCoverage,
				finalReports: weeklyData.finalReports,
				draftReports: weeklyData.draftReports,
				totalLisas: weeklyData.totalLisas,
				totalGaps: weeklyData.totalGaps,
				vehicles: sortVehiclesByCarNumber(weeklyData.vehicles)
			});
		}
		
		dailyStats = stats;
	}
	
	// Process overall vehicle metrics from all reports
	function processVehicleMetrics(reportsData: any[]) {
		const vehiclesObj = new Map<string, { total: number, final: number, draft: number }>();
		
		reportsData.forEach((report: any) => {
			const distance = Number(report.dist_mains_covered_length || 0);
			const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
			const rawName = report.surveyor_unit_desc || 'Unknown';
			
			// Normalize name immediately
			const match = rawName.match(/#(\d+)/);
			const vehicleName = match ? `Vehicle #${match[1]}` : rawName;
			
			if (!vehiclesObj.has(vehicleName)) {
				vehiclesObj.set(vehicleName, { total: 0, final: 0, draft: 0 });
			}
			
			const data = vehiclesObj.get(vehicleName)!;
			data.total += distance;
			
			if (isFinal) {
				data.final += distance;
			} else {
				data.draft += distance;
			}
		});
		
		// Sort by vehicle number and filter out empty ones
		vehicleMetrics = Array.from(vehiclesObj.entries())
			.sort(([nameA], [nameB]) => {
				const carNumberA = parseInt(nameA.replace(/.*#(\d+).*/, '$1')) || 999;
				const carNumberB = parseInt(nameB.replace(/.*#(\d+).*/, '$1')) || 999;
				return carNumberA - carNumberB;
			})
			.map(([name, data]) => ({
				name,
				total: data.total,
				final: data.final,
				draft: data.draft
			}))
			.filter(v => v.total > 0 || v.final > 0 || v.draft > 0);
	}
	
	// Helper function to get week start (Monday 12:00 UTC)
	function getWeekStart(date: Date): Date {
		const currentUtc = new Date(date);
		const result = new Date(currentUtc);
		
		// Get day of week (0 = Sunday, 1 = Monday, etc.)
		const dayOfWeek = result.getUTCDay();
		
		// Calculate days to go back to reach Monday
		const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		
		// Go back to Monday of current week
		result.setUTCDate(result.getUTCDate() - daysToMonday);
		result.setUTCHours(12, 0, 0, 0); // Set to 12:00 UTC
		
		// If we're currently before Monday 12:00 UTC of this week, 
		// we need to go back to the previous Monday
		if (currentUtc < result) {
			result.setUTCDate(result.getUTCDate() - 7);
		}
		
		return result;
	}

	// Helper function to sort vehicles by car number
	function sortVehiclesByCarNumber(vehicles: Map<string, any>) {
		return Array.from(vehicles.entries())
			.sort(([nameA], [nameB]) => {
				// Extract car number from vehicle name (e.g., "Vehicle #1" -> 1)
				const carNumberA = parseInt(nameA.replace(/.*#(\d+).*/, '$1')) || 999;
				const carNumberB = parseInt(nameB.replace(/.*#(\d+).*/, '$1')) || 999;
				return carNumberA - carNumberB;
			})
			.map(([name, data]) => {
				// Normalize name to "Vehicle #N" for display if it contains a number
				const match = name.match(/#(\d+)/);
				const displayName = match ? `Vehicle #${match[1]}` : name;
				
				return {
					name: displayName,
					total: data.total,
					final: data.final,
					draft: data.draft
				};
			});
	}

	// Debug logging using a function to capture current state values
	function logData() {
		console.log('Frontend received data:', {
			reports: reports.length,
			recentReports: recentReports.length,
			stats: {
				totalReports,
				finalReports,
				draftReports,
				totalDistance,
				totalDraftDistance,
				car1Distance,
				car1DraftDistance,
				car2Distance,
				car2DraftDistance,
				car3Distance,
				car3DraftDistance,
				car4Distance,
				car4DraftDistance
			},
			syncInfo,
			error,
			loading,
			statsLoading,
			reportsLoading
		});

		// Use try/catch to safely access context that might not be ready
		if (isMounted.current) {
			try {
				// Get the auth store from context
				const authStore = authContext.getOr(null);

				if (authStore) {
					// Get a snapshot of the current store value
					const authValue = get(authStore);
					console.log('Auth context accessed:', authValue.isAuthenticated, authValue.state);
				} else {
					console.log('Auth context not available');
				}
			} catch (err) {
				console.log('Auth context not ready yet');
			}
		}
	}

	// When component mounts
	onMount(() => {
		// Give the layout component time to initialize the context first
		setTimeout(() => {
			logData();
		}, 10);
	});

	// Process dashboardData when available
	$effect(() => {
		if (data.dashboardData) {
			// Use a promise to handle the data when it resolves
			data.dashboardData
				.then((dashData) => {
					// Set reports data
					reports = dashData.reports || [];
					recentReports = dashData.recentReports || [];
					processDailyStats(dashData.reports || []);
					processVehicleMetrics(dashData.reports || []);
					reportsLoading = false;

					// Set stats data - calculate from filtered reports data
					if (dashData.stats) {
						// Calculate stats from the filtered reports data (since server uses withSurveys filter)
						totalReports = dashData.reports?.length || 0;
						finalReports = dashData.reports?.filter((report: any) => 
							report.report_final === true || 
							report.report_final === 1 || 
							report.report_final === '1'
						).length || 0;
						draftReports = totalReports - finalReports;
						totalDistance = dashData.stats.totalDistance || 0;
						car1Distance = dashData.stats.car1Distance || 0;
						car2Distance = dashData.stats.car2Distance || 0;
						car3Distance = dashData.stats.car3Distance || 0;
						car4Distance = dashData.stats.car4Distance || 0;
						totalDraftDistance = dashData.stats.totalDraftDistance || 0;
						car1DraftDistance = dashData.stats.car1DraftDistance || 0;
						car2DraftDistance = dashData.stats.car2DraftDistance || 0;
						car3DraftDistance = dashData.stats.car3DraftDistance || 0;
						car4DraftDistance = dashData.stats.car4DraftDistance || 0;
						totalIndications = dashData.stats.totalIndications || 0;
						totalGaps = dashData.stats.totalGaps || 0;
						car1LisaCount = dashData.stats.car1LisaCount || 0;
						car2LisaCount = dashData.stats.car2LisaCount || 0;
						car3LisaCount = dashData.stats.car3LisaCount || 0;
						car4LisaCount = dashData.stats.car4LisaCount || 0;
						totalLisaPerKm = dashData.stats.totalLisaPerKm || 0;
						car1LisaPerKm = dashData.stats.car1LisaPerKm || 0;
						car2LisaPerKm = dashData.stats.car2LisaPerKm || 0;
						car3LisaPerKm = dashData.stats.car3LisaPerKm || 0;
						car4LisaPerKm = dashData.stats.car4LisaPerKm || 0;
						// These fields might not exist on initial load from server
						weeklyTargetKm = (dashData.stats as any).weeklyTargetKm || 200;
						dailyTargetKm = (dashData.stats as any).dailyTargetKm || 40;
						weeklyProgress = (dashData.stats as any).weeklyProgress || 0;
						dailyProgress = (dashData.stats as any).dailyProgress || 0;
						timePeriod = (dashData.stats as any).timePeriod || 'all';
						statsLoading = false;
					}

					// Set meta data
					meta = dashData.meta;

					// Set error if any
					if (dashData.error) {
						error = dashData.error;
					}

					// Log successful data processing
					console.log('Dashboard data processed:', {
						reportCount: reports.length,
						statsLoaded: !statsLoading
					});
				})
				.catch((err) => {
					// Handle any errors during promise resolution
					console.error('Error processing dashboard data:', err);
					error = err.message || 'Failed to load dashboard data';
					reportsLoading = false;
					statsLoading = false;
				});
		}
	});

	// Process syncData when available
	$effect(() => {
		if (data.syncData) {
			data.syncData
				.then((syncData) => {
					// Set sync info
					syncInfo = syncData.syncInfo;

					// Set error if any
					if (syncData.syncError) {
						error = error || syncData.syncError;
					}

					console.log('Sync data processed:', syncInfo);
				})
				.catch((err) => {
					console.error('Error processing sync data:', err);
					error = error || err.message || 'Failed to load sync data';
				});
		}
	});

	// Update overall loading state based on component loading states
	$effect(() => {
		loading = statsLoading || reportsLoading;
	});
</script>

<style>
	.dashboard__metrics-section {
		margin-bottom: 2rem;
	}

	.dashboard__metrics-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.dashboard__metrics--combined {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
	}

	.dashboard__metrics--reports {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.dashboard__metrics--vehicles,
		.dashboard__metrics--survey,
		.dashboard__metrics--reports {
			grid-template-columns: 1fr;
		}
	}
	
	/* Time Information Styles */
	.time-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding: 0.5rem 1rem;
		background: rgba(var(--accent-primary-rgb), 0.05);
		border: 1px solid rgba(var(--accent-primary-rgb), 0.15);
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}
	
	.time-info__icon {
		font-size: 1rem;
		opacity: 0.8;
	}
	
	.time-info__text {
		line-height: 1.4;
	}
	
	/* Daily breakdown specific styling */
	.time-info--daily-breakdown {
		margin-top: 0;
		margin-bottom: 1rem;
		background: rgba(var(--info-rgb, 59, 130, 246), 0.05);
		border-color: rgba(var(--info-rgb, 59, 130, 246), 0.15);
	}
</style>

<PageTemplate 
	title={t('dashboard.overview', $language)}
	subtitle={t('dashboard.welcomeMessage', $language)}
	fullWidth={true}
>
	{#snippet pageActions()}
		<a href="/reports" class="button button--primary">
			<FileText size={18} />
			{t('dashboard.viewAllReports', $language)}
		</a>
		{#if syncInfo}
			<div class="sync-info">
				<RefreshCw size={16} class="sync-info__icon" />
				<span class="sync-info__text">
					{t('dashboard.lastSynced', $language)}: {syncInfo.last_sync
						? formatDateTime(syncInfo.last_sync)
						: syncInfo.last_sync_success
							? formatDateTime(syncInfo.last_sync_success)
							: 'Never'}
				</span>
				<span class="sync-info__status sync-info__status--{syncInfo.sync_status || 'pending'}">
					{syncInfo.sync_status || 'Unknown'}
				</span>
			</div>
		{/if}
	{/snippet}
	
	{#snippet content()}
		<div class="dashboard">
			<!-- Key Metrics Section with Time Period Filter -->
			<div class="dashboard__section">
				<!-- Time Period Selector -->
				<div class="dashboard__time-selector">
					<button class="time-selector__button {timePeriod === 'today' ? 'time-selector__button--active' : ''}" onclick={() => handleTimePeriodChange('today')}>
						Today
					</button>
					<button class="time-selector__button {timePeriod === 'week' ? 'time-selector__button--active' : ''}" onclick={() => handleTimePeriodChange('week')}>
						This Week
					</button>
					<button class="time-selector__button {timePeriod === 'month' ? 'time-selector__button--active' : ''}" onclick={() => handleTimePeriodChange('month')}>
						This Month
					</button>
					<button class="time-selector__button {timePeriod === 'all' ? 'time-selector__button--active' : ''}" onclick={() => handleTimePeriodChange('all')}>
						All Time
					</button>
				</div>
				
				<!-- Weekly Statistics Information -->
				{#if timePeriod === 'week'}
					<div class="time-info">
						<span class="time-info__icon">ℹ️</span>
						<span class="time-info__text">Weekly statistics reset every Monday at 12:00 UTC</span>
					</div>
				{/if}

				<!-- Primary Metric - Final Distance -->
				<div class="dashboard__primary-metric">
					<div class="primary-metric-card {statsLoading ? 'metric-card--loading' : ''}">
						<div class="primary-metric-card__header">
							<h2 class="primary-metric-card__title">Final Distance Covered</h2>
							<p class="primary-metric-card__subtitle">
								{#if timePeriod === 'today'}
									Today's Progress
								{:else if timePeriod === 'week'}
									This Week's Progress
								{:else if timePeriod === 'month'}
									This Month's Progress
								{:else}
									Total Progress
								{/if}
							</p>
						</div>
						<div class="primary-metric-card__content">
							{#if statsLoading}
								<div class="skeleton-text skeleton-text--xxlarge"></div>
							{:else}
								<div class="primary-metric-card__value">
									{totalDistance.toFixed(1)}
									<span class="primary-metric-card__unit">km</span>
								</div>
								{#if timePeriod === 'week' && weeklyTargetKm}
									<div class="progress-bar">
										<div class="progress-bar__fill" style="width: {Math.min(weeklyProgress, 100)}%"></div>
									</div>
									<div class="primary-metric-card__target">
										<span>{weeklyProgress.toFixed(0)}% of weekly target ({weeklyTargetKm} km)</span>
									</div>
								{:else if timePeriod === 'today' && dailyTargetKm}
									<div class="progress-bar">
										<div class="progress-bar__fill" style="width: {Math.min(dailyProgress, 100)}%"></div>
									</div>
									<div class="primary-metric-card__target">
										<span>{dailyProgress.toFixed(0)}% of daily target ({dailyTargetKm} km)</span>
									</div>
								{/if}
								<div class="primary-metric-card__draft">
									+ {totalDraftDistance.toFixed(1)} km in draft
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Performance & Findings Section -->
				<div class="dashboard__metrics-section">
					<h3 class="dashboard__metrics-title">
						<Activity size={18} />
						Performance & Findings
					</h3>
					<div class="dashboard__metrics dashboard__metrics--combined">
						<!-- Vehicle Cards -->
						{#if vehicleMetrics.length > 0}
							{#each vehicleMetrics as vehicle}
								<div class="metric-card {statsLoading ? 'metric-card--loading' : ''}">
									<div class="metric-card__header">
										<span class="metric-card__label">{vehicle.name}</span>
										<div class="metric-card__icon">
											<Car size={24} />
										</div>
									</div>
									
									<div class="metric-card__content">
										{#if statsLoading}
											<div class="skeleton-text skeleton-text--large"></div>
										{:else}
											<div class="metric-card__value">
												{vehicle.final.toFixed(1)}
												<span class="metric-card__unit">km</span>
											</div>
											<div class="metric-card__sub">
												+ {vehicle.draft.toFixed(1)} km in draft
											</div>
										{/if}
									</div>
								</div>
							{/each}
						{:else if !statsLoading}
							<div class="metric-card">
								<div class="metric-card__content">
									<div class="metric-card__value" style="font-size: 1.5rem; color: var(--text-secondary);">
										No vehicles found
									</div>
									<span class="metric-card__label">Check reports data</span>
								</div>
							</div>
						{/if}

						<!-- LISA Card -->
						<div class="metric-card {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__header">
								<span class="metric-card__label">LISA Indications</span>
								<div class="metric-card__icon metric-card__icon--success">
									<Activity size={24} />
								</div>
							</div>
							<div class="metric-card__content">
								{#if statsLoading}
									<div class="skeleton-text skeleton-text--large"></div>
								{:else}
									<div class="metric-card__value">
										{totalIndications}
									</div>
									<div class="metric-card__sub">
										{totalLisaPerKm.toFixed(2)} / km
									</div>
								{/if}
							</div>
						</div>

						<!-- Gaps Card -->
						<div class="metric-card {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__header">
								<span class="metric-card__label">Field of View Gaps</span>
								<div class="metric-card__icon metric-card__icon--warning">
									<AlertTriangle size={24} />
								</div>
							</div>
							<div class="metric-card__content">
								{#if statsLoading}
									<div class="skeleton-text skeleton-text--large"></div>
								{:else}
									<div class="metric-card__value">
										{totalGaps}
									</div>
									<div class="metric-card__sub">
										Detected gaps
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
				
				<!-- Report Status Section -->
				<div class="dashboard__metrics-section">
					<h3 class="dashboard__metrics-title">
						<FileText size={18} />
						Report Status
					</h3>
					<div class="dashboard__metrics dashboard__metrics--reports">
						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--success">
								<FileCheck size={20} />
							</div>
							<div class="metric-card__content">
								<span class="metric-card__label">{t('dashboard.finalReports', $language)}</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}
										<div class="skeleton-text"></div>
									{:else}
										{finalReports}
									{/if}
								</div>
							</div>
						</div>

						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--warning">
								<FileText size={20} />
							</div>
							<div class="metric-card__content">
								<span class="metric-card__label">{t('dashboard.draftReports', $language)}</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}
										<div class="skeleton-text"></div>
									{:else}
										{draftReports}
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Daily Progress Section -->
			<div class="dashboard__reports">
				<div class="dashboard__reports-header">
					<h2 class="dashboard__section-title">
						<Calendar size={20} />
						Daily Progress Breakdown
					</h2>
					<a href="/reports" class="dashboard__view-all">
						View All Reports →
					</a>
				</div>
				
				<!-- Weekly Grouping Information -->
				<div class="time-info time-info--daily-breakdown">
					<span class="time-info__icon">ℹ️</span>
					<span class="time-info__text">Weekly groupings start every Monday at 12:00 UTC</span>
				</div>
				
				<div class="dashboard__reports-content">
					{#if loading}
						<div class="loading-container">
							<div class="loading-indicator">
								<div class="loading-bar"></div>
								<div class="loading-bar"></div>
								<div class="loading-bar"></div>
							</div>
							<p class="loading-text">Loading daily statistics...</p>
						</div>
					{:else if error}
						<div class="error-container">
							<p class="error">{error}</p>
						</div>
					{:else}
						<div class="daily-stats-table">
							<table class="daily-stats-table__element">
								<thead>
									<tr>
										<th class="daily-stats-table__header">Date</th>
										<th class="daily-stats-table__header">Distance (km)</th>
										<th class="daily-stats-table__header">Coverage (%)</th>
										<th class="daily-stats-table__header">Final Reports</th>
										<th class="daily-stats-table__header">Draft Reports</th>
										<th class="daily-stats-table__header">LISA Count</th>
										<th class="daily-stats-table__header">Gaps</th>
										<th class="daily-stats-table__header">Vehicles</th>
									</tr>
								</thead>
								<tbody>
									{#if reportsLoading}
										{#each Array(7) as _, i}
											<tr class="daily-stats-table__row daily-stats-table__row--loading">
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
												<td class="daily-stats-table__cell"><div class="skeleton-text"></div></td>
											</tr>
										{/each}
									{:else if dailyStats.length > 0}
										{#each dailyStats as stat}
											{#if stat.isWeeklySummary}
												<tr class="daily-stats-table__row daily-stats-table__row--weekly-summary">
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.weekLabel}</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.totalDistance.toFixed(1)} km</strong>
														<div class="daily-stats-table__breakdown">
															<span class="breakdown-final">{stat.finalDistance.toFixed(1)} final</span>
															<span class="breakdown-draft">{stat.draftDistance.toFixed(1)} draft</span>
														</div>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.avgCoverage.toFixed(1)}%</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.finalReports}</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.draftReports}</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.totalLisas}</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<strong>{stat.totalGaps}</strong>
													</td>
													<td class="daily-stats-table__cell daily-stats-table__cell--summary">
														<div class="vehicles-list">
															{#each stat.vehicles as vehicle}
																<div class="vehicle-badge vehicle-badge--summary">
																	<div class="vehicle-badge__header">{vehicle.name}: {vehicle.total.toFixed(1)}km</div>
																	{#if vehicle.final > 0 || vehicle.draft > 0}
																		<div class="vehicle-badge__breakdown">
																			<span class="breakdown-final">{vehicle.final.toFixed(1)} final</span>
																			<span class="breakdown-draft">{vehicle.draft.toFixed(1)} draft</span>
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													</td>
												</tr>
											{:else}
												<tr class="daily-stats-table__row">
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__date">
															{formatDate(stat.date)}
														</span>
														<span class="daily-stats-table__weekday">
															{stat.weekday}
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__metric">
															{stat.totalDistance.toFixed(1)}
														</span>
														{#if stat.finalDistance !== stat.totalDistance}
															<div class="daily-stats-table__breakdown">
																<span class="breakdown-final">{stat.finalDistance.toFixed(1)} final</span>
																<span class="breakdown-draft">{stat.draftDistance.toFixed(1)} draft</span>
															</div>
														{/if}
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__metric daily-stats-table__metric--{stat.avgCoverage >= 80 ? 'good' : stat.avgCoverage >= 60 ? 'medium' : 'low'}">
															{stat.avgCoverage.toFixed(1)}%
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__count daily-stats-table__count--final">
															{stat.finalReports}
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__count daily-stats-table__count--draft">
															{stat.draftReports}
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__metric">
															{stat.totalLisas}
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<span class="daily-stats-table__metric">
															{stat.totalGaps}
														</span>
													</td>
													<td class="daily-stats-table__cell">
														<div class="vehicles-list">
															{#each stat.vehicles as vehicle}
																<div class="vehicle-badge">
																	<div class="vehicle-badge__header">{vehicle.name}: {vehicle.total.toFixed(1)}km</div>
																	{#if vehicle.final > 0 || vehicle.draft > 0}
																		<div class="vehicle-badge__breakdown">
																			<span class="breakdown-final">{vehicle.final.toFixed(1)} final</span>
																			<span class="breakdown-draft">{vehicle.draft.toFixed(1)} draft</span>
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													</td>
												</tr>
											{/if}
										{/each}
									{:else}
										<tr class="daily-stats-table__row">
											<td class="daily-stats-table__cell daily-stats-table__cell--empty" colspan="8">
												No data available for the selected period
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/snippet}
</PageTemplate>
