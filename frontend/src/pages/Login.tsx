import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Container, Box, Avatar, Typography, TextField, Button, 
  Grid, Link, Paper, CircularProgress, Alert
} from '@mui/material';
import { LockOutlined as LockOutlinedIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      
      // Check if there's a saved redirect path
      const redirectPath = sessionStorage.getItem('redirect_after_login');
      if (redirectPath) {
        console.log('Redirecting to saved path after login:', redirectPath);
        sessionStorage.removeItem('redirect_after_login');
        window.location.href = redirectPath;
      } else {
        // Default redirect to upload-contracts instead of dashboard
        window.location.href = '/upload-contracts';
      }
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* ShowRenewals.com branding */}
          <Typography 
            component="h1" 
            variant="h4" 
            sx={{ 
              color: 'primary.main', 
              fontWeight: 'bold',
              mb: 2 
            }}
          >
            Show Renewals
          </Typography>
          
          <Typography 
            variant="subtitle1" 
            sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}
          >
           Track your renewals efficiently
          </Typography>

          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h2" variant="h5" sx={{ mt: 1 }}>
            Sign in
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>
            <Grid container>
              <Grid item>
                <Link component={RouterLink} to="/register" variant="body2">
                  {"Don't have an account? Sign Up"}
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login; 