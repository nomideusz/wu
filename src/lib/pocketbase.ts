import PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Get PocketBase URL from environment variables
// For client-side, this is made available through Vite's define in vite.config.ts
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://w.zaur.app';

// Create PocketBase client instance
// We'll use a different approach for client vs server
export const pb = browser 
  ? new PocketBase(POCKETBASE_URL)
  : null; // On server, we'll use the instance from locals

// In Svelte 5 Runes mode, we don't need to use a writable store
// The currentUser will be defined directly in components using $state()
// This is just the initial value
export const initialUserValue = browser ? pb?.authStore.record : null;

// Create a writable store for currentUser
export const currentUser = writable(initialUserValue);

// Enhanced version to properly handle auth state changes
export function setupAuthListener(setCurrentUser: (user: any) => void) {
  if (browser && pb) {
    // Set the initial state immediately
    console.log('Setting up auth listener, initial auth state:', pb.authStore.isValid ? 'Logged in' : 'Logged out');
    
    // Immediate call to set the current user
    setCurrentUser(pb.authStore.record);
    currentUser.set(pb.authStore.record);
    
    // Set up the onChange listener
    const unsubscribe = pb.authStore.onChange((token, model) => {
      console.log('Auth store changed:', model ? 'User authenticated' : 'No user', 'Token valid:', !!token);
      setCurrentUser(model);
      currentUser.set(model);
    });
    
    // Return cleanup function
    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }
  return () => {};
}

// ========= Gas Reports API =========

// Define the type for gas reports
export interface GasReport extends RecordModel {
  report_name: string;
  report_title: string;
  report_date: string;
  labels: string[];
  dist_mains_covered: number;
  report_final: number;
}

// API functions for gas reports with better error handling
export const gasReportsApi = {
  /**
   * Get all gas reports (only data after July 1st, 2025)
   * @param sortField Optional field to sort by (default: -report_date)
   * @returns Promise with array of gas reports
   */
  getAll: async (sortField: string = '-report_date'): Promise<GasReport[]> => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return [];
    }
    
    try {
      return await pb.collection('gas_reports').getFullList<GasReport>({
        sort: sortField,
        filter: 'report_date >= "2025-07-01"'
      });
    } catch (error) {
      console.error('Error fetching gas reports:', error);
      throw error;
    }
  },

  /**
   * Get a single gas report by ID
   * @param id Gas report ID
   * @returns Promise with the gas report
   */
  getById: async (id: string): Promise<GasReport | null> => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return null;
    }
    
    try {
      return await pb.collection('gas_reports').getOne<GasReport>(id);
    } catch (error) {
      console.error(`Error fetching gas report with ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get filtered gas reports (only data after July 1st, 2025)
   * @param filter Filter query
   * @param page Page number (default: 1)
   * @param perPage Items per page (default: 50)
   * @returns Promise with paginated gas reports
   */
  getFiltered: async (filter: string, page: number = 1, perPage: number = 50) => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return { items: [], totalItems: 0, totalPages: 0, page };
    }
    
    try {
      // Combine date filter with user provided filter
      const dateFilter = 'report_date >= "2025-07-01"';
      const combinedFilter = filter ? `${dateFilter} && (${filter})` : dateFilter;
      
      return await pb.collection('gas_reports').getList<GasReport>(page, perPage, {
        filter: combinedFilter,
      });
    } catch (error) {
      console.error('Error fetching filtered gas reports:', error);
      throw error;
    }
  }
};

// Format date for display
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

// Format date with time for display
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// ========= Reports API =========

// Interface for API response
interface ApiResponse<T> {
  reports: T[];
  stats: {
    totalReports: number;
    calculationReportsCount: number;
    reportCounts: {
      all: number;
      withSurveys: number;
      final: number;
      finalWithSurveys: number;
    };
    [key: string]: any;
  };
  meta: {
    page: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    calculationReportsCount?: number;
    note?: string;
  };
}

// API functions for reports using the server endpoint
export const reportsApi = {
  /**
   * Get all reports
   * @param options Optional query parameters
   * @returns Promise with array of reports and metadata
   */
  getAll: async (options: {
    limit?: number;
    page?: number;
    sort?: string;
    finalOnly?: boolean;
    includeUnitDesc?: boolean;
    withSurveys?: boolean;
  } = {}): Promise<ApiResponse<any>> => {
    if (!browser) {
      console.warn('Reports API not available on server side');
      return { 
        reports: [], 
        stats: {
          totalReports: 0,
          calculationReportsCount: 0,
          reportCounts: {
            all: 0,
            withSurveys: 0,
            final: 0,
            finalWithSurveys: 0
          }
        },
        meta: { 
          page: 1, 
          totalPages: 0, 
          totalItems: 0, 
          perPage: 0 
        } 
      };
    }
    
    try {
      // Build URL with query parameters
      const url = new URL('/api/v1/reports', window.location.origin);
      
      if (options.limit) url.searchParams.set('limit', String(options.limit));
      if (options.page) url.searchParams.set('page', String(options.page));
      if (options.sort) url.searchParams.set('sort', options.sort);
      if (options.finalOnly !== undefined) url.searchParams.set('finalOnly', String(options.finalOnly));
      if (options.includeUnitDesc) url.searchParams.set('includeUnitDesc', String(options.includeUnitDesc));
      if (options.withSurveys !== undefined) url.searchParams.set('withSurveys', String(options.withSurveys));
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },
  
  /**
   * Get reports with a specific filter
   * @param filter Filter to apply
   * @param options Optional query parameters
   * @returns Promise with filtered reports and metadata
   */
  getFiltered: async (filter: string, options: {
    limit?: number;
    page?: number;
    sort?: string;
    includeUnitDesc?: boolean;
    withSurveys?: boolean;
  } = {}): Promise<ApiResponse<any>> => {
    // For client-side filtering, we could implement this by 
    // calling the server endpoint and then filtering the results
    // This is a placeholder for future implementation
    console.warn('Client-side filtering not yet implemented');
    return reportsApi.getAll(options);
  }
}; 