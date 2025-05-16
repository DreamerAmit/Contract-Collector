import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Types
interface User {
  id: number;
  email: string;
  google_credentials: boolean; // Whether the user has uploaded Google credentials
  googleWorkspaceEmail?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

// Create context
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {}
});

// Auth provider component
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Add this to the top of AuthContext.tsx
  axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Set default axios auth header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Get user info
          const response = await axios.get('/api/auth/me');
          
          setUser({
            id: response.data.id,
            email: response.data.email,
            google_credentials: !!response.data.googleConnected,
            googleWorkspaceEmail: response.data.googleWorkspaceEmail
          });
        } catch (error) {
          console.error('Authentication error:', error);
          localStorage.removeItem('token');
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });

      const { token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      
      // Set axios default header 
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Get user info
      const userResponse = await axios.get('/api/auth/me');
      
      // Get user info from the response directly
      setUser({
        id: userResponse.data.id,
        email: userResponse.data.email,
        google_credentials: !!userResponse.data.googleConnected,
        googleWorkspaceEmail: userResponse.data.googleWorkspaceEmail
      });
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  };

  // Register function
  const register = async (email: string, password: string) => {
    try {
      await axios.post('/api/auth/register', { email, password });
      
      // After registration, log the user in
      await login(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Registration failed. Email might already be in use.');
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Update user data
  const updateUser = (userData: User) => {
    setUser(userData);
  };

  // Add a function to ensure authentication before making any request
  const ensureAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext); 