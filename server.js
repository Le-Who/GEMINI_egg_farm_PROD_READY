
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(__dirname)); // Serve the static frontend files

// --- In-Memory Database (Replace with Firestore/Postgres for true Production) ---
const db = new Map(); 

// --- Config ---
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// --- Middleware to validate request ---
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    // In a real high-security app, you would validate this token against Discord API 
    // or verify a JWT signature if you issued your own.
    // For this activity, we trust the token passed if it maps to a user we know, 
    // or we fetch the user from Discord to verify identity.
    
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
    res.json(data || null); // Return null if new user
});

// 3. Save User State
app.post('/api/state', requireAuth, (req, res) => {
    const userId = req.discordUser.id;
    const state = req.body;
    
    // Basic server-side validation could go here
    if (state.id !== userId) {
        return res.status(400).json({ error: 'User ID mismatch' });
    }

    db.set(userId, state);
    res.json({ success: true });
});

// 4. Get Neighbors (Simple dump of other users in DB)
app.get('/api/neighbors', requireAuth, (req, res) => {
    // In prod, filter by Guild/Channel or Friend list
    // Here we just return 5 random users for the demo
    const neighbors = [];
    const keys = Array.from(db.keys());
    
    // Shuffle and pick 5
    const shuffled = keys.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    for(const k of shuffled) {
        if (k === req.discordUser.id) continue;
        const u = db.get(k);
        if (u) {
            neighbors.push({
                id: u.id,
                username: u.username,
                level: u.level,
                discordId: u.id,
                avatarUrl: null // Ideally store avatar URL in state
            });
        }
    }
    
    res.json(neighbors);
});

// Catch-all for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({error: 'Not found'});
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
