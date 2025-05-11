-- Create vault_searches table
CREATE TABLE IF NOT EXISTS vault_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  matter_id VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  gmail_export_id VARCHAR(255),
  drive_export_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'CREATED',
  search_terms TEXT,
  error_message TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 