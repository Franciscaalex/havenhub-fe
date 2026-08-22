console.log("app.js is connected");

fetch("header.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("header-placeholder").innerHTML = data;
  });


fetch("footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer-placeholder").innerHTML = data;
  });



function loginUser(username) {
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("username", username);
}

function logoutUser() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("username");
}

function isUserLoggedIn() {
  return localStorage.getItem("isLoggedIn") === "true";
}

function getCurrentUsername() {
  return localStorage.getItem("username");
}

const CONFIG = {
  BASE_URL: 'https://api.yourrealestatesite.com',
  USE_MOCK_DATA: true,
  MOCK_BASE_PATH: '/mock-data',

  TOKEN_KEY: 'auth_token',
  TOKEN_EXPIRY_KEY: 'auth_token_expiry',
};

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
  clearSession();
  const returnTo = encodeURIComponent(window.location.pathname);
  window.location.href = `/login.html?redirect=${returnTo}`;
}

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
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isMock = CONFIG.USE_MOCK_DATA;
  const url = isMock
    ? `${CONFIG.MOCK_BASE_PATH}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}`;

  const fetchOptions = { ...options, headers };

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

  if (response.status === 401) {
    redirectToLogin();
    throw new Error('Unauthorized — redirecting to login.');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch (_) {
      
    }
    throw new Error(message);
  }

  if (response.status === 204) return null; 
  return response.json();
}


const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, data) =>
    apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) =>
    apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),

  setToken,
  clearSession,
  isAuthenticated: () => !!getToken() && !isTokenExpired(),
};

window.api = api;
