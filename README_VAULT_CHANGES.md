# Google Vault Integration Changes

## Overview

This document describes the changes made to implement Google Vault API integration without using holds. The application now directly exports data from Google Vault matters instead of creating and managing holds.

## Why Remove Holds?

Holds in Google Vault are typically used for legal/compliance purposes to prevent data deletion. For contract collection purposes, we don't need to prevent deletion - we just need to search and export data. Using direct exports simplifies the process and avoids the "invalid account_id" error encountered when trying to create holds.

## Files Changed

### 1. `backend/src/utils/vaultClient.js`
- Removed hold-related functions: `createSearchHold`, `createDriveSearchHold`
- Removed hold-based export function: `createExport`
- Added direct export functions: `createGmailExport`, `createDriveExport`
- Added `listExports` function to list exports in a matter

### 2. `backend/src/routes/vault.js`
- Updated to use direct export functions instead of creating holds
- Modified search status checking to look at both Gmail and Drive exports
- Updated result processing to handle both export types

### 3. `backend/src/routes/google.js`
- Updated imports and search function to use direct exports
- Removed hold-related code
- Modified status checking to handle the new export structure

### 4. `backend/src/models/vaultSearch.js`
- Removed hold-related fields: `gmailHoldId`, `driveHoldId`, `exportId`
- Added export-related fields: `gmailExportId`, `driveExportId`

### 5. `backend/src/migrations/update-vault-search-remove-holds.js`
- Created migration to update the database schema
- Removes hold-related columns and adds export-related columns
- Renames `keywords` column to `searchTerms` if needed

## Database Changes

The database schema has been updated to remove hold-related columns and add export-related columns. See `DATABASE_MIGRATION_INSTRUCTIONS.md` for detailed instructions on applying these changes.

## How It Works Now

1. The application creates a new matter in Google Vault
2. It directly initiates exports for both Gmail and Drive with the search criteria
3. It periodically checks the status of both exports
4. When both exports are complete, it processes and combines the results

## Benefits

- Simpler code with fewer API calls
- Avoids the "account_id is invalid" error
- More straightforward workflow focused on searching and exporting
- Aligns with the actual goal of contract collection (finding and exporting contracts, not preserving them indefinitely)

## Note About Migrations

If you're deploying this in a new environment, you'll need to run the database migration. See `DATABASE_MIGRATION_INSTRUCTIONS.md` for details. 