import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RoomState, SeatIndex } from '../src/engine/types.ts';

export interface StoredRoomRecord {
  room: RoomState;
  seatSessions: Record<SeatIndex, string | null>;
}

class SqliteRoomStore {
  private db: DatabaseSync;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'callbreak.db');
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS rooms (
        room_code TEXT PRIMARY KEY,
        snapshot_json TEXT NOT NULL,
        sessions_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT NOT NULL,
        version INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_room_events_code_ver
        ON room_events (room_code, version);
      CREATE TABLE IF NOT EXISTS processed_actions (
        room_code TEXT NOT NULL,
        action_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (room_code, action_id)
      );
    `);
  }

  saveRoom(record: StoredRoomRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (room_code, snapshot_json, sessions_json, version, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(room_code) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        sessions_json = excluded.sessions_json,
        version = excluded.version,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.room.roomCode,
      JSON.stringify(record.room),
      JSON.stringify(record.seatSessions),
      record.room.version,
      record.room.updatedAt
    );
  }

  loadRoom(roomCode: string): StoredRoomRecord | null {
    const stmt = this.db.prepare(
      'SELECT snapshot_json, sessions_json FROM rooms WHERE room_code = ?'
    );
    const row = stmt.get(roomCode) as
      | { snapshot_json: string; sessions_json: string }
      | undefined;
    if (!row) return null;
    try {
      return {
        room: JSON.parse(row.snapshot_json) as RoomState,
        seatSessions: JSON.parse(row.sessions_json) as Record<SeatIndex, string | null>,
      };
    } catch {
      return null;
    }
  }

  loadAllRooms(): StoredRoomRecord[] {
    const stmt = this.db.prepare(
      'SELECT snapshot_json, sessions_json FROM rooms ORDER BY updated_at DESC LIMIT 200'
    );
    const rows = stmt.all() as Array<{
      snapshot_json: string;
      sessions_json: string;
    }>;
    const records: StoredRoomRecord[] = [];
    for (const row of rows) {
      try {
        records.push({
          room: JSON.parse(row.snapshot_json) as RoomState,
          seatSessions: JSON.parse(row.sessions_json) as Record<SeatIndex, string | null>,
        });
      } catch {
        // Skip corrupted snapshots
      }
    }
    return records;
  }

  appendEvent(roomCode: string, version: number, eventType: string, payload: unknown): void {
    const stmt = this.db.prepare(`
      INSERT INTO room_events (room_code, version, event_type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(roomCode, version, eventType, JSON.stringify(payload), Date.now());
  }

  hasProcessedAction(roomCode: string, actionId: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM processed_actions WHERE room_code = ? AND action_id = ?'
    );
    return Boolean(stmt.get(roomCode, actionId));
  }

  markActionProcessed(roomCode: string, actionId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO processed_actions (room_code, action_id, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(roomCode, actionId, Date.now());
  }
}

export const roomStore = new SqliteRoomStore();
