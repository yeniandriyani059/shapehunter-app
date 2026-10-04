import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { GoogleGenAI } from '@google/genai';
import {
  ensureDefaultSession,
  getSessionByCode,
  getFullSessionState,
  createNewSession,
  updateSessionSettings,
  updateGroupArenaAssignment,
  updateGroupName,
  resetSessionData,
  createDiscovery,
  updateDiscoveryRealShape,
  submitShapeAttempt,
  proveDiscoveryTraits,
  ShapeType,
} from './src/db/gameRepository.ts';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.get('/RifficFree-Bold.ttf', (_req, res) => {
    res.setHeader('Content-Type', 'font/ttf');
    res.sendFile(path.join(process.cwd(), 'src/RifficFree-Bold.ttf'));
  });

  // WebSocket Server for Real-Time Synchronization across Student HP, PID, and Teacher Dashboard
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcastEvent = (type: string, payload: unknown) => {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  wss.on('connection', async (ws) => {
    try {
      const state = await ensureDefaultSession();
      if (state && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'session:init',
            payload: state,
            timestamp: Date.now(),
          })
        );
      }
    } catch (err) {
      console.error('WebSocket initial state error:', err);
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore malformed ws messages
      }
    });
  });

  // 1. Authenticated Teacher Profile Sync (Firebase Auth -> Cloud SQL users table)
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@teacher.shapehunter.id`;
      const name = req.user!.name || email.split('@')[0];
      const userRecord = await getOrCreateUser(uid, email, name);
      res.json({ user: userRecord });
    } catch (error: any) {
      console.error('Failed to sync teacher user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // 2. Get Active Default Session
  app.get('/api/sessions/current', async (_req, res) => {
    try {
      const state = await ensureDefaultSession();
      res.json(state);
    } catch (error: any) {
      console.error('Failed to get current session:', error);
      res.status(500).json({ error: error.message || 'Failed to load session' });
    }
  });

  // 3. Get Session by Code
  app.get('/api/sessions/code/:code', async (req, res) => {
    try {
      const state = await getSessionByCode(req.params.code);
      if (!state) {
        return res.status(404).json({ error: 'Kode permainan tidak ditemukan.' });
      }
      res.json(state);
    } catch (error: any) {
      console.error('Failed to get session by code:', error);
      res.status(500).json({ error: error.message || 'Failed to find session' });
    }
  });

  // 4. Create New Game Session (Teacher Dashboard)
  app.post('/api/sessions', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        title,
        timerDurationSeconds,
        currentLevel,
        missionTitle,
        missionTargetShape,
        missionTargetCount,
        groupsConfig,
      } = req.body;

      if (req.user?.uid && req.user?.email) {
        await getOrCreateUser(req.user.uid, req.user.email, req.user.name);
      }

      const state = await createNewSession({
        title,
        teacherUid: req.user?.uid,
        timerDurationSeconds,
        currentLevel,
        missionTitle,
        missionTargetShape,
        missionTargetCount,
        groupsConfig:
          Array.isArray(groupsConfig) && groupsConfig.length >= 2
            ? groupsConfig
            : [
                { name: 'Kelompok 1 · Harimau Biru', color: 'blue', mascot: 'kapten_geo', arenaSlot: 1 },
                { name: 'Kelompok 2 · Elang Hijau', color: 'emerald', mascot: 'putri_prisma', arenaSlot: 2 },
              ],
      });

      broadcastEvent('session:updated', state);
      res.json(state);
    } catch (error: any) {
      console.error('Failed to create session:', error);
      res.status(500).json({ error: error.message || 'Failed to create session' });
    }
  });

  // 5. Update Session Settings (Play/Pause/Level/Timer/Mission)
  app.patch('/api/sessions/:id/settings', optionalAuth, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const state = await updateSessionSettings(sessionId, req.body);
      broadcastEvent('session:updated', state);
      res.json(state);
    } catch (error: any) {
      console.error('Failed to update session settings:', error);
      res.status(500).json({ error: error.message || 'Failed to update session' });
    }
  });

  // 6. Update Active Left/Right Arena Groups for PID Split-Screen
  app.patch('/api/sessions/:id/arenas', optionalAuth, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const { leftGroupId, rightGroupId } = req.body;
      const state = await updateGroupArenaAssignment(
        sessionId,
        Number(leftGroupId),
        Number(rightGroupId)
      );
      broadcastEvent('session:updated', state);
      res.json(state);
    } catch (error: any) {
      console.error('Failed to update arena assignment:', error);
      res.status(500).json({ error: error.message || 'Failed to update arenas' });
    }
  });

  // 6.5 Update Group Name
  app.patch('/api/groups/:id', optionalAuth, async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const { name } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Nama kelompok tidak boleh kosong.' });
      }

      const result = await updateGroupName(groupId, name.trim());
      if (!result) {
        return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      }

      // Broadcast WebSocket events to all connected clients
      broadcastEvent('group:updated', {
        group: result.updatedGroup,
        state: result.fullState,
      });
      broadcastEvent('session:updated', result.fullState);

      res.json({
        group: result.updatedGroup,
        state: result.fullState,
      });
    } catch (error: any) {
      console.error('Failed to update group name:', error);
      res.status(500).json({ error: error.message || 'Gagal mengubah nama kelompok.' });
    }
  });

  // 7. Reset Session Data
  app.post('/api/sessions/:id/reset', optionalAuth, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const state = await resetSessionData(sessionId);
      broadcastEvent('session:updated', state);
      res.json(state);
    } catch (error: any) {
      console.error('Failed to reset session:', error);
      res.status(500).json({ error: error.message || 'Failed to reset session' });
    }
  });

  // AI Detection for Geometric Shape using Gemini API (@google/genai)
  async function detectGeometricShapeWithGemini(
    photoUrl: string,
    objectName: string,
    fallbackShape: ShapeType
  ): Promise<ShapeType> {
    try {
      const ai = new GoogleGenAI();
      let imagePart: any = null;

      if (photoUrl.startsWith('data:')) {
        const match = photoUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
        if (match) {
          imagePart = {
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          };
        }
      } else if (photoUrl.startsWith('http')) {
        try {
          const res = await fetch(photoUrl);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = res.headers.get('content-type') || 'image/jpeg';
          imagePart = {
            inlineData: {
              mimeType,
              data: buffer.toString('base64'),
            },
          };
        } catch (fetchErr) {
          console.warn('Could not fetch photoUrl for Gemini analysis:', fetchErr);
        }
      }

      const prompt = `You are an expert primary school geometry shape classifier.
