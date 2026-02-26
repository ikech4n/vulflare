export interface SlaPolicy {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  response_days: number;
  created_at: string;
  updated_at: string;
}

export interface SlaBreach {
  asset_id: string;
  asset_name: string;
  vulnerability_id: string;
  vulnerability_title: string;
  severity: string;
  sla_deadline: string;
  days_overdue: number;
  priority: string;
}

export interface SlaSummary {
  total: number;
  within_sla: number;
  breached: number;
  no_sla: number;
}
