/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module F — Accounting Auditability
 * In-Memory Domain Audit Events for Financial Traceability (OD-708)
 */

export type AccountingAuditEventType =
  | 'ENTRY_CREATED'
  | 'ENTRY_VALIDATED'
  | 'ENTRY_POSTED'
  | 'ENTRY_REVERSED'
  | 'TRANSITION_REJECTED';

/**
 * Recursively deep-freezes objects and arrays to guarantee forensic immutability (OD-708).
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = (obj as any)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export class AccountingAuditEvent {
  public readonly eventId: string;
  public readonly eventType: AccountingAuditEventType;
  public readonly institutionId: string;
  public readonly entryId: string;
  private readonly _timestamp: Date;
  public readonly actorId: string;
  public readonly details: Record<string, any>;

  constructor(props: {
    eventId: string;
    eventType: AccountingAuditEventType;
    institutionId: string;
    entryId: string;
    timestamp: Date;
    actorId: string;
    details: Record<string, any>;
  }) {
    this.eventId = props.eventId;
    this.eventType = props.eventType;
    this.institutionId = props.institutionId;
    this.entryId = props.entryId;
    this._timestamp = new Date(props.timestamp.getTime());
    this.actorId = props.actorId;
    this.details = deepFreeze(props.details);
    Object.freeze(this);
  }

  /**
   * Returns a defensive copy of the event timestamp to prevent Date setter mutation.
   */
  public get timestamp(): Date {
    return new Date(this._timestamp.getTime());
  }
}

export class AuditEventCollector {
  private readonly events: AccountingAuditEvent[] = [];

  public record(
    eventType: AccountingAuditEventType,
    institutionId: string,
    entryId: string,
    actorId: string,
    details: Record<string, any> = {}
  ): AccountingAuditEvent {
    // Sanitize details: strictly strip credentials, tokens, passwords
    const sanitizedDetails: Record<string, any> = {};
    for (const [key, value] of Object.entries(details)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('token') ||
        lower.includes('credential') ||
        lower.includes('key')
      ) {
        continue;
      }
      sanitizedDetails[key] = value;
    }

    const event = new AccountingAuditEvent({
      eventId: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      institutionId,
      entryId,
      timestamp: new Date(),
      actorId,
      details: sanitizedDetails
    });

    this.events.push(event);
    return event;
  }

  public getEvents(): readonly AccountingAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  public getEventsForEntry(entryId: string): readonly AccountingAuditEvent[] {
    return Object.freeze(this.events.filter(e => e.entryId === entryId));
  }

  public getReversalEvent(entryId: string): AccountingAuditEvent | undefined {
    return this.events.find(e => e.entryId === entryId && e.eventType === 'ENTRY_REVERSED');
  }

  public isEntryReversed(entryId: string): boolean {
    return this.events.some(e => e.entryId === entryId && e.eventType === 'ENTRY_REVERSED');
  }
}

