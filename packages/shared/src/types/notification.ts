export type NotificationChannelType = "slack" | "email";

export type EventType =
  | "vulnerability_created"
  | "vulnerability_updated"
  | "vulnerability_critical"
  | "eol_approaching"
  | "eol_expired"
  | "hw_support_approaching"
  | "hw_support_expired";

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  config: string; // JSON
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  channel_id: string;
  event_type: EventType;
  filter_config: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  channel_id: string;
  event_type: EventType;
  payload: string;
  status: "sent" | "failed" | "pending";
  error_message: string | null;
  sent_at: string;
}
