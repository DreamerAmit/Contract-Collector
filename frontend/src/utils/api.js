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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized)
    if (error.response && error.response.status === 401) {
      // Clear local storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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