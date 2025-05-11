import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Button, CircularProgress,
  Alert, TextField, InputAdornment, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Chip, Dialog, DialogTitle, 
  DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { 
  Search as SearchIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CloudDownload as CloudDownloadIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Contract {
  id: number;
  name: string;
  filePath: string;
  contentType: string;
  extractedText?: string;
  contractValue: number | null;
  renewalDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const ContractList: React.FC = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Fetch contracts on component mount
  useEffect(() => {
    fetchContracts();
  }, []);
  
  const fetchContracts = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('/api/contracts');
      
      // Sort by renewal date (descending)
      const sortedContracts = response.data.sort((a: Contract, b: Contract) => {
        if (!a.renewalDate) return 1;
        if (!b.renewalDate) return -1;
        return new Date(b.renewalDate).getTime() - new Date(a.renewalDate).getTime();
      });
      
      setContracts(sortedContracts);
    } catch (err: any) {
      console.error('Error fetching contracts:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };
  
  const handleDeleteClick = (contract: Contract) => {
    setContractToDelete(contract);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;
    
    setDeleting(true);
    setError('');
    setSuccess('');
    
    try {
      await axios.delete(`/api/contracts/${contractToDelete.id}`);
      setContracts(contracts.filter(c => c.id !== contractToDelete.id));
      setSuccess(`Contract "${contractToDelete.name}" deleted successfully`);
    } catch (err: any) {
      console.error('Error deleting contract:', err);
      setError(err.response?.data?.error?.message || 'Failed to delete contract');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    }
  };
  
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setContractToDelete(null);
  };
  
  const handleDownload = async (contractId: number) => {
    try {
      const response = await axios.get(`/api/contracts/${contractId}/download`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract-${contractId}.pdf`);
      
      // Append to html link element page
      document.body.appendChild(link);
      
      // Start download
      link.click();
      
      // Clean up and remove the link
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error downloading contract:', err);
      setError('Failed to download contract');
    }
  };
  
  // Filter contracts based on search term
  const filteredContracts = contracts.filter(contract => 
    contract.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Calculate displayed contracts with pagination
  const displayedContracts = filteredContracts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        All Contracts
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <TextField
            label="Search Contracts"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: '40%' }}
          />
          
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/upload-contracts')}
          >
            Upload Contracts
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : contracts.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No Contracts Found
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              You haven't added any contracts yet. Upload contracts from Google Workspace.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/upload-contracts')}
              sx={{ mt: 2 }}
            >
              Upload Contracts
            </Button>
          </Paper>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Contract Name</TableCell>
                    <TableCell>Contract Amount</TableCell>
                    <TableCell>Renewal Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>{contract.name}</TableCell>
                      <TableCell>
                        {contract.contractValue ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AttachMoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                            {contract.contractValue.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'USD'
                            })}
                          </Box>
                        ) : (
                          <Typography color="textSecondary">Not available</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {contract.renewalDate ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CalendarIcon sx={{ mr: 1, color: 'primary.main' }} />
                            {new Date(contract.renewalDate).toLocaleDateString()}
                          </Box>
                        ) : (
                          <Typography color="textSecondary">Not available</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDownload(contract.id)}
                          title="Download"
                        >
                          <CloudDownloadIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteClick(contract)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={filteredContracts.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Contract</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the contract "{contractToDelete?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ContractList; 