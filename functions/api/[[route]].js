import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const app = new Hono().basePath('/api');

// ----------------------------------------------------
// GLOBAL D1-BACKED ANTI-BRUTE-FORCE LOGIN RATE LIMITER
// ----------------------------------------------------
async function checkLoginRateLimit(db, ip) {
  const now = Date.now();
  try {
    const record = await db.prepare('SELECT attempts, first_attempt, locked_until FROM login_rate_limits WHERE ip = ?')
      .bind(ip).first();
    if (!record) return { allowed: true };

    if (record.locked_until && now < record.locked_until) {
      const remainingSecs = Math.ceil((record.locked_until - now) / 1000);
      return {
        allowed: false,
        error: `Too many failed login attempts. Temporarily locked for security. Please try again in ${remainingSecs} seconds.`
      };
    }

    // Reset window after 15 mins (900,000 ms)
    if (now - record.first_attempt > 900000) {
      await db.prepare('DELETE FROM login_rate_limits WHERE ip = ?').bind(ip).run();
      return { allowed: true };
    }
  } catch (e) {
    // If table doesn't exist yet, it will be created on first failed login
  }
  return { allowed: true };
}

async function recordFailedLogin(db, ip) {
  const now = Date.now();
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS login_rate_limits (
        ip TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 1,
        first_attempt INTEGER,
        locked_until INTEGER
      )
    `).run();

    const record = await db.prepare('SELECT attempts FROM login_rate_limits WHERE ip = ?').bind(ip).first();
    if (!record) {
      await db.prepare(
        'INSERT INTO login_rate_limits (ip, attempts, first_attempt, locked_until) VALUES (?, 1, ?, 0)'
      ).bind(ip, now).run();
    } else {
      const newAttempts = (record.attempts || 0) + 1;
      const lockedUntil = newAttempts >= 5 ? now + (15 * 60 * 1000) : 0;
      await db.prepare(
        'UPDATE login_rate_limits SET attempts = ?, locked_until = ? WHERE ip = ?'
      ).bind(newAttempts, lockedUntil, ip).run();
    }
  } catch (e) {
    console.error('Failed to record login attempt:', e);
  }
}

async function resetLoginRateLimit(db, ip) {
  try {
    await db.prepare('DELETE FROM login_rate_limits WHERE ip = ?').bind(ip).run();
  } catch (e) {}
}

function getJwtSecret(c) {
  const secret = c.env.JWT_SECRET;
  if (!secret) {
    throw new Error('SECURITY_CRITICAL: Missing JWT_SECRET environment configuration.');
  }
  return secret;
}

// ----------------------------------------------------
// STRICT CORS & SECURITY HEADERS MIDDLEWARE
// ----------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://thawhlawmptr.pages.dev',
  'https://thawhlawmptr.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.thawhlawmptr.pages.dev');
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    } else {
      return c.json({ error: 'Cross-origin request blocked by security policy' }, 403);
    }
  }

  // Strict Security Headers on all API responses
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  c.header('X-XSS-Protection', '1; mode=block');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  await next();
});

// Authentication Middleware with Session Validation & Account Lock Verification
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return c.json({ error: 'Access token required' }, 401);
  }

  try {
    const secret = getJwtSecret(c);
    const payload = await verify(token, secret, 'HS256');

    if (!payload || !payload.id) {
      return c.json({ error: 'Malformed or invalid session token' }, 401);
    }

    // Verify account status in DB to ensure deactivated or locked accounts cannot make requests
    const db = c.env.DB;
    const user = await db.prepare('SELECT id, status, role, token_version FROM users WHERE id = ?').bind(payload.id).first();
    if (!user || user.status === 'locked') {
      return c.json({ error: 'Account has been deactivated or locked' }, 403);
    }

    // Invalidate session if password was changed
    if (payload.token_version && user.token_version && payload.token_version !== user.token_version) {
      return c.json({ error: 'Session invalidated due to password change. Please log in again.' }, 401);
    }

    c.set('user', { ...payload, role: user.role });
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired session token' }, 401);
  }
}

function requireAdmin(c, next) {
  const user = c.get('user');
  if (user && user.role === 'ADMIN') {
    return next();
  }
  return c.json({ error: 'Admin privileges required' }, 403);
}

function requireBialUser(c, next) {
  const user = c.get('user');
  if (user && (user.role === 'BIAL' || user.role === 'ADMIN')) {
    return next();
  }
  return c.json({ error: 'Bial User authorization required' }, 403);
}

function cleanNumericInput(val) {
  if (val === null || val === undefined || val === '') return 0;
  const strVal = String(val).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(strVal)) return null;
  const parsed = parseFloat(strVal);
  return isNaN(parsed) || parsed < 0 ? null : parsed;
}

const DEFAULT_COLUMNS = [
  { id: 1, name: 'Pathian Ram', code: 'PTR', field_key: 'pathian_ram', color: '#6366f1', display_order: 1 },
  { id: 2, name: 'Ramthar', code: 'RT', field_key: 'ramthar', color: '#10b981', display_order: 2 },
  { id: 3, name: 'Tualchhung', code: 'Tch', field_key: 'tualchhung', color: '#f59e0b', display_order: 3 },
  { id: 4, name: 'Building', code: 'Bldg', field_key: 'building', color: '#a855f7', display_order: 4 }
];

let _memTitheColumns = null;
let _memTitheColumnsExpiry = 0;

function invalidateTitheColumnsCache() {
  _memTitheColumns = null;
  _memTitheColumnsExpiry = 0;
}

async function getTitheColumns(db) {
  const now = Date.now();
  if (_memTitheColumns && now < _memTitheColumnsExpiry) {
    return _memTitheColumns;
  }
  try {
    const { results } = await db.prepare(
      'SELECT id, name, code, field_key, color, display_order FROM tithe_columns ORDER BY display_order ASC, id ASC'
    ).all();
    if (results && results.length > 0) {
      _memTitheColumns = results;
      _memTitheColumnsExpiry = now + 180000;
      return results;
    }
  } catch (e) {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS tithe_columns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          field_key TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#6366f1',
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await db.prepare(`
        INSERT INTO tithe_columns (name, code, field_key, color, display_order) VALUES
        ('Pathian Ram', 'PTR', 'pathian_ram', '#6366f1', 1),
        ('Ramthar', 'RT', 'ramthar', '#10b981', 2),
        ('Tualchhung', 'Tch', 'tualchhung', '#f59e0b', 3),
        ('Building', 'Bldg', 'building', '#a855f7', 4)
      `).run();
      const { results } = await db.prepare(
        'SELECT id, name, code, field_key, color, display_order FROM tithe_columns ORDER BY display_order ASC, id ASC'
      ).all();
      if (results && results.length > 0) {
        _memTitheColumns = results;
        _memTitheColumnsExpiry = now + 180000;
        return results;
      }
    } catch (err) {}
  }
  return DEFAULT_COLUMNS;
}

let _memActiveYear = null;
let _memActiveYearExpiry = 0;

function invalidateActiveYearCache() {
  _memActiveYear = null;
  _memActiveYearExpiry = 0;
}

async function getActiveYear(db) {
  const now = Date.now();
  if (_memActiveYear && now < _memActiveYearExpiry) {
    return _memActiveYear;
  }
  try {
    const row = await db.prepare('SELECT year FROM financial_years WHERE is_active = 1 LIMIT 1').first();
    const yr = row ? row.year : new Date().getFullYear();
    _memActiveYear = yr;
    _memActiveYearExpiry = now + 180000;
    return yr;
  } catch (e) {
    return new Date().getFullYear();
  }
}

async function isMonthLocked(db, bialId, year, month) {
  if (bialId === 'all') return false;
  const targetBialId = parseInt(bialId);
  const targetYear = parseInt(year);
  const targetMonth = parseInt(month);

  const lock = await db.prepare(
    'SELECT is_locked FROM month_locks WHERE bial_id = ? AND year = ? AND month = ?'
  ).bind(targetBialId, targetYear, targetMonth).first();

  if (lock !== null && lock !== undefined) {
    return lock.is_locked === 1;
  }

  try {
    const actYear = await getActiveYear(db);
    if (targetYear !== actYear) {
      return true;
    }
  } catch (e) {}

  return false;
}

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------
app.post('/auth/login', async (c) => {
  const db = c.env.DB;
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || c.req.header('x-forwarded-for') || 'direct-client';

  // Anti-Brute-Force Rate Limiting (D1-backed)
  const rateLimitStatus = await checkLoginRateLimit(db, clientIp);
  if (!rateLimitStatus.allowed) {
    return c.json({ error: rateLimitStatus.error }, 429);
  }

  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  try {
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username.trim()).first();
    if (!user) {
      await recordFailedLogin(db, clientIp);
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    if (user.status === 'locked') {
      return c.json({ error: 'This account has been locked by Admin' }, 403);
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      await recordFailedLogin(db, clientIp);
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // Reset rate limiter on valid login
    await resetLoginRateLimit(db, clientIp);

    let bialDetails = null;
    if (user.role === 'BIAL') {
      bialDetails = await db.prepare('SELECT * FROM bials WHERE user_id = ?').bind(user.id).first();
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      bial_name: user.bial_name,
      bial_id: bialDetails ? bialDetails.id : null,
      token_version: user.token_version || 1,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    };

    const secret = getJwtSecret(c);
    const token = await sign(payload, secret, 'HS256');

    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bial_name: user.bial_name,
        bial_id: bialDetails ? bialDetails.id : null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ error: 'Internal server error during login' }, 500);
  }
});

// POST /api/auth/google - Admin Google Sign-In with Strict Cryptographic Verification
app.post('/auth/google', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const { credential } = body;

  if (!credential) {
    return c.json({ error: 'Google credential ID token is required' }, 400);
  }

  let verifiedEmail = null;
  let verifiedName = null;
  let verifiedPicture = null;
  let googleSub = null;

  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!googleRes.ok) {
      return c.json({ error: 'Google verification failed: Invalid, expired, or forged token' }, 401);
    }
    const tokenInfo = await googleRes.json();

    // Verify Audience to guarantee token was issued specifically for this app
    const expectedClientId = c.env.GOOGLE_CLIENT_ID || '407051455488-n6bieo72mu6c4v9lm5cbofapq9i81tjo.apps.googleusercontent.com';
    if (tokenInfo.aud !== expectedClientId) {
      return c.json({ error: 'Google token audience mismatch: token not issued for this application' }, 403);
    }

    // Verify Email Verification Status
    if (!tokenInfo.email || (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true)) {
      return c.json({ error: 'Google account email is not verified' }, 401);
    }

    verifiedEmail = tokenInfo.email.toLowerCase();
    verifiedName = tokenInfo.name || null;
    verifiedPicture = tokenInfo.picture || null;
    googleSub = tokenInfo.sub;
  } catch (err) {
    console.error('Google tokeninfo fetch error:', err);
    return c.json({ error: 'Failed to communicate with Google authentication servers' }, 500);
  }

  if (!verifiedEmail) {
    return c.json({ error: 'Unable to extract email from Google profile' }, 400);
  }

  try {
    const { results: adminUsers } = await db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").all();
    const admins = adminUsers || [];

    let allowedEmails = [];
    try {
      const { results: allowedRows } = await db.prepare("SELECT email FROM admin_google_emails").all();
      allowedEmails = (allowedRows || []).map(r => r.email.toLowerCase());
    } catch (e) {}

    let matchedAdmin = admins.find(a => a.email && a.email.toLowerCase() === verifiedEmail);

    if (!matchedAdmin && allowedEmails.includes(verifiedEmail)) {
      matchedAdmin = admins[0] || null;
    }

    const hasAnyLinkedEmail = admins.some(a => a.email && a.email.trim() !== '') || allowedEmails.length > 0;
    if (!matchedAdmin && !hasAnyLinkedEmail && admins.length > 0) {
      matchedAdmin = admins[0];
      try {
        await db.prepare("UPDATE users SET email = ?, google_id = ? WHERE id = ?")
          .bind(verifiedEmail, googleSub, matchedAdmin.id).run();
        await db.prepare("INSERT OR IGNORE INTO admin_google_emails (email) VALUES (?)")
          .bind(verifiedEmail).run();
      } catch (err) {
        console.error('Error linking initial admin email:', err);
      }
    }

    if (!matchedAdmin) {
      return c.json({
        error: `Access Denied: Google account (${verifiedEmail}) is not authorized as an Admin. Please ask the church administrator to add your Google email.`
      }, 403);
    }

    if (matchedAdmin.status === 'locked') {
      return c.json({ error: 'This Admin account has been locked.' }, 403);
    }

    const payload = {
      id: matchedAdmin.id,
      username: matchedAdmin.username || 'admin',
      role: 'ADMIN',
      email: verifiedEmail,
      name: verifiedName || 'Church Admin',
      picture: verifiedPicture || null,
      token_version: matchedAdmin.token_version || 1,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    };

    const secret = getJwtSecret(c);
    const token = await sign(payload, secret, 'HS256');

    return c.json({
      message: 'Admin Google login successful',
      token,
      user: {
        id: matchedAdmin.id,
        username: matchedAdmin.username,
        role: 'ADMIN',
        email: verifiedEmail,
        name: verifiedName,
        picture: verifiedPicture
      }
    });
  } catch (err) {
    console.error('Google Admin auth error:', err);
    return c.json({ error: 'Server error processing Google authentication' }, 500);
  }
});

// Admin Google Email Whitelist Endpoints
app.get('/admin/google-emails', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  try {
    const { results: emails } = await db.prepare("SELECT id, email, created_at FROM admin_google_emails ORDER BY id ASC").all();
    const primaryAdmin = await db.prepare("SELECT email FROM users WHERE role = 'ADMIN' AND email IS NOT NULL LIMIT 1").first();
    return c.json({
      emails: emails || [],
      primaryAdminEmail: primaryAdmin ? primaryAdmin.email : null
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch admin Google emails' }, 500);
  }
});

app.post('/admin/google-emails', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { email } = await c.req.json();
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email address is required' }, 400);
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    await db.prepare("INSERT INTO admin_google_emails (email) VALUES (?)").bind(cleanEmail).run();
    return c.json({ message: 'Admin Google email authorized successfully', email: cleanEmail });
  } catch (err) {
    return c.json({ error: 'Failed to add admin email or email already exists' }, 400);
  }
});

app.delete('/admin/google-emails/:id', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'));
  try {
    await db.prepare("DELETE FROM admin_google_emails WHERE id = ?").bind(id).run();
    return c.json({ message: 'Authorized admin email removed' });
  } catch (err) {
    return c.json({ error: 'Failed to delete admin email' }, 500);
  }
});

app.get('/auth/me', authMiddleware, async (c) => {
  const db = c.env.DB;
  const currentUser = c.get('user');

  try {
    const user = await db.prepare('SELECT id, username, role, bial_name, status FROM users WHERE id = ?').bind(currentUser.id).first();
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    let bialDetails = null;
    if (user.role === 'BIAL') {
      bialDetails = await db.prepare('SELECT * FROM bials WHERE user_id = ?').bind(user.id).first();
    }

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bial_name: user.bial_name,
        bial_id: bialDetails ? bialDetails.id : null
      }
    });
  } catch (err) {
    return c.json({ error: 'Error fetching session profile' }, 500);
  }
});

app.put('/auth/change-password', authMiddleware, async (c) => {
  const db = c.env.DB;
  const currentUser = c.get('user');
  const { currentPassword, newPassword } = await c.req.json();

  if (!currentPassword) {
    return c.json({ error: 'Current password is required to verify identity' }, 400);
  }

  if (!newPassword || newPassword.length < 4) {
    return c.json({ error: 'New password must be at least 4 characters long' }, 400);
  }

  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(currentUser.id).first();
    if (!user) return c.json({ error: 'User not found' }, 404);

    const match = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!match) return c.json({ error: 'Incorrect current password' }, 400);

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    try {
      await db.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1').run();
    } catch (e) {}

    await db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
      .bind(hash, currentUser.id).run();

    return c.json({ message: 'Password changed successfully. All active sessions have been secured.' });
  } catch (err) {
    return c.json({ error: 'Error changing password' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN ROUTES
// ----------------------------------------------------
app.get('/admin/bials', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  try {
    const { results: bials } = await db.prepare(`
      SELECT b.id, b.name, b.code, b.user_id, u.username, u.status, u.created_at,
      (SELECT COUNT(*) FROM members m WHERE m.bial_id = b.id AND m.year = ?) as member_count,
      (SELECT COALESCE(SUM(t.total), 0) FROM tithes t WHERE t.bial_id = b.id AND t.year = ?) as total_collected
      FROM bials b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.id ASC
    `).bind(year, year).all();

    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    return c.json(bials);
  } catch (err) {
    return c.json({ error: 'Failed to fetch Bials' }, 500);
  }
});

app.post('/admin/bials', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { name, code, username, password } = await c.req.json();

  if (!name || !code || !username || !password) {
    return c.json({ error: 'All fields (name, code, username, password) are required' }, 400);
  }

  try {
    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username.trim()).first();
    if (existingUser) return c.json({ error: 'Username already exists' }, 400);

    const existingBial = await db.prepare('SELECT id FROM bials WHERE name = ?').bind(name.trim()).first();
    if (existingBial) return c.json({ error: 'Bial name already exists' }, 400);

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const userRes = await db.prepare(
      "INSERT INTO users (username, password_hash, role, bial_name, status) VALUES (?, ?, 'BIAL', ?, 'active')"
    ).bind(username.trim(), hash, name.trim()).run();

    const bialRes = await db.prepare(
      'INSERT INTO bials (name, code, user_id) VALUES (?, ?, ?)'
    ).bind(name.trim(), code.trim(), userRes.meta.last_row_id).run();

    return c.json({
      message: 'Bial account created successfully',
      bial: {
        id: bialRes.meta.last_row_id,
        name: name.trim(),
        code: code.trim(),
        username: username.trim()
      }
    }, 201);
  } catch (err) {
    return c.json({ error: 'Failed to create Bial account' }, 500);
  }
});

app.put('/admin/bials/:id', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { name, code, username, password, status } = await c.req.json();

  try {
    const bial = await db.prepare('SELECT * FROM bials WHERE id = ?').bind(id).first();
    if (!bial) return c.json({ error: 'Bial not found' }, 404);

    if (name) {
      await db.prepare('UPDATE bials SET name = ? WHERE id = ?').bind(name.trim(), id).run();
      await db.prepare('UPDATE users SET bial_name = ? WHERE id = ?').bind(name.trim(), bial.user_id).run();
    }
    if (code) {
      await db.prepare('UPDATE bials SET code = ? WHERE id = ?').bind(code.trim(), id).run();
    }
    if (username) {
      await db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username.trim(), bial.user_id).run();
    }
    if (status && (status === 'active' || status === 'locked')) {
      await db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, bial.user_id).run();
    }
    if (password && password.length > 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, bial.user_id).run();
    }

    return c.json({ message: 'Bial account updated successfully' });
  } catch (err) {
    return c.json({ error: 'Failed to update Bial' }, 500);
  }
});

app.delete('/admin/bials/:id', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const bial = await db.prepare('SELECT * FROM bials WHERE id = ?').bind(id).first();
    if (!bial) return c.json({ error: 'Bial not found' }, 404);

    await db.batch([
      db.prepare('DELETE FROM tithes WHERE bial_id = ?').bind(id),
      db.prepare('DELETE FROM members WHERE bial_id = ?').bind(id),
      db.prepare('DELETE FROM month_locks WHERE bial_id = ?').bind(id),
      db.prepare('DELETE FROM bials WHERE id = ?').bind(id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(bial.user_id)
    ]);

    return c.json({ message: 'Bial deleted successfully' });
  } catch (err) {
    return c.json({ error: 'Failed to delete Bial' }, 500);
  }
});

app.get('/admin/month-locks', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  try {
    const { results: bials } = await db.prepare('SELECT id, name, code FROM bials ORDER BY id ASC').all();
    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    const { results: locks } = await db.prepare('SELECT * FROM month_locks WHERE year = ?').bind(year).all();

    const matrix = {};
    bials.forEach(b => {
      matrix[b.id] = {};
      for (let m = 1; m <= 12; m++) {
        matrix[b.id][m] = 0;
      }
    });

    locks.forEach(l => {
      if (matrix[l.bial_id]) {
        matrix[l.bial_id][l.month] = l.is_locked;
      }
    });

    return c.json({ year, bials, matrix });
  } catch (err) {
    return c.json({ error: 'Failed to fetch month locks matrix' }, 500);
  }
});

app.post('/admin/month-locks/toggle', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { bial_id, year, month, is_locked, global_toggle } = await c.req.json();
  const targetYear = parseInt(year) || await getActiveYear(db);
  const targetMonth = parseInt(month);

  if (!targetMonth || targetMonth < 1 || targetMonth > 12) {
    return c.json({ error: 'Invalid month (1-12 required)' }, 400);
  }

  try {
    if (global_toggle) {
      const { results: bials } = await db.prepare('SELECT id FROM bials').all();
      const lockVal = is_locked ? 1 : 0;
      const stmts = bials.map(b =>
        db.prepare(`
          INSERT INTO month_locks (bial_id, year, month, is_locked, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(bial_id, year, month) DO UPDATE SET
            is_locked = excluded.is_locked,
            updated_at = CURRENT_TIMESTAMP
        `).bind(b.id, targetYear, targetMonth, lockVal)
      );

      await db.batch(stmts);
      return c.json({ message: `Global lock for month ${targetMonth} set to ${lockVal ? 'LOCKED' : 'UNLOCKED'}` });
    } else {
      if (!bial_id) return c.json({ error: 'bial_id is required' }, 400);
      const lockVal = is_locked ? 1 : 0;
      await db.prepare(`
        INSERT INTO month_locks (bial_id, year, month, is_locked, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(bial_id, year, month) DO UPDATE SET
          is_locked = excluded.is_locked,
          updated_at = CURRENT_TIMESTAMP
      `).bind(bial_id, targetYear, targetMonth, lockVal).run();

      return c.json({ message: `Bial lock updated for month ${targetMonth}` });
    }
  } catch (err) {
    return c.json({ error: 'Failed to update month lock' }, 500);
  }
});

app.get('/admin/dashboard', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);
  const bialId = c.req.query('bial_id') && c.req.query('bial_id') !== 'all' ? parseInt(c.req.query('bial_id')) : null;
  const month = c.req.query('month') && c.req.query('month') !== 'all' ? parseInt(c.req.query('month')) : null;

  try {
    const columns = await getTitheColumns(db);

    // 1. Fetch Bials
    let bialQuery = 'SELECT id, name, code FROM bials';
    const bialParams = [];
    if (bialId) {
      bialQuery += ' WHERE id = ?';
      bialParams.push(bialId);
    }
    bialQuery += ' ORDER BY id ASC';
    const { results: bialsList } = await db.prepare(bialQuery).bind(...bialParams).all();

    // 2. Member counts per Bial and overall system members count
    let memberQuery = 'SELECT bial_id, COUNT(*) as count FROM members WHERE year = ?';
    const memberParams = [year];
    if (bialId) {
      memberQuery += ' AND bial_id = ?';
      memberParams.push(bialId);
    }
    memberQuery += ' GROUP BY bial_id';
    const { results: memberCountRows } = await db.prepare(memberQuery).bind(...memberParams).all();
    const bialMemberCountMap = new Map();
    let total_system_members = 0;
    (memberCountRows || []).forEach(r => {
      bialMemberCountMap.set(r.bial_id, r.count);
      total_system_members += r.count;
    });

    // 3. Fetch all tithes for the year (and bialId if filtered) in ONE single query
    let tithesQuery = `
      SELECT bial_id, member_id, month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total
      FROM tithes
      WHERE year = ?
    `;
    const tithesParams = [year];
    if (bialId) {
      tithesQuery += ' AND bial_id = ?';
      tithesParams.push(bialId);
    }
    const { results: allYearTithes } = await db.prepare(tithesQuery).bind(...tithesParams).all();
    const titheList = allYearTithes || [];

    // Filter matching tithes by month if specified
    const matchingTithes = month ? titheList.filter(t => t.month === month) : titheList;

    // Grand totals calculation
    const grandTotals = { grand_total: 0 };
    columns.forEach(col => {
      grandTotals[col.field_key] = 0;
      grandTotals[`total_${col.field_key}`] = 0;
    });

    const returnedMemberSet = new Set();

    matchingTithes.forEach(t => {
      const extra = t.extra_amounts ? (typeof t.extra_amounts === 'string' ? JSON.parse(t.extra_amounts || '{}') : t.extra_amounts) : {};
      columns.forEach(col => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)
          ? (t[col.field_key] || 0)
          : (extra[col.field_key] || 0);
        grandTotals[col.field_key] += v;
        grandTotals[`total_${col.field_key}`] += v;
      });
      grandTotals.grand_total += (t.total || 0);
      if ((t.total || 0) > 0) {
        returnedMemberSet.add(t.member_id);
      }
    });

    // Backward-compat keys:
    grandTotals.total_pathian_ram = grandTotals.pathian_ram || 0;
    grandTotals.total_ramthar = grandTotals.ramthar || 0;
    grandTotals.total_tualchhung = grandTotals.tualchhung || 0;
    grandTotals.total_building = grandTotals.building || 0;

    const total_returned_members = returnedMemberSet.size;
    const grandTotalVal = grandTotals.grand_total || 0;

    // Bial breakdown calculation
    const bialTotalsMap = new Map();
    const bialReturnedMembersMap = new Map();

    matchingTithes.forEach(t => {
      if (!bialTotalsMap.has(t.bial_id)) {
        const init = { total: 0 };
        columns.forEach(c => { init[c.field_key] = 0; });
        bialTotalsMap.set(t.bial_id, init);
      }
      if (!bialReturnedMembersMap.has(t.bial_id)) {
        bialReturnedMembersMap.set(t.bial_id, new Set());
      }
      const bObj = bialTotalsMap.get(t.bial_id);
      const extra = t.extra_amounts ? (typeof t.extra_amounts === 'string' ? JSON.parse(t.extra_amounts || '{}') : t.extra_amounts) : {};
      columns.forEach(c => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
          ? (t[c.field_key] || 0)
          : (extra[c.field_key] || 0);
        bObj[c.field_key] += v;
      });
      bObj.total += (t.total || 0);
      if ((t.total || 0) > 0) {
        bialReturnedMembersMap.get(t.bial_id).add(t.member_id);
      }
    });

    const bialBreakdown = (bialsList || []).map(b => {
      const bSums = bialTotalsMap.get(b.id) || {};
      const total_members = bialMemberCountMap.get(b.id) || 0;
      const returned_members = bialReturnedMembersMap.has(b.id) ? bialReturnedMembersMap.get(b.id).size : 0;
      const return_rate = total_members > 0 ? Math.round((returned_members / total_members) * 1000) / 10 : 0;
      const bTotal = bSums.total || 0;
      const percentage_share = grandTotalVal > 0 ? Math.round((bTotal / grandTotalVal) * 1000) / 10 : 0;
      const avg_per_member = returned_members > 0 ? Math.round(bTotal / returned_members) : 0;

      const resB = {
        id: b.id,
        name: b.name,
        code: b.code,
        total: bTotal,
        total_members,
        returned_members,
        return_rate,
        percentage_share,
        avg_per_member
      };
      columns.forEach(c => {
        resB[c.field_key] = bSums[c.field_key] || 0;
        resB[`total_${c.field_key}`] = resB[c.field_key];
      });
      return resB;
    });

    bialBreakdown.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    const overall_return_rate = total_system_members > 0 
      ? Math.round((total_returned_members / total_system_members) * 1000) / 10 
      : 0;

    const avg_contribution_per_member = total_returned_members > 0 
      ? Math.round(grandTotalVal / total_returned_members) 
      : 0;

    const topContributingBial = bialBreakdown.length > 0 && bialBreakdown[0].total > 0
      ? {
          id: bialBreakdown[0].id,
          name: bialBreakdown[0].name,
          code: bialBreakdown[0].code,
          total: bialBreakdown[0].total,
          percentage_share: bialBreakdown[0].percentage_share,
          returned_members: bialBreakdown[0].returned_members,
          total_members: bialBreakdown[0].total_members,
          return_rate: bialBreakdown[0].return_rate
        }
      : null;

    const enrichedGrandTotals = {
      ...grandTotals,
      total_system_members,
      total_returned_members,
      pending_members: Math.max(0, total_system_members - total_returned_members),
      overall_return_rate,
      avg_contribution_per_member,
      top_contributing_bial: topContributingBial
    };

    // Monthly trends (1 to 12) computed in memory from titheList in a single pass
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = [];

    for (let m = 1; m <= 12; m++) {
      const mTithes = titheList.filter(t => t.month === m);
      const mSums = { total: 0 };
      columns.forEach(c => { mSums[c.field_key] = 0; });
      const mReturnedSet = new Set();

      mTithes.forEach(r => {
        const extra = r.extra_amounts ? (typeof r.extra_amounts === 'string' ? JSON.parse(r.extra_amounts || '{}') : r.extra_amounts) : {};
        let rTotal = 0;
        columns.forEach(c => {
          const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
            ? (r[c.field_key] || 0)
            : (extra[c.field_key] || 0);
          mSums[c.field_key] += v;
          rTotal += v;
        });
        mSums.total += (r.total || rTotal);
        if ((r.total || rTotal) > 0) mReturnedSet.add(r.member_id);
      });

      // Backward-compat keys:
      mSums.pathian_ram = mSums.pathian_ram || 0;
      mSums.ramthar = mSums.ramthar || 0;
      mSums.tualchhung = mSums.tualchhung || 0;
      mSums.building = mSums.building || 0;

      const returnedCount = mReturnedSet.size;
      const mReturnRate = total_system_members > 0 
        ? Math.round((returnedCount / total_system_members) * 1000) / 10 
        : 0;

      monthlyTrends.push({
        month: monthNames[m - 1],
        monthNum: m,
        ...mSums,
        returned_members: returnedCount,
        return_rate: mReturnRate,
        total_system_members
      });
    }

    return c.json({
      year,
      grandTotals: enrichedGrandTotals,
      bialBreakdown,
      monthlyTrends,
      filteredBialId: bialId,
      filteredMonth: month,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch admin stats' }, 500);
  }
});

app.get('/admin/years', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  try {
    const { results: rows } = await db.prepare('SELECT id, year, is_active FROM financial_years ORDER BY year ASC').all();
    const years = rows.map(r => r.year);
    const activeRow = rows.find(r => r.is_active === 1) || rows[rows.length - 1];
    const activeYear = activeRow ? activeRow.year : new Date().getFullYear();

    return c.json({
      years: years.length > 0 ? years : [2024, 2025, 2026, 2027],
      yearDetails: rows,
      activeYear
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch financial years' }, 500);
  }
});

app.put('/admin/years/active', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { year } = await c.req.json();
  const numYear = parseInt(year);

  if (isNaN(numYear)) {
    return c.json({ error: 'Valid financial year is required' }, 400);
  }

  try {
    const existing = await db.prepare('SELECT id FROM financial_years WHERE year = ?').bind(numYear).first();
    if (!existing) {
      return c.json({ error: `Financial Year ${numYear} not found` }, 404);
    }

    await db.prepare('UPDATE financial_years SET is_active = CASE WHEN year = ? THEN 1 ELSE 0 END').bind(numYear).run();
    invalidateActiveYearCache();
    return c.json({ message: `Financial Year ${numYear} is now the active financial year`, activeYear: numYear });
  } catch (err) {
    return c.json({ error: 'Failed to set active financial year' }, 500);
  }
});

app.post('/admin/years', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { year, set_active } = await c.req.json();
  const numYear = parseInt(year);

  if (isNaN(numYear) || numYear < 2000 || numYear > 2100) {
    return c.json({ error: 'Valid 4-digit financial year required (e.g., 2026)' }, 400);
  }

  try {
    const existing = await db.prepare('SELECT id FROM financial_years WHERE year = ?').bind(numYear).first();
    if (existing) {
      return c.json({ error: `Financial Year ${numYear} already exists` }, 400);
    }

    const isActiveVal = set_active ? 1 : 0;
    if (isActiveVal === 1) {
      await db.prepare('UPDATE financial_years SET is_active = 0').run();
    }

    await db.prepare('INSERT INTO financial_years (year, is_active) VALUES (?, ?)').bind(numYear, isActiveVal).run();
    invalidateActiveYearCache();
    return c.json({ message: `Financial Year ${numYear} added successfully`, year: numYear, is_active: isActiveVal }, 201);
  } catch (err) {
    return c.json({ error: 'Failed to add financial year' }, 500);
  }
});

app.delete('/admin/years/:year', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const numYear = parseInt(c.req.param('year'));
  if (isNaN(numYear)) return c.json({ error: 'Invalid financial year' }, 400);

  try {
    const countRes = await db.prepare('SELECT COUNT(*) as count FROM financial_years').first();
    if (countRes.count <= 1) {
      return c.json({ error: 'Cannot delete the last remaining Financial Year' }, 400);
    }

    const yearToDelete = await db.prepare('SELECT is_active FROM financial_years WHERE year = ?').bind(numYear).first();
    await db.prepare('DELETE FROM financial_years WHERE year = ?').bind(numYear).run();

    if (yearToDelete && yearToDelete.is_active === 1) {
      const latest = await db.prepare('SELECT id FROM financial_years ORDER BY year DESC LIMIT 1').first();
      if (latest) {
        await db.prepare('UPDATE financial_years SET is_active = 1 WHERE id = ?').bind(latest.id).run();
      }
    }

    invalidateActiveYearCache();
    return c.json({ message: `Financial Year ${numYear} deleted successfully` });
  } catch (err) {
    return c.json({ error: 'Failed to delete financial year' }, 500);
  }
});

app.get('/admin/overall-member-contributions', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  try {
    const columns = await getTitheColumns(db);
    const { results: bials } = await db.prepare('SELECT id, name, code FROM bials ORDER BY id ASC').all();
    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    // Fetch all members for the year in ONE batch query
    const { results: allYearMembers } = await db.prepare(`
      SELECT m.id as member_id, m.bial_id, m.sl_no, m.name as member_name
      FROM members m
      WHERE m.year = ?
      ORDER BY m.bial_id ASC, m.sl_no ASC, m.id ASC
    `).bind(year).all();

    // Fetch all tithes for the year in ONE batch query
    const { results: allYearTithes } = await db.prepare(`
      SELECT t.bial_id, t.member_id, t.pathian_ram, t.ramthar, t.tualchhung, t.building, t.extra_amounts, t.total
      FROM tithes t
      WHERE t.year = ?
    `).bind(year).all();

    // Group members by bial_id
    const bialMembersMap = new Map();
    (allYearMembers || []).forEach(m => {
      if (!bialMembersMap.has(m.bial_id)) {
        bialMembersMap.set(m.bial_id, []);
      }
      bialMembersMap.get(m.bial_id).push(m);
    });

    // Group tithes by member_id
    const memberTithesMap = new Map();
    (allYearTithes || []).forEach(t => {
      if (!memberTithesMap.has(t.member_id)) {
        const init = { grand_total: 0 };
        columns.forEach(c => { init[c.field_key] = 0; });
        memberTithesMap.set(t.member_id, init);
      }
      const mObj = memberTithesMap.get(t.member_id);
      const extra = t.extra_amounts ? (typeof t.extra_amounts === 'string' ? JSON.parse(t.extra_amounts || '{}') : t.extra_amounts) : {};
      columns.forEach(c => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
          ? (t[c.field_key] || 0)
          : (extra[c.field_key] || 0);
        mObj[c.field_key] += v;
        mObj.grand_total += v;
      });
    });

    const data = [];
    const churchGrandTotal = { grand_total: 0 };
    columns.forEach(col => {
      churchGrandTotal[col.field_key] = 0;
      churchGrandTotal[`total_${col.field_key}`] = 0;
    });
    let totalMemberCount = 0;

    for (const b of bials) {
      const rawMembers = bialMembersMap.get(b.id) || [];

      const bialSubtotal = { grand_total: 0 };
      columns.forEach(c => {
        bialSubtotal[c.field_key] = 0;
        bialSubtotal[`total_${c.field_key}`] = 0;
      });

      const processedMembers = rawMembers.map(m => {
        const tData = memberTithesMap.get(m.member_id) || {};
        const resMem = {
          member_id: m.member_id,
          sl_no: m.sl_no,
          member_name: m.member_name,
          grand_total: tData.grand_total || 0
        };
        columns.forEach(c => {
          const v = tData[c.field_key] || 0;
          resMem[c.field_key] = v;
          resMem[`total_${c.field_key}`] = v;
          bialSubtotal[c.field_key] += v;
          bialSubtotal[`total_${c.field_key}`] += v;
          churchGrandTotal[c.field_key] += v;
          churchGrandTotal[`total_${c.field_key}`] += v;
        });
        bialSubtotal.grand_total += resMem.grand_total;
        churchGrandTotal.grand_total += resMem.grand_total;
        return resMem;
      });

      // Backward-compat keys for bialSubtotal
      bialSubtotal.total_pathian_ram = bialSubtotal.pathian_ram || 0;
      bialSubtotal.total_ramthar = bialSubtotal.ramthar || 0;
      bialSubtotal.total_tualchhung = bialSubtotal.tualchhung || 0;
      bialSubtotal.total_building = bialSubtotal.building || 0;

      totalMemberCount += processedMembers.length;

      data.push({
        bial_id: b.id,
        bial_name: b.name,
        bial_code: b.code,
        members: processedMembers,
        subtotal: bialSubtotal
      });
    }

    // Backward-compat keys for churchGrandTotal
    churchGrandTotal.total_pathian_ram = churchGrandTotal.pathian_ram || 0;
    churchGrandTotal.total_ramthar = churchGrandTotal.ramthar || 0;
    churchGrandTotal.total_tualchhung = churchGrandTotal.tualchhung || 0;
    churchGrandTotal.total_building = churchGrandTotal.building || 0;

    return c.json({
      year,
      totalMemberCount,
      bials: data,
      churchGrandTotal,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch overall member contributions' }, 500);
  }
});

app.get('/admin/members/all', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const year = parseInt(c.req.query('year'));

  try {
    let query = `
      SELECT 
        m.id, 
        m.bial_id, 
        m.year,
        m.sl_no, 
        m.name, 
        b.name as bial_name, 
        b.code as bial_code,
        COALESCE(ts.tithe_records_count, 0) as tithe_records_count,
        COALESCE(ts.total_contributed, 0) as total_contributed
      FROM members m
      JOIN bials b ON m.bial_id = b.id
      LEFT JOIN (
        SELECT member_id, COUNT(*) as tithe_records_count, SUM(total) as total_contributed
        FROM tithes
        GROUP BY member_id
      ) ts ON ts.member_id = m.id
    `;
    const params = [];
    if (year && !isNaN(year)) {
      query += ` WHERE m.year = ?`;
      params.push(year);
    }
    query += ` ORDER BY b.name ASC, m.sl_no ASC, m.id ASC`;

    const { results: members } = await db.prepare(query).bind(...params).all();
    return c.json(members);
  } catch (err) {
    return c.json({ error: 'Failed to fetch all members' }, 500);
  }
});

app.post('/admin/members/transfer', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { member_id, target_bial_id, new_sl_no } = await c.req.json();
  const memberId = parseInt(member_id);
  const targetBialId = parseInt(target_bial_id);

  if (!memberId || isNaN(memberId) || !targetBialId || isNaN(targetBialId)) {
    return c.json({ error: 'Valid member_id and target_bial_id are required' }, 400);
  }

  try {
    const member = await db.prepare('SELECT * FROM members WHERE id = ?').bind(memberId).first();
    if (!member) return c.json({ error: 'Member not found' }, 404);

    const sourceBial = await db.prepare('SELECT id, name, code FROM bials WHERE id = ?').bind(member.bial_id).first();
    const destinationBial = await db.prepare('SELECT id, name, code FROM bials WHERE id = ?').bind(targetBialId).first();

    if (!destinationBial) return c.json({ error: 'Destination Bial not found' }, 404);
    if (member.bial_id === targetBialId) {
      return c.json({ error: `Member "${member.name}" is already in ${destinationBial.name}` }, 400);
    }

    let assignedSlNo = parseInt(new_sl_no);
    if (isNaN(assignedSlNo) || assignedSlNo <= 0) {
      const maxSl = await db.prepare('SELECT COALESCE(MAX(sl_no), 0) as max_sl FROM members WHERE bial_id = ?').bind(targetBialId).first();
      assignedSlNo = (maxSl ? maxSl.max_sl : 0) + 1;
    }

    await db.batch([
      db.prepare('UPDATE members SET bial_id = ?, sl_no = ? WHERE id = ?').bind(targetBialId, assignedSlNo, memberId),
      db.prepare('UPDATE tithes SET bial_id = ? WHERE member_id = ?').bind(targetBialId, memberId)
    ]);

    return c.json({
      message: `Member "${member.name}" successfully transferred from ${sourceBial?.name || 'Previous Bial'} to ${destinationBial.name}!`,
      member: {
        id: memberId,
        name: member.name,
        previous_bial_id: member.bial_id,
        previous_bial_name: sourceBial?.name,
        new_bial_id: targetBialId,
        new_bial_name: destinationBial.name,
        sl_no: assignedSlNo
      }
    });
  } catch (err) {
    return c.json({ error: err.message || 'Failed to transfer member' }, 500);
  }
});

// ----------------------------------------------------
// MEMBERS ROUTES
// ----------------------------------------------------
function getTargetBialId(c) {
  const user = c.get('user');
  if (user.role === 'ADMIN') {
    const qVal = c.req.query('bial_id');
    if (qVal === 'all') return 'all';
    return qVal ? parseInt(qVal) : 'all';
  }
  return user.bial_id;
}

app.get('/members', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const bialId = getTargetBialId(c);
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  if (!bialId) {
    return c.json({ error: 'bial_id is required' }, 400);
  }

  try {
    let members;
    if (bialId === 'all') {
      const res = await db.prepare(`
        SELECT m.id, m.bial_id, m.year, m.sl_no, m.name, m.created_at, b.name as bial_name, b.code as bial_code
        FROM members m
        JOIN bials b ON m.bial_id = b.id
        WHERE m.year = ?
        ORDER BY b.name ASC, m.sl_no ASC, m.id ASC
      `).bind(year).all();
      members = res.results;
    } else {
      const res = await db.prepare(`
        SELECT id, bial_id, year, sl_no, name, created_at
        FROM members
        WHERE bial_id = ? AND year = ?
        ORDER BY sl_no ASC, id ASC
      `).bind(bialId, year).all();
      members = res.results;
    }

    return c.json(members);
  } catch (err) {
    return c.json({ error: 'Failed to fetch members' }, 500);
  }
});

app.post('/members', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const user = c.get('user');
  const bialId = user.role === 'ADMIN' ? parseInt(body.bial_id || c.req.query('bial_id')) : user.bial_id;
  const year = parseInt(body.year) || await getActiveYear(db);
  const name = body.name;
  const sl_no = body.sl_no;

  if (!bialId || isNaN(bialId)) {
    return c.json({ error: 'Specific bial_id is required' }, 400);
  }

  if (!name || name.trim().length === 0) {
    return c.json({ error: 'Member name (HMING) is required' }, 400);
  }

  try {
    let nextSlNo = parseInt(sl_no);
    if (!nextSlNo || isNaN(nextSlNo)) {
      const maxSl = await db.prepare('SELECT MAX(sl_no) as max_sl FROM members WHERE bial_id = ? AND year = ?').bind(bialId, year).first();
      nextSlNo = (maxSl && maxSl.max_sl) ? maxSl.max_sl + 1 : 1;
    }

    const result = await db.prepare(`
      INSERT INTO members (bial_id, year, sl_no, name)
      VALUES (?, ?, ?, ?)
    `).bind(bialId, year, nextSlNo, name.trim()).run();

    return c.json({
      message: 'Member added successfully',
      member: {
        id: result.meta.last_row_id,
        bial_id: bialId,
        year,
        sl_no: nextSlNo,
        name: name.trim()
      }
    }, 201);
  } catch (err) {
    return c.json({ error: 'Failed to add member' }, 500);
  }
});

app.post('/members/rollover', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json();
  const sourceYear = parseInt(body.source_year);
  const targetYear = parseInt(body.target_year);

  if (!sourceYear || !targetYear || isNaN(sourceYear) || isNaN(targetYear)) {
    return c.json({ error: 'Valid source_year and target_year are required' }, 400);
  }

  if (sourceYear === targetYear) {
    return c.json({ error: 'Source and target financial years must be different' }, 400);
  }

  let targetBialId;
  if (user.role === 'ADMIN') {
    targetBialId = body.bial_id === 'all' || !body.bial_id ? 'all' : parseInt(body.bial_id);
  } else {
    targetBialId = user.bial_id;
  }

  try {
    let sourceMembers;
    if (targetBialId === 'all') {
      const res = await db.prepare(`
        SELECT bial_id, sl_no, name
        FROM members
        WHERE year = ?
        ORDER BY bial_id ASC, sl_no ASC, id ASC
      `).bind(sourceYear).all();
      sourceMembers = res.results;
    } else {
      const res = await db.prepare(`
        SELECT bial_id, sl_no, name
        FROM members
        WHERE bial_id = ? AND year = ?
        ORDER BY sl_no ASC, id ASC
      `).bind(targetBialId, sourceYear).all();
      sourceMembers = res.results;
    }

    if (sourceMembers.length === 0) {
      return c.json({ error: `No members found in FY ${sourceYear} to rollover.` }, 400);
    }

    const { results: existingMembers } = await db.prepare(
      'SELECT bial_id, LOWER(name) as name_lower FROM members WHERE year = ?'
    ).bind(targetYear).all();

    const existingSet = new Set(existingMembers.map(e => `${e.bial_id}_${e.name_lower}`));

    const insertStmts = [];
    let rolledOverCount = 0;
    let skippedCount = 0;

    for (const m of sourceMembers) {
      const key = `${m.bial_id}_${m.name.trim().toLowerCase()}`;
      if (!existingSet.has(key)) {
        insertStmts.push(
          db.prepare('INSERT INTO members (bial_id, year, sl_no, name) VALUES (?, ?, ?, ?)').bind(m.bial_id, targetYear, m.sl_no, m.name.trim())
        );
        existingSet.add(key);
        rolledOverCount++;
      } else {
        skippedCount++;
      }
    }

    if (insertStmts.length > 0) {
      // Chunk batch operations if large (D1 supports up to 100 statements per batch)
      const chunkSize = 80;
      for (let i = 0; i < insertStmts.length; i += chunkSize) {
        await db.batch(insertStmts.slice(i, i + chunkSize));
      }
    }

    return c.json({
      success: true,
      message: `Successfully rolled over ${rolledOverCount} member name(s) from FY ${sourceYear} to FY ${targetYear}.${skippedCount > 0 ? ` (${skippedCount} already existed).` : ''}`,
      rolled_over_count: rolledOverCount,
      skipped_count: skippedCount,
      total_source_members: sourceMembers.length,
      source_year: sourceYear,
      target_year: targetYear
    });
  } catch (err) {
    return c.json({ error: err.message || 'Failed to rollover members' }, 500);
  }
});

app.put('/members/:id', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const { name, sl_no } = await c.req.json();

  try {
    const member = await db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first();
    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (user.role === 'BIAL' && member.bial_id !== user.bial_id) {
      return c.json({ error: 'Unauthorized to modify member of another Bial' }, 403);
    }

    if (name && name.trim().length > 0) {
      await db.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name.trim(), id).run();
    }

    if (sl_no !== undefined && !isNaN(parseInt(sl_no))) {
      await db.prepare('UPDATE members SET sl_no = ? WHERE id = ?').bind(parseInt(sl_no), id).run();
    }

    return c.json({ message: 'Member updated successfully' });
  } catch (err) {
    return c.json({ error: 'Failed to update member' }, 500);
  }
});

app.delete('/members/:id', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const member = await db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first();
    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (user.role === 'BIAL' && member.bial_id !== user.bial_id) {
      return c.json({ error: 'Unauthorized to delete member of another Bial' }, 403);
    }

    await db.batch([
      db.prepare('DELETE FROM tithes WHERE member_id = ?').bind(id),
      db.prepare('DELETE FROM members WHERE id = ?').bind(id)
    ]);

    return c.json({ message: 'Member deleted successfully' });
  } catch (err) {
    return c.json({ error: 'Failed to delete member' }, 500);
  }
});

// ----------------------------------------------------
// COLUMN MANAGEMENT ROUTES
// ----------------------------------------------------
app.get('/columns', async (c) => {
  const db = c.env.DB;
  const columns = await getTitheColumns(db);
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ columns });
});

app.post('/columns', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim();
  const color = String(body.color || '#6366f1').trim();

  if (!name || !code) {
    return c.json({ error: 'Column full name and short code header are required.' }, 400);
  }

  try {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 16);
    const fieldKey = `col_${baseSlug}_${Date.now().toString(36)}`;

    const maxOrderRow = await db.prepare('SELECT COALESCE(MAX(display_order), 0) as max_order FROM tithe_columns').first();
    const nextOrder = (maxOrderRow?.max_order || 0) + 1;

    const res = await db.prepare(
      'INSERT INTO tithe_columns (name, code, field_key, color, display_order) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, code, fieldKey, color, nextOrder).run();

    invalidateTitheColumnsCache();

    const newCol = {
      id: res.meta.last_row_id,
      name,
      code,
      field_key: fieldKey,
      color,
      display_order: nextOrder
    };

    const columns = await getTitheColumns(db);
    return c.json({ message: 'Column created successfully', column: newCol, columns });
  } catch (err) {
    return c.json({ error: 'Failed to create column' }, 500);
  }
});

app.put('/columns/:id', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const colId = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim();
  const color = body.color ? String(body.color).trim() : null;
  const displayOrder = body.display_order !== undefined ? parseInt(body.display_order) : null;

  if (!name || !code) {
    return c.json({ error: 'Column full name and short code header are required.' }, 400);
  }

  try {
    if (color && displayOrder !== null) {
      await db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ?, color = ?, display_order = ? WHERE id = ?'
      ).bind(name, code, color, displayOrder, colId).run();
    } else if (color) {
      await db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ?, color = ? WHERE id = ?'
      ).bind(name, code, color, colId).run();
    } else {
      await db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ? WHERE id = ?'
      ).bind(name, code, colId).run();
    }

    invalidateTitheColumnsCache();
    const columns = await getTitheColumns(db);
    return c.json({ message: 'Column updated successfully', columns });
  } catch (err) {
    return c.json({ error: 'Failed to update column' }, 500);
  }
});

app.delete('/columns/:id', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const colId = parseInt(c.req.param('id'));

  try {
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM tithe_columns').first();
    if ((countRow?.count || 0) <= 1) {
      return c.json({ error: 'Cannot delete the only remaining contribution column. At least 1 column is required.' }, 400);
    }

    await db.prepare('DELETE FROM tithe_columns WHERE id = ?').bind(colId).run();
    invalidateTitheColumnsCache();
    const columns = await getTitheColumns(db);
    return c.json({ message: 'Column deleted successfully', columns });
  } catch (err) {
    return c.json({ error: 'Failed to delete column' }, 500);
  }
});

app.put('/columns/reorder', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  const { orders } = await c.req.json();

  if (!Array.isArray(orders)) {
    return c.json({ error: 'Orders array is required' }, 400);
  }

  try {
    for (const item of orders) {
      if (item.id && item.display_order !== undefined) {
        await db.prepare('UPDATE tithe_columns SET display_order = ? WHERE id = ?').bind(item.display_order, item.id).run();
      }
    }
    invalidateTitheColumnsCache();
    const columns = await getTitheColumns(db);
    return c.json({ message: 'Columns reordered successfully', columns });
  } catch (err) {
    return c.json({ error: 'Failed to reorder columns' }, 500);
  }
});

// ----------------------------------------------------
// TITHES ROUTES
// ----------------------------------------------------
app.get('/tithes', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reqBialId = c.req.query('bial_id');
  const bialId = user.role === 'ADMIN' ? (reqBialId === 'all' ? 'all' : (parseInt(reqBialId) || 'all')) : user.bial_id;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);
  const month = parseInt(c.req.query('month')) || (new Date().getMonth() + 1);

  if (!bialId) return c.json({ error: 'bial_id is required' }, 400);

  try {
    const isAll = bialId === 'all';
    const locked = isAll ? false : await isMonthLocked(db, bialId, year, month);
    const columns = await getTitheColumns(db);

    let rows;
    if (isAll) {
      const { results: allBials } = await db.prepare('SELECT id, name, code FROM bials').all();
      allBials.sort((a, b) => {
        const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
        const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
        return numA - numB;
      });

      const { results: rawRows } = await db.prepare(`
        SELECT
          m.id as member_id,
          m.bial_id,
          b.name as bial_name,
          b.code as bial_code,
          m.sl_no,
          m.name,
          COALESCE(t.id, 0) as tithe_id,
          COALESCE(t.pathian_ram, 0) as pathian_ram,
          COALESCE(t.ramthar, 0) as ramthar,
          COALESCE(t.tualchhung, 0) as tualchhung,
          COALESCE(t.building, 0) as building,
          COALESCE(t.extra_amounts, '{}') as extra_amounts,
          COALESCE(t.total, 0) as total
        FROM members m
        JOIN bials b ON m.bial_id = b.id
        LEFT JOIN tithes t ON m.id = t.member_id AND t.year = ? AND t.month = ?
        WHERE m.year = ?
      `).bind(year, month, year).all();

      const bialOrderMap = new Map();
      allBials.forEach((b, idx) => bialOrderMap.set(b.id, idx));

      rawRows.sort((a, b) => {
        const orderA = bialOrderMap.has(a.bial_id) ? bialOrderMap.get(a.bial_id) : 999;
        const orderB = bialOrderMap.has(b.bial_id) ? bialOrderMap.get(b.bial_id) : 999;
        if (orderA !== orderB) return orderA - orderB;
        if ((a.sl_no || 0) !== (b.sl_no || 0)) return (a.sl_no || 0) - (b.sl_no || 0);
        return a.member_id - b.member_id;
      });

      rows = rawRows.map((m, index) => {
        const extra = m.extra_amounts ? (typeof m.extra_amounts === 'string' ? JSON.parse(m.extra_amounts || '{}') : m.extra_amounts) : {};
        const memberObj = {
          ...m,
          original_sl_no: m.sl_no,
          global_sl_no: index + 1,
          display_sl_no: index + 1,
          sl_no: index + 1
        };
        let rowTotal = 0;
        columns.forEach(col => {
          const val = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)
            ? (parseFloat(m[col.field_key]) || 0)
            : (parseFloat(extra[col.field_key]) || 0);
          memberObj[col.field_key] = val;
          rowTotal += val;
        });
        memberObj.total = rowTotal;
        return memberObj;
      });
    } else {
      const { results: bialRows } = await db.prepare(`
        SELECT
          m.id as member_id,
          m.bial_id,
          b.name as bial_name,
          b.code as bial_code,
          m.sl_no,
          m.name,
          COALESCE(t.id, 0) as tithe_id,
          COALESCE(t.pathian_ram, 0) as pathian_ram,
          COALESCE(t.ramthar, 0) as ramthar,
          COALESCE(t.tualchhung, 0) as tualchhung,
          COALESCE(t.building, 0) as building,
          COALESCE(t.extra_amounts, '{}') as extra_amounts,
          COALESCE(t.total, 0) as total
        FROM members m
        JOIN bials b ON m.bial_id = b.id
        LEFT JOIN tithes t ON m.id = t.member_id AND t.year = ? AND t.month = ?
        WHERE m.bial_id = ? AND m.year = ?
        ORDER BY m.sl_no ASC, m.id ASC
      `).bind(year, month, bialId, year).all();

      rows = bialRows.map(m => {
        const extra = m.extra_amounts ? (typeof m.extra_amounts === 'string' ? JSON.parse(m.extra_amounts || '{}') : m.extra_amounts) : {};
        const memberObj = { ...m };
        let rowTotal = 0;
        columns.forEach(col => {
          const val = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)
            ? (parseFloat(m[col.field_key]) || 0)
            : (parseFloat(extra[col.field_key]) || 0);
          memberObj[col.field_key] = val;
          rowTotal += val;
        });
        memberObj.total = rowTotal;
        return memberObj;
      });
    }

    const summary = { grand_total: 0 };
    columns.forEach(c => { summary[c.field_key] = 0; });
    rows.forEach(r => {
      columns.forEach(c => {
        summary[c.field_key] += (r[c.field_key] || 0);
      });
      summary.grand_total += (r.total || 0);
    });

    summary.sum_pathian_ram = summary.pathian_ram || 0;
    summary.sum_ramthar = summary.ramthar || 0;
    summary.sum_tualchhung = summary.tualchhung || 0;
    summary.sum_building = summary.building || 0;

    return c.json({
      bial_id: bialId,
      year,
      month,
      is_locked: locked,
      members: rows,
      summary,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch tithe records' }, 500);
  }
});

app.post('/tithes/upsert', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json();
  const bialId = user.role === 'ADMIN' ? (parseInt(body.bial_id) || user.bial_id) : user.bial_id;
  const { member_id, year, month } = body;

  if (!bialId || !member_id || !year || !month) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  // IDOR Protection: Verify member belongs to this Bial
  if (user.role !== 'ADMIN') {
    const targetMember = await db.prepare('SELECT id, bial_id FROM members WHERE id = ?').bind(member_id).first();
    if (!targetMember || targetMember.bial_id !== bialId) {
      return c.json({ error: 'Access Denied: Member does not belong to your Bial' }, 403);
    }
  }

  const locked = await isMonthLocked(db, bialId, year, month);
  if (locked && user.role !== 'ADMIN') {
    return c.json({ error: 'Month Locked by Admin. Data entry and edits are restricted.' }, 403);
  }

  const columns = await getTitheColumns(db);

  const pr = cleanNumericInput(body.pathian_ram) || 0;
  const ram = cleanNumericInput(body.ramthar) || 0;
  const tual = cleanNumericInput(body.tualchhung) || 0;
  const bldg = cleanNumericInput(body.building) || 0;

  const extra = {};
  let extraSum = 0;
  columns.forEach(col => {
    if (!['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)) {
      const val = cleanNumericInput(body[col.field_key]) || 0;
      extra[col.field_key] = val;
      extraSum += val;
    }
  });

  const rowTotal = pr + ram + tual + bldg + extraSum;
  const extraJson = JSON.stringify(extra);

  try {
    await db.prepare(`
      INSERT INTO tithes (member_id, bial_id, year, month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(member_id, year, month) DO UPDATE SET
        pathian_ram = excluded.pathian_ram,
        ramthar = excluded.ramthar,
        tualchhung = excluded.tualchhung,
        building = excluded.building,
        extra_amounts = excluded.extra_amounts,
        total = excluded.total,
        updated_at = CURRENT_TIMESTAMP
    `).bind(member_id, bialId, year, month, pr, ram, tual, bldg, extraJson, rowTotal).run();

    const entry = { member_id, year, month, pathian_ram: pr, ramthar: ram, tualchhung: tual, building: bldg, ...extra, total: rowTotal };

    return c.json({
      message: 'Tithe entry saved successfully',
      entry,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to save tithe entry' }, 500);
  }
});

app.post('/tithes/bulk-upsert', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json();
  const bialId = user.role === 'ADMIN' ? (parseInt(body.bial_id) || user.bial_id) : user.bial_id;
  const { entries, year, month } = body;

  if (!bialId || !year || !month || !Array.isArray(entries)) {
    return c.json({ error: 'Invalid payload for bulk save' }, 400);
  }

  // IDOR Protection: Verify all members belong to this Bial
  if (user.role !== 'ADMIN' && entries.length > 0) {
    const memberIds = [...new Set(entries.map(item => item.member_id).filter(Boolean))];
    const chunkSize = 80;
    for (let i = 0; i < memberIds.length; i += chunkSize) {
      const slice = memberIds.slice(i, i + chunkSize);
      const placeholders = slice.map(() => '?').join(',');
      const { results: verifiedRows } = await db.prepare(
        `SELECT id FROM members WHERE bial_id = ? AND id IN (${placeholders})`
      ).bind(bialId, ...slice).all();

      const validSet = new Set((verifiedRows || []).map(r => r.id));
      const invalid = slice.find(id => !validSet.has(id));
      if (invalid) {
        return c.json({ error: `Access Denied: Member ID ${invalid} does not belong to your Bial` }, 403);
      }
    }
  }

  const locked = await isMonthLocked(db, bialId, year, month);
  if (locked && user.role !== 'ADMIN') {
    return c.json({ error: 'Month Locked by Admin. Edits are not allowed.' }, 403);
  }

  const columns = await getTitheColumns(db);

  try {
    const stmts = entries.map(item => {
      const pr = cleanNumericInput(item.pathian_ram) || 0;
      const ram = cleanNumericInput(item.ramthar) || 0;
      const tual = cleanNumericInput(item.tualchhung) || 0;
      const bldg = cleanNumericInput(item.building) || 0;

      const extra = {};
      let extraSum = 0;
      columns.forEach(col => {
        if (!['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)) {
          const val = cleanNumericInput(item[col.field_key]) || 0;
          extra[col.field_key] = val;
          extraSum += val;
        }
      });

      const rowTotal = pr + ram + tual + bldg + extraSum;
      const extraJson = JSON.stringify(extra);

      return db.prepare(`
        INSERT INTO tithes (member_id, bial_id, year, month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(member_id, year, month) DO UPDATE SET
          pathian_ram = excluded.pathian_ram,
          ramthar = excluded.ramthar,
          tualchhung = excluded.tualchhung,
          building = excluded.building,
          extra_amounts = excluded.extra_amounts,
          total = excluded.total,
          updated_at = CURRENT_TIMESTAMP
      `).bind(item.member_id, bialId, year, month, pr, ram, tual, bldg, extraJson, rowTotal);
    });

    const chunkSize = 80;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize));
    }

    return c.json({ message: 'Bulk tithes saved successfully', columns });
  } catch (err) {
    return c.json({ error: 'Failed to complete bulk save' }, 500);
  }
});

app.get('/tithes/yearly-summary', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reqBialId = c.req.query('bial_id');
  const bialId = user.role === 'ADMIN' ? (parseInt(reqBialId) || user.bial_id) : user.bial_id;
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  if (!bialId) return c.json({ error: 'bial_id is required' }, 400);

  try {
    const bial = await db.prepare('SELECT id, name, code FROM bials WHERE id = ?').bind(bialId).first();
    if (!bial) return c.json({ error: 'Bial not found' }, 404);

    const columns = await getTitheColumns(db);
    const activeYear = await getActiveYear(db);
    const financialMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const monthNames = {
      1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
      7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
    };

    // 1. Fetch month locks in ONE single query
    const { results: rawLocks } = await db.prepare(
      'SELECT month, is_locked FROM month_locks WHERE bial_id = ? AND year = ?'
    ).bind(bialId, year).all();
    const lockMap = new Map((rawLocks || []).map(l => [l.month, l.is_locked]));

    // 2. Fetch all members in ONE query
    const { results: memberList } = await db.prepare(`
      SELECT m.id as member_id, m.sl_no, m.name
      FROM members m
      WHERE m.bial_id = ? AND m.year = ?
      ORDER BY m.sl_no ASC, m.id ASC
    `).bind(bialId, year).all();

    // 3. Fetch ALL year tithes for this bial in ONE single query
    const { results: allYearTithes } = await db.prepare(`
      SELECT t.month, t.member_id, t.pathian_ram, t.ramthar, t.tualchhung, t.building, t.extra_amounts, t.total
      FROM tithes t
      WHERE t.bial_id = ? AND t.year = ?
    `).bind(bialId, year).all();

    const tithesList = allYearTithes || [];

    // Group by month in memory
    const monthlyBreakdown = [];
    for (const m of financialMonthOrder) {
      const locked = lockMap.has(m) ? lockMap.get(m) === 1 : (year !== activeYear);
      const mRows = tithesList.filter(t => t.month === m);

      const mSums = { total: 0 };
      columns.forEach(c => { mSums[c.field_key] = 0; });
      mRows.forEach(r => {
        const extra = r.extra_amounts ? (typeof r.extra_amounts === 'string' ? JSON.parse(r.extra_amounts || '{}') : r.extra_amounts) : {};
        columns.forEach(c => {
          const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
            ? (r[c.field_key] || 0)
            : (extra[c.field_key] || 0);
          mSums[c.field_key] += v;
          mSums.total += v;
        });
      });

      mSums.pathian_ram = mSums.pathian_ram || 0;
      mSums.ramthar = mSums.ramthar || 0;
      mSums.tualchhung = mSums.tualchhung || 0;
      mSums.building = mSums.building || 0;

      monthlyBreakdown.push({
        month: m,
        month_name: monthNames[m],
        is_locked: locked ? 1 : 0,
        ...mSums
      });
    }

    const memberMap = new Map();
    tithesList.forEach(t => {
      if (!memberMap.has(t.member_id)) {
        const initial = { grand_total: 0 };
        columns.forEach(c => { initial[c.field_key] = 0; });
        memberMap.set(t.member_id, initial);
      }
      const entry = memberMap.get(t.member_id);
      const extra = t.extra_amounts ? (typeof t.extra_amounts === 'string' ? JSON.parse(t.extra_amounts || '{}') : t.extra_amounts) : {};
      columns.forEach(c => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
          ? (t[c.field_key] || 0)
          : (extra[c.field_key] || 0);
        entry[c.field_key] += v;
        entry.grand_total += v;
      });
    });

    const memberTotals = (memberList || []).map(m => {
      const entry = memberMap.get(m.member_id) || {};
      const resMem = {
        member_id: m.member_id,
        sl_no: m.sl_no,
        name: m.name,
        grand_total: entry.grand_total || 0
      };
      columns.forEach(c => {
        resMem[c.field_key] = entry[c.field_key] || 0;
        resMem[`total_${c.field_key}`] = entry[c.field_key] || 0;
      });
      resMem.total_pathian_ram = resMem.pathian_ram || 0;
      resMem.total_ramthar = resMem.ramthar || 0;
      resMem.total_tualchhung = resMem.tualchhung || 0;
      resMem.total_building = resMem.building || 0;
      return resMem;
    });

    const grandTotals = { grand_total: 0 };
    columns.forEach(c => {
      grandTotals[c.field_key] = memberTotals.reduce((acc, m) => acc + (m[c.field_key] || 0), 0);
      grandTotals[`total_${c.field_key}`] = grandTotals[c.field_key];
    });
    grandTotals.grand_total = memberTotals.reduce((acc, m) => acc + (m.grand_total || 0), 0);
    grandTotals.total_pathian_ram = grandTotals.pathian_ram || 0;
    grandTotals.total_ramthar = grandTotals.ramthar || 0;
    grandTotals.total_tualchhung = grandTotals.tualchhung || 0;
    grandTotals.total_building = grandTotals.building || 0;

    return c.json({
      bial,
      year,
      monthlyBreakdown,
      memberTotals,
      grandTotals,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch yearly summary' }, 500);
  }
});

app.get('/tithes/member-history', authMiddleware, requireBialUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const memberId = parseInt(c.req.query('member_id'));
  const year = parseInt(c.req.query('year')) || await getActiveYear(db);

  if (!memberId) return c.json({ error: 'member_id is required' }, 400);

  try {
    const member = await db.prepare(`
      SELECT m.id, m.sl_no, m.name, m.bial_id, b.name as bial_name, b.code as bial_code
      FROM members m
      JOIN bials b ON m.bial_id = b.id
      WHERE m.id = ?
    `).bind(memberId).first();

    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (user.role !== 'ADMIN' && user.bial_id !== member.bial_id) {
      return c.json({ error: 'Access denied to member outside your Bial' }, 403);
    }

    const columns = await getTitheColumns(db);
    const activeYear = await getActiveYear(db);
    const financialMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const monthNames = {
      1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
      7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
    };

    // 1. Fetch month locks for this bial/year in ONE query
    const { results: rawLocks } = await db.prepare(
      'SELECT month, is_locked FROM month_locks WHERE bial_id = ? AND year = ?'
    ).bind(member.bial_id, year).all();
    const lockMap = new Map((rawLocks || []).map(l => [l.month, l.is_locked]));

    // 2. Fetch member tithes for the entire year in ONE query
    const { results: memberTithes } = await db.prepare(`
      SELECT month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total
      FROM tithes
      WHERE member_id = ? AND year = ?
    `).bind(memberId, year).all();
    const tithesByMonth = new Map((memberTithes || []).map(t => [t.month, t]));

    const monthlyEntries = [];
    const annualSummary = { grand_total: 0 };
    columns.forEach(c => {
      annualSummary[c.field_key] = 0;
      annualSummary[`total_${c.field_key}`] = 0;
    });

    for (const m of financialMonthOrder) {
      const isLocked = lockMap.has(m) ? lockMap.get(m) === 1 : (year !== activeYear);
      const entry = tithesByMonth.get(m);

      const extra = entry?.extra_amounts ? (typeof entry.extra_amounts === 'string' ? JSON.parse(entry.extra_amounts || '{}') : entry.extra_amounts) : {};
      const mObj = {
        month: m,
        month_name: monthNames[m],
        is_locked: isLocked ? 1 : 0,
        total: 0
      };

      columns.forEach(c => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
          ? (entry ? (entry[c.field_key] || 0) : 0)
          : (extra[c.field_key] || 0);
        mObj[c.field_key] = v;
        mObj.total += v;
        annualSummary[c.field_key] += v;
        annualSummary[`total_${c.field_key}`] += v;
      });
      annualSummary.grand_total += mObj.total;

      mObj.pathian_ram = mObj.pathian_ram || 0;
      mObj.ramthar = mObj.ramthar || 0;
      mObj.tualchhung = mObj.tualchhung || 0;
      mObj.building = mObj.building || 0;

      monthlyEntries.push(mObj);
    }

    annualSummary.total_pathian_ram = annualSummary.pathian_ram || 0;
    annualSummary.total_ramthar = annualSummary.ramthar || 0;
    annualSummary.total_tualchhung = annualSummary.tualchhung || 0;
    annualSummary.total_building = annualSummary.building || 0;

    return c.json({
      member,
      year,
      monthlyEntries,
      annualSummary,
      columns
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch member payment history' }, 500);
  }
});

// ----------------------------------------------------
// BACKUP & RESTORE ROUTES
// ----------------------------------------------------
app.post('/backup/now', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  try {
    const { results: users } = await db.prepare('SELECT id, username, password_hash, role, bial_name, status, created_at FROM users').all();
    const { results: bials } = await db.prepare('SELECT id, name, code, user_id, created_at FROM bials').all();
    const { results: members } = await db.prepare('SELECT id, bial_id, year, sl_no, name, created_at FROM members').all();
    const { results: month_locks } = await db.prepare('SELECT id, bial_id, year, month, is_locked, updated_at FROM month_locks').all();
    const { results: tithes } = await db.prepare('SELECT id, member_id, bial_id, year, month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total, updated_at FROM tithes').all();
    let tithe_columns = [];
    try {
      const colRes = await db.prepare('SELECT id, name, code, field_key, color, display_order FROM tithe_columns').all();
      tithe_columns = colRes.results || [];
    } catch (e) {}

    const snapshot = {
      app: 'PATHIAN_RAM_TITHE_COLLECTION',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      stats: {
        users_count: users.length,
        bials_count: bials.length,
        members_count: members.length,
        tithes_count: tithes.length,
        columns_count: tithe_columns.length
      },
      data: { users, bials, members, month_locks, tithes, tithe_columns }
    };

    const fileName = `pathian_ram_backup_${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (err) {
    return c.json({ error: 'Failed to generate cloud database snapshot' }, 500);
  }
});

app.get('/backup/list', authMiddleware, requireAdmin, async (c) => {
  return c.json([]);
});

app.post('/backup/restore', authMiddleware, requireAdmin, async (c) => {
  const db = c.env.DB;
  try {
    const body = await c.req.parseBody();
    const file = body['backup_file'];
    if (!file) return c.json({ error: 'No backup file provided' }, 400);

    const text = typeof file === 'string' ? file : await file.text();
    const snapshot = JSON.parse(text);

    if (!snapshot || !snapshot.data) {
      return c.json({ error: 'Invalid backup JSON file structure' }, 400);
    }

    const { users, bials, members, month_locks, tithes, tithe_columns } = snapshot.data;

    // Execute atomic clear and restore
    const clearStmts = [
      db.prepare('DELETE FROM tithes'),
      db.prepare('DELETE FROM month_locks'),
      db.prepare('DELETE FROM members'),
      db.prepare('DELETE FROM bials'),
      db.prepare('DELETE FROM users')
    ];
    try {
      clearStmts.push(db.prepare('DELETE FROM tithe_columns'));
    } catch (e) {}
    await db.batch(clearStmts);

    if (tithe_columns && tithe_columns.length) {
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS tithe_columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            field_key TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT '#6366f1',
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        const colStmts = tithe_columns.map(c =>
          db.prepare('INSERT INTO tithe_columns (id, name, code, field_key, color, display_order) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(c.id, c.name, c.code, c.field_key, c.color || '#6366f1', c.display_order || 0)
        );
        await db.batch(colStmts);
      } catch (err) {}
    }

    const userStmts = (users || []).map(u =>
      db.prepare('INSERT INTO users (id, username, password_hash, role, bial_name, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(u.id, u.username, u.password_hash, u.role, u.bial_name, u.status || 'active')
    );
    if (userStmts.length) await db.batch(userStmts);

    const bialStmts = (bials || []).map(b =>
      db.prepare('INSERT INTO bials (id, name, code, user_id) VALUES (?, ?, ?, ?)')
        .bind(b.id, b.name, b.code, b.user_id)
    );
    if (bialStmts.length) await db.batch(bialStmts);

    const memberStmts = (members || []).map(m =>
      db.prepare('INSERT INTO members (id, bial_id, year, sl_no, name) VALUES (?, ?, ?, ?, ?)')
        .bind(m.id, m.bial_id, m.year || 2026, m.sl_no, m.name)
    );
    for (let i = 0; i < memberStmts.length; i += 80) {
      await db.batch(memberStmts.slice(i, i + 80));
    }

    const lockStmts = (month_locks || []).map(l =>
      db.prepare('INSERT INTO month_locks (id, bial_id, year, month, is_locked) VALUES (?, ?, ?, ?, ?)')
        .bind(l.id, l.bial_id, l.year, l.month, l.is_locked)
    );
    for (let i = 0; i < lockStmts.length; i += 80) {
      await db.batch(lockStmts.slice(i, i + 80));
    }

    const titheStmts = (tithes || []).map(t =>
      db.prepare('INSERT INTO tithes (id, member_id, bial_id, year, month, pathian_ram, ramthar, tualchhung, building, extra_amounts, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(t.id, t.member_id, t.bial_id, t.year, t.month, t.pathian_ram || 0, t.ramthar || 0, t.tualchhung || 0, t.building || 0, t.extra_amounts || '{}', t.total || 0)
    );
    for (let i = 0; i < titheStmts.length; i += 80) {
      await db.batch(titheStmts.slice(i, i + 80));
    }

    return c.json({
      message: 'Cloud database restored successfully from snapshot',
      restored: {
        users: users?.length || 0,
        bials: bials?.length || 0,
        members: members?.length || 0,
        tithes: tithes?.length || 0
      }
    });
  } catch (err) {
    return c.json({ error: err.message || 'Failed to restore snapshot' }, 500);
  }
});

export const onRequest = handle(app);
