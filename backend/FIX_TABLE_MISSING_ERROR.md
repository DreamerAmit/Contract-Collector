# How to Fix the "relation vault_searches does not exist" Error

You're seeing this error because the database schema is missing the `vault_searches` table. Here's how to fix it:

## Option 1: Run the SQL Script Directly

1. Connect to your PostgreSQL database using psql or a GUI tool like pgAdmin
2. Run the SQL script in `create_vault_searches_table.sql`

```bash
# Using psql from command line
psql -U postgres -d contract_collector -f create_vault_searches_table.sql
```

## Option 2: Fix the Sequelize Migration Issues

If you prefer to use Sequelize migrations:

1. Create a `.env` file in the backend directory with your actual database credentials:

```
DB_NAME=contract_collector
DB_USER=postgres
DB_PASSWORD=your_actual_password
DB_HOST=localhost
DB_PORT=5432
```

2. Run the migrations:

```bash
npx sequelize-cli db:migrate --migrations-path=./src/migrations
```

## Option 3: Manually Create the Table in a Database Tool

If you're using a database management tool like pgAdmin, you can:

1. Open your PostgreSQL database
2. Create a new table named `vault_searches` with the following columns:
   - `id` - SERIAL PRIMARY KEY
   - `user_id` - INTEGER NOT NULL REFERENCES users(id)
   - `matter_id` - VARCHAR(255) NOT NULL
   - `description` - VARCHAR(255)
   - `gmail_export_id` - VARCHAR(255)
   - `drive_export_id` - VARCHAR(255)
   - `status` - VARCHAR(20) DEFAULT 'CREATED'
   - `search_terms` - TEXT
   - `error_message` - TEXT
   - `start_date` - TIMESTAMP
   - `end_date` - TIMESTAMP
   - `result_count` - INTEGER DEFAULT 0
   - `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   - `updated_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

## Check If Fix Was Successful

After applying one of the above solutions, you can verify the table exists by running:

```sql
SELECT * FROM vault_searches;
```

If this command works without errors, you've successfully fixed the issue. 