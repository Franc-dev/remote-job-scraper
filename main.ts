/* eslint-disable @typescript-eslint/no-unused-vars */
import { JobBoardScraper, Job, ScraperConfig, JobStats } from './JobScraper';
import cron from 'node-cron';
import { importJobsFromJson, saveJobsToDb } from './db';

// Configuration for the scraper
const scraperConfig: ScraperConfig = {
  headless: true,        // Set to false to see browser in action
  delay: 2000,          // 2 second delay between requests
  timeout: 30000,       // 30 second timeout
  outputDir: './job_data',
  maxRetries: 3
};

// List of all available job boards (keys from JobScraper)
const ALL_JOB_BOARDS = [
  'weworkremotely',
  'remoteok',
  'remotive',
  'jobspresso',
  'workingnomads',
  'remoteleaf',
  'euremotejobs',
  'skipthedrive',
  'hubstafftalent',
  'powertofly',
  'techjobsforgood',
  'ycombinator',
  'nodesk',
  'remotehub'
];

// Main function to demonstrate usage
async function main() {
  console.log('🚀 Starting Job Board Scraper...');
  
  const scraper = new JobBoardScraper(scraperConfig);

  try {
    // Initialize the browser
    await scraper.initialize();

    // Example 1: Scrape multiple job boards for software engineer positions
    console.log('\n📋 Example 1: Scraping for Software Engineer positions');
    const softwareJobs = await scraper.scrapeJobs(
      ['indeed'],  // You can add 'linkedin' here too
      'software engineer',
      'New York, NY',
      2  // Number of pages to scrape
    );

    // Save the results
    const filepath1 = scraper.saveJobs(softwareJobs, 'software_engineer_jobs.json');
    await saveJobsToDb(softwareJobs);

    // Print statistics
    const stats1 = scraper.getJobStats(softwareJobs);
    console.log('\n📊 Software Engineer Job Statistics:');
    console.log(`Total Jobs: ${stats1.total}`);
    console.log('Sources:', stats1.sources);
    console.log('Top 5 Companies:', Object.entries(stats1.topCompanies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
    );

    // Example 2: Scrape for different job type
    console.log('\n📋 Example 2: Scraping for Data Scientist positions');
    const dataJobs = await scraper.scrapeJobs(
      ['indeed'],
      'data scientist',
      'San Francisco, CA',
      1
    );

    const filepath2 = scraper.saveJobs(dataJobs, 'data_scientist_jobs.json');
    await saveJobsToDb(dataJobs);
    const stats2 = scraper.getJobStats(dataJobs);
    console.log(`\n📊 Found ${stats2.total} Data Scientist jobs`);

    // Example 3: Scrape a custom URL (if you have a specific job board)
    console.log('\n📋 Example 3: Custom URL scraping (commented out)');
    // const customJobs = await scraper.scrapeCustomUrl('https://example-job-board.com/jobs');
    // scraper.saveJobs(customJobs, 'custom_jobs.json');

    // Combine all jobs and generate comprehensive report
    const allJobs = [...softwareJobs, ...dataJobs];
    const combinedStats = scraper.getJobStats(allJobs);
    
    console.log('\n📈 Combined Statistics:');
    console.log(JSON.stringify(combinedStats, null, 2));

    // Save combined results
    scraper.saveJobs(allJobs, 'all_jobs_combined.json');
    await saveJobsToDb(allJobs);

  } catch (error) {
    console.error('❌ Scraping process failed:', error);
  } finally {
    // Always close the browser
    await scraper.close();
    console.log('\n✅ Scraping process completed!');
  }
}

// Function to scrape specific job with custom parameters
async function scrapeSpecificJob(
  jobTitle: string, 
  location: string = '', 
  sites: string[] = ['indeed'],
  pages: number = 3
) {
  const scraper = new JobBoardScraper({
    headless: true,
    delay: 1500,
    outputDir: './specific_jobs'
  });

  try {
    await scraper.initialize();
    
    console.log(`🔍 Searching for: ${jobTitle} in ${location || 'Any location'} (Pages: ${pages})`);
    
    const jobs = await scraper.scrapeJobs(sites, jobTitle, location, pages);
    
    if (jobs.length > 0) {
      const siteName = sites[0] || 'results';
      const filename = `${jobTitle.replace(/\s+/g, '_').toLowerCase()}_${siteName}.json`;
      scraper.saveJobs(jobs, filename);
      await saveJobsToDb(jobs);
      
      const stats = scraper.getJobStats(jobs);
      console.log(`✅ Found ${stats.total} jobs for ${jobTitle}`);
      
      // Show sample jobs
      console.log('\n📋 Sample Jobs:');
      jobs.slice(0, 3).forEach((job, index) => {
        console.log(`${index + 1}. ${job.title} at ${job.company} - ${job.location}`);
      });
    } else {
      console.log(`❌ No jobs found for ${jobTitle}`);
    }
    
  } catch (error) {
    console.error('❌ Error during specific job search:', error);
  } finally {
    await scraper.close();
  }
}

// Scrape all job boards at once and save each to its own file
async function scrapeAllBoards(query: string, location: string = '', pages: number = 1) {
  const scraper = new JobBoardScraper(scraperConfig);
  try {
    await scraper.initialize();
    console.log(`\n🚀 Scraping ALL boards for: ${query} in ${location || 'Any location'} (Pages: ${pages})`);
    let totalJobs = 0;
    for (const board of ALL_JOB_BOARDS) {
      console.log(`\n--- Scraping ${board} ---`);
      const jobs = await scraper.scrapeJobs([board], query, location, pages);
      totalJobs += jobs.length;
      const filename = `${board}_jobs.json`;
      scraper.saveJobs(jobs, filename);
      await saveJobsToDb(jobs);
      console.log(`💾 Saved ${jobs.length} jobs to ${filename}`);
    }
    console.log(`\n📊 Total Jobs Scraped: ${totalJobs}`);
  } catch (error) {
    console.error('❌ Error scraping all boards:', error);
  } finally {
    await scraper.close();
  }
}

// Schedule scraping using node-cron
function scheduleScraping(query: string, location: string = '', pages: number = 1, cronExpr: string = '0 * * * *') {
  // Default: every hour at minute 0
  console.log(`⏰ Scheduling scraping for '${query}' every cron: ${cronExpr}`);
  cron.schedule(cronExpr, async () => {
    console.log(`\n[${new Date().toISOString()}] Running scheduled scrape...`);
    await scrapeAllBoards(query, location, pages);
  });
}

// Export functions for module usage
export { main, scrapeSpecificJob, scraperConfig };

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'all') {
    // npm run dev all "developer" "Remote" 1
    const query = args[1] || 'developer';
    const location = args[2] || '';
    const pages = args[3] ? parseInt(args[3], 10) : 1;
    scrapeAllBoards(query, location, pages).catch(console.error);
  } else if (args[0] === 'schedule') {
    // npm run dev schedule "developer" "Remote" 1 "0 * * * *"
    const query = args[1] || 'developer';
    const location = args[2] || '';
    const pages = args[3] ? parseInt(args[3], 10) : 1;
    const cronExpr = args[4] || '0 * * * *';
    scheduleScraping(query, location, pages, cronExpr);
  } else if (args[0] === 'import') {
    // npm run dev import path/to/file.json
    const jsonPath = args[1];
    if (!jsonPath) {
      console.error('Please provide a JSON file path to import.');
      process.exit(1);
    }
    importJobsFromJson(jsonPath).catch(console.error);
  } else {
    // Default behavior
    main().catch(console.error);
  }
}