<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { reportsApi, formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { ChevronUp, ChevronDown, ChevronRight, AlertTriangle, Download, RefreshCw, Activity, TrendingUp } from 'lucide-svelte';
	import LisaModal from '$lib/components/LisaModal.svelte';
	import ReportsStatsCard from '$lib/components/ReportsStatsCard.svelte';
	import ExportControls from '$lib/components/ExportControls.svelte';
	import ReportsFilters from '$lib/components/ReportsFilters.svelte';

	// Define Report interface based on the API response
	interface Report {
		id: string;
		report_name: string;
		report_title: string;
		report_date: string;
		dist_mains_length: number;
		dist_mains_covered_length: number;
		dist_mains_coverage: number;
		surveyor_unit_desc?: string;
		report_final: boolean | number | string;
		indicationsCount?: number;
		fieldOfViewGapsCount?: number;
		driving_sessions?: any[];
		total_duration_seconds?: number;
		formatted_duration?: string;
		total_distance_km?: string;
		expand?: {
			driving_sessions?: any[];
			indications_via_report?: any[];
		};
		[key: string]: any; // Allow other properties
	}

	// Stats and sync info
	let finalReports = $state(0);
	let totalReports = $state(0);
	let draftReports = $state(0);
	let finalAndDraftReports = $state(0);
	let totalLISAs = $state(0);
	let totalGaps = $state(0);
	let syncInfo = $state<any>(null);
	
	// Car data (distances only)
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let car3Distance = $state(0);
	let car4Distance = $state(0);
	
	let reports = $state<Report[]>([]);
	let displayedReports = $state<Report[]>([]);
	let loading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');
	let meta = $state({ page: 1, totalPages: 0, totalItems: 0, perPage: 0 });
	let tableContainer = $state<HTMLElement>();

	// Sorting state
	let sortColumn = $state('report_date');
	let sortDirection = $state('desc'); // 'asc' or 'desc'

	// Filter state
	let reportFilter = $state('final'); // 'final', 'all', 'draft' - default to final reports only
	let searchQuery = $state(''); // Search query
	let includeSurveysOnly = $state(true); // Show reports with surveys by default
	
	// Accordion state - track which reports are expanded
	let expandedReports = $state<Set<string>>(new Set());
	
	// Selection state - track which reports are selected for export
	let selectedReports = $state<Set<string>>(new Set());



	// LISA modal state
	let showLisaModal = $state(false);
	let currentLisaReport = $state<any>(null);

	// Function to toggle report expansion
	function toggleReportExpansion(reportId: string) {
		const newSet = new Set(expandedReports);
		if (newSet.has(reportId)) {
			newSet.delete(reportId);
		} else {
			newSet.add(reportId);
		}
		expandedReports = newSet;
	}

	// Selection functions
	function toggleReportSelection(reportId: string) {
		const newSet = new Set(selectedReports);
		if (newSet.has(reportId)) {
			newSet.delete(reportId);
		} else {
			newSet.add(reportId);
		}
		selectedReports = newSet;
	}

	function selectAllReports() {
		selectedReports = new Set(displayedReports.map(r => r.id));
	}

	function clearAllSelections() {
		selectedReports = new Set();
	}

	// State for copy feedback
	let copiedItems = $state(new Set());

	// Copy text to clipboard
	async function copyToClipboard(text: string, type: string, itemId: string) {
		try {
			await navigator.clipboard.writeText(text);
			console.log(`${type} copied to clipboard:`, text);
			
			// Show success feedback
			copiedItems.add(itemId);
			copiedItems = new Set(copiedItems); // Trigger reactivity
			
			// Remove feedback after 1.5 seconds
			setTimeout(() => {
				copiedItems.delete(itemId);
				copiedItems = new Set(copiedItems); // Trigger reactivity
			}, 1500);
		} catch (err) {
			console.error('Failed to copy text: ', err);
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			try {
				document.execCommand('copy');
				console.log(`${type} copied to clipboard (fallback):`, text);
				
				// Show success feedback for fallback too
				copiedItems.add(itemId);
				copiedItems = new Set(copiedItems);
				setTimeout(() => {
					copiedItems.delete(itemId);
					copiedItems = new Set(copiedItems);
				}, 1500);
			} catch (fallbackErr) {
				console.error('Fallback copy failed: ', fallbackErr);
			}
			document.body.removeChild(textArea);
		}
	}

	// Check if all displayed reports are selected
	const allReportsSelected = $derived(() => {
		return displayedReports.length > 0 && displayedReports.every(r => selectedReports.has(r.id));
	});

	// Get selected reports data
	const selectedReportsData = $derived(() => {
		return displayedReports.filter(r => selectedReports.has(r.id));
	});

	// Helper function to determine if a report is deletable
	function isReportDeletable(report: Report): { isDeletable: boolean; reason: string } {
		const reportTitle = report.report_title || '';
		const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
		const isDraft = report.report_final === false || report.report_final === 0 || report.report_final === '0' || !report.report_final;
		
		// Check for exact title duplicates with conflicting final/draft states
		const hasExactDuplicate = reports.some(otherReport => 
			otherReport.id !== report.id && 
			otherReport.report_title === reportTitle &&
			reportTitle.trim() !== '' && // Don't match empty titles
			((isFinal && (otherReport.report_final === false || otherReport.report_final === 0 || otherReport.report_final === '0' || !otherReport.report_final)) ||
			 (isDraft && (otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1')))
		);
		
		if (hasExactDuplicate) {
			return { isDeletable: true, reason: 'Duplicate title with conflicting status' };
		}
		
		// Check for temporary reports
		const tempPatterns = [
			/\s+Temp\s*$/i,           // " Temp"
			/\s+Temp\s+\d+S\s*$/i,    // " Temp 1S", " Temp 2S", etc.
			/\s+Temp\d+\s*$/i,        // " Temp1", " Temp2", etc.
			/\s+TEMP\s*$/i,           // " TEMP" (uppercase)
			/\s+TEMP\s+\d+S\s*$/i,    // " TEMP 1S", " TEMP 2S", etc.
		];
		
		const isTempReport = tempPatterns.some(pattern => pattern.test(reportTitle));
		
		if (isTempReport) {
			// Extract base title
			let baseTitle = reportTitle;
			for (const pattern of tempPatterns) {
				if (pattern.test(reportTitle)) {
					baseTitle = reportTitle.replace(pattern, '').trim();
					break;
				}
			}
			
			// Check if there's a corresponding final report
			const hasFinalVersion = reports.some(otherReport => {
				const otherIsFinal = otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1';
				if (!otherIsFinal) return false;
				
				return otherReport.id !== report.id && (
					otherReport.report_title === baseTitle || // Exact match
					otherReport.report_title === baseTitle + " Final" // Match with " Final" suffix
				);
			});
			
			if (hasFinalVersion) {
				return { isDeletable: true, reason: 'Temp report with final version available' };
			}
			
			// Check if this is an older temporary report
			const tempReportGroups = new Map();
			reports.forEach(r => {
				const rTitle = r.report_title || '';
				const isTemp = tempPatterns.some(pattern => pattern.test(rTitle));
				
				if (isTemp) {
					let rBaseTitle = rTitle;
					for (const pattern of tempPatterns) {
						if (pattern.test(rTitle)) {
							rBaseTitle = rTitle.replace(pattern, '').trim();
							break;
						}
					}
					
					if (!tempReportGroups.has(rBaseTitle)) {
						tempReportGroups.set(rBaseTitle, []);
					}
					tempReportGroups.get(rBaseTitle).push(r);
				}
			});
			
			const tempGroup = tempReportGroups.get(baseTitle);
			if (tempGroup && tempGroup.length > 1) {
				// Sort by date (newest first)
				tempGroup.sort((a: Report, b: Report) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
				const reportIndex = tempGroup.findIndex((r: Report) => r.id === report.id);
				if (reportIndex > 0) {
					return { isDeletable: true, reason: `Older temp report (${reportIndex + 1} of ${tempGroup.length})` };
				}
			}
		}
		
		return { isDeletable: false, reason: '' };
	}

	// Function to open LISA modal
	function openLisaModal(report: any) {
		currentLisaReport = report;
		showLisaModal = true;
	}

	// Function to close LISA modal
	function closeLisaModal() {
		showLisaModal = false;
		currentLisaReport = null;
	}



	// Function to force scrollbar refresh - modified to be more reliable
	async function refreshScrollbars() {
		// Wait for DOM update
		await tick();
		
		// More reliable scrollbar handling
		if (tableContainer) {
			// Get the actual table width
			const tableElement = tableContainer.querySelector('.table__element');
			const tableWidth = tableElement?.getBoundingClientRect().width || 0;
			const containerWidth = tableContainer.getBoundingClientRect().width;
			
			// If table is wider than container, ensure horizontal scrolling is enabled
			if (tableWidth > containerWidth) {
				tableContainer.style.overflowX = 'auto';
				
				// Force a reflow to ensure scrollbars appear
				/* eslint-disable no-unused-expressions */
				tableContainer.scrollLeft;
				tableContainer.scrollLeft = 0;
			}
		}
		
		// Schedule another refresh after a short delay to catch any delayed rendering
		setTimeout(() => {
			if (tableContainer) {
				const tableElement = tableContainer.querySelector('.table__element');
				if (tableElement) {
					// Force a reflow again to ensure scrollbars appear
					/* eslint-disable no-unused-expressions */
					tableContainer.scrollLeft;
					tableContainer.scrollLeft = 0;
				}
			}
		}, 100);
	}

	// Sort the reports based on current sort column and direction
	function sortReports() {
		// Filter reports based on the toggle state and search query
		let filteredReports = [...reports];
		
		// Filter by draft/final status
		if (reportFilter === 'final') {
			// Only show final reports
			filteredReports = filteredReports.filter(report => 
				report.report_final === true || 
				report.report_final === 1 || 
				report.report_final === '1'
			);
		} else if (reportFilter === 'draft') {
			// Only show draft reports
			filteredReports = filteredReports.filter(report => 
				report.report_final === false || 
				report.report_final === 0 || 
				report.report_final === '0' ||
				!report.report_final
			);
		} else if (reportFilter === 'final-and-draft') {
			// Show reports that are potentially deletable:
			// 1. Reports with conflicting final/draft states (exact name duplicates)
			// 2. Temporary reports (with "Temp", "Temp 1S", etc.) that have corresponding final versions
			// 3. Older temporary reports when there are multiple temp reports for the same base title
			// console.log('DEBUG: Filtering for deletable reports. Total reports:', reports.length);
			
			// Pre-process: Group temporary reports by base title to find duplicates
			const tempPatterns = [
				/\s+Temp\s*$/i,           // " Temp"
				/\s+Temp\s+\d+S\s*$/i,    // " Temp 1S", " Temp 2S", etc.
				/\s+Temp\d+\s*$/i,        // " Temp1", " Temp2", etc.
				/\s+TEMP\s*$/i,           // " TEMP" (uppercase)
				/\s+TEMP\s+\d+S\s*$/i,    // " TEMP 1S", " TEMP 2S", etc.
			];
			
			const tempReportGroups = new Map();
			reports.forEach(report => {
				const reportTitle = report.report_title || '';
				const isTempReport = tempPatterns.some(pattern => pattern.test(reportTitle));
				
				if (isTempReport) {
					let baseTitle = reportTitle;
					for (const pattern of tempPatterns) {
						if (pattern.test(reportTitle)) {
							baseTitle = reportTitle.replace(pattern, '').trim();
							break;
						}
					}
					
					if (!tempReportGroups.has(baseTitle)) {
						tempReportGroups.set(baseTitle, []);
					}
					tempReportGroups.get(baseTitle).push(report);
				}
			});
			
			// Sort each group by date (newest first) to identify older reports for deletion
			tempReportGroups.forEach((reportsInGroup, baseTitle) => {
				if (reportsInGroup.length > 1) {
					reportsInGroup.sort((a: Report, b: Report) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
					// console.log(`DEBUG: Found ${reportsInGroup.length} temp reports for "${baseTitle}":`, 
					//	reportsInGroup.map((r: Report) => `"${r.report_title}" (${r.report_date})`));
				}
			});
			
			filteredReports = filteredReports.filter(report => {
				const reportName = report.report_name || '';
				const reportTitle = report.report_title || '';
				const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
				const isDraft = report.report_final === false || report.report_final === 0 || report.report_final === '0' || !report.report_final;
				
				// Check for exact title duplicates with conflicting final/draft states (using report_title)
				const hasExactDuplicate = reports.some(otherReport => 
					otherReport.id !== report.id && 
					otherReport.report_title === reportTitle &&
					reportTitle.trim() !== '' && // Don't match empty titles
					((isFinal && (otherReport.report_final === false || otherReport.report_final === 0 || otherReport.report_final === '0' || !otherReport.report_final)) ||
					 (isDraft && (otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1')))
				);
				
				// Check for temporary reports that can be deleted (using report_title for long descriptive names)
				const isTempReport = tempPatterns.some(pattern => pattern.test(reportTitle));
				
				let hasFinalVersion = false;
				let isOlderTempReport = false;
				
				if (isTempReport) {
					// Try multiple patterns to extract base title
					let baseTitle = reportTitle;
					for (const pattern of tempPatterns) {
						if (pattern.test(reportTitle)) {
							baseTitle = reportTitle.replace(pattern, '').trim();
							break;
						}
					}
					
					// Check if there's a final report with the base title
					// Final reports might have " Final" suffix, so check both base title and base title + " Final"
					hasFinalVersion = reports.some(otherReport => {
						const otherIsFinal = otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1';
						if (!otherIsFinal) return false;
						
						const match = otherReport.id !== report.id && (
							otherReport.report_title === baseTitle || // Exact match
							otherReport.report_title === baseTitle + " Final" // Match with " Final" suffix
						);
						
						return match;
					});
					
					// Check if this is an older temporary report (when there are multiple temp reports for same base title)
					const tempGroup = tempReportGroups.get(baseTitle);
					if (tempGroup && tempGroup.length > 1) {
						// If this report is not the newest (index > 0 in sorted array), it's deletable
						const reportIndex = tempGroup.findIndex((r: Report) => r.id === report.id);
						isOlderTempReport = reportIndex > 0; // Keep only the newest (index 0)
					}
				}
				
				const isDeleteable = hasExactDuplicate || (isTempReport && hasFinalVersion) || isOlderTempReport;
				
				return isDeleteable;
			});
		}
		// If reportFilter === 'all', show all reports (no filtering needed)
		
		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filteredReports = filteredReports.filter(report => 
				report.report_name?.toLowerCase().includes(query) ||
				report.report_title?.toLowerCase().includes(query) ||
				report.surveyor_unit_desc?.toLowerCase().includes(query) ||
				report.report_date?.toLowerCase().includes(query)
			);
		}
		
		displayedReports = filteredReports.sort((a, b) => {
			let valueA = a[sortColumn];
			let valueB = b[sortColumn];

			// Special case for formatting dates for comparison
			if (sortColumn === 'report_date') {
				valueA = new Date(valueA).getTime();
				valueB = new Date(valueB).getTime();
			}
			
			// Special case for numeric fields
			if (sortColumn === 'dist_mains_length' || 
                sortColumn === 'dist_mains_covered_length' || 
                sortColumn === 'dist_mains_coverage' ||
                sortColumn === 'indicationsCount' || 
                sortColumn === 'fieldOfViewGapsCount' ||
                sortColumn === 'total_duration_seconds' ||
                sortColumn === 'total_distance_km') {
				valueA = Number(valueA) || 0;
				valueB = Number(valueB) || 0;
			}

			// Handle boolean/number/string report_final field
			if (sortColumn === 'report_final') {
				valueA = Boolean(valueA) ? 1 : 0;
				valueB = Boolean(valueB) ? 1 : 0;
			}

			// Handle comparison based on sort direction
			if (sortDirection === 'asc') {
				return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
			} else {
				return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
			}
		});
		
		// Refresh scrollbars after sorting
		refreshScrollbars();
	}

	// Handle column header click to change sort
	function handleSort(column: string) {		
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New column, default to descending for dates, ascending for others
			sortColumn = column;
			sortDirection = column === 'report_date' ? 'desc' : 'asc';
		}
		sortReports();
	}

	// Export functionality
	async function exportToExcel() {
		try {
			// Dynamically import the xlsx library
			const XLSX = await import('xlsx');
			
			// Use selected reports if any are selected, otherwise use all displayed reports
			const reportsToExport = selectedReports.size > 0 ? selectedReportsData() : displayedReports;
			
			// Sort reports by report title (1st column) before exporting
			const sortedReports = [...reportsToExport].sort((a, b) => {
				const titleA = (a.report_title || '').toLowerCase();
				const titleB = (b.report_title || '').toLowerCase();
				return titleA.localeCompare(titleB);
			});

			// Prepare data for export (using sorted reports) - matching table column order
			const exportData = sortedReports.map(report => ({
				'Report Date': report.report_date ? formatDate(report.report_date) : '',
				'Report Title': report.report_title || '',
				'Report Name': report.report_name || '',
				'Total Assets': report.dist_mains_length ? Number(report.dist_mains_length).toFixed(2) : '',
				'Coverage %': report.dist_mains_coverage ? (Number(report.dist_mains_coverage) * 100).toFixed(2) : '',
				'Assets Covered': report.dist_mains_covered_length ? Number(report.dist_mains_covered_length).toFixed(2) : '',
				'GAPS': report.fieldOfViewGapsCount || 0,
				'LISA': report.indicationsCount || 0
			}));

			// Calculate totals for Total Assets, Assets Covered, LISA, and Gaps
			const totalAssetsSum = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.dist_mains_length) || 0);
			}, 0);
			
			const assetsCoveredSum = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.dist_mains_covered_length) || 0);
			}, 0);

			const lisaTotal = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.indicationsCount) || 0);
			}, 0);

			const gapsTotal = sortedReports.reduce((sum, report) => {
				const reportGaps = Number(report.fieldOfViewGapsCount) || 0;
				if (reportGaps > 0) {
					console.log(`[DEBUG REPORTS PAGE] Adding ${reportGaps} gaps from report ${report.report_name} to total (current sum: ${sum})`);
				}
				return sum + reportGaps;
			}, 0);
			
			// Calculate overall coverage percentage
			const overallCoverage = totalAssetsSum > 0 ? (assetsCoveredSum / totalAssetsSum * 100).toFixed(2) : '';
			
			console.log(`[DEBUG REPORTS PAGE] Final gaps total: ${gapsTotal} from ${sortedReports.length} reports`);

			// Add SUM row to the export data
			const exportDataWithTotals = [
				...exportData,
				{
					'Report Date': '',
					'Report Title': 'TOTAL',
					'Report Name': '',
					'Total Assets': totalAssetsSum.toFixed(2),
					'Coverage %': overallCoverage,
					'Assets Covered': assetsCoveredSum.toFixed(2),
					'GAPS': gapsTotal,
					'LISA': lisaTotal
				}
			];

			// Create workbook with cellStyles enabled
			const wb = XLSX.utils.book_new();
			wb.Props = {
				Title: "Wales and West Utilities Reports Export",
				Subject: "Survey Reports",
				Author: "Wales and West Utilities System",
				CreatedDate: new Date()
			};

			// Build the worksheet data as an array of arrays (AOA) format
			const headers = Object.keys(exportDataWithTotals[0]);
			
			const aoa = [
				// Header row
				headers,
				// Data rows
				...exportDataWithTotals.map((row) => {
					return headers.map(header => row[header as keyof typeof row]);
				})
			];

			// Create worksheet from array of arrays
			const ws = XLSX.utils.aoa_to_sheet(aoa);

			// Set column widths to match table structure
			ws['!cols'] = [
				{ wch: 12 }, // Report Date
				{ wch: 60 }, // Report Title - wider
				{ wch: 25 }, // Report Name
				{ wch: 15 }, // Total Assets
				{ wch: 12 }, // Coverage %
				{ wch: 16 }, // Assets Covered
				{ wch: 8 },  // GAPS
				{ wch: 8 }   // LISA
			];

			// Note: Bold formatting requires xlsx Pro edition or a different library
			// The visual markers above provide clear distinction instead

			// Add worksheet to workbook with specific options
			XLSX.utils.book_append_sheet(wb, ws, 'Reports');

			// Generate filename with current date and filter info
			const now = new Date();
			const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
			const filterInfo = reportFilter === 'all' ? 'All' : 
							   reportFilter === 'draft' ? 'Draft' : 
							   reportFilter === 'final-and-draft' ? 'FinalAndDraft' : 
							   'Final';
			const surveysInfo = includeSurveysOnly ? '' : '_AllReports';
			const searchInfo = searchQuery ? `_Search-${searchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
			const selectionInfo = selectedReports.size > 0 ? `_Selected-${selectedReports.size}` : '';
			const filename = `WalesWest_Reports_${filterInfo}${surveysInfo}${searchInfo}${selectionInfo}_${timestamp}.xlsx`;

			// Write and download file
			XLSX.writeFile(wb, filename);
			
			const exportType = selectedReports.size > 0 ? `${selectedReports.size} selected` : 'all displayed';
			console.log(`Exported ${exportType} reports (+ totals row with Total Assets, Assets Covered, Coverage %, GAPS, and LISA totals) to ${filename}`);
		} catch (error) {
			console.error('Error exporting to Excel:', error);
			alert('Error exporting to Excel. Please try again.');
		}
	}

	// Function to handle filter changes
	function handleFilterChange() {
		if (reports.length > 0) {
			sortReports();
			clearAllSelections();
		}
	}
	
	// Function to handle survey filter change (needs to reload data)
	function handleSurveyFilterChange() {
		// Reload data when survey filter changes
		loadData();
	}

	// Calculate total survey distance
	const totalSurveyDistance = $derived(() => {
		return reports.reduce((sum, report) => {
			return sum + (parseFloat(report.total_distance_km || '0') || 0);
		}, 0);
	});

	// Calculate total coverage (from final reports only)
	const totalCoverage = $derived(() => {
		const finalReportsOnly = reports.filter(report => 
			report.report_final === true || 
			report.report_final === 1 || 
			report.report_final === '1'
		);
		const totalAssets = finalReportsOnly.reduce((sum, report) => sum + (report.dist_mains_length || 0), 0);
		const coveredAssets = finalReportsOnly.reduce((sum, report) => sum + (report.dist_mains_covered_length || 0), 0);
		return totalAssets > 0 ? (coveredAssets / totalAssets) * 100 : 0;
	});

	// Function to load data
	const loadData = async () => {
		loading = true;
		reportsLoading = true;
		try {
			// Fetch reports using our API service
			const result = await reportsApi.getAll({
				limit: 500,
				page: 1,
				sort: '-report_date',
				finalOnly: false, // Show all reports including drafts
				includeUnitDesc: true, // Include unit descriptions
				withSurveys: includeSurveysOnly // Show only reports with surveys based on toggle
			});

			
			// We no longer need to filter for driving sessions as the API does this for us
			reports = result.reports;
			meta = result.meta;
			
			// Apply initial sorting
			sortReports();
			
			// Calculate stats from the filtered reports data (since we're using withSurveys filter)
			totalReports = reports.length;
			finalReports = reports.filter(report => 
				report.report_final === true || 
				report.report_final === 1 || 
				report.report_final === '1'
			).length;
			draftReports = totalReports - finalReports;
			
			// Calculate final-and-draft reports (potentially deletable)
			// 1. Reports with conflicting final/draft states (exact name duplicates)
			// 2. Temporary reports (with "Temp", "Temp 1S", etc.) that have corresponding final versions
			// 3. Older temporary reports when there are multiple temp reports for the same base title
			
			// Pre-process: Group temporary reports by base title to find duplicates (for count calculation)
			const tempPatternsForCount = [
				/\s+Temp\s*$/i,           // " Temp"
				/\s+Temp\s+\d+S\s*$/i,    // " Temp 1S", " Temp 2S", etc.
				/\s+Temp\d+\s*$/i,        // " Temp1", " Temp2", etc.
				/\s+TEMP\s*$/i,           // " TEMP" (uppercase)
				/\s+TEMP\s+\d+S\s*$/i,    // " TEMP 1S", " TEMP 2S", etc.
			];
			
			const tempReportGroupsForCount = new Map();
			reports.forEach(report => {
				const reportTitle = report.report_title || '';
				const isTempReport = tempPatternsForCount.some(pattern => pattern.test(reportTitle));
				
				if (isTempReport) {
					let baseTitle = reportTitle;
					for (const pattern of tempPatternsForCount) {
						if (pattern.test(reportTitle)) {
							baseTitle = reportTitle.replace(pattern, '').trim();
							break;
						}
					}
					
					if (!tempReportGroupsForCount.has(baseTitle)) {
						tempReportGroupsForCount.set(baseTitle, []);
					}
					tempReportGroupsForCount.get(baseTitle).push(report);
				}
			});
			
			// Sort each group by date (newest first) to identify older reports for deletion
			tempReportGroupsForCount.forEach((reportsInGroup) => {
				if (reportsInGroup.length > 1) {
					reportsInGroup.sort((a: Report, b: Report) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
				}
			});
			
			finalAndDraftReports = reports.filter(report => {
				const reportName = report.report_name || '';
				const reportTitle = report.report_title || '';
				const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
				const isDraft = report.report_final === false || report.report_final === 0 || report.report_final === '0' || !report.report_final;
				
				// Check for exact title duplicates with conflicting final/draft states (using report_title)
				const hasExactDuplicate = reports.some(otherReport => 
					otherReport.id !== report.id && 
					otherReport.report_title === reportTitle &&
					reportTitle.trim() !== '' && // Don't match empty titles
					((isFinal && (otherReport.report_final === false || otherReport.report_final === 0 || otherReport.report_final === '0' || !otherReport.report_final)) ||
					 (isDraft && (otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1')))
				);
				
				// Check for temporary reports that can be deleted (using report_title for long descriptive names)
				const isTempReport = tempPatternsForCount.some(pattern => pattern.test(reportTitle));
				
				let hasFinalVersion = false;
				let isOlderTempReport = false;
				
				if (isTempReport) {
					// Try multiple patterns to extract base title
					let baseTitle = reportTitle;
					for (const pattern of tempPatternsForCount) {
						if (pattern.test(reportTitle)) {
							baseTitle = reportTitle.replace(pattern, '').trim();
							break;
						}
					}
					
					// Check if there's a final report with the base title
					// Final reports might have " Final" suffix, so check both base title and base title + " Final"
					hasFinalVersion = reports.some(otherReport => {
						const otherIsFinal = otherReport.report_final === true || otherReport.report_final === 1 || otherReport.report_final === '1';
						if (!otherIsFinal) return false;
						
						return otherReport.id !== report.id && (
							otherReport.report_title === baseTitle || // Exact match
							otherReport.report_title === baseTitle + " Final" // Match with " Final" suffix
						);
					});
					
					// Check if this is an older temporary report (when there are multiple temp reports for same base title)
					const tempGroup = tempReportGroupsForCount.get(baseTitle);
					if (tempGroup && tempGroup.length > 1) {
						// If this report is not the newest (index > 0 in sorted array), it's deletable
						const reportIndex = tempGroup.findIndex((r: Report) => r.id === report.id);
						isOlderTempReport = reportIndex > 0; // Keep only the newest (index 0)
					}
				}
				
				return hasExactDuplicate || (isTempReport && hasFinalVersion) || isOlderTempReport;
			}).length;
			
			// totalIndications already comes from final reports only (calculation reports)
			totalLISAs = result.stats.totalIndications || 0;
			totalGaps = result.stats.totalGaps || 0;
			
			// Load car distance data from API
			car1Distance = result.stats.car1Distance || 0;
			car2Distance = result.stats.car2Distance || 0;
			car3Distance = result.stats.car3Distance || 0;
			car4Distance = result.stats.car4Distance || 0;
			
			// Fetch sync info from centralized API
							try {
					const syncResponse = await fetch('/api/v1/sync-status');
					if (syncResponse.ok) {
						syncInfo = await syncResponse.json();
					} else {
						console.error('Error fetching sync status:', syncResponse.status, syncResponse.statusText);
					}
				} catch (syncErr) {
					console.error('Error fetching sync status:', syncErr);
				}
			

		} catch (err) {
			console.error('Error fetching reports:', err);
			error = t('reports.error', $language);
		} finally {
			loading = false;
			reportsLoading = false;
			
			// Multiple attempts at refreshing scrollbars to ensure they appear
			refreshScrollbars();
			setTimeout(refreshScrollbars, 100);
			setTimeout(refreshScrollbars, 500);
			setTimeout(refreshScrollbars, 1000);
		}
	};

	onMount(() => {
		loadData();
		
		// Add window resize listener to handle responsive behavior
		const handleResize = () => {
			refreshScrollbars();
		};
		
		window.addEventListener('resize', handleResize);
		
		// Return cleanup function directly
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});


</script>

<PageTemplate title={t('reports.title', $language)} fullWidth={true}>
	{#snippet pageActions()}
		<ExportControls 
			{selectedReports}
			{reportFilter}
			{includeSurveysOnly}
			{displayedReports}
			{syncInfo}
			onClearSelections={clearAllSelections}
			onExport={exportToExcel}
		/>
	{/snippet}
	
	{#snippet content()}
		<SectionContainer
			title="Survey Reports Overview"
			subtitle="Comprehensive analysis of survey data and asset coverage"
			width="full"
		>
			{#snippet children()}
				{#if loading}
					<div class="loading-container">
						<div class="loading-indicator">
							<div class="loading-bar"></div>
							<div class="loading-bar"></div>
							<div class="loading-bar"></div>
						</div>
						<p class="loading-text">{t('reports.loading', $language)}</p>
					</div>
				{:else if error}
					<div class="error-container">
						<p class="error">{error}</p>
					</div>
				{:else}
					<!-- Stats Header -->
					<ReportsStatsCard 
						{finalReports}
						{draftReports}
						totalCoverage={totalCoverage()}
						{totalLISAs}
						{totalGaps}
						{car1Distance}
						{car2Distance}
						{car3Distance}
						{car4Distance}
					/>

					<!-- Filter Controls -->
					<ReportsFilters 
						bind:reportFilter
						bind:searchQuery
						bind:includeSurveysOnly
						{finalReports}
						{totalReports}
						{draftReports}
						{finalAndDraftReports}
						onFilterChange={handleFilterChange}
						onSurveyFilterChange={handleSurveyFilterChange}
					/>



					<p class="table-scroll-hint">Scroll horizontally to view all report data • Click values to copy (Title, Name, Assets, Coverage)</p>
					
					<div class="table-container" bind:this={tableContainer}>
						<div class="table table--compact table--reports">
													<table class="table__element">
							<thead>
								<tr>
									<th class="table__header table__header--expand">

									</th>
									<th class="table__header table__header--checkbox">
										<div class="checkbox-header">
											<label class="checkbox-wrapper">
												<input 
													type="checkbox" 
													class="checkbox-input" 
													checked={allReportsSelected()}
													onchange={() => allReportsSelected() ? clearAllSelections() : selectAllReports()}
												>
												<span class="checkbox-custom"></span>
												<span class="checkbox-label" title="Select all {reportFilter === 'final' ? 'final' : reportFilter === 'draft' ? 'draft' : reportFilter === 'final-and-draft' ? 'final & draft' : ''} reports">
													Select All
													{#if reportFilter !== 'all'}
														<br><span class="checkbox-label-filter">({reportFilter === 'final' ? 'Final' : reportFilter === 'draft' ? 'Draft' : reportFilter === 'final-and-draft' ? 'F&D' : ''})</span>
													{/if}
												</span>
											</label>
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--report-date" role="button" tabindex="0" onclick={() => handleSort('report_date')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_date')}>
										<div class="sort-header">
											<span>Report Date</span>
											{#if sortColumn === 'report_date'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--report-title" role="button" tabindex="0" onclick={() => handleSort('report_title')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_title')}>
										<div class="sort-header">
											<span>Report Title</span>
											{#if sortColumn === 'report_title'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--report-name" role="button" tabindex="0" onclick={() => handleSort('report_name')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_name')}>
										<div class="sort-header">
											<span>Report Name</span>
											{#if sortColumn === 'report_name'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_length')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_length')}>
										<div class="sort-header">
											<span>Total Assets</span>
											{#if sortColumn === 'dist_mains_length'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_coverage')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_coverage')}>
										<div class="sort-header">
											<span>Coverage %</span>
											{#if sortColumn === 'dist_mains_coverage'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_covered_length')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_covered_length')}>
										<div class="sort-header">
											<span>Assets Covered</span>
											{#if sortColumn === 'dist_mains_covered_length'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('fieldOfViewGapsCount')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('fieldOfViewGapsCount')}>
										<div class="sort-header">
											<span>GAPS</span>
											{#if sortColumn === 'fieldOfViewGapsCount'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('indicationsCount')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('indicationsCount')}>
										<div class="sort-header">
											<span>LISA</span>
											{#if sortColumn === 'indicationsCount'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('total_duration_seconds')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('total_duration_seconds')}>
										<div class="sort-header">
											<span>Duration</span>
											{#if sortColumn === 'total_duration_seconds'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('total_distance_km')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('total_distance_km')}>
										<div class="sort-header">
											<span>Survey Distance</span>
											{#if sortColumn === 'total_distance_km'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('surveyor_unit_desc')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('surveyor_unit_desc')}>
										<div class="sort-header">
											<span>Vehicle</span>
											{#if sortColumn === 'surveyor_unit_desc'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('report_final')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_final')}>
										<div class="sort-header">
											<span>Status</span>
											{#if sortColumn === 'report_final'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>

									</th>
									</tr>
								</thead>
								<tbody>
									{#if reportsLoading}
										{#each Array(5) as _, i}
											<tr class="table__row table__row--loading">
												<td class="table__cell table__cell--expand">
													<div class="skeleton-text" style="width: 14px; height: 14px; border-radius: 3px;"></div>
												</td>
												<td class="table__cell table__cell--checkbox">
													<div class="checkbox-wrapper">
														<div class="skeleton-text" style="width: 15px; height: 15px; border-radius: 3px;"></div>
													</div>
												</td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell table__cell--status">
													<div class="skeleton-text"></div>
												</td>
											</tr>
										{/each}
									{:else if displayedReports.length > 0}
										{#each displayedReports as report}
											{@const hasSurveys = (report.expand?.driving_sessions?.length ?? 0) > 0}
											{@const isExpanded = expandedReports.has(report.id)}
											{@const deletableInfo = isReportDeletable(report)}
											<tr class="table__row">
												<td class="table__cell table__cell--expand">
													{#if hasSurveys}
														<button 
															class="expand-button"
															onclick={() => toggleReportExpansion(report.id)}
															aria-expanded={isExpanded}
															aria-label="{isExpanded ? 'Collapse' : 'Expand'} surveys for {report.report_name}"
														>
															<ChevronRight 
																size={14} 
																class="expand-icon {isExpanded ? 'expand-icon--rotated' : ''}"
															/>
														</button>
													{/if}
												</td>
												<td class="table__cell table__cell--checkbox">
													<label class="checkbox-wrapper">
														<input 
															type="checkbox" 
															class="checkbox-input"
															checked={selectedReports.has(report.id)}
															onchange={() => toggleReportSelection(report.id)}
														>
														<span class="checkbox-custom"></span>
														<span class="sr-only">Select {report.report_name}</span>
													</label>
												</td>
												<td class="table__cell table__cell--report-date" data-tooltip={report.report_title}>
													<div class="report-date-content">
														{formatDateTime(report.report_date)}
													</div>
												</td>
												<td class="table__cell table__cell--report-title" title={report.report_title}>
													<span 
														class="table__cell-content clickable-value {copiedItems.has(`${report.id}-title`) ? 'copied-value' : ''}"
														onclick={() => copyToClipboard(report.report_title, 'Report Title', `${report.id}-title`)}
														title={copiedItems.has(`${report.id}-title`) ? 'Copied!' : 'Click to copy Report Title'}
													>
														{report.report_title}
													</span>
													{#if deletableInfo.isDeletable}
														<span 
															class="deletable-badge" 
															title={deletableInfo.reason}
															style="font-family: system-ui, -apple-system, sans-serif;"
														>
															⚠
														</span>
													{/if}
												</td>
												<td class="table__cell table__cell--report-name" title={report.report_name}>
													<span 
														class="report-name-text clickable-value {copiedItems.has(`${report.id}-name`) ? 'copied-value' : ''}"
														onclick={() => copyToClipboard(report.report_name, 'Report Name', `${report.id}-name`)}
														title={copiedItems.has(`${report.id}-name`) ? 'Copied!' : 'Click to copy Report Name'}
													>
														{report.report_name}
													</span>
												</td>
												<td class="table__cell">
													<span 
														class="clickable-value {copiedItems.has(`${report.id}-total-assets`) ? 'copied-value' : ''}"
														onclick={() => copyToClipboard(report.dist_mains_length ? `${Number(report.dist_mains_length).toFixed(2)} km` : 'N/A', 'Total Assets', `${report.id}-total-assets`)}
														title={copiedItems.has(`${report.id}-total-assets`) ? 'Copied!' : 'Click to copy Total Assets'}
													>
														{report.dist_mains_length ? `${Number(report.dist_mains_length).toFixed(2)} km` : 'N/A'}
													</span>
												</td>
												<td class="table__cell">
													<span 
														class="clickable-value {copiedItems.has(`${report.id}-coverage`) ? 'copied-value' : ''} {(report.dist_mains_coverage || 0) > 0.9 ? 'value--high-quality' : ''}"
														onclick={() => copyToClipboard(report.dist_mains_coverage ? `${Number(report.dist_mains_coverage * 100).toFixed(1)}%` : 'N/A', 'Coverage %', `${report.id}-coverage`)}
														title={copiedItems.has(`${report.id}-coverage`) ? 'Copied!' : 'Click to copy Coverage %'}
													>
														{report.dist_mains_coverage ? `${Number(report.dist_mains_coverage * 100).toFixed(1)}%` : 'N/A'}
													</span>
												</td>
												<td class="table__cell">
													<span 
														class="clickable-value {copiedItems.has(`${report.id}-assets-covered`) ? 'copied-value' : ''}"
														onclick={() => copyToClipboard(report.dist_mains_covered_length ? `${Number(report.dist_mains_covered_length).toFixed(2)} km` : 'N/A', 'Assets Covered', `${report.id}-assets-covered`)}
														title={copiedItems.has(`${report.id}-assets-covered`) ? 'Copied!' : 'Click to copy Assets Covered'}
													>
														{report.dist_mains_covered_length ? `${Number(report.dist_mains_covered_length).toFixed(2)} km` : 'N/A'}
													</span>
												</td>
												<td class="table__cell table__cell--center">
													<span class:value--high-quality={(report.fieldOfViewGapsCount || 0) < 50}>
														{report.fieldOfViewGapsCount || 0}
													</span>
												</td>
												<td class="table__cell table__cell--center">
													<button 
														class="lisa-count-button {(report.indicationsCount || 0) > 0 ? 'lisa-count-button--active' : ''}"
														onclick={() => openLisaModal(report)}
														disabled={(report.indicationsCount || 0) === 0}
													>
														{report.indicationsCount || 0}
													</button>
												</td>
												<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
												<td class="table__cell">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
												<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
												<td class="table__cell table__cell--status">
													<div class="status-container">
														<span class="status-indicator {
															report.report_final === true || 
															report.report_final === 1 || 
															report.report_final === '1' ? 'status-indicator--final' : 'status-indicator--draft'
														}"></span>
														<span class="status-text">
															{report.report_final === true || 
															report.report_final === 1 || 
															report.report_final === '1' ? 'Final' : 'Draft'}
														</span>
													</div>
												</td>
											</tr>
											{#if isExpanded && hasSurveys}
												<tr class="table__row table__row--expansion">
													<td colspan="14" class="table__cell table__cell--expansion">
														<div class="surveys-container">
															<h4 class="surveys-title">Surveys for {report.report_name}</h4>
															<div class="surveys-grid">
																{#each (report.expand?.driving_sessions || []) as session, index}
																	{@const s = session as any}
																	<div class="survey-card">
																		<div class="survey-header">
																			<span class="survey-number">
																				{s.survey_tag || `Survey #${index + 1}`}
																			</span>
																			{#if s.created}
																				<span class="survey-date">{formatDateTime(s.created)}</span>
																			{/if}
																		</div>
																		<div class="survey-details">
																			{#if s.surveyor_unit_desc}
																				<div class="survey-detail">
																					<span class="survey-label">Vehicle:</span>
																					<span class="survey-value">{s.surveyor_unit_desc}</span>
																				</div>
																			{/if}
																			{#if s.survey_start_datetime}
																				<div class="survey-detail">
																					<span class="survey-label">Start Time:</span>
																					<span class="survey-value">{formatDateTime(s.survey_start_datetime)}</span>
																				</div>
																			{/if}
																			{#if s.survey_end_datetime}
																				<div class="survey-detail">
																					<span class="survey-label">End Time:</span>
																					<span class="survey-value">{formatDateTime(s.survey_end_datetime)}</span>
																				</div>
																			{/if}
																			{#if s.stability_class}
																				<div class="survey-detail">
																					<span class="survey-label">Stability Class:</span>
																					<span class="survey-value">{s.stability_class}</span>
																				</div>
																			{/if}
																			{#if s.total_duration_seconds}
																				<div class="survey-detail">
																					<span class="survey-label">Total Duration:</span>
																					<span class="survey-value">
																						{Math.floor(Number(s.total_duration_seconds) / 3600)}h {Math.floor((Number(s.total_duration_seconds) % 3600) / 60)}m
																					</span>
																				</div>
																			{/if}
																			{#if s.total_length_meters}
																				<div class="survey-detail">
																					<span class="survey-label">Total Distance:</span>
																					<span class="survey-value">
																						{(Number(s.total_length_meters) / 1000).toFixed(1)} km
																					</span>
																				</div>
																			{/if}
																		</div>
																	</div>
																{/each}
															</div>
														</div>
													</td>
												</tr>
											{/if}
										{/each}
									{:else}
										<tr class="table__row">
											<td class="table__cell table__cell--empty" colspan="14">No reports found</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			{/snippet}
		</SectionContainer>
	{/snippet}
</PageTemplate>

<!-- LISA Modal -->
<LisaModal 
	bind:show={showLisaModal} 
	reportName={currentLisaReport?.report_name || ''} 
	indications={currentLisaReport?.indications || []} 
	onClose={closeLisaModal} 
/>

<style>




	/* Checkbox Styles */
	.table__header--checkbox {
		width: 35px !important;
		min-width: 35px !important;
		max-width: 35px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.table__cell--checkbox {
		width: 35px !important;
		min-width: 35px !important;
		max-width: 35px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.checkbox-header {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		cursor: pointer;
		user-select: none;
		position: relative;
		width: 100%;
		height: 100%;
	}

	.checkbox-input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.checkbox-custom {
		width: 15px;
		height: 15px;
		border: 2px solid var(--border-primary);
		border-radius: 3px;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		position: relative;
		flex-shrink: 0;
	}

	.checkbox-custom::after {
		content: '';
		width: 4px;
		height: 7px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.checkbox-input:checked + .checkbox-custom {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
	}

	.checkbox-input:checked + .checkbox-custom::after {
		opacity: 1;
	}

	.checkbox-wrapper:hover .checkbox-custom {
		border-color: var(--accent-primary);
		transform: scale(1.05);
	}

	.checkbox-input:focus + .checkbox-custom {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	.checkbox-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		white-space: nowrap;
		display: none; /* Hidden by default due to narrow column */
		text-align: center;
		line-height: 1.2;
	}

	.checkbox-label-filter {
		font-size: 0.65rem;
		font-weight: 400;
		color: var(--accent-primary);
		opacity: 0.8;
	}

	.checkbox-wrapper:hover .checkbox-label {
		color: var(--accent-primary);
	}

	.checkbox-input:checked + .checkbox-custom + .checkbox-label {
		color: var(--accent-primary);
	}

	/* Enhanced hover effects for table rows with checkboxes */
	.table__row:hover .checkbox-custom {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.table__row:hover .checkbox-input:checked + .checkbox-custom {
		background: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	/* Expand Column Styles */
	.table__header--expand {
		width: 25px !important;
		min-width: 25px !important;
		max-width: 25px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.table__cell--expand {
		width: 25px !important;
		min-width: 25px !important;
		max-width: 25px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.expand-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.125rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		transition: background-color 0.2s ease;
		color: var(--text-secondary);
		width: 20px;
		height: 20px;
	}

	.expand-button:hover {
		background-color: var(--bg-secondary);
		color: var(--accent-primary);
	}





	/* Sync Status */
	.sync-status {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-bottom: 1.5rem;
	}

	.sync-status-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.sync-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sync-badge--success {
		background: rgba(34, 197, 94, 0.1);
		color: var(--success);
	}

	.sync-badge--pending {
		background: rgba(245, 158, 11, 0.1);
		color: var(--warning);
	}

	.sync-badge--failed {
		background: rgba(239, 68, 68, 0.1);
		color: var(--error);
	}

	/* Loading States */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
	}

	.loading-indicator {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.loading-bar {
		width: 4px;
		height: 40px;
		background: var(--accent-primary);
		border-radius: 2px;
		animation: loading-pulse 1.2s infinite ease-in-out;
	}

	.loading-bar:nth-child(2) {
		animation-delay: 0.1s;
	}

	.loading-bar:nth-child(3) {
		animation-delay: 0.2s;
	}

	@keyframes loading-pulse {
		0%, 80%, 100% {
			transform: scaleY(0.4);
			opacity: 0.5;
		}
		40% {
			transform: scaleY(1);
			opacity: 1;
		}
	}

	.loading-text {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.error-container {
		padding: 2rem;
		text-align: center;
	}

	.error {
		color: var(--error);
		font-size: 0.9rem;
	}

	/* Professional Table Styles */
	.table-container {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		overflow-x: auto;
	}

	/* Clickable value styles */
	.clickable-value {
		cursor: pointer;
		transition: all 0.2s ease;
		border-radius: 4px;
		padding: 0.125rem 0.25rem;
		display: inline-block;
		position: relative;
		width: fit-content;
		max-width: 100%;
	}
	


	.clickable-value:hover {
		background-color: var(--bg-secondary);
		color: var(--accent-primary);
		transform: scale(1.02);
	}

	.clickable-value:active {
		transform: scale(0.98);
		background-color: var(--accent-primary);
		color: white;
	}

	/* Success state styling for copied values */
	.copied-value {
		background-color: rgba(16, 185, 129, 0.1) !important;
		color: #10b981 !important;
		animation: copySuccess 0.4s ease-out;
	}

	.copied-value:hover {
		background-color: rgba(16, 185, 129, 0.15) !important;
		color: #059669 !important;
	}

	@keyframes copySuccess {
		0% {
			transform: scale(1);
			background-color: rgba(16, 185, 129, 0.2);
		}
		50% {
			transform: scale(1.05);
			background-color: rgba(16, 185, 129, 0.3);
		}
		100% {
			transform: scale(1);
			background-color: rgba(16, 185, 129, 0.1);
		}
	}

	/* Legacy support for remaining copy buttons (if any) */
	.cell-with-copy {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 0.5rem;
	}

	/* Green text for high quality values */
	.value--high-quality {
		color: #15803d !important;
		font-weight: 600;
	}

	/* Deletable badge styling */
	.deletable-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		cursor: help;
		transition: all 0.2s ease;
		line-height: 1;
		vertical-align: middle;
		color: rgb(239, 68, 68);
		font-weight: bold;
		min-width: 1.5rem;
		flex-shrink: 0; /* Prevent the badge from shrinking */
		margin-left: auto; /* Push to the right */
	}

	.deletable-badge:hover {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.4);
		transform: scale(1.05);
	}

	.deletable-badge :global(svg) {
		color: rgb(239, 68, 68);
		vertical-align: middle;
		display: inline-block !important;
		width: 14px !important;
		height: 14px !important;
	}



	:global(.expand-icon) {
		transition: transform 0.2s ease !important;
		color: var(--text-secondary) !important;
		transform-origin: center !important;
	}

	:global(.expand-icon--rotated) {
		transform: rotate(90deg) !important;
		color: var(--accent-primary) !important;
	}

	/* LISA Count Button */
	.lisa-count-button {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: default;
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.lisa-count-button--active {
		color: var(--accent-primary);
		background-color: var(--bg-secondary);
		cursor: pointer;
	}

	.lisa-count-button--active:hover {
		background-color: var(--accent-primary);
		color: white;
		transform: scale(1.05);
	}



	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}



	/* Survey accordion styles */
	.surveys-container {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-primary);
	}

	.surveys-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.surveys-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
		gap: 1rem;
	}

	.survey-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		overflow: hidden; /* Prevent any overflow */
		word-wrap: break-word; /* Ensure all text wraps */
	}

	.survey-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-secondary);
		gap: 0.75rem;
		min-height: 2.5rem; /* Ensure minimum height for multiple lines */
	}

	.survey-number {
		font-weight: 600;
		color: var(--accent-primary);
		font-size: 0.8rem;
		line-height: 1.2;
		word-break: break-all; /* More aggressive breaking */
		overflow-wrap: anywhere; /* Break anywhere if needed */
		hyphens: auto;
		flex: 1;
		min-width: 0; /* Allow shrinking */
		max-width: 100%; /* Ensure it doesn't exceed container */
		white-space: normal; /* Allow wrapping */
	}

	.survey-date {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.survey-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.survey-detail {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
	}

	.survey-label {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.survey-value {
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
	}





	/* Table scroll hint */
	.table-scroll-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-secondary);
		border-radius: 4px;
		text-align: center;
		font-style: italic;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.stats-dashboard {
			grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
			gap: 1rem;
		}

		.stats-section-content {
			grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
			gap: 0.75rem;
			padding: 1rem;
		}

		.stats-value {
			font-size: 1.1rem;
		}
		
		.checkbox-label {
			display: none;
		}
	}



	@media (max-width: 640px) {
		.stats-dashboard {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.stats-section-content {
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
			padding: 0.75rem;
		}

		.stats-value {
			font-size: 1rem;
		}

		.stats-label {
			font-size: 0.75rem;
		}

		.stats-sublabel {
			font-size: 0.65rem;
		}

		.checkbox-label {
			display: none;
		}
		
		.checkbox-custom {
			width: 12px;
			height: 12px;
		}
		
		.checkbox-custom::after {
			width: 3px;
			height: 5px;
		}

		.expand-button {
			padding: 0.0625rem;
			width: 16px;
			height: 16px;
		}

		.surveys-grid {
			grid-template-columns: 1fr;
		}

		.survey-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.survey-number {
			font-size: 0.75rem;
			word-break: break-all;
			line-height: 1.1;
		}

		.surveys-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}



	@media (max-width: 480px) {
		.surveys-grid {
			grid-template-columns: 1fr;
		}

		.survey-card {
			padding: 0.75rem;
		}

		.survey-number {
			font-size: 0.7rem;
			line-height: 1.0;
		}

		.survey-header {
			min-height: 3rem; /* More space for long names on small screens */
		}
	}

	/* Table resizing styles */
	.table__header {
		position: relative;
	}



	/* Dynamic column widths using CSS custom properties */
	.table-container {
		--col-expand-width: 35px;
		--col-checkbox-width: 45px;
		--col-report_date-width: 180px;
		--col-report_title-width: 600px;
		--col-report_name-width: 200px;
		--col-dist_mains_length-width: 120px;
		--col-dist_mains_coverage-width: 100px;
		--col-dist_mains_covered_length-width: 140px;
		--col-fieldOfViewGapsCount-width: 80px;
		--col-indicationsCount-width: 80px;
		--col-total_duration_seconds-width: 100px;
		--col-total_distance_km-width: 140px;
		--col-surveyor_unit_desc-width: 100px;
		--col-report_final-width: 80px;
	}

	.table__header--expand { width: var(--col-expand-width); min-width: var(--col-expand-width); }
	.table__header--checkbox { width: var(--col-checkbox-width); min-width: var(--col-checkbox-width); }
	.table__header--report-date { width: var(--col-report_date-width) !important; min-width: var(--col-report_date-width) !important; max-width: var(--col-report_date-width) !important; }
	.table__header--report-title { width: var(--col-report_title-width) !important; min-width: var(--col-report_title-width) !important; max-width: var(--col-report_title-width) !important; }
	.table__header--report-name { width: var(--col-report_name-width); min-width: var(--col-report_name-width); }
	
	.table__header:nth-child(6) { width: var(--col-dist_mains_length-width); min-width: var(--col-dist_mains_length-width); }
	.table__header:nth-child(7) { width: var(--col-dist_mains_coverage-width); min-width: var(--col-dist_mains_coverage-width); }
	.table__header:nth-child(8) { width: var(--col-dist_mains_covered_length-width); min-width: var(--col-dist_mains_covered_length-width); }
	.table__header:nth-child(9) { width: var(--col-fieldOfViewGapsCount-width); min-width: var(--col-fieldOfViewGapsCount-width); }
	.table__header:nth-child(10) { width: var(--col-indicationsCount-width); min-width: var(--col-indicationsCount-width); }
	.table__header:nth-child(11) { width: var(--col-total_duration_seconds-width); min-width: var(--col-total_duration_seconds-width); }
	.table__header:nth-child(12) { width: var(--col-total_distance_km-width); min-width: var(--col-total_distance_km-width); }
	.table__header:nth-child(13) { width: var(--col-surveyor_unit_desc-width); min-width: var(--col-surveyor_unit_desc-width); }
	.table__header:nth-child(14) { width: var(--col-report_final-width); min-width: var(--col-report_final-width); }

	/* Apply same widths to table cells */
	.table__cell--expand { width: var(--col-expand-width); min-width: var(--col-expand-width); }
	.table__cell--checkbox { width: var(--col-checkbox-width); min-width: var(--col-checkbox-width); }
	.table__cell--report-date { width: var(--col-report_date-width) !important; min-width: var(--col-report_date-width) !important; max-width: var(--col-report_date-width) !important; }
	.table__cell--report-title { 
		width: var(--col-report_title-width) !important; 
		min-width: var(--col-report_title-width) !important; 
		max-width: var(--col-report_title-width) !important;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.table__cell--report-name { width: var(--col-report_name-width); min-width: var(--col-report_name-width); }
	
	.table__row > .table__cell:nth-child(6) { width: var(--col-dist_mains_length-width); min-width: var(--col-dist_mains_length-width); }
	.table__row > .table__cell:nth-child(7) { width: var(--col-dist_mains_coverage-width); min-width: var(--col-dist_mains_coverage-width); }
	.table__row > .table__cell:nth-child(8) { width: var(--col-dist_mains_covered_length-width); min-width: var(--col-dist_mains_covered_length-width); }
	.table__row > .table__cell:nth-child(9) { width: var(--col-fieldOfViewGapsCount-width); min-width: var(--col-fieldOfViewGapsCount-width); }
	.table__row > .table__cell:nth-child(10) { width: var(--col-indicationsCount-width); min-width: var(--col-indicationsCount-width); }
	.table__row > .table__cell:nth-child(11) { width: var(--col-total_duration_seconds-width); min-width: var(--col-total_duration_seconds-width); }
	.table__row > .table__cell:nth-child(12) { width: var(--col-total_distance_km-width); min-width: var(--col-total_distance_km-width); }
	.table__row > .table__cell:nth-child(13) { width: var(--col-surveyor_unit_desc-width); min-width: var(--col-surveyor_unit_desc-width); }
	.table__row > .table__cell:nth-child(14) { width: var(--col-report_final-width); min-width: var(--col-report_final-width); }

	/* Ensure report date tooltip works properly */
	.report-date-content {
		display: block;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: help;
		position: relative;
		z-index: 1;
		pointer-events: auto;
	}
	
	/* Prevent tooltip interference from adjacent cells */
	.table__cell--report-title .clickable-value {
		pointer-events: auto;
		position: relative;
		z-index: 2;
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: middle;
		flex: 1;
		min-width: 0; /* Allow flex item to shrink below content size */
	}

	/* Override tables.css overflow for report date to allow tooltip */
	.table--reports .table__cell--report-date {
		overflow: visible !important;
		position: relative;
		isolation: isolate;
	}
	
	/* Native tooltip for report date using data attribute */
	.table__cell--report-date[data-tooltip]:hover::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.5rem 1rem;
		background: rgba(0, 0, 0, 0.9);
		color: white;
		border-radius: 4px;
		white-space: nowrap;
		font-size: 0.875rem;
		z-index: 1000;
		pointer-events: none;
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 0.25rem;
	}
	
	.table__cell--report-date[data-tooltip]:hover::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 5px solid transparent;
		border-top-color: rgba(0, 0, 0, 0.9);
		z-index: 1000;
		pointer-events: none;
	}
	
	/* Ensure deletable badge icon shows properly */
	.deletable-badge {
		display: inline-flex !important;
		align-items: center;
		justify-content: center;
		width: auto !important;
		height: auto !important;
	}
</style>