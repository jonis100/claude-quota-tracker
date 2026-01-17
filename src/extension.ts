import * as vscode from 'vscode';
import * as fs from 'fs';
import { chromium } from 'playwright-core';
import { registry, registryDirectory } from 'playwright-core/lib/server';
import { QuotaService } from './core/quotaService';
import { StatusBarManager } from './ui/statusBar';
import { logger } from './utils/logger';
import { QuotaInfo } from './utils/types';

let quotaService: QuotaService | null = null;
let statusBarManager: StatusBarManager | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let currentQuota: QuotaInfo | null = null;

/**
 * Checks if the extension has write permissions to the Playwright registry directory.
 * Throws an error if permissions are insufficient.
 * If not checked, installation may hang indefinitely on permission issues.
 */
async function checkRegistryPermissions(): Promise<void> {
  try {
    await fs.promises.access(registryDirectory, fs.constants.W_OK);
  } catch (error: unknown) {
    const errCode = error instanceof Error && 'code' in error ? error.code : undefined;
    if (errCode === 'EACCES') {
      logger.error('Setup', `Permission denied: ${registryDirectory}`);
      throw new Error(
        `Cannot write to browser cache directory due to permission issues.`
      );
    } 
    logger.error('Setup', 'An unexpected error occurred: ' + String(error));
    throw error;
  }
}

/**
 * Ensures Playwright browsers are installed.
 * @returns A promise that resolves when the browsers are installed.
 */
async function ensurePlaywrightBrowsers(): Promise<void> {
  logger.info('Setup', 'Checking Playwright browsers...');

  try {
    const testBrowser = await chromium.launch({ headless: true, timeout: 5000 });
    await testBrowser.close();
    logger.info('Setup', 'Playwright browsers already installed');
    return;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (!msg.includes('executable') && !msg.includes('Executable')) {
      throw error;
    }
    logger.warn('Setup', 'Chromium not found, installing...');
  }

  // Pre-check permissions to fail fast instead of hanging
  await checkRegistryPermissions();

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Claude Quota: Installing Playwright Chromium...',
    cancellable: false
  }, async () => {
    try {
      const executable = registry.findExecutable('chromium');
      if (!executable) {
        throw new Error('Could not find chromium executable definition');
      }
      await registry.install([executable], { force: false });
      logger.info('Setup', 'Chromium installed successfully');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Setup', `Installation failed: ${msg}`);
      throw error;
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  logger.init(context);
  logger.section('Extension', 'Claude Quota Tracker Activating');
  logger.info('Extension', `VS Code Version: ${vscode.version}`);
  logger.info('Extension', `Extension activating at: ${new Date().toISOString()}`);

  statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);

  const config = vscode.workspace.getConfiguration('claudeQuota');
  const sessionKey = config.get<string>('sessionKey', '');
  const organizationId = config.get<string>('organizationId', '');

    logger.info('Extension', 'Creating QuotaService');
    quotaService = new QuotaService(sessionKey, organizationId);
    logger.info('Extension', 'QuotaService created');

  const refreshCommand = vscode.commands.registerCommand(
    'claudeQuota.refresh',
    async () => {
      await refreshQuota();
    }
  );

  const showDetailsCommand = vscode.commands.registerCommand(
    'claudeQuota.showDetails',
    () => {
      showQuotaDetails();
    }
  );

  const showLogsCommand = vscode.commands.registerCommand(
    'claudeQuota.showLogs',
    () => {
      logger.info('Extension', 'Opening debug log panel');
      logger.show();
      vscode.window.showInformationMessage('Debug log panel opened');
    }
  );

  context.subscriptions.push(refreshCommand, showDetailsCommand, showLogsCommand);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeQuota')) {
        handleConfigurationChange();
      }
    })
  );

  // Show status bar with N/A initially
  statusBarManager.updateQuota(null);
  statusBarManager.show();

  setImmediate(async () => {
    try {
      await ensurePlaywrightBrowsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Setup', `Browser setup failed: ${msg}`);
      vscode.window.showWarningMessage(
        'Claude Quota: Could not install Playwright. Install manually (e.g. `npx playwright install chromium`) and reload VS Code'
      );
      return;
    }

    setupAutoRefresh();

    if (sessionKey && organizationId) {
      setTimeout(() => {
        refreshQuota().catch(err => {
          logger.error('Extension', 'Initial quota fetch failed', err);
        });
      }, 2000);
    }
  });

  logger.info('Extension', 'Claude Quota Tracker activated successfully');
}

