const API_BASE = import.meta.env.VITE_HTTP_API_URL;

export async function apiFetch(
  path: string,
  idToken: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const url = `${API_BASE}${path}`;
  return fetch(url, { ...options, headers });
}
