import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Button, CircularProgress,
  Alert, TextField, Divider, Grid, Card, CardContent, CardActions,
  Checkbox, FormControlLabel, FormGroup, Stepper, Step, StepLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip
} from '@mui/material';
import { 
  Visibility as VisibilityIcon, 
  Search as SearchIcon,
  Check as CheckIcon,
  Done as DoneIcon,
  Email as EmailIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import axios from 'axios';

interface EmailContract {
  id: string;
  subject: string;
  sender: string;
  date: string;
  attachmentName: string;
  selected: boolean;
}

const ContractReview: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [contracts, setContracts] = useState<EmailContract[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [processingResults, setProcessingResults] = useState<any[]>([]);
  
  // Fetch keywords on component mount
  useEffect(() => {
    fetchKeywords();
  }, []);
  
  const fetchKeywords = async () => {
    try {
      const response = await axios.get('/api/keywords');
      setSearchKeywords(response.data.map((k: any) => k.keyword));
    } catch (err) {
      console.error('Error fetching keywords:', err);
      setError('Failed to fetch keywords');
    }
  };
  
  const handleSearch = async () => {
    if (searchKeywords.length === 0) {
      setError('Please add at least one keyword to search for');
      return;
    }
    
    setSearching(true);
    setError('');
    setSuccess('');
    
    try {
      // Format the search request
      const formData = new FormData();
      formData.append('keywords', JSON.stringify(searchKeywords));
      
      if (startDate) formData.append('start_date', startDate);
      if (endDate) formData.append('end_date', endDate);
      
      // Search emails
      const response = await axios.post('/api/google/search-emails', formData);
      
      // Format the results
      const emailsWithAttachments = response.data.emails
        .filter((email: any) => email.hasAttachments)
        .map((email: any) => ({
          id: email.id,
          subject: email.subject,
          sender: email.sender,
          date: email.date,
          attachmentName: email.attachments[0]?.name || 'Unknown',
          selected: false
        }));
      
      setContracts(emailsWithAttachments);
      setSelectedContracts([]);
      
      if (emailsWithAttachments.length === 0) {
        setSuccess('Search completed, but no emails with attachments were found');
      } else {
        setSuccess(`Found ${emailsWithAttachments.length} potential contracts`);
        setActiveStep(1);
      }
    } catch (err: any) {
      console.error('Error searching emails:', err);
      setError(err.response?.data?.detail || 'Failed to search emails');
    } finally {
      setSearching(false);
    }
  };
  
  const handleToggleContract = (contractId: string) => {
    const newSelectedContracts = [...selectedContracts];
    
    if (newSelectedContracts.includes(contractId)) {
      // Remove from selection
      const index = newSelectedContracts.indexOf(contractId);
      newSelectedContracts.splice(index, 1);
    } else {
      // Add to selection
      newSelectedContracts.push(contractId);
    }
    
    setSelectedContracts(newSelectedContracts);
  };
  
  const handleSelectAll = () => {
    if (selectedContracts.length === contracts.length) {
      // Deselect all
      setSelectedContracts([]);
    } else {
      // Select all
      setSelectedContracts(contracts.map(c => c.id));
    }
  };
  
  const handleProcessSelected = async () => {
    if (selectedContracts.length === 0) {
      setError('Please select at least one contract to process');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // This would be an actual API call to process contracts
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate processing results
      const results = selectedContracts.map(id => {
        const contract = contracts.find(c => c.id === id);
        return {
          id,
          subject: contract?.subject,
          analyzed: true,
          contractName: `Contract: ${contract?.subject.substring(0, 25)}`,
          renewalDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          contractValue: Math.floor(Math.random() * 100000) / 100
        };
      });
      
      setProcessingResults(results);
      setSuccess(`Successfully processed ${results.length} contracts`);
      setActiveStep(2);
    } catch (err: any) {
      console.error('Error processing contracts:', err);
      setError(err.response?.data?.detail || 'Failed to process contracts');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFinish = () => {
    navigate('/contracts');
  };
  
  const steps = [
    'Search for Contracts',
    'Select Contracts to Analyze',
    'Review Results'
  ];
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Contract Review
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
        
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Search for Contracts
            </Typography>
            
            <Typography paragraph>
              We'll search your Google Workspace for emails with contract attachments 
              based on the keywords you've set up.
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Start Date (optional)"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="End Date (optional)"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Search Keywords:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {searchKeywords.length > 0 ? (
                  searchKeywords.map((keyword, index) => (
                    <Chip 
                      key={index} 
                      label={keyword} 
                      color="primary" 
                      variant="outlined" 
                    />
                  ))
                ) : (
                  <Typography color="textSecondary">
                    No keywords added yet. Please add keywords in the Keywords section.
                  </Typography>
                )}
              </Box>
            </Box>
            
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={searching || searchKeywords.length === 0}
              sx={{ mt: 2 }}
            >
              {searching ? <CircularProgress size={24} /> : 'Search for Contracts'}
            </Button>
          </Box>
        )}
        
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Contracts to Analyze
            </Typography>
            
            <Typography paragraph>
              Select the emails with contract attachments that you want to analyze.
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                onClick={handleSelectAll}
                sx={{ mr: 2 }}
              >
                {selectedContracts.length === contracts.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={handleProcessSelected}
                disabled={loading || selectedContracts.length === 0}
              >
                {loading ? <CircularProgress size={24} /> : 'Process Selected'}
              </Button>
            </Box>
            
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedContracts.length === contracts.length && contracts.length > 0}
                        indeterminate={selectedContracts.length > 0 && selectedContracts.length < contracts.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Email Subject</TableCell>
                    <TableCell>Sender</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Attachment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedContracts.includes(contract.id)}
                          onChange={() => handleToggleContract(contract.id)}
                        />
                      </TableCell>
                      <TableCell>{contract.subject}</TableCell>
                      <TableCell>{contract.sender}</TableCell>
                      <TableCell>{new Date(contract.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DescriptionIcon sx={{ mr: 1 }} />
                          {contract.attachmentName}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No contracts found. Try adjusting your search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
              sx={{ mt: 2, mr: 2 }}
            >
              Back to Search
            </Button>
          </Box>
        )}
        
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Results
            </Typography>
            
            <Typography paragraph>
              The selected contracts have been analyzed. Review the results below.
            </Typography>
            
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Contract Name</TableCell>
                    <TableCell>Renewal Date</TableCell>
                    <TableCell>Contract Value</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processingResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>{result.contractName}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CalendarIcon sx={{ mr: 1 }} />
                          {result.renewalDate}
                        </Box>
                      </TableCell>
                      <TableCell>${result.contractValue.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip 
                          icon={<DoneIcon />} 
                          label="Added" 
                          color="success" 
                          variant="outlined" 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
              >
                Back to Selection
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<DoneIcon />}
                onClick={handleFinish}
              >
                Finish
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default ContractReview; 