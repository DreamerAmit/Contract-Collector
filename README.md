# Contract Collector

A comprehensive solution for extracting, analyzing, and managing contracts from Google Workspace.

## Overview

Contract Collector automates the process of finding, extracting, and managing contracts from your Google Workspace (Gmail, Drive) using Google Vault API. It also utilizes AI to analyze contracts for key information such as renewal dates and contract values.

## Features

- Extract contracts from Google Workspace (Gmail, Drive) using Google Vault API
- Keyword-based search for contracts
- AI-powered contract analysis using OpenAI
- Contract metadata extraction (renewal dates, contract values)
- Google Calendar integration for contract renewal reminders
- Clean and modern UI built with React and Material-UI

## Project Structure

This project consists of two main components:

- **Frontend**: React application with TypeScript and Material-UI
- **Backend**: Python FastAPI application with PostgreSQL database

## Prerequisites

- Node.js and npm
- Python 3.8+
- PostgreSQL
- Google Workspace account with admin access
- OpenAI API key

## Setup

### Backend

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a virtual environment:

```bash
python -m venv venv
```

3. Activate the virtual environment:

```bash
# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. Set up environment variables in a `.env` file:

```
DATABASE_URL=postgresql://username:password@localhost:5432/contract_collector
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-api-key
```

6. Initialize the database:

```bash
python create_db.py
```

7. Run the server:

```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000.

### Frontend

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The frontend will be available at http://localhost:3000.

## User Workflow

1. Register and log in to the application
2. Upload Google Workspace credentials (JSON file)
3. Add keywords for contract search
4. Extract contracts from emails based on keywords
5. Review extracted contracts and select which ones to add
6. View contract metadata and renewal dates on the dashboard
7. Manage contracts in the contracts list

## Google Workspace Setup

To use this application, you need to:

1. Create a project in Google Cloud Console
2. Enable the Google Vault API, Gmail API, Drive API, and Calendar API
3. Create a service account with appropriate permissions
4. Generate and download a JSON key for the service account
5. Upload this JSON key to the application

## License

MIT 