/**
 * Chromium Service
 *
 * Playwright Chromium is installed into the user cache directory (e.g., ~/.cache/ms-playwright)
 * rather than inside the extension or node_modules.
 * This ensures:
 *   - Chromium is shared across projects and extensions
 *   - The extension package stays small
 *   - Users don't need to reinstall it every time
 *
 * NOTE: Uninstalling this extension does NOT remove Chromium from the cache,
 * and that is intentional. The cache may be used by other projects or extensions.
 */

import { chromium } from 'playwright-core';
import { logger } from './logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkChromiumAvailability(): Promise<boolean> {
  try {
    const executablePath = chromium.executablePath();
    logger.debug('ChromiumService', `Chromium executable path: ${executablePath}`);
    const fs = await import('fs');
    if (!fs.existsSync(executablePath)) {
      logger.warn('ChromiumService', 'Chromium executable path returned but file does not exist', { path: executablePath });
      return false;
    }

    logger.debug('ChromiumService', 'Chromium verified and available');
    return true;
  } catch (error) {
    logger.warn('ChromiumService', 'Chromium not available', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

export async function ensureChromiumAvailable(vscode: typeof import('vscode')): Promise<boolean> {
  const isAvailable = await checkChromiumAvailability();
  if (!isAvailable) {
    logger.warn('ChromiumService', 'Chromium not available, prompting installation');
    await promptChromiumInstallation(vscode);
    return await checkChromiumAvailability();
  }
  return true;
}

export async function installChromium(
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('ChromiumService', 'Starting Chromium installation...');
    onProgress?.('Installing Chromium browser...');
    const command = 'npx playwright install chromium';
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });

    logger.debug('ChromiumService', 'Installation output:', { stdout, stderr });

    const isAvailable = await checkChromiumAvailability();
    if (isAvailable) {
      logger.info('ChromiumService', 'Chromium installed successfully');
      onProgress?.('Chromium installed successfully!');
      return { success: true };
    }

    logger.error('ChromiumService', 'Installation completed but Chromium still not available');
    return {
      success: false,
      error: 'Installation completed but Chromium is still not available'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('ChromiumService', 'Failed to install Chromium', { error: errorMessage });
    onProgress?.(`Installation failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function promptChromiumInstallation(vscode: typeof import('vscode')): Promise<void> {
  const selection = await vscode.window.showWarningMessage(
    'Claude Quota Tracker requires Chromium browser to function. Would you like to install it now?',
    'Install Now',
    'Install Later',
    'Learn More'
  );

  if (selection === 'Install Now') {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Chromium',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Downloading and installing Chromium browser...' });

        const result = await installChromium((message) => {
          progress.report({ message });
          logger.info('ChromiumService', message);
        });

        if (result.success) {
          vscode.window.showInformationMessage(
            'Chromium installed successfully! The extension is now ready to use.'
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to install Chromium: ${result.error}\n
            \nPlease try installing manually: npx playwright install chromium`
          );
        }
      }
    );
  } else if (selection === 'Learn More') {
    const choice = await vscode.window.showInformationMessage(
      'Claude Quota Tracker uses Playwright to fetch your Claude.ai usage data.\n\n' +
      'To install Chromium manually, run:\nnpx playwright install chromium',
      'Install Now'
    );
    if (choice === 'Install Now') {
      await promptChromiumInstallation(vscode);
    }
  }
}
