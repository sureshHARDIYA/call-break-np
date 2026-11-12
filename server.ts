import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { RoomSettingsSchema } from './src/engine/protocol.ts';
import { createRateLimiter } from './server/rateLimit.ts';
import { roomManager } from './server/roomManager.ts';
import {
  clientAddress,
  createConnectionLimiter,
  createMessageBudget,
  isSameOriginHandshake,
} from './server/wsGuards.ts';

const JSON_BODY_LIMIT = '10kb';
const WS_MAX_PAYLOAD_BYTES = 16 * 1024;
const ROOM_CREATE_WINDOW_MS = 60_000;
const ROOM_CREATE_MAX_PER_WINDOW = 10;
const ROOM_LOOKUP_WINDOW_MS = 60_000;
const ROOM_LOOKUP_MAX_PER_WINDOW = 60;
const WS_MAX_CONNECTIONS_PER_ADDRESS = 30;
const WS_MAX_MESSAGES_PER_SECOND = 40;
const WS_CLOSE_TRY_AGAIN_LATER = 1013;
const WS_CLOSE_POLICY_VIOLATION = 1008;

const CreateRoomBodySchema = z.object({
  displayName: z.string().trim().min(1).max(24),
  roomName: z.string().trim().max(36).optional(),
  settings: RoomSettingsSchema.partial().optional(),
  fillBots: z.boolean().optional(),
});

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  // One reverse proxy (Caddy) sits in front in production; use its X-Forwarded-For for req.ip.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const roomCreateLimiter = createRateLimiter({
    windowMs: ROOM_CREATE_WINDOW_MS,
    max: ROOM_CREATE_MAX_PER_WINDOW,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'call-break-server', timestamp: Date.now() });
  });

  app.post('/api/rooms', roomCreateLimiter, (req, res) => {
    const parsed = CreateRoomBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid room creation parameters',
      });
      return;
    }

    const result = roomManager.createRoom(parsed.data);
    res.status(201).json(result);
  });

  // Slows down guessing of room codes.
  const roomLookupLimiter = createRateLimiter({
    windowMs: ROOM_LOOKUP_WINDOW_MS,
    max: ROOM_LOOKUP_MAX_PER_WINDOW,
  });

  app.get('/api/rooms/:code', roomLookupLimiter, (req, res) => {
    const summary = roomManager.getPublicRoomSummary(req.params.code);
    if (!summary) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(summary);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: WS_MAX_PAYLOAD_BYTES,
    verifyClient: (info: { origin: string; req: http.IncomingMessage }) =>
      isSameOriginHandshake(info.origin, info.req.headers.host),
  });
  const connectionLimiter = createConnectionLimiter(WS_MAX_CONNECTIONS_PER_ADDRESS);

  wss.on('connection', (ws, req) => {
    const address = clientAddress(req);
    if (!connectionLimiter.tryAcquire(address)) {
      ws.close(WS_CLOSE_TRY_AGAIN_LATER, 'Too many connections');
      return;
    }
    const hasMessageBudget = createMessageBudget(WS_MAX_MESSAGES_PER_SECOND);
    (ws as unknown as { isAlive: boolean }).isAlive = true;

    ws.on('pong', () => {
      (ws as unknown as { isAlive: boolean }).isAlive = true;
    });

    ws.on('message', (data) => {
      if (!hasMessageBudget()) {
        // A real player never sends this fast; drop the flooding connection.
        ws.close(WS_CLOSE_POLICY_VIOLATION, 'Message rate exceeded');
        return;
      }
      (ws as unknown as { isAlive: boolean }).isAlive = true;
      roomManager.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      connectionLimiter.release(address);
      roomManager.handleDisconnect(ws);
    });

    ws.on('error', () => {
      roomManager.handleDisconnect(ws);
    });
  });

  // Server-level WebSocket heartbeat monitor
  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      const tracked = client as unknown as { isAlive: boolean };
      if (!tracked.isAlive) {
        client.terminate();
        continue;
      }
      tracked.isAlive = false;
      client.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    app.use(
      '/cards',
      express.static(path.resolve(process.cwd(), 'public', 'cards'))
    );
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Call Break server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Call Break server:', err);
  process.exit(1);
});
