# Local Database Setup

## Prerequisites
- PostgreSQL 17+ installed locally
- `postgres` superuser access

## Steps

```bash
# 1. Create the database
createdb -U postgres ppm

# 2. Create the ppm_app role
psql -U postgres -d ppm -f app/db/create-role.sql

# 3. Apply the schema
psql -U postgres -d ppm -f sql/ppm_local_schema.sql
```

## After Setup

Update `app/.env` to point to the local database:

```env
DATABASE_URL=postgresql://ppm_app:<password>@localhost:5432/ppm
DATABASE_URL_MIGRATE=postgresql://postgres:<password>@localhost:5432/ppm
```

Then regenerate the Prisma client:

```bash
cd app && pnpm prisma generate
```
