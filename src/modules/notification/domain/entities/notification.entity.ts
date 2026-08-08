export enum NotificationType {
  SYSTEM = 'SYSTEM',
  APPLICATION = 'APPLICATION',
  PAYMENT = 'PAYMENT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SCHOOL = 'SCHOOL',
  SECURITY = 'SECURITY',
}

export class Notification {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _type: NotificationType,
    private _title: string,
    private _message: string,
    private _readAt: Date | null,
    private readonly _metadata: Record<string, unknown> | null,
    private readonly _createdAt: Date,
  ) {}

  static create(params: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  }): Notification {
    return new Notification(
      params.id,
      params.userId,
      params.type,
      params.title,
      params.message,
      null,
      params.metadata ?? null,
      new Date(),
    );
  }

  static rehydrate(params: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    readAt: Date | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }): Notification {
    return new Notification(
      params.id,
      params.userId,
      params.type,
      params.title,
      params.message,
      params.readAt,
      params.metadata,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get readAt(): Date | null {
    return this._readAt;
  }

  markAsRead(at = new Date()): void {
    if (!this._readAt) this._readAt = at;
  }

  isRead(): boolean {
    return this._readAt !== null;
  }
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  listByUserId(userId: string): Promise<Notification[]>;
  markAllAsRead(userId: string): Promise<void>;
}
