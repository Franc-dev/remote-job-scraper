import { PrismaClient, Job as PrismaJob } from '@prisma/client';
import { Job } from './JobTypes';

const prisma = new PrismaClient();

// Clean and normalize a job object
function cleanJob(job: Job): Omit<PrismaJob, 'id' | 'createdAt'> {
  // Validate postedDate
  let postedDate: Date | null = null;
  if (job.postedDate) {
    const d = new Date(job.postedDate);
    postedDate = isNaN(d.getTime()) ? null : d;
  }

  return {
    title: job.title.trim(),
    company: job.company.trim(),
    location: job.location.trim(),
    description: job.description.trim(),
    salary: job.salary ? job.salary.trim() : null,
    postedDate,
    jobType: job.jobType ? job.jobType.trim() : null,
    experienceLevel: job.experienceLevel ? job.experienceLevel.trim() : null,
    url: job.url.trim(),
    source: job.source.trim(),
    logo: job.logo ? job.logo.trim() : null,
  };
}

// Save jobs to the database with deduplication (upsert by url)
export async function saveJobsToDb(jobs: Job[]) {
  for (const job of jobs) {
    // Skip jobs with missing required fields
    if (!job.title || !job.company || !job.url) continue;
    const cleaned = cleanJob(job);
    await prisma.job.upsert({
      where: { url: cleaned.url },
      update: cleaned,
      create: cleaned,
    });
  }
}

// Import jobs from a JSON file
import { readFileSync } from 'fs';
export async function importJobsFromJson(jsonPath: string) {
  const raw = readFileSync(jsonPath, 'utf-8');
  const jobs: Job[] = JSON.parse(raw);
  await saveJobsToDb(jobs);
  console.log(`Imported ${jobs.length} jobs from ${jsonPath}`);
} 