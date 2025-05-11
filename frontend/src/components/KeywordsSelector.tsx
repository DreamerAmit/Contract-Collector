import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  TextField,
  Typography
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface KeywordsSelectorProps {
  selectedKeywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  allowCustom?: boolean;
}

const KeywordsSelector: React.FC<KeywordsSelectorProps> = ({
  selectedKeywords,
  onKeywordsChange,
  allowCustom = false
}) => {
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load saved keywords from the API
  useEffect(() => {
    const fetchKeywords = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/keywords`, {
          withCredentials: true
        });
        
        const keywordList = response.data.map((k: any) => k.keyword);
        setSavedKeywords(keywordList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching keywords:', error);
        setError('Failed to load keywords');
        setLoading(false);
      }
    };

    fetchKeywords();
  }, []);

  // Handle selection changes
  const handleKeywordsChange = (_event: React.SyntheticEvent, value: string[]) => {
    onKeywordsChange(value);
  };

  return (
    <Box>
      <Autocomplete
        multiple
        id="keywords-selector"
        options={savedKeywords}
        value={selectedKeywords}
        onChange={handleKeywordsChange}
        freeSolo={allowCustom}
        renderTags={(value: readonly string[], getTagProps) =>
          value.map((option: string, index: number) => (
            <Chip
              label={option}
              {...getTagProps({ index })}
              key={option}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label="Keywords"
            placeholder="Select keywords or type new ones"
            helperText={allowCustom ? "Select existing keywords or type new ones" : "Select keywords"}
            fullWidth
            error={!!error}
          />
        )}
        loading={loading}
      />
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default KeywordsSelector; 