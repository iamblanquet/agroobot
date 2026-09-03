/**
 * Cliente HTTP para comunicación con el backend Standalone API
 */

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('tesa_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (netErr) {
    throw new ApiError('Error de red o servidor no disponible.', 0, { isNetworkError: true });
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Error ${response.status}: ${response.statusText}`;
    const isAuthError = response.status === 401 || (response.status === 403 && errorMsg.toLowerCase().includes('token'));
    if (isAuthError && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/telegram') && !endpoint.includes('/auth/pin-login')) {
      localStorage.removeItem('tesa_token');
      localStorage.removeItem('tesa_user');
      window.dispatchEvent(new CustomEvent('tesa:unauthorized'));
    }
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' })
};

export default api;
