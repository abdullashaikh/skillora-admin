export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const ADMIN_TOKEN_STORAGE_KEY = 'skilled_admin_token';

export function getStoredAdminToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  }
  return null;
}

export function setStoredAdminToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }
}

export function clearStoredAdminToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

/**
 * Universal fetch wrapper for communicating directly with Express backend (port 5000).
 * Always includes credentials (cookies) for admin session and attaches Authorization: Bearer token.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/api')
    ? endpoint.replace(/^\/api/, '')
    : endpoint;

  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const url = cleanEndpoint.startsWith('http')
    ? cleanEndpoint
    : `${baseUrl}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;

  console.log(`[Admin API Client] Fetching directly from Backend: ${url}`);

  const token = getStoredAdminToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * Safe JSON parser that provides helpful error messages if server responds with non-JSON
 */
export async function parseApiResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Server error (${res.status}): ${text.slice(0, 150) || res.statusText || 'Non-JSON response'}`
    );
  }

  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json as T;
}
