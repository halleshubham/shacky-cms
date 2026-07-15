import { api } from './api';

export interface IssueSummary {
  id: string;
  title: string;
  volumeNumber: number;
  issueNumber: number;
  publishDate: string;
}

export async function fetchIssues(pageSize = 50): Promise<IssueSummary[]> {
  try {
    const res = await api.get<{ data: IssueSummary[] }>(`/api/issues?pageSize=${pageSize}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}
