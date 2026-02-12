
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());

// --- JSON File Persistence ---
const DB_PATH = path.join(__dirname, 'data', 'db.json');

function loadDb() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return new Map(Object.entries(data));
        }
    } catch (e) {
        console.error("Failed to load DB:", e);
    }
    return new Map();
}

function saveDb(db) {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const obj = Object.fromEntries(db);
        fs.writeFileSync(DB_PATH, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error("Failed to save DB:", e);
    }
}

const db = loadDb();

// Debounced save to avoid excessive writes
let saveTimeout = null;
function debouncedSaveDb() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveDb(db), 3000);
}

// Save on shutdown
process.on('SIGTERM', () => { saveDb(db); process.exit(0); });
process.on('SIGINT', () => { saveDb(db); process.exit(0); });

// --- Serve Frontend ---
// In production, serve built assets from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    app.use(express.static(__dirname));
}

// --- Config ---
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now(), users: db.size });
});

// --- Middleware to validate request ---
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    
    try {
        const userReq = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!userReq.ok) throw new Error('Invalid token');
        
        const user = await userReq.json();
        req.discordUser = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// --- Routes ---

// 1. Token Exchange
app.post('/api/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Token exchange failed:", data);
        return res.status(500).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Get User State
app.get('/api/state', requireAuth, (req, res) => {
    const userId = req.discordUser.id;
    const data = db.get(userId);
    res.json(data || null);
});

// 3. Save User State
app.post('/api/state', requireAuth, (req, res) => {
    const userId = req.discordUser.id;
    const state = req.body;
    
    if (state.id !== userId) {
        return res.status(400).json({ error: 'User ID mismatch' });
    }

    db.set(userId, state);
    debouncedSaveDb();
    res.json({ success: true });
});

// 4. Get Neighbors (filter self before shuffle)
app.get('/api/neighbors', requireAuth, (req, res) => {
    const keys = Array.from(db.keys()).filter(k => k !== req.discordUser.id);
    
    // Shuffle and pick up to 5
    const shuffled = keys.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    const neighbors = [];
    for (const k of shuffled) {
        const u = db.get(k);
        if (u) {
            neighbors.push({
                id: u.id,
                username: u.username,
                level: u.level,
                discordId: u.id,
                avatarUrl: null
            });
        }
    }
    
    res.json(neighbors);
});

// Catch-all for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({error: 'Not found'});
    const indexPath = fs.existsSync(distPath) 
        ? path.join(distPath, 'index.html')
        : path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
