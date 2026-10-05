import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import {
  getDefaultGameState,
  addDiscoveryToState,
  addDiscoveryToStateAsync,
  evaluateShapeAttempt,
  proveDiscoveryTraitsInState,
  updateMissionLevel,
  resetGameSession,
  mergeSupabaseDiscoveriesToState,
} from './src/utils/gameStore.ts';
import { fetchKartuTemuanFromSupabase } from './src/supabaseClient.ts';
import { FullSessionState, ShapeType } from './src/types/game.ts';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.get('/RifficFree-Bold.ttf', (_req, res) => {
    res.setHeader('Content-Type', 'font/ttf');
    res.sendFile(path.join(process.cwd(), 'src/RifficFree-Bold.ttf'));
  });

  // Server session state synced dynamically with Supabase public.kartu_temuan
  let serverGameState: FullSessionState = getDefaultGameState();

  const syncServerWithSupabase = async () => {
    try {
      const cards = await fetchKartuTemuanFromSupabase();
      if (Array.isArray(cards) && cards.length > 0) {
        serverGameState = mergeSupabaseDiscoveriesToState(serverGameState, cards);
      }
    } catch (err) {
      console.warn('[Server] Supabase sync notice:', err);
    }
  };

  // Initial sync and periodic 3s background sync
  syncServerWithSupabase();
  setInterval(syncServerWithSupabase, 3000);

  // WebSocket Server for Real-Time synchronization across local tabs/devices
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcastEvent = (type: string, payload: unknown) => {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  wss.on('connection', (ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'session:init',
          payload: serverGameState,
          timestamp: Date.now(),
        })
      );
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed ws messages
      }
    });
  });

  // 1. Get Current Session State
  app.get('/api/sessions/current', (_req, res) => {
    res.json(serverGameState);
  });

  // 2. Upload New Discovery from Student (In-Memory State + Supabase Bucket & Table Sync)
  app.post('/api/discoveries', async (req, res) => {
    try {
      const {
        groupId,
        studentName,
        objectName,
        photoUrl,
        expectedShape,
        studentClaimedShape,
        realShape,
      } = req.body;

      if (!groupId || !photoUrl) {
        return res.status(400).json({ error: 'Data foto temuan belum lengkap.' });
      }

      const assignedShape: ShapeType = realShape || expectedShape || 'lingkaran';

      const { newState, newDiscovery } = await addDiscoveryToStateAsync(serverGameState, {
        groupId: Number(groupId),
        studentName: String(studentName || 'Petualang Cilik'),
        objectName: String(objectName || 'Benda Temuan'),
        photoUrl: String(photoUrl),
        expectedShape: assignedShape,
        realShape: assignedShape,
        studentClaimedShape: studentClaimedShape || assignedShape,
      });

      serverGameState = newState;

      broadcastEvent('discovery:created', {
        discovery: newDiscovery,
        state: serverGameState,
      });
      broadcastEvent('session:updated', serverGameState);

      res.json({ discovery: newDiscovery, state: serverGameState });
    } catch (error: any) {
      console.error('Failed to create discovery:', error);
      res.status(500).json({ error: error.message || 'Gagal menyimpan foto temuan.' });
    }
  });

  // 3. Submit Shape Placement Attempt (Drag & Drop evaluation)
  app.post('/api/attempts', (req, res) => {
    try {
      const { groupId, discoveryId, selectedShape } = req.body;
      if (!groupId || !discoveryId || !selectedShape) {
        return res.status(400).json({ error: 'Parameter jawaban belum lengkap.' });
      }

      const evalResult = evaluateShapeAttempt(serverGameState, {
        groupId: Number(groupId),
        discoveryId: Number(discoveryId),
        selectedShape: selectedShape as ShapeType,
      });

      serverGameState = evalResult.newState;

      broadcastEvent('attempt:evaluated', {
        result: evalResult,
        state: serverGameState,
      });
      broadcastEvent('session:updated', serverGameState);

      res.json({
        result: evalResult,
        state: serverGameState,
      });
    } catch (error: any) {
      console.error('Failed to evaluate attempt:', error);
      res.status(500).json({ error: error.message || 'Gagal mengevaluasi jawaban.' });
    }
  });

  // 4. Prove Discovery Geometric Traits (Mission 2 Corners & Sides)
  app.post('/api/discoveries/:id/prove', (req, res) => {
    try {
      const discoveryId = Number(req.params.id);
      const { markers } = req.body;

      const newState = proveDiscoveryTraitsInState(serverGameState, {
        discoveryId,
        markers: Array.isArray(markers) ? markers : [],
      });

      serverGameState = newState;

      broadcastEvent('discovery:proven', {
        discoveryId,
        state: serverGameState,
      });
      broadcastEvent('session:updated', serverGameState);

      res.json({ state: serverGameState });
    } catch (error: any) {
      console.error('Failed to prove discovery traits:', error);
      res.status(500).json({ error: error.message || 'Gagal memverifikasi ciri bangun.' });
    }
  });

  // 5. Update Session Settings (Level switch M1 / M2 / M3)
  app.patch('/api/sessions/:id/settings', (req, res) => {
    try {
      const { currentLevel } = req.body;
      if (typeof currentLevel === 'number') {
        serverGameState = updateMissionLevel(serverGameState, currentLevel);
      }
      broadcastEvent('session:updated', serverGameState);
      res.json(serverGameState);
    } catch (error: any) {
      console.error('Failed to update session settings:', error);
      res.status(500).json({ error: error.message || 'Gagal memperbarui pengaturan sesi.' });
    }
  });

  // 6. Update Group Name
  app.patch('/api/groups/:id', (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const { name } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Nama kelompok tidak boleh kosong.' });
      }

      serverGameState = {
        ...serverGameState,
        groups: serverGameState.groups.map((g) =>
          g.id === groupId ? { ...g, name: name.trim() } : g
        ),
      };

      broadcastEvent('session:updated', serverGameState);
      res.json({ state: serverGameState });
    } catch (error: any) {
      console.error('Failed to update group name:', error);
      res.status(500).json({ error: error.message || 'Gagal mengubah nama kelompok.' });
    }
  });

  // 7. Reset Session Data
  app.post('/api/sessions/:id/reset', (_req, res) => {
    try {
      serverGameState = resetGameSession();
      broadcastEvent('session:updated', serverGameState);
      res.json(serverGameState);
    } catch (error: any) {
      console.error('Failed to reset session:', error);
      res.status(500).json({ error: error.message || 'Gagal mereset sesi.' });
    }
  });

  // Mount Vite development middleware or serve production dist
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, () => {
    console.log(`[Shape Hunter] Server running smoothly at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Shape Hunter] Fatal startup error:', err);
});
