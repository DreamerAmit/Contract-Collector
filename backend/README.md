# Contract Collector Backend

This is the Node.js backend for the Contract Collector application.

## Technology Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Sequelize** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **Multer** - File upload middleware
- **JWT** - Authentication
- **OpenAI API** - For contract analysis
- **Google APIs** - For Gmail, Drive, and Calendar integration

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file in the backend directory with the following variables:
   ```
   # Server Configuration
   PORT=8000
   NODE_ENV=development

   # Database Configuration
   DATABASE_URL=postgres://postgres:password@localhost:5432/contract_collector
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=contract_collector
   DB_USER=postgres
   DB_PASSWORD=password

   # JWT Authentication
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRATION=24h

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Google API Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/google/callback

   # File Storage
   UPLOAD_DIR=uploads
   ```
5. Initialize the database:
   ```
   node src/scripts/init-db.js
   ```

### Running the Server

Development mode (with auto-reload):
```
npm run dev
```

Production mode:
```
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile

### Contracts
- `POST /api/contracts` - Upload a new contract
- `GET /api/contracts` - Get all contracts
- `GET /api/contracts/:id` - Get a specific contract
- `PUT /api/contracts/:id` - Update a contract
- `DELETE /api/contracts/:id` - Delete a contract

### Keywords
- `GET /api/keywords` - Get all keywords
- `POST /api/keywords` - Create a new keyword
- `DELETE /api/keywords/:id` - Delete a keyword
- `PUT /api/keywords/:id` - Update a keyword

### Calendar Events
- `GET /api/calendar` - Get all calendar events
- `POST /api/calendar` - Create a new calendar event
- `PUT /api/calendar/:id` - Update a calendar event
- `DELETE /api/calendar/:id` - Delete a calendar event

### Google Integration
- `GET /api/google/auth-url` - Get Google OAuth URL
- `GET /api/google/callback` - Handle Google OAuth callback
- `POST /api/google/save-credentials` - Save Google credentials
- `GET /api/google/drive/files` - List Google Drive files
- `GET /api/google/gmail/messages` - List Gmail messages with attachments

### AI Features
- `POST /api/ai/analyze-contract` - Analyze contract text
- `POST /api/ai/extract-keywords` - Extract keywords from contract

## Google Workspace Integration

### Setup Instructions

1. **Create a Service Account**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Navigate to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name and description
   - Grant it roles as needed
   - Click "Create and Continue"

2. **Enable Domain-Wide Delegation**:
   - Once the service account is created, click on it in the list
   - Go to the "Details" tab
   - Click "Edit" at the top of the page
   - Check the box for "Enable Google Workspace Domain-wide Delegation"
   - Click "Save"

3. **Create a Key for the Service Account**:
   - On the service account details page, go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" as the key type
   - Click "Create"
   - The JSON key file will be downloaded to your computer

4. **Enable Required APIs**:
   - In the Google Cloud Console, go to "APIs & Services" > "Dashboard"
   - Click "Enable APIs and Services"
   - Search for and enable:
     - Gmail API
     - Google Drive API
     - Google Calendar API

5. **Configure Domain-Wide Delegation in Google Workspace**:
   - Go to your [Google Workspace Admin Console](https://admin.google.com/)
   - Navigate to Security > API Controls > Domain-wide Delegation
   - Click "Add new"
   - Enter the Client ID from your service account (found in the JSON file)
   - Add these OAuth scopes:
     ```
     https://www.googleapis.com/auth/drive.readonly
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/calendar
     ```
   - Click "Authorize"

### Using the Application

1. Log in to the Contract Collector application
2. Go to the "Upload Contracts" page
3. Enter the Google Workspace email address of the account you want to access
4. Upload the service account JSON key file
5. The application will use the service account to access the specified user's Gmail and Drive data

### Troubleshooting

If you encounter authentication errors:

1. **"unauthorized_client" error**:
   - Make sure domain-wide delegation is enabled for the service account
   - Verify the OAuth scopes are properly configured in the Google Workspace Admin Console
   - Ensure the user email is part of your Google Workspace domain

2. **"invalid_grant" error**:
   - Check that the service account key is correct and not expired
   - Verify the user is part of your Google Workspace domain

3. **API Access Issues**:
   - Make sure all required APIs are enabled in the Google Cloud Console
   - Check that the service account has the necessary API access

## Folder Structure

- `/src` - Source code
  - `/config` - Configuration files
  - `/middleware` - Express middleware
  - `/models` - Sequelize models
  - `/routes` - API routes
  - `/scripts` - Utility scripts
  - `/utils` - Utility functions
  - `index.js` - Entry point
- `/uploads` - File storage directory 