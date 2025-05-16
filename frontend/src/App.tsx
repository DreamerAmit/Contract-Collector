import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ContractList from './pages/ContractList';
import Calendar from './pages/Calendar';
import UploadContracts from './pages/UploadContracts';

// Components
import Layout from './components/Layout';

// Define theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CssBaseline />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/upload-contracts" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/upload-contracts" />} />
          
          {/* Protected routes */}
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Navigate to="/upload-contracts" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="contracts" element={<ContractList />} />
            <Route path="calendar" element={<Calendar />} />
            <Route 
              path="upload-contracts" 
              element={
                user ? (
                  <UploadContracts />
                ) : (
                  // If user is trying to access Upload Contracts but not logged in,
                  // try to restore session
                  <Navigate to={
                    localStorage.getItem('token') ? 
                    "/upload-contracts" : // Try with restored token
                    "/login?redirect=/upload-contracts" // Add redirect parameter
                  } />
                )
              } 
            />
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/upload-contracts" />} />
        </Routes>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App; 