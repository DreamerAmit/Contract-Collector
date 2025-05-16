import axios from 'axios';

// Create axios instance with base URL and default configs
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token to every request
api.interceptors.request.use(
  (config) => {
    // First try localStorage
    let token = localStorage.getItem('token');
    
    // If not found in localStorage, try sessionStorage backup
    if (!token) {
      token = sessionStorage.getItem('auth_token_backup');
      // If found in backup, restore to localStorage
      if (token) {
        console.log('Restoring token from backup during request');
        localStorage.setItem('token', token);
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with specific redirect handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized) more intelligently
    if (error.response && error.response.status === 401) {
      console.log('Received 401 error - checking if we have a backup token');
      
      // Check if we have a backup token before redirecting
      const backupToken = sessionStorage.getItem('auth_token_backup');
      if (backupToken && !localStorage.getItem('token')) {
        // Try to restore from backup instead of immediate logout
        console.log('Restoring from backup token after 401 error');
        localStorage.setItem('token', backupToken);
        
        // Don't redirect yet - let the request retry with new token
        const originalRequest = error.config;
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest.headers['Authorization'] = `Bearer ${backupToken}`;
          return api(originalRequest);
        }
      }
      
      // If we reach here, we really need to log out
      console.log('Authentication failed - redirecting to login');
      localStorage.removeItem('token');
      sessionStorage.removeItem('auth_token_backup');
      
      // Save current path for specific redirect after login
      const currentPath = window.location.pathname;
      if (currentPath.includes('upload-contracts')) {
        // Ensure we remember to go back to upload-contracts specifically
        sessionStorage.setItem('redirect_after_login', '/upload-contracts');
      } else if (currentPath !== '/login') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/me', userData),
};

// Contracts API
export const contractsAPI = {
  getContracts: (page = 0, limit = 100) => api.get(`/contracts?page=${page}&limit=${limit}`),
  getContract: (id) => api.get(`/contracts/${id}`),
  createContract: (formData) => {
    // For file uploads, we need to use FormData and change content type
    return api.post('/contracts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  updateContract: (id, contractData) => api.put(`/contracts/${id}`, contractData),
  deleteContract: (id) => api.delete(`/contracts/${id}`),
};

// Keywords API
export const keywordsAPI = {
  getKeywords: () => api.get('/keywords'),
  createKeyword: (keywordData) => api.post('/keywords', keywordData),
  updateKeyword: (id, keywordData) => api.put(`/keywords/${id}`, keywordData),
  deleteKeyword: (id) => api.delete(`/keywords/${id}`),
};

// Calendar API
export const calendarAPI = {
  getEvents: () => api.get('/calendar'),
  createEvent: (eventData) => api.post('/calendar', eventData),
  updateEvent: (id, eventData) => api.put(`/calendar/${id}`, eventData),
  deleteEvent: (id) => api.delete(`/calendar/${id}`),
};

// Google API
export const googleAPI = {
  getAuthUrl: () => api.get('/google/auth-url'),
  saveCredentials: (tokenData) => api.post('/google/save-credentials', tokenData),
  getDriveFiles: () => api.get('/google/drive/files'),
  getGmailMessages: () => api.get('/google/gmail/messages'),
};

// AI API
export const aiAPI = {
  analyzeContract: (contractData) => api.post('/ai/analyze-contract', contractData),
  extractKeywords: (contractData) => api.post('/ai/extract-keywords', contractData),
};

export default api; 