import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * GET - Retrieves reports directly from the local PocketBase database
 * 
 * Query parameters:
 * - limit: number of records to retrieve (default 1000)
 * - page: page number (default 1)
 * - sort: sort field (default -report_date)
 * - finalOnly: only final reports (true/false, default true)
 * - includeUnitDesc: whether to include surveyor_unit_desc field (true/false, default false)
 * - withSurveys: only return reports with surveys (true/false, default true)
 */
export const GET = async ({ url, locals }: RequestEvent) => {
    try {
        // Get PocketBase instance from locals
        const pb = locals.pb;
        if (!pb) {
            return json({
                error: 'PocketBase instance not available',
                reports: []
            }, { status: 500 });
        }

        // Get query parameters
        const limit = parseInt(url.searchParams.get('limit') || '1000');
        const page = parseInt(url.searchParams.get('page') || '1');
        const sort = url.searchParams.get('sort') || '-report_date';
        const finalOnly = url.searchParams.get('finalOnly') !== 'false'; // default true
        const includeUnitDesc = url.searchParams.get('includeUnitDesc') === 'true'; // default false
        const withSurveys = url.searchParams.get('withSurveys') !== 'false'; // default true
        const timePeriod = url.searchParams.get('timePeriod') || 'all'; // 'today', 'week', 'month', 'all'
        
        console.log('API: Query parameters:', { limit, page, sort, finalOnly, includeUnitDesc, withSurveys, timePeriod });
        
        // Prepare filtering with date constraint (only data after July 1st, 2025)
        let dateFilter = 'report_date >= "2025-07-01"';
        
        // Add time period filter
        const now = new Date();
        if (timePeriod === 'today') {
            const today = now.toISOString().split('T')[0];
            dateFilter += ` && report_date >= "${today}"`;
        } else if (timePeriod === 'week') {
            // Get start of current week (Monday 12:00 UTC)
            const currentUtc = new Date();
            const startOfWeek = new Date(currentUtc);
            const dayOfWeek = startOfWeek.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Handle Sunday case
            startOfWeek.setUTCDate(startOfWeek.getUTCDate() - daysFromMonday);
            startOfWeek.setUTCHours(12, 0, 0, 0); // Set to 12:00 UTC
            
            // If current time is before Monday 12:00 UTC, use previous week
            if (currentUtc < startOfWeek) {
                startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);
            }
            
            const weekStartStr = startOfWeek.toISOString().split('T')[0]; // Use date part only for database
            dateFilter += ` && report_date >= "${weekStartStr}"`;
        } else if (timePeriod === 'month') {
            // Get start of current month
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthStartStr = startOfMonth.toISOString().split('T')[0];
            dateFilter += ` && report_date >= "${monthStartStr}"`;
        }
        
        let filter = dateFilter;
        
        // Add final report filter if requested
        if (finalOnly) {
            filter += ' && report_final=1';
        }
        
        // Check total number of reports (with date filter)
        const countAll = await pb.collection('gas_reports').getList(1, 1, {
            filter: dateFilter
        });
        const countFinal = finalOnly ? await pb.collection('gas_reports').getList(1, 1, {
            filter: dateFilter + ' && report_final=1'
        }) : { totalItems: countAll.totalItems };
        
        // Use expand to get related driving sessions, indications, and field_of_view_gaps
        const expandParam = includeUnitDesc 
            ? 'driving_sessions,indications_via_report,field_of_view_gaps' 
            : 'indications_via_report,field_of_view_gaps';
        
        console.log('API: Using expand parameter:', expandParam);
        
        // Prepare main query options
        const queryOptions: {
            sort: string;
            filter: string;
            expand?: string;
        } = {
            sort,
            filter,
            expand: expandParam
        };
        
        // If no final reports but there are any reports, return all (but still with date filter)
        const useAllReports = finalOnly && countFinal.totalItems === 0 && countAll.totalItems > 0;
        if (useAllReports) {
            queryOptions.filter = dateFilter;
        }
        
        const result = await pb.collection('gas_reports').getList(page, limit, queryOptions);
        
        // Process items - convert types and add needed fields
        const processedItems = result.items.map((item: any) => {
            const convertedItem: any = { ...item };
            
            // Convert numeric report_final (0 or 1) to boolean
            if ('report_final' in convertedItem) {
                // Handle report_final as a number (0 or 1)
                if (typeof convertedItem.report_final === 'number') {
                    convertedItem.report_final = convertedItem.report_final === 1;
                } 
                // For backward compatibility
                else if (typeof convertedItem.report_final === 'string') {
                    // Try to parse as number first
                    const num = parseInt(convertedItem.report_final, 10);
                    if (!isNaN(num)) {
                        convertedItem.report_final = num === 1;
                    } else {
                        // Fallback to string boolean check
                        convertedItem.report_final = convertedItem.report_final.toLowerCase() === 'true';
                    }
                } 
                // Default to Boolean conversion
                else {
                    convertedItem.report_final = Boolean(convertedItem.report_final);
                }
            }
            
            // Process total duration - convert to human readable format
            if ('total_breadcrumb_duration_seconds' in convertedItem) {
                const seconds = Number(convertedItem.total_breadcrumb_duration_seconds || 0);
                // Ensure we keep the original value
                convertedItem.total_duration_seconds = seconds;
                // Format as hours and minutes
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                convertedItem.formatted_duration = hours > 0 
                    ? `${hours}h ${minutes}m` 
                    : `${minutes}m`;
            } else {
                convertedItem.total_duration_seconds = 0;
                convertedItem.formatted_duration = '0m';
            }
            
            // Process total distance - ensure it's a number
            if ('total_breadcrumb_length_meters' in convertedItem) {
                // Convert meters to kilometers and ensure it's a number
                const meters = Number(convertedItem.total_breadcrumb_length_meters || 0);
                convertedItem.total_distance_km = (meters / 1000).toFixed(2);
            } else {
                convertedItem.total_distance_km = '0.00';
            }
            
            // Check if report has driving sessions (surveys)
            const hasDrivingSessions = !!((convertedItem.expand?.driving_sessions && 
                                         Array.isArray(convertedItem.expand.driving_sessions) && 
                                         convertedItem.expand.driving_sessions.length > 0) ||
                                        (convertedItem.driving_sessions && 
                                         Array.isArray(convertedItem.driving_sessions) && 
                                         convertedItem.driving_sessions.length > 0));
            
            // Add flag indicating whether report has driving sessions
            convertedItem.has_surveys = hasDrivingSessions;
            
            // Get surveyor_unit_desc from expanded relation
            if (includeUnitDesc) {
                if (convertedItem.expand && convertedItem.expand.driving_sessions?.length > 0) {
                    const firstSession = convertedItem.expand.driving_sessions[0];
                    convertedItem.surveyor_unit_desc = firstSession.surveyor_unit_desc || 'n/a';
                } else {
                    convertedItem.surveyor_unit_desc = 'n/a';
                }
            } else {
                convertedItem.surveyor_unit_desc = null;
            }
            
            // Add indications from expanded back-relation
            convertedItem.indications = [];
            convertedItem.indicationsCount = 0;
            convertedItem.uniqueIndicationsCount = 0;
            
            if (convertedItem.expand && convertedItem.expand.indications_via_report) {
                // Store the full indications data
                convertedItem.indications = Array.isArray(convertedItem.expand.indications_via_report) 
                    ? convertedItem.expand.indications_via_report 
                    : [];
                
                // Set the total count (including potential duplicates)
                convertedItem.indicationsCount = convertedItem.indications.length;
                
                // Deduplicate indications based on lisa_id or lisa_name
                const uniqueIndications = new Map();
                convertedItem.indications.forEach((indication: any) => {
                    // Use lisa_id if available, otherwise use lisa_name
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) {
                        uniqueIndications.set(uniqueId, indication);
                    }
                });
                
                // Set the count of unique indications
                convertedItem.uniqueIndicationsCount = uniqueIndications.size;
            }
            
            // Add field_of_view_gaps count from expanded relation
            convertedItem.fieldOfViewGapsCount = 0;
            
            if (convertedItem.expand && convertedItem.expand.field_of_view_gaps) {
                const gaps = Array.isArray(convertedItem.expand.field_of_view_gaps) 
                    ? convertedItem.expand.field_of_view_gaps 
                    : [];
                convertedItem.fieldOfViewGapsCount = gaps.length;
                
                // Debug logging for gaps calculation
                if (gaps.length > 0) {
                    console.log(`[DEBUG] Report ${convertedItem.report_name}: ${gaps.length} gaps found`);
                    // Check for potential duplicates by gap_id
                    const gapIds = gaps.map((gap: any) => gap.gap_id || gap.id);
                    const uniqueGapIds = [...new Set(gapIds)];
                    if (gapIds.length !== uniqueGapIds.length) {
                        console.warn(`[WARNING] Report ${convertedItem.report_name}: Found ${gapIds.length} gaps but only ${uniqueGapIds.length} unique gap_ids - potential duplicates!`);
                    }
                }
            }
                        
            return convertedItem;
        });
        
        // Apply withSurveys filter after processing if requested
        const filteredItems = withSurveys 
            ? processedItems.filter((item: any) => item.has_surveys) 
            : processedItems;
        
        // ======= USE ALL FINAL REPORTS FOR CALCULATIONS (WITH OR WITHOUT SURVEYS) =======
        // Include all final reports in calculations to ensure complete statistics
        const calculationReports = processedItems.filter((r: any) => 
            (r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        // ======= FINAL REPORTS WITH SURVEYS FOR DETAILED ANALYTICS =======
        // Track final reports with surveys for detailed analytics like LISA counting
        const finalReportsWithSurveys = processedItems.filter((r: any) => 
            r.has_surveys && 
            (r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        // ======= DRAFT REPORTS WITH SURVEYS FOR SEPARATE TRACKING =======
        // Track draft reports separately to show progress before finalization
        const draftReportsWithSurveys = processedItems.filter((r: any) => 
            r.has_surveys && 
            !(r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        // Count reports by status
        const reportStatusCount = {
            all: processedItems.length,
            withSurveys: processedItems.filter((r: any) => r.has_surveys).length,
            final: calculationReports.length, // All final reports (with or without surveys)
            finalWithSurveys: finalReportsWithSurveys.length,
            draftWithSurveys: draftReportsWithSurveys.length
        };
        
        // Calculate total distance (only from final reports with surveys)
        const totalDistance = finalReportsWithSurveys.reduce((sum: number, report: any) => {
            const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
            return sum + distance;
        }, 0);
        
        // Distance for specific vehicles (only from final reports with surveys)
        const car1Distance = finalReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #1')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car2Distance = finalReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #2')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car3Distance = finalReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #3')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car4Distance = finalReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #4')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);
        
        // Calculate total distance for draft reports with surveys
        const totalDraftDistance = draftReportsWithSurveys.reduce((sum: number, report: any) => {
            const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
            return sum + distance;
        }, 0);
        
        // Distance for specific vehicles (from draft reports with surveys)
        const car1DraftDistance = draftReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #1')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car2DraftDistance = draftReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #2')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car3DraftDistance = draftReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #3')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);

        const car4DraftDistance = draftReportsWithSurveys
            .filter((r: any) => r.surveyor_unit_desc === 'Vehicle #4')
            .reduce((sum: number, report: any) => {
                const distance = report.dist_mains_covered_length ? Number(report.dist_mains_covered_length) : 0;
                return sum + distance;
            }, 0);
        
        // Get all unique LISAs from final reports with surveys (LISA data only comes from surveys)
        const allUniqueIndications = new Map();
        
        // Process all LISA indications from final reports with surveys only
        finalReportsWithSurveys.forEach(report => {
            if (report.indications && Array.isArray(report.indications)) {
                report.indications.forEach((indication: any) => {
                    // Use lisa_id if available, otherwise use lisa_name
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) {
                        // Store with the report's surveyor_unit_desc for per-vehicle counting
                        indication.surveyor_unit_desc = report.surveyor_unit_desc;
                        allUniqueIndications.set(uniqueId, indication);
                    }
                });
            }
        });
        
        // Count unique indications
        const uniqueIndicationsArray = Array.from(allUniqueIndications.values());
        const totalUniqueIndications = uniqueIndicationsArray.length;
        
        // Count unique indications per vehicle
        const uniqueCar1Indications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'Vehicle #1'
        ).length;

        const uniqueCar2Indications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'Vehicle #2'
        ).length;

        const uniqueCar3Indications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'Vehicle #3'
        ).length;

        const uniqueCar4Indications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'Vehicle #4'
        ).length;
        
        // Calculate LISA per km metrics using unique indications
        const totalLisaPerKm = totalDistance > 0 ? (totalUniqueIndications / totalDistance) : 0;
        const car1LisaPerKm = car1Distance > 0 ? (uniqueCar1Indications / car1Distance) : 0;
        const car2LisaPerKm = car2Distance > 0 ? (uniqueCar2Indications / car2Distance) : 0;
        const car3LisaPerKm = car3Distance > 0 ? (uniqueCar3Indications / car3Distance) : 0;
        const car4LisaPerKm = car4Distance > 0 ? (uniqueCar4Indications / car4Distance) : 0;
        
        // Calculate total gaps from final reports with surveys (gaps data only comes from surveys)
        const totalGaps = finalReportsWithSurveys.reduce((sum: number, report: any) => {
            const reportGaps = report.fieldOfViewGapsCount || 0;
            if (reportGaps > 0) {
                console.log(`[DEBUG] Adding ${reportGaps} gaps from report ${report.report_name} to total (current sum: ${sum})`);
            }
            return sum + reportGaps;
        }, 0);
        
        console.log(`[DEBUG] Final total gaps calculated: ${totalGaps} from ${finalReportsWithSurveys.length} final reports with surveys`);

        // Placeholder for work hours - will be loaded from separate API
        const totalWorkHours = 0;
        const car1WorkHours = 0;
        const car2WorkHours = 0;
        const car3WorkHours = 0;
        const car4WorkHours = 0;
        
        // Weekly targets (configurable)
        const WEEKLY_TARGET_KM = 200; // Client's weekly target in km
        const DAILY_TARGET_KM = WEEKLY_TARGET_KM / 5; // Assuming 5 working days
        
        // Calculate progress against targets
        const weeklyProgress = timePeriod === 'week' ? (totalDistance / WEEKLY_TARGET_KM) * 100 : 0;
        const dailyProgress = timePeriod === 'today' ? (totalDistance / DAILY_TARGET_KM) * 100 : 0;
        
        // Calculate statistics
        const stats = {
            totalReports: filteredItems.length,
            calculationReportsCount: calculationReports.length,
            reportCounts: reportStatusCount,
            totalDistance,
            car1Distance,
            car2Distance,
            car3Distance,
            car4Distance,
            totalDraftDistance,
            car1DraftDistance,
            car2DraftDistance,
            car3DraftDistance,
            car4DraftDistance,
            totalGaps,
            totalIndications: totalUniqueIndications,
            totalRawIndications: finalReportsWithSurveys.reduce((sum, item: any) => sum + (item.indicationsCount || 0), 0),
            car1LisaCount: uniqueCar1Indications,
            car2LisaCount: uniqueCar2Indications,
            car3LisaCount: uniqueCar3Indications,
            car4LisaCount: uniqueCar4Indications,
            totalLisaPerKm,
            car1LisaPerKm,
            car2LisaPerKm,
            car3LisaPerKm,
            car4LisaPerKm,
            totalWorkHours,
            car1WorkHours,
            car2WorkHours,
            car3WorkHours,
            car4WorkHours,
            // Target tracking
            weeklyTargetKm: WEEKLY_TARGET_KM,
            dailyTargetKm: DAILY_TARGET_KM,
            weeklyProgress,
            dailyProgress,
            timePeriod
        };
        
        // Log processed data summary
        console.log('API: Processed reports summary:', {
            total: processedItems.length,
            allFinalReports: calculationReports.length,
            finalWithSurveys: finalReportsWithSurveys.length,
            filtered: filteredItems.length,
            rawIndicationsCount: stats.totalRawIndications,
            uniqueIndicationsCount: totalUniqueIndications
        });
        
        // Prepare response
        return json({
            reports: filteredItems,
            stats,
            meta: {
                page: result.page,
                totalPages: result.totalPages,
                totalItems: withSurveys ? filteredItems.length : result.totalItems,
                perPage: result.perPage,
                calculationReportsCount: calculationReports.length,
                ...(useAllReports && { note: 'No final reports found, returning all reports' })
            }
        }, {
            headers: {
                'Cache-Control': 'private, max-age=60' // cache for 1 minute
            }
        });
        
    } catch (error) {
        console.error('Error fetching reports from PocketBase:', error);
        return json({
            error: 'Failed to fetch reports',
            details: error instanceof Error ? error.message : String(error),
            reports: []
        }, { status: 500 });
    }
}; 