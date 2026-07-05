const BASE_URL = 'http://127.0.0.1:8000';

export interface ApiRequestOptions extends RequestInit {
  useExamToken?: boolean;
}

export const getAuthToken = () => localStorage.getItem('access_token');
export const getRefreshToken = () => localStorage.getItem('refresh_token');
export const getExamToken = () => localStorage.getItem('exam_session_token');

export const setAuthSession = (accessToken: string, refreshToken: string, role: string, userId: number, userName: string) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user_role', role);
  localStorage.setItem('user_id', String(userId));
  localStorage.setItem('user_name', userName);
};

export const clearAuthSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('exam_session_token');
  localStorage.removeItem('active_attempt_id');
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
};

export async function apiFetch(endpoint: string, options: ApiRequestOptions = {}): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.useExamToken) {
    const examToken = getExamToken();
    if (examToken) {
      if (endpoint.includes('screenshot') || endpoint.includes('event')) {
      } else {
        headers.set('Authorization', `Bearer ${examToken}`);
      }
    }
  } else {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const fetchOptions = { ...options, headers };

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 401 && !options.useExamToken && getRefreshToken()) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: getRefreshToken() }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setAuthSession(data.access_token, data.refresh_token, data.role, data.user_id, data.name);
            isRefreshing = false;
            onRefreshed(data.access_token);
          } else {
            isRefreshing = false;
            clearAuthSession();
            window.location.href = '/auth';
            throw new Error('Session expired');
          }
        } catch (err) {
          isRefreshing = false;
          clearAuthSession();
          window.location.href = '/auth';
          return Promise.reject(err);
        }
      }

      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          resolve(fetch(url, fetchOptions).then((r) => r.json()));
        });
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
}

export const parseUTCDate = (
  dateStr: string | Date | null | undefined
): Date => {
  if (!dateStr) return new Date();

  if (dateStr instanceof Date) return dateStr;

  if (typeof dateStr === "string") {
    return new Date(dateStr.replace(" ", "T"));
  }

  return new Date(dateStr);
};

export { BASE_URL };
