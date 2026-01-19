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

    const config = vscode.workspace.getConfiguration('claudeQuota');
    const usagePeriod = config.get<'5-hour' | '7-day'>('usagePeriod', '5-hour');
    let statusText = '$(pulse) Claude:';
    let displayUtilization = 0;

    if (usagePeriod === '5-hour') {
      if (quota.fiveHour) {
        const fiveHourPct = quota.fiveHour.utilization.toFixed(0);
        const barLength = 10;
        const filled = Math.round((quota.fiveHour.utilization / 100) * barLength);
        const empty = barLength - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        statusText += ` 5h ${bar} ${fiveHourPct}%`;
        displayUtilization = quota.fiveHour.utilization;
      }
      if (quota.sevenDay) {
        const sevenDayPct = quota.sevenDay.utilization.toFixed(0);
        statusText += ` | 7d ${sevenDayPct}%`;
      }
    } else {
      if (quota.sevenDay) {
        const sevenDayPct = quota.sevenDay.utilization.toFixed(0);
        const barLength = 10;
        const filled = Math.round((quota.sevenDay.utilization / 100) * barLength);
        const empty = barLength - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        statusText += ` 7d ${bar} ${sevenDayPct}%`;
        displayUtilization = quota.sevenDay.utilization;
      }
      if (quota.fiveHour) {
        const fiveHourPct = quota.fiveHour.utilization.toFixed(0);
        statusText += ` | 5h ${fiveHourPct}%`;
      }
    }

    this.statusBarItem.text = statusText;

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

    const warningThreshold = config.get<number>('warningThreshold', 80);

    if (displayUtilization >= 95) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    } else if (displayUtilization >= warningThreshold) {
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
