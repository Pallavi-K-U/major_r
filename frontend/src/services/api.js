const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let token = localStorage.getItem('jwt_token') || null;

export const setToken = (newToken) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('jwt_token', newToken);
  } else {
    localStorage.removeItem('jwt_token');
  }
};

export const getToken = () => token;

// Helper to make authenticated requests
const authFetch = async (endpoint, options = {}) => {
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, options.headers);

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        error: { message: error.message || 'Network error / server unreachable', status: 0 }
      }
    };
  }
};

export const registerUser = async (userData) => {
  return authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials) => {
  const response = await authFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  if (response.ok && response.data.token) {
    setToken(response.data.token);
  }

  return response;
};

export const logoutUser = () => {
  setToken(null);
};

export const getDonorDashboard = async () => {
  return authFetch('/donor/dashboard', { method: 'GET' });
};

export const getNgoDashboard = async () => {
  return authFetch('/ngo/dashboard', { method: 'GET' });
};

export const getAdminDashboard = async () => {
  return authFetch('/admin/dashboard', { method: 'GET' });
};

// NGO Profile
export const getNgoProfile = async () => {
  return authFetch('/ngo/profile', { method: 'GET' });
};

export const updateNgoProfile = async (profileData) => {
  return authFetch('/ngo/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

// Project Management
export const createProject = async (projectData) => {
  return authFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  });
};

export const updateProject = async (projectId, projectData) => {
  return authFetch(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(projectData),
  });
};

export const getOwnProjects = async () => {
  return authFetch('/projects/my', { method: 'GET' });
};

export const getActiveProjects = async () => {
  return authFetch('/projects/active', { method: 'GET' });
};

export const getProjectDetails = async (projectId) => {
  return authFetch(`/projects/${projectId}`, { method: 'GET' });
};

// Admin NGO/Project management
export const adminGetNgos = async () => {
  return authFetch('/admin/ngos', { method: 'GET' });
};

export const adminGetProjects = async () => {
  return authFetch('/admin/projects', { method: 'GET' });
};

export const adminVerifyNgo = async (ngoProfileId) => {
  return authFetch(`/admin/ngos/${ngoProfileId}/verify`, {
    method: 'PUT',
  });
};

// Donation APIs
export const donateToProject = async (projectId, amount, idempotencyKey, transactionHash) => {
  return authFetch('/donations', {
    method: 'POST',
    body: JSON.stringify({ projectId, amount, idempotencyKey, transactionHash }),
  });
};

export const getDonationHistory = async () => {
  return authFetch('/donations/my', { method: 'GET' });
};

export const getNgoDonations = async () => {
  return authFetch('/ngo/donations', { method: 'GET' });
};

export const getNgoDonationsTotal = async () => {
  return authFetch('/ngo/donations/total', { method: 'GET' });
};

export const adminGetTransactions = async () => {
  return authFetch('/admin/transactions', { method: 'GET' });
};

export const adminUpdateTransactionReview = async (transactionId, reviewStatus) => {
  return authFetch(`/admin/transactions/${transactionId}/review`, {
    method: 'PUT',
    body: JSON.stringify({ reviewStatus }),
  });
};

// Document locker IPFS APIs
export const uploadProjectDocument = async (projectId, file) => {
  const formData = new FormData();
  formData.append('projectId', projectId);
  formData.append('file', file);
  return authFetch('/documents', {
    method: 'POST',
    body: formData,
  });
};

export const getProjectDocuments = async (projectId) => {
  return authFetch(`/projects/${projectId}/documents`, { method: 'GET' });
};

export const deleteProjectDocument = async (documentId) => {
  return authFetch(`/documents/${documentId}`, { method: 'DELETE' });
};

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('API health check fetch error:', error);
    return {
      ok: false,
      status: 0,
      data: {
        status: 'DOWN',
        services: {
          backend: 'DOWN',
          database: 'DOWN',
        },
        error: error.message || 'Network error / server unreachable',
      },
    };
  }
};

// Impact Analysis API
export const analyseProjectImpact = async (projectId, text) => {
  return authFetch(`/projects/${projectId}/analyse-impact`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};
