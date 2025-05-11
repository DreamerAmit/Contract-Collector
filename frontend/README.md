# Contract Collector Frontend

This is the frontend React application for the Contract Collector. It provides a user interface for managing and reviewing contracts extracted from Google Workspace.

## Technologies Used

- React with TypeScript
- Material-UI for UI components
- React Router for navigation
- Axios for API requests

## Features

- User authentication (login/registration)
- Google Workspace credentials management
- Keywords management for contract search
- Contract extraction from emails
- Contract review and selection
- AI analysis of contracts
- Contract list with filtering and pagination

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

The application will be available at http://localhost:3000.

## Project Structure

- `src/components/`: Reusable UI components
- `src/pages/`: Page components for each route
- `src/contexts/`: React contexts for state management
- `src/services/`: API services for backend communication
- `src/utils/`: Utility functions
- `src/types/`: TypeScript type definitions
- `src/assets/`: Static assets like images

## Backend API

This frontend connects to a FastAPI backend which should be running at http://localhost:8000. Make sure the backend server is running before using this application. 