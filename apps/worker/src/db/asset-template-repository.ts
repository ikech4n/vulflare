import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export interface DbAssetTemplate {
  id: string;
  name: string;
  description: string | null;
  asset_type: string;
  environment: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbAssetTemplatePackage {
  id: string;
  template_id: string;
  ecosystem: string;
  name: string;
  version: string;
  vendor: string | null;
  created_at: string;
}

export interface DbAssetTemplateEolLink {
  id: string;
  template_id: string;
  eol_cycle_id: string;
  created_at: string;
}

export const assetTemplateRepo = {
  // テンプレート一覧
  list(
    db: D1Database,
    options?: {
      q?: string;           // 検索クエリ（名前と説明文）
      assetType?: string;   // アセットタイプフィルター
      environment?: string; // 環境フィルター
      sortBy?: string;      // 'name' | 'created_at'
      sortOrder?: string;   // 'asc' | 'desc'
      page?: number;        // ページ番号（デフォルト: 1）
      limit?: number;       // ページサイズ（デフォルト: 20）
    }
  ): { countStmt: D1PreparedStatement; dataStmt: D1PreparedStatement } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // 検索クエリ
    if (options?.q) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${options.q}%`, `%${options.q}%`);
    }

    // アセットタイプフィルター
    if (options?.assetType) {
      conditions.push('asset_type = ?');
      params.push(options.assetType);
    }

    // 環境フィルター
    if (options?.environment) {
      conditions.push('environment = ?');
      params.push(options.environment);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // ソート設定
    const sortBy = options?.sortBy === 'name' ? 'name' : 'created_at';
    const sortOrder = options?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;

    // ページネーション
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    // カウントクエリ
    const countStmt = db
      .prepare(`SELECT COUNT(*) as total FROM asset_templates ${where}`)
      .bind(...params);

    // データクエリ
    const dataStmt = db
      .prepare(`SELECT * FROM asset_templates ${where} ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset);

    return { countStmt, dataStmt };
  },

  // テンプレート詳細
  async findById(db: D1Database, id: string): Promise<DbAssetTemplate | null> {
    const result = await db
      .prepare('SELECT * FROM asset_templates WHERE id = ?')
      .bind(id)
      .first<DbAssetTemplate>();
    return result ?? null;
  },

  // テンプレート作成
  create(db: D1Database, data: Omit<DbAssetTemplate, 'created_at' | 'updated_at'>): D1PreparedStatement {
    return db
      .prepare(
        `INSERT INTO asset_templates (id, name, description, asset_type, environment, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(data.id, data.name, data.description, data.asset_type, data.environment, data.created_by);
  },

  // テンプレート更新
  update(db: D1Database, id: string, fields: Partial<DbAssetTemplate>): D1PreparedStatement {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
    sets.push('updated_at = datetime("now")');
    values.push(id);

    return db.prepare(`UPDATE asset_templates SET ${sets.join(', ')} WHERE id = ?`).bind(...values);
  },

  // テンプレート削除
  delete(db: D1Database, id: string): D1PreparedStatement {
    return db.prepare('DELETE FROM asset_templates WHERE id = ?').bind(id);
  },
};

export const assetTemplatePackageRepo = {
  // テンプレートのパッケージ一覧
  listByTemplate(db: D1Database, templateId: string): D1PreparedStatement {
    return db
      .prepare('SELECT * FROM asset_template_packages WHERE template_id = ? ORDER BY ecosystem, name')
      .bind(templateId);
  },

  // パッケージ作成
  create(
    db: D1Database,
    data: Omit<DbAssetTemplatePackage, 'created_at'>
  ): D1PreparedStatement {
    return db
      .prepare(
        `INSERT INTO asset_template_packages (id, template_id, ecosystem, name, version, vendor)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(data.id, data.template_id, data.ecosystem, data.name, data.version, data.vendor);
  },

  // パッケージ削除
  delete(db: D1Database, id: string): D1PreparedStatement {
    return db.prepare('DELETE FROM asset_template_packages WHERE id = ?').bind(id);
  },

  // テンプレートの全パッケージ削除
  deleteByTemplate(db: D1Database, templateId: string): D1PreparedStatement {
    return db.prepare('DELETE FROM asset_template_packages WHERE template_id = ?').bind(templateId);
  },
};

export const assetTemplateEolLinkRepo = {
  // テンプレートのEOLリンク一覧
  listByTemplate(db: D1Database, templateId: string): D1PreparedStatement {
    return db
      .prepare('SELECT * FROM asset_template_eol_links WHERE template_id = ?')
      .bind(templateId);
  },

  // EOLリンク作成
  create(db: D1Database, data: Omit<DbAssetTemplateEolLink, 'created_at'>): D1PreparedStatement {
    return db
      .prepare(
        `INSERT INTO asset_template_eol_links (id, template_id, eol_cycle_id)
         VALUES (?, ?, ?)`
      )
      .bind(data.id, data.template_id, data.eol_cycle_id);
  },

  // EOLリンク削除
  delete(db: D1Database, id: string): D1PreparedStatement {
    return db.prepare('DELETE FROM asset_template_eol_links WHERE id = ?').bind(id);
  },

  // テンプレートの全EOLリンク削除
  deleteByTemplate(db: D1Database, templateId: string): D1PreparedStatement {
    return db.prepare('DELETE FROM asset_template_eol_links WHERE template_id = ?').bind(templateId);
  },
};
