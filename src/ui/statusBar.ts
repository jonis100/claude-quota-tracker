import * as vscode from 'vscode';
import { QuotaInfo } from '../utils/types';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'claudeQuota.showDetails';
  }

  updateQuota(quota: QuotaInfo | null) {
    if (!quota) {
      this.statusBarItem.text = '$(cloud-download) Claude: N/A';
      this.statusBarItem.tooltip = 'Click to configure credentials';
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.show();
      return;
    }

    // Build status bar text with both 5-hour and 7-day usage
    let statusText = '$(pulse) Claude:';

    if (quota.fiveHour) {
      const fiveHourPct = quota.fiveHour.utilization.toFixed(0);
      const barLength = 10;
      const filled = Math.round((quota.fiveHour.utilization / 100) * barLength);
      const empty = barLength - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      statusText += ` 5h ${bar} ${fiveHourPct}%`;
    }

    if (quota.sevenDay) {
      const sevenDayPct = quota.sevenDay.utilization.toFixed(0);
      statusText += ` | 7d ${sevenDayPct}%`;
    }

    this.statusBarItem.text = statusText;

    // Update tooltip with detailed information
    const tooltipLines = [
      `Claude Usage`,
      `─────────────────`,
    ];

    if (quota.fiveHour) {
      tooltipLines.push(`5-Hour Window: ${quota.fiveHour.utilization.toFixed(1)}%`);
      const fiveHourReset = new Date(quota.fiveHour.resets_at);
      tooltipLines.push(`  Resets: ${fiveHourReset.toLocaleString()}`);
    }

    if (quota.sevenDay) {
      tooltipLines.push(`7-Day Window: ${quota.sevenDay.utilization.toFixed(1)}%`);
      const sevenDayReset = new Date(quota.sevenDay.resets_at);
      tooltipLines.push(`  Resets: ${sevenDayReset.toLocaleString()}`);
    }

    tooltipLines.push('', 'Click for details');

    this.statusBarItem.tooltip = new vscode.MarkdownString(
      tooltipLines.join('\n')
    );

    const config = vscode.workspace.getConfiguration('claudeQuota');
    const warningThreshold = config.get<number>('warningThreshold', 80);

    if (quota.percentage >= 95) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    } else if (quota.percentage >= warningThreshold) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    this.statusBarItem.show();
  }

  showError(message: string) {
    this.statusBarItem.text = '$(alert) Claude: Error';
    this.statusBarItem.tooltip = message;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground'
    );
    this.statusBarItem.show();
  }

  showLoading() {
    this.statusBarItem.text = '$(sync~spin) Claude: Loading...';
    this.statusBarItem.tooltip = 'Fetching quota information...';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.show();
  }

  hide() {
    this.statusBarItem.hide();
  }

  show() {
    this.statusBarItem.show();
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
