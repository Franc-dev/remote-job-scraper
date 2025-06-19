/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Job interface
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

// Scraper configuration
export interface ScraperConfig {
  headless?: boolean;
  delay?: number;
  timeout?: number;
  userAgent?: string;
  maxRetries?: number;
  outputDir?: string;
}

// Site-specific scraper interface
interface SiteScraper {
  name: string;
  baseUrl: string;
  searchUrl: string;
  scrapeJobs(query: string, location?: string, pages?: number): Promise<Job[]>;
}

// Job statistics interface
export interface JobStats {
  total: number;
  sources: Record<string, number>;
  topCompanies: Record<string, number>;
  locations: Record<string, number>;
}

export class JobBoardScraper {
  private browser: Browser | null = null;
  private config: Required<ScraperConfig>;
  private scrapers: Map<string, SiteScraper> = new Map();

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      delay: config.delay ?? 1000,
      timeout: config.timeout ?? 60000,
      userAgent: config.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      maxRetries: config.maxRetries ?? 3,
      outputDir: config.outputDir ?? './scraped_jobs'
    };

    this.initializeScrapers();
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private initializeScrapers(): void {
    // We Work Remotely scraper (Puppeteer)
    this.scrapers.set('weworkremotely', {
      name: 'We Work Remotely',
      baseUrl: 'https://weworkremotely.com',
      searchUrl: 'https://weworkremotely.com/remote-jobs/search',
      scrapeJobs: this.scrapeWeWorkRemotely.bind(this)
    });

    // RemoteOK scraper (Puppeteer)
    this.scrapers.set('remoteok', {
      name: 'RemoteOK',
      baseUrl: 'https://remoteok.com',
      searchUrl: 'https://remoteok.com/remote-dev-jobs',
      scrapeJobs: this.scrapeRemoteOK.bind(this)
    });

    // LinkedIn scraper (basic)
    this.scrapers.set('linkedin', {
      name: 'LinkedIn',
      baseUrl: 'https://www.linkedin.com',
      searchUrl: 'https://www.linkedin.com/jobs/search',
      scrapeJobs: this.scrapeLinkedIn.bind(this)
    });

    // Generic scraper for other sites
    this.scrapers.set('generic', {
      name: 'Generic',
      baseUrl: '',
      searchUrl: '',
      scrapeJobs: this.scrapeGeneric.bind(this)
    });

    // Remotive scraper (Puppeteer, FINAL)
    this.scrapers.set('remotive', {
      name: 'Remotive',
      baseUrl: 'https://remotive.com',
      searchUrl: 'https://remotive.com/remote-jobs',
      scrapeJobs: this.scrapeRemotive.bind(this)
    });

    // Jobspresso scraper (Puppeteer)
    this.scrapers.set('jobspresso', {
      name: 'Jobspresso',
      baseUrl: 'https://jobspresso.co',
      searchUrl: 'https://jobspresso.co/remote-jobs',
      scrapeJobs: this.scrapeJobspresso.bind(this)
    });

    // Working Nomads scraper (Puppeteer, FINAL)
    this.scrapers.set('workingnomads', {
      name: 'Working Nomads',
      baseUrl: 'https://www.workingnomads.co',
      searchUrl: 'https://www.workingnomads.co/jobs',
      scrapeJobs: this.scrapeWorkingNomads.bind(this)
    });

    // SkipTheDrive scraper (Puppeteer, FIXED)
    this.scrapers.set('skipthedrive', {
      name: 'SkipTheDrive',
      baseUrl: 'https://www.skipthedrive.com',
      searchUrl: 'https://www.skipthedrive.com/remote-jobs',
      scrapeJobs: this.scrapeSkipTheDrive.bind(this)
    });

    // Hubstaff Talent scraper (Puppeteer, FINAL)
    this.scrapers.set('hubstafftalent', {
      name: 'Hubstaff Talent',
      baseUrl: 'https://talent.hubstaff.com',
      searchUrl: 'https://talent.hubstaff.com/search/jobs',
      scrapeJobs: this.scrapeHubstaffTalent.bind(this)
    });

    // PowerToFly scraper (Puppeteer)
    this.scrapers.set('powertofly', {
      name: 'PowerToFly',
      baseUrl: 'https://powertofly.com',
      searchUrl: 'https://powertofly.com/jobs',
      scrapeJobs: this.scrapePowerToFly.bind(this)
    });

    // AngelList / Wellfound
    this.scrapers.set('angellist', {
      name: 'AngelList',
      baseUrl: 'https://wellfound.com',
      searchUrl: 'https://wellfound.com/jobs',
      scrapeJobs: this.scrapeAngelList.bind(this)
    });

    // Tech Jobs for Good scraper (Puppeteer, FIXED)
    this.scrapers.set('techjobsforgood', {
      name: 'Tech Jobs for Good',
      baseUrl: 'https://techjobsforgood.com',
      searchUrl: 'https://techjobsforgood.com/jobs',
      scrapeJobs: this.scrapeTechJobsForGood.bind(this)
    });

    // Y Combinator Jobs scraper (Puppeteer, FIXED)
    this.scrapers.set('ycombinator', {
      name: 'Y Combinator Jobs',
      baseUrl: 'https://www.ycombinator.com',
      searchUrl: 'https://www.ycombinator.com/jobs',
      scrapeJobs: this.scrapeYCombinator.bind(this)
    });

    // NoDesk scraper (Puppeteer, FINAL)
    this.scrapers.set('nodesk', {
      name: 'NoDesk',
      baseUrl: 'https://nodesk.co',
      searchUrl: 'https://nodesk.co/remote-jobs',
      scrapeJobs: this.scrapeNoDesk.bind(this)
    });

    // Outsourcely scraper (stub, may require login)
    this.scrapers.set('outsourcely', {
      name: 'Outsourcely',
      baseUrl: 'https://www.outsourcely.com',
      searchUrl: 'https://www.outsourcely.com/remote-jobs',
      scrapeJobs: this.scrapeOutsourcely.bind(this)
    });

    // Workana scraper (stub, may require login)
    this.scrapers.set('workana', {
      name: 'Workana',
      baseUrl: 'https://www.workana.com',
      searchUrl: 'https://www.workana.com/jobs',
      scrapeJobs: this.scrapeWorkana.bind(this)
    });

    // RemoteHub scraper (Puppeteer, FINAL)
    this.scrapers.set('remotehub', {
      name: 'RemoteHub',
      baseUrl: 'https://www.remotehub.com',
      searchUrl: 'https://www.remotehub.com/jobs',
      scrapeJobs: this.scrapeRemoteHub.bind(this)
    });
  }

  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      console.log('✅ Browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('✅ Browser closed');
    }
  }

  private async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    
    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Add stealth settings to avoid detection
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
    });
    
    // Block images and stylesheets for faster loading (but allow LinkedIn's essential resources)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      // Allow LinkedIn's essential resources
      if (url.includes('linkedin.com') || 
          url.includes('licdn.com') || 
          resourceType === 'document' || 
          resourceType === 'script' ||
          resourceType === 'xhr' ||
          resourceType === 'fetch') {
        req.continue();
      } else if (resourceType === 'stylesheet' || resourceType === 'image' || resourceType === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`⚠️ Attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        await this.delay(2000 * (i + 1));
      }
    }
    throw new Error('All retry attempts failed');
  }

  // Scraper for We Work Remotely (Puppeteer, robust selectors)
  private async scrapeWeWorkRemotely(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping We Work Remotely page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        const html = await page.content();
        const $ = cheerio.load(html);
        $('li.new-listing-container').each((_, el) => {
          const $el = $(el);
          const jobLink = $el.find('a').first().attr('href');
          const url = jobLink ? `https://weworkremotely.com${jobLink}` : '';
          const title = $el.find('h4.new-listing__header__title').text().trim();
          const company = $el.find('p.new-listing__company-name').text().replace(/\s+$/, '').trim();
          const location = $el.find('p.new-listing__company-headquarters').text().replace(/\s+$/, '').trim();
          const postedDate = $el.find('p.new-listing__header__icons__date').text().trim();
          const categories = $el.find('div.new-listing__categories p.new-listing__categories__category').map((_, cat) => $(cat).text().trim()).get();
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description: '',
              url,
              source: 'We Work Remotely',
              postedDate: postedDate || new Date().toISOString(),
              jobType: categories.join(', '),
              experienceLevel: undefined
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Error scraping We Work Remotely:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Scraper for RemoteOK (Puppeteer, robust selectors)
  private async scrapeRemoteOK(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://remoteok.com/remote-${encodeURIComponent(query.replace(/\s+/g, '-'))}-jobs?page=${pageNum}`;
        console.log(`🔍 Scraping RemoteOK page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        const html = await page.content();
        const $ = cheerio.load(html);
        $('tr.job').each((_, el) => {
          const $el = $(el);
          const url = $el.attr('data-href') ? `https://remoteok.com${$el.attr('data-href')}` : '';
          const title = $el.find('h2').text().trim();
          const company = $el.find('.companyLink h3').text().trim();
          const location = $el.find('.location').text().trim() || 'Remote';
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location,
              description: '',
              url,
              source: 'RemoteOK',
              postedDate: new Date().toISOString()
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Error scraping RemoteOK:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // LinkedIn scraper (enhanced implementation)
  private async scrapeLinkedIn(query: string, location: string = '', pages: number = 3): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();

    try {
      for (let pageNum = 0; pageNum < pages; pageNum++) {
        const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&start=${pageNum * 25}`;
        
        console.log(`🔍 Scraping LinkedIn page ${pageNum + 1}: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);

        // Wait for job cards to load
        try {
          await page.waitForSelector('div.job-card-container', { timeout: 10000 });
          console.log('✅ Job cards found on page');
        } catch (error) {
          console.log('⚠️ No job cards found, trying alternative selectors...');
        }

        const pageJobs = await page.evaluate(() => {
          // Try multiple selectors to find job cards
          let jobElements = document.querySelectorAll('div.job-card-container');
          
          // If no job cards found, try alternative selectors
          if (jobElements.length === 0) {
            jobElements = document.querySelectorAll('li.discovery-templates-entity-item div.job-card-container');
          }
          
          // If still no results, try broader selector
          if (jobElements.length === 0) {
            jobElements = document.querySelectorAll('[data-job-id]');
          }

          console.log(`Found ${jobElements.length} job elements`);
          
          const jobs: any[] = [];

          jobElements.forEach((element, index) => {
            try {
              // Title and URL - try multiple selectors
              let titleElement = element.querySelector('.job-card-container__link') as HTMLAnchorElement;
              if (!titleElement) {
                titleElement = element.querySelector('a[href*="/jobs/"]') as HTMLAnchorElement;
              }
              
              // Company and location (combined in subtitle)
              let subtitleElement = element.querySelector('.artdeco-entity-lockup__subtitle');
              if (!subtitleElement) {
                subtitleElement = element.querySelector('[class*="subtitle"]');
              }
              
              // Posted date
              let postedDateElement = element.querySelector('.job-card-container__footer-wrapper time');
              if (!postedDateElement) {
                postedDateElement = element.querySelector('time');
              }
              
              // Job type (not always present in card)
              const jobTypeElement = element.querySelector('.job-card-container__metadata-wrapper');
              
              // Logo (optional)
              const logoElement = element.querySelector('.ivm-view-attr__img--centered') as HTMLImageElement;

              if (titleElement && subtitleElement) {
                let url = titleElement.href || '';
                // Ensure URL is absolute
                if (url && !url.startsWith('http')) {
                  url = `https://www.linkedin.com${url}`;
                }

                // Parse company and location from subtitle
                const subtitleText = subtitleElement.textContent?.trim() || '';
                let company = '';
                let location = '';
                
                if (subtitleText.includes('·')) {
                  const parts = subtitleText.split('·').map(part => part.trim());
                  company = parts[0] || '';
                  location = parts.slice(1).join(' · ') || '';
                } else {
                  company = subtitleText;
                  location = 'Not specified';
                }

                // Extract posted date
                const postedDate = postedDateElement?.textContent?.trim() || 
                                 postedDateElement?.getAttribute('datetime') || 
                                 '';

                const job = {
                  title: titleElement.textContent?.trim() || '',
                  company: company,
                  location: location,
                  url: url,
                  description: '', // Not available in card view
                  jobType: jobTypeElement?.textContent?.trim() || '',
                  postedDate: postedDate,
                  logo: logoElement?.src || ''
                };

                console.log(`Job ${index + 1}: ${job.title} at ${job.company}`);
                jobs.push(job);
              } else {
                console.log(`Job ${index + 1}: Missing required elements`);
              }
            } catch (error) {
              console.log(`⚠️ Error parsing LinkedIn job element ${index + 1}:`, error);
            }
          });

          return jobs;
        });

        pageJobs.forEach(job => {
          jobs.push({
            ...job,
            source: 'LinkedIn',
            postedDate: job.postedDate || new Date().toISOString()
          });
        });

        console.log(`📊 Found ${pageJobs.length} jobs on page ${pageNum + 1}`);
      }
    } catch (error) {
      console.error('❌ Error scraping LinkedIn:', error);
    } finally {
      await page.close();
    }

    return jobs;
  }

  // Generic scraper using Cheerio for simple HTML parsing
  private async scrapeGeneric(url: string): Promise<Job[]> {
    const jobs: Job[] = [];

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent
        },
        timeout: this.config.timeout
      });

      const $ = cheerio.load(response.data);
      
      // Generic selectors - would need to be customized per site
      const jobElements = $('.job-item, .job-listing, .job-card, [class*="job"]').slice(0, 50);
      
      jobElements.each((i, element) => {
        try {
          const $el = $(element);
          const title = $el.find('h1, h2, h3, .title, [class*="title"]').first().text().trim();
          const company = $el.find('.company, [class*="company"]').first().text().trim();
          const location = $el.find('.location, [class*="location"]').first().text().trim();
          const jobUrl = $el.find('a').first().attr('href') || '';

          if (title && company) {
            jobs.push({
              title,
              company,
              location: location || 'Not specified',
              description: '',
              url: jobUrl.startsWith('http') ? jobUrl : `${new URL(url).origin}${jobUrl}`,
              source: 'Generic',
              postedDate: new Date().toISOString()
            });
          }
        } catch (error) {
          console.log('⚠️ Error parsing generic job element:', error);
        }
      });

    } catch (error) {
      console.error('❌ Error in generic scraper:', error);
    }

    return jobs;
  }

  // Utility to save screenshot and HTML for debugging
  private async debugPage(page: Page, board: string) {
    const dir = './screenshots';
    if (!existsSync(dir)) mkdirSync(dir);
    const screenshotPath = `${dir}/${board}_page.png`;
    const htmlPath = `${dir}/${board}_page.html`;
    await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true });
    const html = await page.content();
    writeFileSync(htmlPath, html);
    console.log(`🖼️ Screenshot saved: ${screenshotPath}`);
    console.log(`📝 HTML saved: ${htmlPath}`);
  }

  // Remotive scraper (Puppeteer, FINAL)
  private async scrapeRemotive(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://remotive.com/remote-jobs?search=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping Remotive page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2);
        const mainSelector = 'li.tw-cursor-pointer';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[remotive] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'remotive');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          // Title and company are in .job-tile-title a .remotive-bold
          const title = $el.find('.job-tile-title a .remotive-bold').first().text().trim();
          // Company is usually the third .remotive-bold
          const company = $el.find('.job-tile-title a .remotive-bold').eq(2).text().trim();
          // URL
          let url = $el.find('.job-tile-title a').attr('href') || '';
          if (url && !url.startsWith('http')) url = `https://remotive.com${url}`;
          // Locations (may be multiple)
          const locations = $el.find('.job-tile-location').map((_, loc) => $(loc).text().trim()).get();
          const location = locations.join(', ') || 'Remote';
          // Salary
          const salary = $el.find('.job-tile-salary').text().trim();
          // Logo
          const logo = $el.find('img.tw-bg-white').attr('src') || '';
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location,
              description: '',
              url,
              source: 'Remotive',
              postedDate: new Date().toISOString(),
              salary,
              logo
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'remotive');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Remotive:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Jobspresso scraper (Puppeteer)
  private async scrapeJobspresso(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://jobspresso.co/remote-jobs/page/${pageNum}/?search_keywords=${encodeURIComponent(query)}`;
        console.log(`🔍 Scraping Jobspresso page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        // Selector check
        const mainSelector = '.job_listing';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[jobspresso] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'jobspresso');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $('.job_listing').each((_, el) => {
          const $el = $(el);
          const title = $el.find('.job_listing-title').text().trim();
          const company = $el.find('.job_listing-company strong').text().trim();
          const location = $el.find('.job_listing-location').text().trim();
          const url = $el.find('a.job_listing-clickbox').attr('href') || $el.find('a').attr('href') || '';
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description: '',
              url: url.startsWith('http') ? url : `https://jobspresso.co${url}`,
              source: 'Jobspresso',
              postedDate: new Date().toISOString()
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'jobspresso');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Jobspresso:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Working Nomads scraper (Puppeteer, FINAL)
  private async scrapeWorkingNomads(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://www.workingnomads.co/jobs?search=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping Working Nomads page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2);
        const mainSelector = 'div.job-desktop';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[workingnomads] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'workingnomads');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('h4 a').first().text().trim();
          const company = $el.find('.company a').first().text().trim();
          const location = $el.find('.boxes .box:first-child span').text().trim();
          const salary = $el.find('.boxes .box').filter((i, el) => $(el).text().includes('€')).find('span').text().trim();
          let url = $el.find('h4 a').first().attr('href') || '';
          if (url && !url.startsWith('http')) url = `https://www.workingnomads.co${url}`;
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description: '',
              url,
              source: 'Working Nomads',
              postedDate: new Date().toISOString(),
              salary
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'workingnomads');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Working Nomads:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // SkipTheDrive scraper (Puppeteer, FIXED)
  private async scrapeSkipTheDrive(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        // Use the correct search URL
        const searchUrl = `https://www.skipthedrive.com/?s=${encodeURIComponent(query)}&paged=${pageNum}`;
        console.log(`🔍 Scraping SkipTheDrive page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        // The job cards are in <div class="post-content">
        const mainSelector = '.post-content';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[skipthedrive] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'skipthedrive');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('h2.post-title.entry-title a').text().trim();
          const company = $el.find('.custom_fields_company_name_display_search_results').text().replace(/^\s*\n?\s*\u00a0/, '').trim();
          const postedDate = $el.find('.custom_fields_job_date_display_search_results').text().trim();
          const description = $el.find('p').text().trim();
          const url = $el.find('h2.post-title.entry-title a').attr('href') || '';
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: 'Remote',
              description,
              url,
              source: 'SkipTheDrive',
              postedDate: postedDate || new Date().toISOString()
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'skipthedrive');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping SkipTheDrive:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Hubstaff Talent scraper (Puppeteer, FINAL)
  private async scrapeHubstaffTalent(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://talent.hubstaff.com/search/jobs?search%5Bkeywords%5D=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping Hubstaff Talent page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2);
        const mainSelector = 'div.main-details';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[hubstafftalent] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'hubstafftalent');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('a.name').text().trim();
          const company = $el.find('.job-company a').first().text().trim();
          const location = $el.find('.job-company .location').text().trim();
          const salary = $el.find('.pay-rate').text().trim();
          const description = $el.find('.profil-bio').text().trim();
          let url = $el.find('a.name').attr('href') || '';
          if (url && !url.startsWith('http')) url = `https://talent.hubstaff.com${url}`;
          const postedDate = $el.find('.job-company .a-tooltip').text().trim();
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description,
              url,
              source: 'Hubstaff Talent',
              postedDate,
              salary
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'hubstafftalent');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Hubstaff Talent:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // PowerToFly scraper (Puppeteer)
  private async scrapePowerToFly(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://powertofly.com/jobs/?keywords=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping PowerToFly page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        const mainSelector = 'button.job.box';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[powertofly] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'powertofly');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const title = $(el).find('.title').text().trim();
          const company = $(el).find('.company').text().trim();
          const location = $(el).find('.location .item').text().trim();
          const jobId = $(el).attr('data-job-id') || '';
          const url = jobId ? `https://powertofly.com/jobs/detail/${jobId}` : '';
          jobs.push({
            title,
            company,
            location,
            description: '',
            url,
            source: 'PowerToFly'
          });
        });
      }
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Tech Jobs for Good scraper (Puppeteer, FIXED)
  private async scrapeTechJobsForGood(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://techjobsforgood.com/jobs/?q=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping Tech Jobs for Good page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2); // Wait extra for JS rendering
        // Use the correct selector for job cards
        const mainSelector = 'a.content';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[techjobsforgood] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'techjobsforgood');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('.header').text().trim();
          const company = $el.find('.company_name').text().trim();
          const location = $el.find('.location').text().trim();
          const salary = $el.find('.salary').text().trim();
          const description = $el.find('.description .content').text().trim();
          const postedDate = $el.find('.date-posted').text().trim();
          let url = $el.attr('href') || '';
          if (url && !url.startsWith('http')) {
            url = `https://techjobsforgood.com${url}`;
          }
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description,
              url,
              source: 'Tech Jobs for Good',
              postedDate,
              salary
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'techjobsforgood');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Tech Jobs for Good:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Y Combinator Jobs scraper (Puppeteer, FIXED)
  private async scrapeYCombinator(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://www.ycombinator.com/jobs?query=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping Y Combinator page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay);
        // The jobs are in a data-page attribute on a div with id^="WaasLandingPage-react-component-"
        const dataPage = await page.evaluate(() => {
          const el = document.querySelector('[id^="WaasLandingPage-react-component-"]');
          return el ? el.getAttribute('data-page') : null;
        });
        if (!dataPage) {
          console.warn('[ycombinator] data-page attribute not found');
          await this.debugPage(page, 'ycombinator');
          continue;
        }
        let jobPostings: any[] = [];
        try {
          const parsed = JSON.parse(dataPage);
          jobPostings = parsed?.props?.jobPostings || [];
        } catch (e) {
          console.warn('[ycombinator] Failed to parse data-page JSON');
          await this.debugPage(page, 'ycombinator');
          continue;
        }
        for (const job of jobPostings) {
          jobs.push({
            title: job.title,
            company: job.companyName,
            location: job.location || 'Remote',
            description: job.companyOneLiner || '',
            url: job.url ? `https://www.ycombinator.com${job.url}` : '',
            source: 'Y Combinator Jobs',
            postedDate: job.createdAt || new Date().toISOString(),
            salary: job.salaryRange || '',
            experienceLevel: job.minExperience || '',
            logo: job.companyLogoUrl || ''
          });
        }
      }
    } catch (error) {
      console.error('❌ Error scraping Y Combinator:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // NoDesk scraper (Puppeteer, FINAL)
  private async scrapeNoDesk(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://nodesk.co/remote-jobs/?search=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping NoDesk page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2);
        // Selector check
        const mainSelector = 'li.ais-Hits-item';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[nodesk] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'nodesk');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('h2 a').text().trim();
          const company = $el.find('h3').text().trim();
          const location = $el.find('.inline-flex h5').text().trim();
          const logo = $el.find('img').attr('src') || '';
          let url = $el.find('h2 a').attr('href') || '';
          if (url && !url.startsWith('http')) url = `https://nodesk.co${url}`;
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description: '',
              url,
              source: 'NoDesk',
              postedDate: new Date().toISOString(),
              logo
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'nodesk');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping NoDesk:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // Outsourcely scraper (stub, may require login)
  private async scrapeOutsourcely(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    // TODO: Outsourcely may require login. Use Puppeteer and automate login if needed.
    return [];
  }

  // Workana scraper (stub, may require login)
  private async scrapeWorkana(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    // TODO: Workana may require login. Use Puppeteer and automate login if needed.
    return [];
  }

  // RemoteHub scraper (Puppeteer, FINAL)
  private async scrapeRemoteHub(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];
    const page = await this.createPage();
    try {
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        const searchUrl = `https://www.remotehub.com/jobs/search?search=${encodeURIComponent(query)}&page=${pageNum}`;
        console.log(`🔍 Scraping RemoteHub page ${pageNum}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
        await this.delay(this.config.delay * 2);
        const mainSelector = 'mat-card.mat-card';
        const exists = await page.$(mainSelector);
        if (!exists) {
          console.warn(`[remotehub] Selector not found: ${mainSelector}`);
          await this.debugPage(page, 'remotehub');
          continue;
        }
        const html = await page.content();
        const $ = cheerio.load(html);
        $(mainSelector).each((_, el) => {
          const $el = $(el);
          const title = $el.find('.title.primary').text().trim();
          const company = $el.find('.account-name.mat-body-2').text().trim();
          const location = $el.find('.location .text').text().trim();
          const salary = $el.find('.mat-chip.blue-2').text().trim();
          const description = $el.find('.description.fs15').text().trim();
          let url = $el.find('.entity-detailed-link').attr('href') || '';
          if (url && !url.startsWith('http')) url = `https://www.remotehub.com${url}`;
          if (title && company && url) {
            jobs.push({
              title,
              company,
              location: location || 'Remote',
              description,
              url,
              source: 'RemoteHub',
              postedDate: new Date().toISOString(),
              salary
            });
          }
        });
        if (jobs.length === 0) {
          await this.debugPage(page, 'remotehub');
        }
      }
    } catch (error) {
      console.error('❌ Error scraping RemoteHub:', error);
    } finally {
      await page.close();
    }
    return jobs;
  }

  // AngelList scraper (stub, requires JS rendering/login)
  private async scrapeAngelList(query: string, _location: string = '', pages: number = 1): Promise<Job[]> {
    // TODO: AngelList/Wellfound requires JS rendering and/or login. Use Puppeteer and automate login if needed.
    return [];
  }

  // Main scraping method
  async scrapeJobs(
    sites: string[],
    query: string,
    location: string = '',
    pages: number = 3
  ): Promise<Job[]> {
    const allJobs: Job[] = [];

    for (const site of sites) {
      const scraper = this.scrapers.get(site.toLowerCase());
      if (!scraper) {
        console.warn(`⚠️ No scraper found for site: ${site}`);
        continue;
      }

      try {
        console.log(`🚀 Starting to scrape ${scraper.name}...`);
        const jobs = await this.retryOperation(() => 
          scraper.scrapeJobs(query, location, pages)
        );
        allJobs.push(...jobs);
        console.log(`✅ Successfully scraped ${jobs.length} jobs from ${scraper.name}`);
      } catch (error) {
        console.error(`❌ Failed to scrape ${scraper.name}:`, error);
      }

      // Delay between sites
      await this.delay(2000);
    }

    return allJobs;
  }

  // Scrape a custom URL
  async scrapeCustomUrl(url: string): Promise<Job[]> {
    return this.retryOperation(() => this.scrapeGeneric(url));
  }

  // Save jobs to file
  saveJobs(jobs: Job[], filename?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `jobs_${timestamp}.json`;
    const filepath = join(this.config.outputDir, finalFilename);

    // Use the current scrape date as the reference
    const scrapeDate = new Date();
    const jobsWithStandardDate = jobs.map(job => {
      const standardized = standardizePostedDate(job.postedDate, scrapeDate);
      // If the original date is missing or unparseable, set to null
      return {
        ...job,
        postedDate: standardized || null
      };
    });

    writeFileSync(filepath, JSON.stringify(jobsWithStandardDate, null, 2));
    console.log(`💾 Saved ${jobsWithStandardDate.length} jobs to ${filepath}`);
    return filepath;
  }

  // Get job statistics
  getJobStats(jobs: Job[]): JobStats {
    const stats: JobStats = {
      total: jobs.length,
      sources: {},
      topCompanies: {},
      locations: {}
    };

    jobs.forEach(job => {
      // Count by source
      stats.sources[job.source] = (stats.sources[job.source] || 0) + 1;
      
      // Count by company
      stats.topCompanies[job.company] = (stats.topCompanies[job.company] || 0) + 1;
      
      // Count by location
      stats.locations[job.location] = (stats.locations[job.location] || 0) + 1;
    });

    return stats;
  }

  // Get available scrapers
  getAvailableScrapers(): string[] {
    return Array.from(this.scrapers.keys());
  }
}

