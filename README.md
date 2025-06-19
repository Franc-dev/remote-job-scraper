# Job Board Scraper

A TypeScript-powered web scraper for remote job boards, with automatic saving to both JSON files and a PostgreSQL database using Prisma. Cleans and deduplicates job data on save.

---

## Features
- Scrapes multiple remote job boards (We Work Remotely, RemoteOK, Remotive, etc.)
- Saves scraped jobs to JSON files in `job_data/`
- Automatically saves jobs to a PostgreSQL database (with deduplication)
- Cleans and normalizes job data before saving
- Supports scheduling (e.g., every 2 minutes) with `node-cron`
- CLI for scraping, scheduling, and importing jobs

---

## Setup

### 1. Clone and Install
```sh
npm install
```

### 2. Configure Database
- Edit `.env` and set your PostgreSQL connection string:
  ```
  DATABASE_URL="postgresql://user:password@localhost:5432/yourdb"
  ```

### 3. Prisma Setup
```sh
npx prisma migrate dev --name init
npx prisma generate
```

---

## Usage

### Scrape All Boards (and save to DB automatically)
```sh
npm run dev all "developer" "Remote" 1
```
- This scrapes all boards for "developer" jobs in "Remote" locations (1 page each).
- Jobs are saved to `job_data/` and also to your database (cleaned and deduplicated).

### Schedule Scraping (e.g., every 2 minutes)
```sh
npm run dev schedule "developer" "Remote" 1 "*/2 * * * *"
```
- Uses cron syntax for flexible scheduling.

### Import Existing JSON Data
```sh
npm run dev import job_data/ycombinator_jobs.json
```
- Imports jobs from a JSON file into the database (cleaned and deduplicated).

### Import All Job Data (if you have a script for this)
```sh
npx ts-node import_all_job_data.ts
```

---

## Project Structure

- `main.ts` - Main entry point, CLI, and scheduling logic
- `JobScraper.ts` - Scraper logic for each job board
- `db.ts` - Prisma integration, cleaning, deduplication, and import helpers
- `job_data/` - Folder for all scraped job JSON files
- `prisma/schema.prisma` - Prisma schema for the Job model

---

## Database Model

Prisma schema (`prisma/schema.prisma`):
```prisma
model Job {
  id              Int      @id @default(autoincrement())
  title           String
  company         String
  location        String
  description     String
  salary          String?
  postedDate      DateTime?
  jobType         String?
  experienceLevel String?
  url             String   @unique
  source          String
  logo            String?
  createdAt       DateTime @default(now())
}
```
- Deduplication is enforced by the unique `url` field.

---

## Data Cleaning & Deduplication
- All job fields are trimmed and normalized before saving.
- Only valid dates are saved; invalid or missing dates are set to `null`.
- Jobs with missing required fields (`title`, `company`, `url`) are skipped.
- Upsert is used to avoid duplicates in the database.

---

## Extending
- Add new job boards by extending `JobScraper.ts`.
- Add new fields to the Prisma schema and regenerate the client.

---

## License
ISC 