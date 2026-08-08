export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');

export type AuditLogEntry = {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
}