async function refreshQuota() {
  if (!quotaService || !statusBarManager) {
    return;
  }

  const config = vscode.workspace.getConfiguration('claudeQuota');
  const sessionKey = config.get<string>('sessionKey', '');
  const organizationId = config.get<string>('organizationId', '');

  if (!sessionKey || !organizationId) {
    statusBarManager.updateQuota(null);
    return;
  }

  try {
    statusBarManager.showLoading();
    logger.debug('Quota', 'Fetching quota data...');
    currentQuota = await quotaService.fetchQuota();
    logger.debug('Quota', 'Quota data received', {
      usage: currentQuota?.usage,
      limit: currentQuota?.limit,
      percentage: currentQuota?.percentage
    });
    statusBarManager.updateQuota(currentQuota);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Quota', 'Error fetching quota', error);
    statusBarManager.showError(`Failed to fetch quota: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Claude Quota: ${errorMessage}. Please check your credentials in settings.`
    );
  }
}

function showQuotaDetails() {
  const config = vscode.workspace.getConfiguration('claudeQuota');
  const sessionKey = config.get<string>('sessionKey', '');
  const organizationId = config.get<string>('organizationId', '');

  if (!sessionKey || !organizationId) {
    vscode.window
      .showInformationMessage(
        'Claude.ai credentials not configured. Would you like to set them now?',
        'Configure'
      )
      .then((selection) => {
        if (selection === 'Configure') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'claudeQuota'
          );
        }
      });
    return;
  }

  if (!currentQuota) {
    vscode.window.showInformationMessage(
      'No quota data available. Click "Refresh" to fetch the latest data.',
      'Refresh'
    ).then((selection) => {
      if (selection === 'Refresh') {
        refreshQuota();
      }
    });
    return;
  }

  const percentage = currentQuota.percentage.toFixed(2);
  const used = formatNumber(currentQuota.usage);
  const limit = formatNumber(currentQuota.limit);
  const remaining = formatNumber(currentQuota.remaining);

  let message = `Claude Usage\n\n`;
  message += `Used: ${used} requests\n`;
  message += `Limit: ${limit} requests\n`;
  message += `Remaining: ${remaining} requests\n`;
  message += `Usage: ${percentage}%\n`;

  if (currentQuota.period && currentQuota.period.type) {
    message += `\nPeriod: ${currentQuota.period.type}`;
    if (currentQuota.resetDate) {
      message += `\nResets: ${currentQuota.resetDate.toLocaleString()}`;
    }
  }

  vscode.window.showInformationMessage(message, 'Refresh', 'Open Settings').then((selection) => {
    if (selection === 'Refresh') {
      refreshQuota();
    } else if (selection === 'Open Settings') {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'claudeQuota'
      );
    }
  });
}

function handleConfigurationChange() {
  logger.info('Config', 'Configuration changed, reloading...');
  const config = vscode.workspace.getConfiguration('claudeQuota');
  const sessionKey = config.get<string>('sessionKey', '');
  const organizationId = config.get<string>('organizationId', '');
  const showInStatusBar = config.get<boolean>('showInStatusBar', true);

  logger.debug('Config', 'New configuration', {
    hasSessionKey: !!sessionKey,
    hasOrganizationId: !!organizationId,
    showInStatusBar
  });

  if (quotaService) {
    quotaService.updateCredentials(sessionKey, organizationId);
  }

  if (statusBarManager) {
    if (showInStatusBar) {
      statusBarManager.show();
    } else {
      statusBarManager.hide();
    }
  }

  refreshQuota();

  setupAutoRefresh();
}

function setupAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  const config = vscode.workspace.getConfiguration('claudeQuota');
  const refreshInterval = config.get<number>('refreshInterval', 300000);

  logger.debug('AutoRefresh', `Setting up auto-refresh with interval: ${refreshInterval}ms`);

  if (refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      logger.debug('AutoRefresh', 'Auto-refresh triggered');
      refreshQuota();
    }, refreshInterval);
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

export async function deactivate() {
  logger.info('Extension', 'Claude Quota Tracker deactivating...');

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (quotaService) {
    await quotaService.dispose();
  }

  logger.info('Extension', 'Claude Quota Tracker deactivated');
}