Analyze the main object shown in this photo (Object name: "${objectName}").
Classify its predominant 2D geometric outline into EXACTLY ONE of these 4 basic shapes:
- 'lingkaran' (circle: round outline, e.g. wall clock, bicycle wheel, coin, circular plate, circular fan)
- 'segitiga' (triangle: 3 straight sides, 3 corners, e.g. triangular roof, warning sign, triangular ruler, slice of pizza)
- 'persegi' (square: 4 EQUAL straight sides, 4 corners, e.g. square floor tile, square window pane, square sticky note)
- 'persegi_panjang' (rectangle: 4 straight sides where opposite sides are equal, length != width, e.g. classroom door, blackboard, textbook, smartphone, desk)

Respond strictly with valid JSON:
{"shape": "lingkaran" | "segitiga" | "persegi" | "persegi_panjang", "confidence": number, "reason": "short explanation"}
`;

      const contents: any[] = [prompt];
      if (imagePart) {
        contents.push(imagePart);
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const detected = parsed.shape?.toLowerCase().trim() as ShapeType;
      if (
        detected === 'lingkaran' ||
        detected === 'segitiga' ||
        detected === 'persegi' ||
        detected === 'persegi_panjang'
      ) {
        console.log(`[Gemini AI] Detected shape for "${objectName}":`, detected);
        return detected;
      }
    } catch (error) {
      console.warn('[Gemini AI] Shape detection fallback:', error);
    }

    return fallbackShape;
  }

  // 8. Upload New Discovery from Student HP (with Gemini AI Detection for realShape)
  app.post('/api/discoveries', async (req, res) => {
    try {
      const {
        sessionId,
        groupId,
        studentName,
        objectName,
        photoUrl,
        expectedShape,
        studentClaimedShape,
      } = req.body;

      if (!sessionId || !groupId || !objectName || !photoUrl) {
        return res.status(400).json({ error: 'Data foto temuan belum lengkap.' });
      }

      const claimedShape = (studentClaimedShape || expectedShape || 'lingkaran') as ShapeType;

      // Detect real geometric shape using Gemini AI
      const realShape = await detectGeometricShapeWithGemini(
        photoUrl,
        objectName,
        claimedShape
      );

      const discovery = await createDiscovery({
        sessionId: Number(sessionId),
        groupId: Number(groupId),
        studentName: String(studentName || 'Tim Eksplorasi'),
        objectName: String(objectName),
        photoUrl: String(photoUrl),
        expectedShape: realShape,
        realShape,
        studentClaimedShape: claimedShape,
      });

      const fullState = await getFullSessionState(Number(sessionId));
      broadcastEvent('discovery:created', {
        discovery,
        state: fullState,
      });
      broadcastEvent('session:updated', fullState);

      res.json({ discovery, state: fullState });
    } catch (error: any) {
      console.error('Failed to create discovery:', error);
      res.status(500).json({ error: error.message || 'Gagal menyimpan foto temuan.' });
    }
  });

  // 8.5 Teacher Manual Correction for realShape (Ruang Guru Dashboard)
  app.patch('/api/discoveries/:id/shape', optionalAuth, async (req, res) => {
    try {
      const discoveryId = Number(req.params.id);
      const { realShape } = req.body;

      if (
        !realShape ||
        !['lingkaran', 'segitiga', 'persegi', 'persegi_panjang'].includes(realShape)
      ) {
        return res.status(400).json({ error: 'Pilihan bentuk tidak valid.' });
      }

      const result = await updateDiscoveryRealShape(discoveryId, realShape as ShapeType);

      broadcastEvent('discovery:updated', {
        discovery: result.updatedDiscovery,
        state: result.fullState,
      });
      broadcastEvent('session:updated', result.fullState);

      res.json(result);
    } catch (error: any) {
      console.error('Failed to update discovery shape:', error);
      res.status(500).json({ error: error.message || 'Gagal mengubah bentuk benda.' });
    }
  });

  // 9. Submit Shape Attempt ("CHECK" Button on PID Arena)
  app.post('/api/attempts', async (req, res) => {
    try {
      const {
        sessionId,
        groupId,
        discoveryId,
        selectedShape,
        levelAtAttempt,
        annotationsJson,
        traitsVerified,
        reasonText,
      } = req.body;

      const result = await submitShapeAttempt({
        sessionId: Number(sessionId),
        groupId: Number(groupId),
        discoveryId: Number(discoveryId),
        selectedShape,
        levelAtAttempt: Number(levelAtAttempt || 1),
        annotationsJson,
        traitsVerified,
        reasonText,
      });

      const fullState = await getFullSessionState(Number(sessionId));
      broadcastEvent('attempt:submitted', {
        result,
        groupId: Number(groupId),
        discoveryId: Number(discoveryId),
        state: fullState,
      });

      res.json({ result, state: fullState });
    } catch (error: any) {
      console.error('Failed to submit shape attempt:', error);
      res.status(500).json({ error: error.message || 'Gagal memeriksa jawaban.' });
    }
  });

  // 10. Submit Shape Proving in Mission 2 ("Buktikan!")
  app.post('/api/attempts/prove', async (req, res) => {
    try {
      const { sessionId, groupId, discoveryId, sides, corners } = req.body;

      if (!sessionId || !groupId || !discoveryId) {
        return res.status(400).json({ error: 'Data pembuktian tidak lengkap.' });
      }

      const result = await proveDiscoveryTraits({
        sessionId: Number(sessionId),
        groupId: Number(groupId),
        discoveryId: Number(discoveryId),
        sides: Number(sides),
        corners: Number(corners),
      });

      const fullState = await getFullSessionState(Number(sessionId));
      broadcastEvent('attempt:submitted', {
        result,
        groupId: Number(groupId),
        discoveryId: Number(discoveryId),
        state: fullState,
      });
      broadcastEvent('session:updated', fullState);

      res.json({ result, state: fullState });
    } catch (error: any) {
      console.error('Failed to prove discovery traits:', error);
      res.status(500).json({ error: error.message || 'Gagal memeriksa pembuktian ciri bentuk.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Shape Hunter server running on http://localhost:${PORT}`);
  });
}

startServer();
