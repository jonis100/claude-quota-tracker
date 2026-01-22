import { chromium, Browser, BrowserContext } from 'playwright-core';
import { QuotaInfo, ClaudeUsageResponse } from '../utils/types';
import { logger } from '../utils/logger';

export class QuotaService {
  private sessionKey: string;
  private organizationId: string;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private usagePeriod: '5-hour' | '7-day' = '5-hour';

  constructor(sessionKey: string, organizationId: string) {
    this.sessionKey = this.parseSessionKey(sessionKey);
    this.organizationId = organizationId;
  }

  updateCredentials(sessionKey: string, organizationId: string) {
    this.sessionKey = this.parseSessionKey(sessionKey);
    this.organizationId = organizationId;
  }

  setUsagePeriod(period: '5-hour' | '7-day') {
    this.usagePeriod = period;
  }

  /**
   * Parse session key from cookie string if needed
   * Handles formats like:
   * - "sessionKey=sk-ant-sid01-...; Domain=.claude.ai; ..."
   * - "sk-ant-sid01-..."
   */
  private parseSessionKey(sessionKey: string): string {
    if (!sessionKey) {
      return '';
    }

    // If it looks like a full cookie string, extract just the value
    if (sessionKey.includes('sessionKey=')) {
      const match = sessionKey.match(/sessionKey=([^;]+)/);
      return match ? match[1].trim() : sessionKey;
    }

    // Otherwise assume it's already just the key
    return sessionKey.trim();
  }

  async fetchQuota(): Promise<QuotaInfo | null> {
    if (!this.sessionKey || !this.organizationId) {
      throw new Error('Session key and organization ID not configured');
    }

    return await this.fetchWithPlaywright();
  }

  private async fetchWithPlaywright(): Promise<QuotaInfo> {
    try {
      if (!this.browser) {
        logger.debug('QuotaService', 'Launching Chromium browser');
        this.browser = await chromium.launch({
          headless: false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1,1',
            '--window-position=-2400,-2400',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-extensions',
            '--mute-audio',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        });
      }

      if (!this.context) {
        this.context = await this.browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
        });

        await this.context.addCookies([
          {
            name: 'sessionKey',
            value: this.sessionKey,
            domain: '.claude.ai',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
          },
          {
            name: 'lastActiveOrg',
            value: this.organizationId,
            domain: '.claude.ai',
            path: '/',
            secure: true,
            sameSite: 'Lax',
          },
        ]);
      }

      const page = await this.context.newPage();

      // Hide webdriver and automation flags
      await page.addInitScript(`
        // Override the navigator.webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Override the permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Add chrome object if not present
        if (!window.chrome) {
          window.chrome = {
            runtime: {},
          };
        }
      `);

      logger.debug('QuotaService', 'Navigating to claude.ai...');
      await page.goto('https://claude.ai/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      logger.debug('QuotaService', 'Waiting for Cloudflare challenge to complete...');
      // Wait for Cloudflare challenge to complete
      try {
        await page.waitForFunction(`
          () => {
            // Check if we're past the Cloudflare page
            const body = document.body.innerText;
            return !body.includes('Verifying you are human') &&
                   !body.includes('claude.ai needs to review the security');
          }
        `, { timeout: 30000 });
        logger.debug('QuotaService', 'Cloudflare challenge passed!');
      } catch (error) {
        logger.debug('QuotaService', 'Cloudflare challenge may still be present, continuing anyway...');
      }

      logger.debug('QuotaService', 'Waiting for page to fully settle...');
      await page.waitForTimeout(3000);

      const url = `https://claude.ai/api/organizations/${this.organizationId}/usage`;

      const result = await page.evaluate(async (apiUrl: string) => {
        try {
          const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'accept': '*/*',
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'anthropic-client-platform': 'web_claude_ai',
            },
          });

          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });

          let data;
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          return {
            status: response.status,
            statusText: response.statusText,
            headers,
            data,
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }, url);

      await page.close();

      if (result.status !== 200) {
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }

      return this.parseUsageData(result.data as ClaudeUsageResponse);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch with browser: ${errorMessage}`);
    }
  }

  private parseUsageData(data: ClaudeUsageResponse): QuotaInfo {
    let utilization = 0;
    let resetDate: Date | undefined;
    let periodType = '';
    let resetsAt = '';

    // Use the configured usage period preference
    if (this.usagePeriod === '5-hour' && data.five_hour) {
      utilization = data.five_hour.utilization;
      resetDate = new Date(data.five_hour.resets_at);
      periodType = '5-hour window';
      resetsAt = data.five_hour.resets_at;
    } else if (this.usagePeriod === '7-day' && data.seven_day) {
      utilization = data.seven_day.utilization;
      resetDate = new Date(data.seven_day.resets_at);
      periodType = '7-day window';
      resetsAt = data.seven_day.resets_at;
    } else if (data.five_hour) {
      // Fallback to 5-hour if preferred period not available
      utilization = data.five_hour.utilization;
      resetDate = new Date(data.five_hour.resets_at);
      periodType = '5-hour window';
      resetsAt = data.five_hour.resets_at;
    } else if (data.seven_day) {
      // Fallback to 7-day if 5-hour not available
      utilization = data.seven_day.utilization;
      resetDate = new Date(data.seven_day.resets_at);
      periodType = '7-day window';
      resetsAt = data.seven_day.resets_at;
    }

    const limit = 100;
    const usage = utilization;
    const remaining = limit - usage;
    const percentage = utilization;

    return {
      usage,
      limit,
      percentage,
      remaining,
      resetDate,
      period: {
        type: periodType,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        resets_at: resetsAt,
      },
      fiveHour: data.five_hour ? {
        utilization: data.five_hour.utilization,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        resets_at: data.five_hour.resets_at,
      } : undefined,
      sevenDay: data.seven_day ? {
        utilization: data.seven_day.utilization,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        resets_at: data.seven_day.resets_at,
      } : undefined,
    };
  }

  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
