import React, { useState, useEffect } from 'react';
import { 
  Container, Paper, Typography, Grid, Card, CardContent, 
  List, ListItem, ListItemText, Divider, Box
} from '@mui/material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import axios from 'axios';

// Types
interface Contract {
  id: number;
  name: string;
  contractValue: number;
  renewalDate: string;
}

const Calendar: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Fetch contracts
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/contracts');
        console.log('Contracts retrieved from API:', response.data);
        setContracts(response.data);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, []);

  // Get days in current month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Get contracts due for renewal in the next 30 days
  const upcomingRenewals = contracts
    .filter(contract => {
      const renewalDate = new Date(contract.renewalDate);
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);
      return renewalDate >= today && renewalDate <= nextMonth;
    })
    .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());

  // Check if a day has renewals
  const getRenewalsForDay = (day: Date) => {
    return contracts.filter(contract => {
      const renewalDate = new Date(contract.renewalDate);
      return isSameDay(renewalDate, day);
    });
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Contract Renewal Calendar
      </Typography>
      
      <Grid container spacing={3}>
        {/* Calendar View */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {format(currentDate, 'MMMM yyyy')}
            </Typography>
            
            <Grid container spacing={1}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Grid item xs={1.7} key={day}>
                  <Typography align="center" fontWeight="bold">
                    {day}
                  </Typography>
                </Grid>
              ))}
              
              {daysInMonth.map(day => {
                const dayRenewals = getRenewalsForDay(day);
                return (
                  <Grid item xs={1.7} key={day.toString()}>
                    <Card 
                      sx={{ 
                        minHeight: 80,
                        bgcolor: dayRenewals.length > 0 ? 'primary.light' : 'background.paper',
                        cursor: 'pointer'
                      }}
                    >
                      <CardContent sx={{ p: 1 }}>
                        <Typography align="center">
                          {format(day, 'd')}
                        </Typography>
                        {dayRenewals.length > 0 && (
                          <Typography variant="caption" display="block" align="center">
                            {dayRenewals.length} renewal{dayRenewals.length !== 1 ? 's' : ''}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Grid>
        
        {/* Upcoming Renewals */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Renewals (Next 30 days)
            </Typography>
            
            <List>
              {upcomingRenewals.length > 0 ? (
                upcomingRenewals.map((contract, index) => (
                  <React.Fragment key={contract.id}>
                    <ListItem>
                      <ListItemText
                        primary={contract.name}
                        secondary={
                          <React.Fragment>
                            <Typography component="span" variant="body2" color="text.primary">
                              ${contract.contractValue ? contract.contractValue.toLocaleString() : '0'}
                            </Typography>
                            <br />
                            Renewal: {format(new Date(contract.renewalDate), 'MMM d, yyyy')}
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    {index < upcomingRenewals.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))
              ) : (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No upcoming renewals
                  </Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Calendar; 