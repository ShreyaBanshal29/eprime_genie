// utils/api.ts (Updated for dynamic token inclusion)

export async function apiGet(path: string, userToken?: string) { // <-- Added optional userToken parameter
    const base = (process.env.NEXT_PUBLIC_EXTERNAL_API_BASE || process.env.AUTH_API_URL || '').replace(/\/$/, '');
    if (!base) {
        throw new Error('External API base URL not configured');
    }
    const url = `${base}/${path.replace(/^\//, '')}`;
    
    // Server's static API key (for general requests that need a master key)
    const staticToken = process.env.NEXT_PUBLIC_API_TOKEN || process.env.API_TOKEN || process.env.X_API_TOKEN;

    const headers: Record<string, string> = {};

    // 1. Prioritize dynamic user token for AUTHENTICATION
    if (userToken) {
        // External verification endpoints usually expect Bearer for user tokens
        headers['Authorization'] = `Bearer ${userToken}`; 
    } 
    // 2. Use the static API key only if the user token is NOT present (for generic data fetches)
    else if (staticToken) {
        headers['X-API-TOKEN'] = staticToken; 
    }

    const res = await fetch(url, {
        method: 'GET',
        headers: Object.keys(headers).length > 0 ? headers : undefined, // Send headers only if they exist
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        // NOTE: Improved error message for debugging
        throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}. Response body: ${text.substring(0, 100)}`); 
    }
    return res.json();
}