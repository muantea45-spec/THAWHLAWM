import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import memberRoutes from './routes/members.js';
import titheRoutes from './routes/tithes.js';
import columnRoutes from './routes/columns.js';
import backupRoutes, { generateBackupSnapshot } from './routes/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema and seed initial Admin/Bials
initDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/tithes', titheRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/backup', backupRoutes);

// Scheduled Automated Backup (Runs every day at Midnight 00:00)
cron.schedule('0 0 * * *', () => {
  try {
    const snapshot = generateBackupSnapshot();
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const fileName = `auto_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = path.join(backupsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[Automated Cron Backup] Snapshot created: ${fileName}`);
  } catch (err) {
    console.error('[Automated Cron Backup Error]:', err);
  }
});

// Serve frontend dist assets if available
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  Pathian Ram Tithe Collection Server Running`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[Server] Port ${PORT} already active. Connecting to existing instance.`);
  } else {
    console.error('[Server Error]:', err);
  }
});