/**
 * Standardizes a postedDate string to ISO 8601 format.
 * @param postedDate The original postedDate string (can be ISO, relative, human-readable, or empty).
 * @param fallbackDate The fallback Date (e.g., scrape date or current date) to use if postedDate is missing or unparseable.
 * @returns ISO 8601 date string.
 */
export function standardizePostedDate(postedDate: string | undefined, fallbackDate: Date = new Date()): string {
  if (!postedDate || postedDate.trim() === "") {
    return fallbackDate.toISOString();
  }

  // ISO 8601 check
  const isoDate = Date.parse(postedDate);
  if (!isNaN(isoDate)) {
    return new Date(isoDate).toISOString();
  }

  const now = fallbackDate;
  const lower = postedDate.toLowerCase().trim();

  // Today/yesterday
  if (lower === "new" || lower === "today") {
    return now.toISOString();
  }
  if (lower === "yesterday") {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
  }

  // X days/months/years ago
  const agoMatch = lower.match(/(\d+)\s*(day|month|year|week|hour|minute|second)s?\s*ago/);
  if (agoMatch) {
    const value = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2];
    const date = new Date(now);
    switch (unit) {
      case "day": date.setDate(date.getDate() - value); break;
      case "week": date.setDate(date.getDate() - value * 7); break;
      case "month": date.setMonth(date.getMonth() - value); break;
      case "year": date.setFullYear(date.getFullYear() - value); break;
      case "hour": date.setHours(date.getHours() - value); break;
      case "minute": date.setMinutes(date.getMinutes() - value); break;
      case "second": date.setSeconds(date.getSeconds() - value); break;
    }
    return date.toISOString();
  }

  // Xd, Xm, Xy (e.g., 3d, 6m, 2y)
  const relShortMatch = lower.match(/(\d+)\s*(d|day|days|m|month|months|y|year|years)/);
  if (relShortMatch) {
    const value = parseInt(relShortMatch[1], 10);
    const unit = relShortMatch[2];
    const date = new Date(now);
    if (unit.startsWith("d")) {
      date.setDate(date.getDate() - value);
    } else if (unit.startsWith("m")) {
      date.setMonth(date.getMonth() - value);
    } else if (unit.startsWith("y")) {
      date.setFullYear(date.getFullYear() - value);
    }
    return date.toISOString();
  }

  // Human-readable: 'about 2 months', 'over 3 years', 'almost 2 years', etc.
  const humanMatch = lower.match(/(about|over|almost)?\s*(\d+)\s*(day|month|year|week|hour|minute|second)s?/);
  if (humanMatch) {
    const value = parseInt(humanMatch[2], 10);
    const unit = humanMatch[3];
    const date = new Date(now);
    switch (unit) {
      case "day": date.setDate(date.getDate() - value); break;
      case "week": date.setDate(date.getDate() - value * 7); break;
      case "month": date.setMonth(date.getMonth() - value); break;
      case "year": date.setFullYear(date.getFullYear() - value); break;
      case "hour": date.setHours(date.getHours() - value); break;
      case "minute": date.setMinutes(date.getMinutes() - value); break;
      case "second": date.setSeconds(date.getSeconds() - value); break;
    }
    return date.toISOString();
  }

  // Fallback
  return fallbackDate.toISOString();
}

