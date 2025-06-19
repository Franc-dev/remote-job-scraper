    
export interface Job {
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  postedDate?: string;
  jobType?: string;
  experienceLevel?: string;
  url: string;
  source: string;
  logo?: string;
}

// Remotive
export interface RemotiveJob extends Job {
  tags?: string[];
}

// Working Nomads
export interface WorkingNomadsJob extends Job {
  salary?: string;
}

// Hubstaff Talent
export interface HubstaffTalentJob extends Job {
  payRate?: string;
}

// NoDesk
export type NoDeskJob = Job;

// Tech Jobs for Good
export interface TechJobsForGoodJob extends Job {
  datePosted?: string; // e.g., "Posted 1 day ago"
}

// Y Combinator
export interface YCombinatorJob extends Job {
  createdAt?: string;
  minExperience?: string;
}

// SkipTheDrive
export type SkipTheDriveJob = Job;

// Jobspresso
export type JobspressoJob = Job;

// PowerToFly
export type PowerToFlyJob = Job;

// RemoteHub
export type RemoteHubJob = Job;
