// Minimal relay server for Hotel Tycoon co-op.  Run: npm install && npm start
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: process.env.PORT || 8080, maxPayload: 16 * 1024 });
const rooms = new Map();
const KEYS = ['host', 'n', 's', 'x', 'z', 'c'];   // only these presence fields are relayed
let nextId = 1;

wss.on('connection', (ws) => {
  ws.id = 'p' + nextId++;
  ws.room = null;
  ws.state = {};
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !ws.room && /^[a-z0-9_-]{1,32}$/.test(m.room || '')) {
      const r = rooms.get(m.room) || new Set();
      if (r.size >= 8) { ws.close(); return; }          // max 8 players per room
      rooms.set(m.room, r); r.add(ws); ws.room = m.room;
      ws.send(JSON.stringify({ t: 'hello', id: ws.id }));
      for (const o of r) if (o !== ws) ws.send(JSON.stringify({ t: 'pres', id: o.id, d: o.state }));
    } else if (m.t === 'pres' && ws.room && m.d && typeof m.d === 'object') {
      const d = {}; for (const k of KEYS) if (k in m.d) d[k] = m.d[k];
      Object.assign(ws.state, d);
      const out = JSON.stringify({ t: 'pres', id: ws.id, d });
      for (const o of rooms.get(ws.room)) if (o !== ws && o.readyState === 1) o.send(out);
    }
  });
  ws.on('close', () => {
    if (!ws.room) return;
    const r = rooms.get(ws.room); r.delete(ws);
    const out = JSON.stringify({ t: 'left', id: ws.id });
    for (const o of r) if (o.readyState === 1) o.send(out);
    if (!r.size) rooms.delete(ws.room);
  });
});
console.log('relay listening on', process.env.PORT || 8080);
