import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { RoomSettingsSchema } from './src/engine/protocol.ts';
import { roomManager } from './server/roomManager.ts';

const CreateRoomBodySchema = z.object({
  displayName: z.string().trim().min(1).max(24),
  roomName: z.string().trim().max(36).optional(),
  settings: RoomSettingsSchema.partial().optional(),
  fillBots: z.boolean().optional(),
});

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'call-break-server', timestamp: Date.now() });
  });

  app.post('/api/rooms', (req, res) => {
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

  app.get('/api/rooms/:code', (req, res) => {
    const summary = roomManager.getPublicRoomSummary(req.params.code);
    if (!summary) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(summary);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    (ws as unknown as { isAlive: boolean }).isAlive = true;

    ws.on('pong', () => {
      (ws as unknown as { isAlive: boolean }).isAlive = true;
    });

    ws.on('message', (data) => {
      (ws as unknown as { isAlive: boolean }).isAlive = true;
      roomManager.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
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
