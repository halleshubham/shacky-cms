// Canonical default shapes for campaign-email block types that are seeded server-side
// (apps/api/src/routes/campaigns.ts) and edited client-side (apps/web/src/lib/page-builder.ts).
// Kept here, not duplicated per-app, so the two don't silently drift apart.

export interface IssueHeaderConfig {
  showLogo: boolean;
  showTagline: boolean;
  showIssueMeta: boolean;
  showEditors: boolean;
}

export interface IssueArticlesConfig {
  source: 'latest_issue' | 'specific';
  issueId?: string;
  coverCount: number;
  columns: 2 | 3 | 4;
  showImages: boolean;
  showExcerpt: boolean;
  excerptLength: number;
}

export function defaultIssueHeaderConfig(): IssueHeaderConfig {
  return { showLogo: true, showTagline: true, showIssueMeta: true, showEditors: true };
}

export function defaultIssueArticlesConfig(overrides: Partial<IssueArticlesConfig> = {}): IssueArticlesConfig {
  return {
    source: 'latest_issue',
    coverCount: 1,
    columns: 4,
    showImages: true,
    showExcerpt: true,
    excerptLength: 150,
    ...overrides,
  };
}
