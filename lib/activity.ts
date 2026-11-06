// Activity log (admin "who changed what"). Never throws — logging must not break the action being logged.
import { run } from './db';

export function logActivity(user: { id: number; email: string } | null, action: string, entity = '', entityId: string | number = '', summary = '') {
  try {
    run(
      'INSERT INTO activity (user_id, user_label, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?, ?)',
      user?.id ?? null,
      user?.email ?? '',
      action,
      entity,
      String(entityId),
      summary.slice(0, 300)
    );
  } catch {
    /* ignore */
  }
}
