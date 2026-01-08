import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    let status = 'unknown';
    let error = null;
    let url = null;
    
    try {
        // Get PocketBase URL
        url = process.env.POCKETBASE_URL || 'https://w.zaur.app';
        
        // Check if PocketBase is accessible
        const response = await fetch(`${url}/api/health`);
        
        if (response.ok) {
            status = 'connected';
        } else {
            status = 'error';
            error = `Received response with status: ${response.status}`;
        }
    } catch (err: any) {
        status = 'error';
        error = err.message || 'Unknown error';
    }
    
    return {
        pbStatus: status,
        pbError: error,
        pbUrl: url
    };
}; 