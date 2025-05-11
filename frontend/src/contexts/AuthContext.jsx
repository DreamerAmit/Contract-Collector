import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../utils/api';

// Create context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state - check if user is already logged in
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (storedUser && token) {
        try {
          // Validate token and get current user data
          const response = await authAPI.getProfile();
          setUser(response.data);
        } catch (err) {
          // Token invalid or expired
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  // Register a new user
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      
      // Store token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
      throw err;
    }
  };

  // Login user
  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      
      // Store token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
      throw err;
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.updateProfile(userData);
      
      // Update stored user data
      const updatedUser = { ...user, ...response.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update profile');
      throw err;
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile
  };

  // Return provider with value
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 