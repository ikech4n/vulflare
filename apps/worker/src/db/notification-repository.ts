export interface NotificationChannel {
  id: string;
  name: string;
  type: "slack" | "email";
  config: string; // JSON
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  channel_id: string;
  event_type: string;
  filter_config: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  channel_id: string;
  event_type: string;
  payload: string;
  status: "sent" | "failed" | "pending";
  error_message: string | null;
  sent_at: string;
}

export const notificationRepo = {
  // ========================================
  // チャネル管理
  // ========================================

  async listChannels(db: D1Database): Promise<NotificationChannel[]> {
    const result = await db
      .prepare("SELECT * FROM notification_channels ORDER BY created_at DESC")
      .all();
    return result.results as unknown as NotificationChannel[];
  },

  async findChannelById(db: D1Database, id: string): Promise<NotificationChannel | null> {
    const result = await db
      .prepare("SELECT * FROM notification_channels WHERE id = ?")
      .bind(id)
      .first();
    return result as NotificationChannel | null;
  },

  async createChannel(
    db: D1Database,
    channel: Omit<NotificationChannel, "created_at" | "updated_at">,
  ): Promise<void> {
    await db
      .prepare(
        "INSERT INTO notification_channels (id, name, type, config, is_active) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(channel.id, channel.name, channel.type, channel.config, channel.is_active)
      .run();
  },

  async updateChannel(
    db: D1Database,
    id: string,
    updates: Partial<Pick<NotificationChannel, "name" | "config" | "is_active">>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      params.push(updates.name);
    }
    if (updates.config !== undefined) {
      sets.push("config = ?");
      params.push(updates.config);
    }
    if (updates.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(updates.is_active);
    }

    if (sets.length === 0) return;

    params.push(id);
    await db
      .prepare(`UPDATE notification_channels SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },

  async deleteChannel(db: D1Database, id: string): Promise<void> {
    await db.prepare("DELETE FROM notification_channels WHERE id = ?").bind(id).run();
  },

  // ========================================
  // ルール管理
  // ========================================

  async listRules(db: D1Database, channelId?: string): Promise<NotificationRule[]> {
    if (channelId) {
      const result = await db
        .prepare("SELECT * FROM notification_rules WHERE channel_id = ? ORDER BY created_at DESC")
        .bind(channelId)
        .all();
      return result.results as unknown as NotificationRule[];
    }
    const result = await db
      .prepare("SELECT * FROM notification_rules ORDER BY created_at DESC")
      .all();
    return result.results as unknown as NotificationRule[];
  },

  async findRuleById(db: D1Database, id: string): Promise<NotificationRule | null> {
    const result = await db
      .prepare("SELECT * FROM notification_rules WHERE id = ?")
      .bind(id)
      .first();
    return result as NotificationRule | null;
  },

  async createRule(
    db: D1Database,
    rule: Omit<NotificationRule, "created_at" | "updated_at">,
  ): Promise<void> {
    await db
      .prepare(
        "INSERT INTO notification_rules (id, channel_id, event_type, filter_config, is_active) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(rule.id, rule.channel_id, rule.event_type, rule.filter_config, rule.is_active)
      .run();
  },

  async updateRule(
    db: D1Database,
    id: string,
    updates: Partial<Pick<NotificationRule, "event_type" | "filter_config" | "is_active">>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.event_type !== undefined) {
      sets.push("event_type = ?");
      params.push(updates.event_type);
    }
    if (updates.filter_config !== undefined) {
      sets.push("filter_config = ?");
      params.push(updates.filter_config);
    }
    if (updates.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(updates.is_active);
    }

    if (sets.length === 0) return;

    params.push(id);
    await db
      .prepare(`UPDATE notification_rules SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },

  async deleteRule(db: D1Database, id: string): Promise<void> {
    await db.prepare("DELETE FROM notification_rules WHERE id = ?").bind(id).run();
  },

  async findRulesByEvent(db: D1Database, eventType: string): Promise<NotificationRule[]> {
    const result = await db
      .prepare("SELECT * FROM notification_rules WHERE event_type = ? AND is_active = 1")
      .bind(eventType)
      .all();
    return result.results as unknown as NotificationRule[];
  },

  // ========================================
  // ログ管理
  // ========================================

  async createLog(db: D1Database, log: Omit<NotificationLog, "sent_at">): Promise<void> {
    await db
      .prepare(
        "INSERT INTO notification_logs (id, channel_id, event_type, payload, status, error_message) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(log.id, log.channel_id, log.event_type, log.payload, log.status, log.error_message)
      .run();
  },

  async findLogById(db: D1Database, id: string): Promise<NotificationLog | null> {
    const result = await db
      .prepare("SELECT * FROM notification_logs WHERE id = ?")
      .bind(id)
      .first();
    return result as NotificationLog | null;
  },

  async listLogs(
    db: D1Database,
    options: {
      channelId?: string;
      eventType?: string;
      status?: "sent" | "failed" | "pending";
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: NotificationLog[]; total: number; page: number; limit: number }> {
    const limit = options.limit ?? 50;
    const page = options.page ?? 1;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.channelId) {
      conditions.push("channel_id = ?");
      params.push(options.channelId);
    }
    if (options.eventType) {
      conditions.push("event_type = ?");
      params.push(options.eventType);
    }
    if (options.status) {
      conditions.push("status = ?");
      params.push(options.status);
    }
    if (options.dateFrom) {
      conditions.push("sent_at >= ?");
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push("sent_at <= ?");
      params.push(options.dateTo);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await db
      .prepare(`SELECT COUNT(*) as count FROM notification_logs${where}`)
      .bind(...params)
      .first<{ count: number }>();
    const total = countResult?.count ?? 0;

    const dataResult = await db
      .prepare(`SELECT * FROM notification_logs${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all();

    return {
      data: dataResult.results as unknown as NotificationLog[],
      total,
      page,
      limit,
    };
  },
};