/**
 * Converts a postedDate string to a relative format like 'today', 'yesterday', '3 days ago', '2 months ago', etc.
 * Returns null if missing or unparseable.
 */
export function toRelativePostedDate(postedDate: string | undefined, referenceDate: Date = new Date()): string | null {
  if (!postedDate || postedDate.trim() === "") return null;
  const lower = postedDate.trim().toLowerCase();

  // 1. ISO 8601
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}\.\d{3}z$/.test(lower)) {
    const date = new Date(postedDate);
    if (isNaN(date.getTime())) return null;
    return getRelativeFromDates(date, referenceDate);
  }

  // 2. '2d', '13d', etc.
  let m = lower.match(/^(\d+)d$/);
  if (m) return `${m[1]} days ago`;

  // 3. '3 days ago', '2 days ago'
  m = lower.match(/^(\d+)\s+days?\s+ago$/);
  if (m) return `${m[1]} days ago`;

  // 4. '5 months', 'over 2 years', 'about 2 months', 'almost 2 years'
  m = lower.match(/^(about|over|almost)?\s*(\d+)\s+months?$/);
  if (m) return `${m[2]} months ago`;
  m = lower.match(/^(about|over|almost)?\s*(\d+)\s+years?$/);
  if (m) return `${m[2]} years ago`;

  // 5. 'new' or 'today'
  if (/^(new|today)$/.test(lower)) return 'today';

  // 6. 'yesterday'
  if (lower === 'yesterday') return 'yesterday';

  // 7. 'Posted X [unit] ago'
  m = lower.match(/^posted\s+(\d+)\s+(hours?|days?|weeks?|months?|years?)\s+ago$/);
  if (m) return `${m[1]} ${m[2]} ago`;

  // 8. '30+ days ago'
  m = lower.match(/^(\d+)\+\s+days?\s+ago$/);
  if (m) return `${m[1]} days ago`;

  // Try to parse as date
  const tryDate = Date.parse(postedDate);
  if (!isNaN(tryDate)) {
    return getRelativeFromDates(new Date(tryDate), referenceDate);
  }

  return null;
}

/**
 * Helper to get relative string from two dates.
 */
function getRelativeFromDates(date: Date, reference: Date): string {
  const diffMs = reference.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'today';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} years ago`;
}