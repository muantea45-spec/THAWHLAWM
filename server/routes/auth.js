import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ error: 'This account has been locked by Admin' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    let bialDetails = null;
    if (user.role === 'BIAL') {
      bialDetails = db.prepare('SELECT * FROM bials WHERE user_id = ?').get(user.id);
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      bial_name: user.bial_name,
      bial_id: bialDetails ? bialDetails.id : null,
      bial_code: bialDetails ? bialDetails.code : null
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: payload
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// POST /api/auth/google - Admin Google Sign-In
router.post('/google', async (req, res) => {
  const { credential, email, name, picture } = req.body;

  if (!credential && !email) {
    return res.status(400).json({ error: 'Google credential token or email is required' });
  }

  let verifiedEmail = null;
  let verifiedName = name || null;
  let verifiedPicture = picture || null;
  let googleSub = null;

  if (credential) {
    try {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!googleRes.ok) {
        return res.status(401).json({ error: 'Google verification failed: Invalid or expired ID token' });
      }
      const tokenInfo = await googleRes.json();
      if (!tokenInfo.email || (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true)) {
        return res.status(401).json({ error: 'Google account email is not verified' });
      }
      verifiedEmail = tokenInfo.email.toLowerCase();
      verifiedName = tokenInfo.name || verifiedName;
      verifiedPicture = tokenInfo.picture || verifiedPicture;
      googleSub = tokenInfo.sub;
    } catch (err) {
      console.error('Google tokeninfo fetch error:', err);
      return res.status(500).json({ error: 'Failed to communicate with Google authentication servers' });
    }
  } else if (email) {
    verifiedEmail = String(email).trim().toLowerCase();
  }

  if (!verifiedEmail) {
    return res.status(400).json({ error: 'Unable to extract email from Google profile' });
  }

  try {
    const adminUsers = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").all();
    const admins = adminUsers || [];

    let allowedEmails = [];
    try {
      const rows = db.prepare("SELECT email FROM admin_google_emails").all();
      allowedEmails = (rows || []).map(r => r.email.toLowerCase());
    } catch (e) {}

    let matchedAdmin = admins.find(a => a.email && a.email.toLowerCase() === verifiedEmail);

    if (!matchedAdmin && allowedEmails.includes(verifiedEmail)) {
      matchedAdmin = admins[0] || null;
    }

    const hasAnyLinkedEmail = admins.some(a => a.email && a.email.trim() !== '') || allowedEmails.length > 0;
    if (!matchedAdmin && !hasAnyLinkedEmail && admins.length > 0) {
      matchedAdmin = admins[0];
      try {
        db.prepare("UPDATE users SET email = ?, google_id = ? WHERE id = ?").run(verifiedEmail, googleSub, matchedAdmin.id);
        db.prepare("INSERT OR IGNORE INTO admin_google_emails (email) VALUES (?)").run(verifiedEmail);
      } catch (err) {
        console.error('Error linking initial admin email:', err);
      }
    }

    if (!matchedAdmin) {
      return res.status(403).json({
        error: `Access Denied: Google account (${verifiedEmail}) is not authorized as an Admin. Please ask the church administrator to add your Google email.`
      });
    }

    if (matchedAdmin.status === 'locked') {
      return res.status(403).json({ error: 'This Admin account has been locked.' });
    }

    const payload = {
      id: matchedAdmin.id,
      username: matchedAdmin.username || 'admin',
      role: 'ADMIN',
      email: verifiedEmail,
      name: verifiedName || 'Church Admin',
      picture: verifiedPicture || null
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Admin Google login successful',
      token,
      user: payload
    });
  } catch (err) {
    console.error('Google Admin auth error:', err);
    return res.status(500).json({ error: 'Server error processing Google authentication' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, role, bial_name, status FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let bialDetails = null;
    if (user.role === 'BIAL') {
      bialDetails = db.prepare('SELECT * FROM bials WHERE user_id = ?').get(user.id);
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bial_name: user.bial_name,
        bial_id: bialDetails ? bialDetails.id : null,
        bial_code: bialDetails ? bialDetails.code : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching session profile' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (currentPassword) {
      const match = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!match) return res.status(400).json({ error: 'Incorrect current password' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
