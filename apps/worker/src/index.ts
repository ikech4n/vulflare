import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types.ts';
import { authRoutes } from './routes/auth.ts';
import { vulnerabilityRoutes } from './routes/vulnerabilities.ts';
import { jvnRoutes } from './routes/jvn.ts';
import { userRoutes } from './routes/users.ts';
import { syncRoutes } from './routes/sync.ts';
import { notificationRoutes } from './routes/notifications.ts';
import { reportRoutes } from './routes/reports.ts';
import { dashboardRoutes } from './routes/dashboard.ts';
import { eolRoutes } from './routes/eol.ts';
import { appSettingsRoutes } from './routes/app-settings.ts';
import { handleJvnSync } from './scheduled/jvn-sync.ts';
import { handleEolSync } from './scheduled/eol-sync.ts';
import { csrfProtection } from './middleware/csrf.ts';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', logger());
app.use('/api/*', cors({
  origin: (origin, c) => {
    const pagesUrl = c.env.PAGES_URL;
    const allowed = [pagesUrl, 'http://localhost:5173', 'http://localhost:4173'];
    // Also allow *.pages.dev subdomains for preview deployments
    if (allowed.includes(origin)) return origin;
    if (origin?.endsWith('.vulflare.pages.dev')) return origin;
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use('/api/*', csrfProtection);

app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

app.route('/api/auth', authRoutes);
app.route('/api/vulnerabilities', vulnerabilityRoutes);
app.route('/api/jvn', jvnRoutes);
app.route('/api/users', userRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/eol', eolRoutes);
app.route('/api/app-settings', appSettingsRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // JVN同期処理: 毎時実行（増分同期）
    ctx.waitUntil(handleJvnSync(env));
    // EOL同期処理: 毎日 01:00 JST (16:00 UTC) のみ実行
    const scheduledHour = new Date(event.scheduledTime).getUTCHours();
    if (scheduledHour === 16) {
      ctx.waitUntil(handleEolSync(env));
    }
  },
};
