import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Button, CircularProgress,
  Alert, TextField, Chip, Divider, List, ListItem, ListItemText,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';

interface Keyword {
  id: number;
  keyword: string;
}

const KeywordsManagement: React.FC = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);

  // Fetch keywords on component mount
  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/keywords');
      setKeywords(response.data);
    } catch (err: any) {
      console.error('Error fetching keywords:', err);
      setError(err.response?.data?.detail || 'Failed to fetch keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyword.trim()) {
      setError('Keyword cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/keywords', { keyword: newKeyword.trim() });
      setKeywords([...keywords, response.data]);
      setNewKeyword('');
      setSuccess('Keyword added successfully!');
    } catch (err: any) {
      console.error('Error adding keyword:', err);
      setError(err.response?.data?.detail || 'Failed to add keyword');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (keyword: Keyword) => {
    setSelectedKeyword(keyword);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedKeyword) return;
    
    setDeleting(selectedKeyword.id);
    setError('');
    setSuccess('');

    try {
      await axios.delete(`/api/keywords/${selectedKeyword.id}`);
      setKeywords(keywords.filter(k => k.id !== selectedKeyword.id));
      setSuccess('Keyword deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting keyword:', err);
      setError(err.response?.data?.detail || 'Failed to delete keyword');
    } finally {
      setDeleting(null);
      setDeleteDialogOpen(false);
      setSelectedKeyword(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedKeyword(null);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Keywords Management
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="body1" paragraph>
          Manage the keywords used to search for contracts in your Google Workspace. 
          Add keywords that would typically appear in contract documents, such as "agreement", "contract", "terms", etc.
        </Typography>
      </Paper>
      
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Add New Keyword
        </Typography>
        
        <Box component="form" onSubmit={handleAddKeyword} sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <TextField
            label="New Keyword"
            variant="outlined"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            sx={{ flexGrow: 1, mr: 2 }}
            disabled={loading}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={loading || !newKeyword.trim()}
          >
            Add
          </Button>
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current Keywords
        </Typography>
        
        {loading && !keywords.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {keywords.length === 0 ? (
              <Typography color="textSecondary" sx={{ my: 2, textAlign: 'center' }}>
                No keywords added yet. Add your first keyword above.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 2 }}>
                {keywords.map((keyword) => (
                  <Chip
                    key={keyword.id}
                    label={keyword.keyword}
                    onDelete={() => handleDeleteClick(keyword)}
                    disabled={deleting === keyword.id}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </Paper>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Keyword</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the keyword "{selectedKeyword?.keyword}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            disabled={deleting !== null}
          >
            {deleting !== null ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default KeywordsManagement; 