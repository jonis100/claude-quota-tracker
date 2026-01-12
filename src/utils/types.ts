/* eslint-disable @typescript-eslint/naming-convention */

export interface QuotaInfo {
  usage: number;
  limit: number;
  percentage: number;
  remaining: number;
  resetDate?: Date;
  period?: {
    type: string;
    resets_at: string;
  };
  fiveHour?: {
    utilization: number;
    resets_at: string;
  };
  sevenDay?: {
    utilization: number;
    resets_at: string;
  };
}

export interface ClaudeUsageResponse {
  five_hour?: {
    utilization: number;
    resets_at: string;
  };
  seven_day?: {
    utilization: number;
    resets_at: string;
  };
  seven_day_oauth_apps?: Record<string, unknown>;
  seven_day_opus?: Record<string, unknown>;
  seven_day_sonnet?: Record<string, unknown>;
  iguana_necktie?: Record<string, unknown>;
  extra_usage?: Record<string, unknown>;
}
