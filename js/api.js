/* api.js */

const CONFIG = {
  BASE_URL: 'https://havenhub-be.onrender.com/api/v1',
  USE_MOCK_DATA: false,
  MOCK_BASE_PATH: '/mock-data',

  TOKEN_KEY: 'auth_token',
  TOKEN_EXPIRY_KEY: 'auth_token_expiry',
};

/* ---------- Token storage ---------- */

function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY);
}

function setToken(token, expiresInSeconds) {
  localStorage.setItem(CONFIG.TOKEN_KEY, token);
  if (expiresInSeconds) {
    const expiryTimestamp = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(CONFIG.TOKEN_EXPIRY_KEY, String(expiryTimestamp));
  }
}

function clearSession() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
}

function isTokenExpired() {
  const expiry = localStorage.getItem(CONFIG.TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() > Number(expiry);
}

function redirectToLogin() {
  const currentPath = window.location.pathname;
  
  // CRITICAL GUARD: Stop the execution trail immediately if the user is already here
  if (currentPath.includes('login.html') || currentPath.includes('signup.html')) {
    clearSession();
    return; 
  }

  clearSession();
  const returnTo = encodeURIComponent(currentPath);
  window.location.href = `login.html?redirect=${returnTo}`;
}


/* JWT interceptor + request wrapper  */

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  if (token && isTokenExpired()) {
    redirectToLogin();
    return Promise.reject(new Error('Session expired. Redirecting to login.'));
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`; // <-- the interceptor
  }

  // FIXED: Placed securely inside the apiRequest function scope to fix the ReferenceError
  let cleanEndpoint = endpoint;
  if (cleanEndpoint && cleanEndpoint.startsWith('/api/v1')) {
    cleanEndpoint = cleanEndpoint.replace('/api/v1', '');
  }

  const isMock = CONFIG.USE_MOCK_DATA;
  const url = isMock
    ? `${CONFIG.MOCK_BASE_PATH}${cleanEndpoint}`
    : `${CONFIG.BASE_URL}${cleanEndpoint}`;

  const fetchOptions = { ...options, headers };

  // Mock JSON files can only be GET (static files), so force that in mock mode
  if (isMock) {
    fetchOptions.method = 'GET';
    delete fetchOptions.body;
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr) {
    throw new Error(`Network error contacting ${url}: ${networkErr.message}`);
  }

    // Open api.js and replace the 401 block with this:
  if (response.status === 401) {
    const isAuthRoute = window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html');
    
    if (!isAuthRoute) {
      redirectToLogin();
      throw new Error('Unauthorized — redirecting to login.');
    }
    
    // On the login page, extract the true error message instead of redirecting!
    let loginMessage = 'Invalid email or password.';
    try {
      const errorBody = await response.json();
      loginMessage = errorBody.message || loginMessage;
    } catch (_) { }
    throw new Error(loginMessage);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch (_) { }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, data) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (endpoint, data) => apiRequest(endpoint, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),

  setToken,
  clearSession,
  isAuthenticated: () => !!getToken() && !isTokenExpired(),
};
window.api = api;
