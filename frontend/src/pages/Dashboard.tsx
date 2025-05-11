import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Grid, Card, CardContent,
  CardActions, Button, CircularProgress, Alert
} from '@mui/material';
import { 
  Description as DocumentIcon,
  Event as CalendarIcon,
  Search as KeywordIcon,
  FileUpload as UploadIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface DashboardStats {
  contractsCount: number;
  upcomingRenewals: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Here we would fetch actual data from the backend
        // For now, let's simulate it
        
        setTimeout(() => {
          setStats({
            contractsCount: 0,
            upcomingRenewals: 0
          });
          setLoading(false);
        }, 1000);
        
        // Actual API call would look like this:
        // const response = await axios.get('/api/dashboard/stats');
        // setStats(response.data);
        // setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center', py: 8 }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dashboard...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Dashboard
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Contracts
              </Typography>
              <Typography variant="h3">
                {stats?.contractsCount || 0}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary"
                onClick={() => handleNavigate('/contracts')}
              >
                VIEW ALL CONTRACTS
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Upcoming Renewals
              </Typography>
              <Typography variant="h3">
                {stats?.upcomingRenewals || 0}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary"
                onClick={() => handleNavigate('/calendar')}
              >
                VIEW DETAILS
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<UploadIcon />}
                onClick={() => handleNavigate('/upload-contracts')}
                sx={{ py: 1, px: 2 }}
              >
                Upload Contracts
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CalendarIcon />}
                onClick={() => handleNavigate('/calendar')}
                sx={{ py: 1, px: 2 }}
              >
                View Calendar
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 