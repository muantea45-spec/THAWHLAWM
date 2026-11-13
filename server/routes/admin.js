import express from 'express';
import bcrypt from 'bcryptjs';
import { db, getTitheColumns } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper to get active financial year
function getActiveYear() {
  try {
    const row = db.prepare('SELECT year FROM financial_years WHERE is_active = 1 LIMIT 1').get();
    return row ? row.year : new Date().getFullYear();
  } catch (e) {
    return new Date().getFullYear();
  }
}

// Apply auth middleware to all admin routes
router.use(authenticateToken, requireAdmin);

// GET /api/admin/bials - List all Bials with statistics
router.get('/bials', (req, res) => {
  const year = parseInt(req.query.year) || getActiveYear();
  try {
    const bials = db.prepare(`
      SELECT b.id, b.name, b.code, b.user_id, u.username, u.status, u.created_at,
      (SELECT COUNT(*) FROM members m WHERE m.bial_id = b.id AND m.year = ?) as member_count,
      (SELECT COALESCE(SUM(t.total), 0) FROM tithes t WHERE t.bial_id = b.id AND t.year = ?) as total_collected
      FROM bials b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.id ASC
    `).all(year, year);

    // Natural sort by code number (B1, B2, ..., B12) or ID
    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    res.json(bials);
  } catch (err) {
    console.error('Error fetching bials:', err);
    res.status(500).json({ error: 'Failed to fetch Bials' });
  }
});

// POST /api/admin/bials - Create new Bial account
router.post('/bials', (req, res) => {
  const { name, code, username, password } = req.body;

  if (!name || !code || !username || !password) {
    return res.status(400).json({ error: 'All fields (name, code, username, password) are required' });
  }

  try {
    // Check if username or bial name exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingBial = db.prepare('SELECT id FROM bials WHERE name = ?').get(name.trim());
    if (existingBial) {
      return res.status(400).json({ error: 'Bial name already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // Create User
    const userRes = db.prepare(`
      INSERT INTO users (username, password_hash, role, bial_name, status)
      VALUES (?, ?, 'BIAL', ?, 'active')
    `).run(username.trim(), hash, name.trim());

    // Create Bial
    const bialRes = db.prepare(`
      INSERT INTO bials (name, code, user_id)
      VALUES (?, ?, ?)
    `).run(name.trim(), code.trim(), userRes.lastInsertRowid);

    res.status(201).json({
      message: 'Bial account created successfully',
      bial: {
        id: bialRes.lastInsertRowid,
        name: name.trim(),
        code: code.trim(),
        username: username.trim()
      }
    });
  } catch (err) {
    console.error('Error creating bial:', err);
    res.status(500).json({ error: 'Failed to create Bial account' });
  }
});

// PUT /api/admin/bials/:id - Update Bial account details or lock/unlock account
router.put('/bials/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, username, password, status } = req.body;

  try {
    const bial = db.prepare('SELECT * FROM bials WHERE id = ?').get(id);
    if (!bial) {
      return res.status(404).json({ error: 'Bial not found' });
    }

    if (name) {
      db.prepare('UPDATE bials SET name = ? WHERE id = ?').run(name.trim(), id);
      db.prepare('UPDATE users SET bial_name = ? WHERE id = ?').run(name.trim(), bial.user_id);
    }
    if (code) {
      db.prepare('UPDATE bials SET code = ? WHERE id = ?').run(code.trim(), id);
    }
    if (username) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), bial.user_id);
    }
    if (status && (status === 'active' || status === 'locked')) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, bial.user_id);
    }
    if (password && password.length > 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, bial.user_id);
    }

    res.json({ message: 'Bial account updated successfully' });
  } catch (err) {
    console.error('Error updating bial:', err);
    res.status(500).json({ error: 'Failed to update Bial' });
  }
});

// DELETE /api/admin/bials/:id - Delete Bial account and all associated data
router.delete('/bials/:id', (req, res) => {
  const { id } = req.params;

  try {
    const bial = db.prepare('SELECT * FROM bials WHERE id = ?').get(id);
    if (!bial) {
      return res.status(404).json({ error: 'Bial not found' });
    }

    // Cascading deletes handled by foreign keys or manual cleanup
    db.prepare('DELETE FROM tithes WHERE bial_id = ?').run(id);
    db.prepare('DELETE FROM members WHERE bial_id = ?').run(id);
    db.prepare('DELETE FROM month_locks WHERE bial_id = ?').run(id);
    db.prepare('DELETE FROM bials WHERE id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(bial.user_id);

    res.json({ message: 'Bial deleted successfully' });
  } catch (err) {
    console.error('Error deleting bial:', err);
    res.status(500).json({ error: 'Failed to delete Bial' });
  }
});

// GET /api/admin/month-locks?year=2026 - Fetch month locks matrix
router.get('/month-locks', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    const bials = db.prepare('SELECT id, name, code FROM bials ORDER BY id ASC').all();
    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });
    const locks = db.prepare('SELECT * FROM month_locks WHERE year = ?').all(year);

    // Build lock matrix mapping: { [bial_id]: { [month]: is_locked } }
    const matrix = {};

    // Initialize with 0 (unlocked) for all bials and months 1-12
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

    res.json({
      year,
      bials,
      matrix
    });
  } catch (err) {
    console.error('Error fetching month locks:', err);
    res.status(500).json({ error: 'Failed to fetch month locks matrix' });
  }
});

// POST /api/admin/month-locks/toggle - Toggle single Bial month lock or Global month lock
router.post('/month-locks/toggle', (req, res) => {
  const { bial_id, year, month, is_locked, global_toggle } = req.body;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const targetMonth = parseInt(month);

  if (!targetMonth || targetMonth < 1 || targetMonth > 12) {
    return res.status(400).json({ error: 'Invalid month (1-12 required)' });
  }

  try {
    if (global_toggle) {
      // Toggle for ALL bials for this month and year
      const bials = db.prepare('SELECT id FROM bials').all();
      const lockVal = is_locked ? 1 : 0;

      for (const b of bials) {
        db.prepare(`
          INSERT INTO month_locks (bial_id, year, month, is_locked, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(bial_id, year, month) DO UPDATE SET
            is_locked = excluded.is_locked,
            updated_at = CURRENT_TIMESTAMP
        `).run(b.id, targetYear, targetMonth, lockVal);
      }

      return res.json({
        message: `Global lock for month ${targetMonth} set to ${lockVal ? 'LOCKED' : 'UNLOCKED'}`
      });
    } else {
      // Single Bial toggle
      if (!bial_id) {
        return res.status(400).json({ error: 'bial_id is required' });
      }

      const lockVal = is_locked ? 1 : 0;
      db.prepare(`
        INSERT INTO month_locks (bial_id, year, month, is_locked, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(bial_id, year, month) DO UPDATE SET
          is_locked = excluded.is_locked,
          updated_at = CURRENT_TIMESTAMP
      `).run(bial_id, targetYear, targetMonth, lockVal);

      return res.json({
        message: `Bial lock updated for month ${targetMonth}`
      });
    }
  } catch (err) {
    console.error('Error toggling month lock:', err);
    res.status(500).json({ error: 'Failed to update month lock' });
  }
});

// GET /api/admin/dashboard - Aggregated Global Analytics with optional Bial & Month filters
router.get('/dashboard', (req, res) => {
  const year = parseInt(req.query.year) || getActiveYear();
  const bialId = req.query.bial_id && req.query.bial_id !== 'all' ? parseInt(req.query.bial_id) : null;
  const month = req.query.month && req.query.month !== 'all' ? parseInt(req.query.month) : null;

  try {
    const columns = getTitheColumns();

    let whereClause = 'WHERE year = ?';
    const params = [year];

    if (bialId) {
      whereClause += ' AND bial_id = ?';
      params.push(bialId);
    }
    if (month) {
      whereClause += ' AND month = ?';
      params.push(month);
    }

    const allMatchingTithes = db.prepare(`
      SELECT pathian_ram, ramthar, tualchhung, building, extra_amounts, total
      FROM tithes
      ${whereClause}
    `).all(...params);

    const grandTotals = { grand_total: 0 };
    columns.forEach(col => {
      grandTotals[col.field_key] = 0;
      grandTotals[`total_${col.field_key}`] = 0;
    });

    (allMatchingTithes || []).forEach(t => {
      const extra = t.extra_amounts ? (typeof t.extra_amounts === 'string' ? JSON.parse(t.extra_amounts || '{}') : t.extra_amounts) : {};
      columns.forEach(col => {
        const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)
          ? (t[col.field_key] || 0)
          : (extra[col.field_key] || 0);
        grandTotals[col.field_key] += v;
        grandTotals[`total_${col.field_key}`] += v;
      });
      grandTotals.grand_total += (t.total || 0);
    });

    // Backward-compat keys:
    grandTotals.total_pathian_ram = grandTotals.pathian_ram || 0;
    grandTotals.total_ramthar = grandTotals.ramthar || 0;
    grandTotals.total_tualchhung = grandTotals.tualchhung || 0;
    grandTotals.total_building = grandTotals.building || 0;

    let bialWhere = '';
    const subParams = [year];
    if (month) subParams.push(month);

    const mainParams = [year];
    if (month) mainParams.push(month);

    if (bialId) {
      bialWhere = 'WHERE b.id = ?';
    }

    const monthFilterTithe = month ? 'AND t.month = ?' : '';
    const monthFilterT2 = month ? 'AND t2.month = ?' : '';

    const queryParams = [...subParams, ...mainParams];
    if (bialId) {
      queryParams.push(bialId);
    }

    const rawBialBreakdown = db.prepare(`
      SELECT
        b.id,
        b.name,
        b.code,
        COALESCE(SUM(t.pathian_ram), 0) as pathian_ram,
        COALESCE(SUM(t.ramthar), 0) as ramthar,
        COALESCE(SUM(t.tualchhung), 0) as tualchhung,
        COALESCE(SUM(t.building), 0) as building,
        COALESCE(SUM(t.total), 0) as total,
        (SELECT COUNT(*) FROM members m WHERE m.bial_id = b.id AND m.year = ${year}) as total_members,
        (SELECT COUNT(DISTINCT t2.member_id) FROM tithes t2 WHERE t2.bial_id = b.id AND t2.year = ? ${monthFilterT2} AND t2.total > 0) as returned_members
      FROM bials b
      LEFT JOIN tithes t ON b.id = t.bial_id AND t.year = ? ${monthFilterTithe}
      ${bialWhere}
      GROUP BY b.id
      ORDER BY total DESC, b.name ASC
    `).all(...queryParams);

    // Query extra amounts per bial to enrich breakdown
    const rawBialTithes = db.prepare(`
      SELECT t.bial_id, t.pathian_ram, t.ramthar, t.tualchhung, t.building, t.extra_amounts, t.total
      FROM tithes t
      WHERE t.year = ? ${month ? 'AND t.month = ' + month : ''}
    `).all(year);

    const bialTotalsMap = new Map();
    (rawBialTithes || []).forEach(t => {
      if (!bialTotalsMap.has(t.bial_id)) {
        const init = { total: 0 };
        columns.forEach(c => { init[c.field_key] = 0; });
        bialTotalsMap.set(t.bial_id, init);
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
    });

    const grandTotalVal = grandTotals?.grand_total || 0;

    const bialBreakdown = rawBialBreakdown.map(b => {
      const bSums = bialTotalsMap.get(b.id) || {};
      const return_rate = b.total_members > 0 ? Math.round((b.returned_members / b.total_members) * 1000) / 10 : 0;
      const bTotal = bSums.total !== undefined ? bSums.total : b.total;
      const percentage_share = grandTotalVal > 0 ? Math.round((bTotal / grandTotalVal) * 1000) / 10 : 0;
      const avg_per_member = b.returned_members > 0 ? Math.round(bTotal / b.returned_members) : 0;

      const resB = {
        ...b,
        total: bTotal,
        return_rate,
        percentage_share,
        avg_per_member
      };
      columns.forEach(c => {
        resB[c.field_key] = bSums[c.field_key] || b[c.field_key] || 0;
        resB[`total_${c.field_key}`] = resB[c.field_key];
      });
      return resB;
    });

    // Natural sort by code (Bial 1 to Bial 12)
    bialBreakdown.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    // Total registered members across system (or filtered Bial) for this financial year
    let memberCountWhere = 'WHERE year = ?';
    const memberCountParams = [year];
    if (bialId) {
      memberCountWhere += ' AND bial_id = ?';
      memberCountParams.push(bialId);
    }
    const systemMembersRes = db.prepare(`SELECT COUNT(*) as count FROM members ${memberCountWhere}`).get(...memberCountParams);
    const total_system_members = systemMembersRes?.count || 0;

    // Distinct returning members across system (or filtered Bial) matching filters
    const returnedMembersRes = db.prepare(`
      SELECT COUNT(DISTINCT member_id) as count
      FROM tithes
      ${whereClause} AND total > 0
    `).get(...params);
    const total_returned_members = returnedMembersRes?.count || 0;

    const overall_return_rate = total_system_members > 0 
      ? Math.round((total_returned_members / total_system_members) * 1000) / 10 
      : 0;

    const avg_contribution_per_member = total_returned_members > 0 
      ? Math.round(grandTotalVal / total_returned_members) 
      : 0;

    // Identify top contributing Bial
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

    // Monthly breakdown (Jan - Dec)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = [];

    for (let m = 1; m <= 12; m++) {
      let mWhere = 'WHERE year = ? AND month = ?';
      const mParams = [year, m];
      if (bialId) {
        mWhere += ' AND bial_id = ?';
        mParams.push(bialId);
      }

      const mTithes = db.prepare(`
        SELECT pathian_ram, ramthar, tualchhung, building, extra_amounts, total, member_id
        FROM tithes
        ${mWhere}
      `).all(...mParams);

      const mSums = { total: 0 };
      columns.forEach(c => { mSums[c.field_key] = 0; });
      const returnedMemberSet = new Set();
      (mTithes || []).forEach(r => {
        const extra = r.extra_amounts ? (typeof r.extra_amounts === 'string' ? JSON.parse(r.extra_amounts || '{}') : r.extra_amounts) : {};
        columns.forEach(c => {
          const v = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(c.field_key)
            ? (r[c.field_key] || 0)
            : (extra[c.field_key] || 0);
          mSums[c.field_key] += v;
        });
        mSums.total += (r.total || 0);
        if (r.total > 0) returnedMemberSet.add(r.member_id);
      });

      // Backward-compat keys:
      mSums.pathian_ram = mSums.pathian_ram || 0;
      mSums.ramthar = mSums.ramthar || 0;
      mSums.tualchhung = mSums.tualchhung || 0;
      mSums.building = mSums.building || 0;

      const returnedCount = returnedMemberSet.size;
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

    res.json({
      year,
      grandTotals: enrichedGrandTotals,
      bialBreakdown,
      monthlyTrends,
      filteredBialId: bialId,
      filteredMonth: month,
      columns
    });
  } catch (err) {
    console.error('Error fetching admin dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/years - List all configured Financial Years with active status
router.get('/years', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, year, is_active FROM financial_years ORDER BY year ASC').all();
    const years = rows.map(r => r.year);
    const activeRow = rows.find(r => r.is_active === 1) || rows[rows.length - 1];
    const activeYear = activeRow ? activeRow.year : new Date().getFullYear();

    res.json({
      years: years.length > 0 ? years : [2024, 2025, 2026, 2027],
      yearDetails: rows,
      activeYear
    });
  } catch (err) {
    console.error('Error fetching financial years:', err);
    res.status(500).json({ error: 'Failed to fetch financial years' });
  }
});

// PUT /api/admin/years/active - Set a specific Financial Year as Active
router.put('/years/active', (req, res) => {
  const { year } = req.body;
  const numYear = parseInt(year);

  if (isNaN(numYear)) {
    return res.status(400).json({ error: 'Valid financial year is required' });
  }

  try {
    const existing = db.prepare('SELECT id FROM financial_years WHERE year = ?').get(numYear);
    if (!existing) {
      return res.status(404).json({ error: `Financial Year ${numYear} not found` });
    }

    db.prepare('UPDATE financial_years SET is_active = CASE WHEN year = ? THEN 1 ELSE 0 END').run(numYear);
    res.json({ message: `Financial Year ${numYear} is now the active financial year`, activeYear: numYear });
  } catch (err) {
    console.error('Error setting active financial year:', err);
    res.status(500).json({ error: 'Failed to set active financial year' });
  }
});

// POST /api/admin/years - Add a new Financial Year
router.post('/years', (req, res) => {
  const { year, set_active } = req.body;
  const numYear = parseInt(year);

  if (isNaN(numYear) || numYear < 2000 || numYear > 2100) {
    return res.status(400).json({ error: 'Valid 4-digit financial year required (e.g., 2026)' });
  }

  try {
    const existing = db.prepare('SELECT id FROM financial_years WHERE year = ?').get(numYear);
    if (existing) {
      return res.status(400).json({ error: `Financial Year ${numYear} already exists` });
    }

    const isActiveVal = set_active ? 1 : 0;
    if (isActiveVal === 1) {
      db.prepare('UPDATE financial_years SET is_active = 0').run();
    }

    db.prepare('INSERT INTO financial_years (year, is_active) VALUES (?, ?)').run(numYear, isActiveVal);
    res.status(201).json({ message: `Financial Year ${numYear} added successfully`, year: numYear, is_active: isActiveVal });
  } catch (err) {
    console.error('Error adding financial year:', err);
    res.status(500).json({ error: 'Failed to add financial year' });
  }
});

// DELETE /api/admin/years/:year - Delete a Financial Year
router.delete('/years/:year', (req, res) => {
  const numYear = parseInt(req.params.year);
  if (isNaN(numYear)) {
    return res.status(400).json({ error: 'Invalid financial year' });
  }

  try {
    const countRes = db.prepare('SELECT COUNT(*) as count FROM financial_years').get();
    if (countRes.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining Financial Year' });
    }

    const yearToDelete = db.prepare('SELECT is_active FROM financial_years WHERE year = ?').get(numYear);
    db.prepare('DELETE FROM financial_years WHERE year = ?').run(numYear);

    // If deleted year was active, activate the latest remaining year
    if (yearToDelete && yearToDelete.is_active === 1) {
      const latest = db.prepare('SELECT id FROM financial_years ORDER BY year DESC LIMIT 1').get();
      if (latest) {
        db.prepare('UPDATE financial_years SET is_active = 1 WHERE id = ?').run(latest.id);
      }
    }

    res.json({ message: `Financial Year ${numYear} deleted successfully` });
  } catch (err) {
    console.error('Error deleting financial year:', err);
    res.status(500).json({ error: 'Failed to delete financial year' });
  }
});

// GET /api/admin/overall-member-contributions - Aggregated Full Year contributions per member grouped by Bial
router.get('/overall-member-contributions', (req, res) => {
  const year = parseInt(req.query.year) || getActiveYear();

  try {
    const columns = getTitheColumns();
    const bials = db.prepare('SELECT id, name, code FROM bials ORDER BY id ASC').all();
    bials.sort((a, b) => {
      const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
      const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
      return numA - numB;
    });

    const data = [];
    const churchGrandTotal = { grand_total: 0 };
    columns.forEach(col => {
      churchGrandTotal[col.field_key] = 0;
      churchGrandTotal[`total_${col.field_key}`] = 0;
    });
    let totalMemberCount = 0;

    for (const b of bials) {
      const rawMembers = db.prepare(`
        SELECT m.id as member_id, m.sl_no, m.name as member_name
        FROM members m
        WHERE m.bial_id = ? AND m.year = ?
        ORDER BY m.sl_no ASC, m.id ASC
      `).all(b.id, year);

      const allBialYearTithes = db.prepare(`
        SELECT t.member_id, t.pathian_ram, t.ramthar, t.tualchhung, t.building, t.extra_amounts, t.total
        FROM tithes t
        WHERE t.bial_id = ? AND t.year = ?
      `).all(b.id, year);

      const memberTithesMap = new Map();
      (allBialYearTithes || []).forEach(t => {
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

      const bialSubtotal = { grand_total: 0 };
      columns.forEach(c => {
        bialSubtotal[c.field_key] = 0;
        bialSubtotal[`total_${c.field_key}`] = 0;
      });

      const processedMembers = (rawMembers || []).map(m => {
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

    res.json({
      year,
      totalMemberCount,
      bials: data,
      churchGrandTotal,
      columns
    });
  } catch (err) {
    console.error('Error fetching overall member contributions:', err);
    res.status(500).json({ error: 'Failed to fetch overall member contributions' });
  }
});

// GET /api/admin/members/all - Get all members across all Bials with summary
router.get('/members/all', (req, res) => {
  const year = parseInt(req.query.year);
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
        (SELECT COUNT(*) FROM tithes t WHERE t.member_id = m.id) as tithe_records_count,
        (SELECT COALESCE(SUM(total), 0) FROM tithes t WHERE t.member_id = m.id) as total_contributed
      FROM members m
      JOIN bials b ON m.bial_id = b.id
    `;
    const params = [];
    if (year && !isNaN(year)) {
      query += ` WHERE m.year = ?`;
      params.push(year);
    }
    query += ` ORDER BY b.name ASC, m.sl_no ASC, m.id ASC`;

    const members = db.prepare(query).all(...params);
    res.json(members);
  } catch (err) {
    console.error('Error fetching all members:', err);
    res.status(500).json({ error: 'Failed to fetch all members' });
  }
});

// POST /api/admin/members/transfer - Transfer a member from one Bial to another with simultaneous update of all data
router.post('/members/transfer', (req, res) => {
  const { member_id, target_bial_id, new_sl_no } = req.body;
  const memberId = parseInt(member_id);
  const targetBialId = parseInt(target_bial_id);

  if (!memberId || isNaN(memberId)) {
    return res.status(400).json({ error: 'Valid member_id is required' });
  }

  if (!targetBialId || isNaN(targetBialId)) {
    return res.status(400).json({ error: 'Valid target_bial_id is required' });
  }

  try {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const sourceBial = db.prepare('SELECT id, name, code FROM bials WHERE id = ?').get(member.bial_id);
    const destinationBial = db.prepare('SELECT id, name, code FROM bials WHERE id = ?').get(targetBialId);

    if (!destinationBial) {
      return res.status(404).json({ error: 'Destination Bial not found' });
    }

    if (member.bial_id === targetBialId) {
      return res.status(400).json({ error: `Member "${member.name}" is already in ${destinationBial.name}` });
    }

    // Determine new Sl No in destination Bial if not explicitly provided
    let assignedSlNo = parseInt(new_sl_no);
    if (isNaN(assignedSlNo) || assignedSlNo <= 0) {
      const maxSl = db.prepare('SELECT COALESCE(MAX(sl_no), 0) as max_sl FROM members WHERE bial_id = ?').get(targetBialId);
      assignedSlNo = (maxSl ? maxSl.max_sl : 0) + 1;
    }

    // Execute atomic transfer across members and tithes tables
    db.exec('BEGIN TRANSACTION;');

    try {
      // 1. Update member's Bial and serial number
      db.prepare('UPDATE members SET bial_id = ?, sl_no = ? WHERE id = ?').run(targetBialId, assignedSlNo, memberId);

      // 2. Simultaneously update all tithe history for this member to the destination Bial
      const titheUpdate = db.prepare('UPDATE tithes SET bial_id = ? WHERE member_id = ?').run(targetBialId, memberId);

      db.exec('COMMIT;');

      res.json({
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
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    console.error('Error transferring member:', err);
    res.status(500).json({ error: err.message || 'Failed to transfer member' });
  }
});

// GET /api/admin/google-emails
router.get('/google-emails', (req, res) => {
  try {
    const emails = db.prepare("SELECT id, email, created_at FROM admin_google_emails ORDER BY id ASC").all();
    const primaryAdmin = db.prepare("SELECT email FROM users WHERE role = 'ADMIN' AND email IS NOT NULL LIMIT 1").get();
    res.json({
      emails: emails || [],
      primaryAdminEmail: primaryAdmin ? primaryAdmin.email : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin Google emails' });
  }
});

// POST /api/admin/google-emails
router.post('/google-emails', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    db.prepare("INSERT INTO admin_google_emails (email) VALUES (?)").run(cleanEmail);
    res.json({ message: 'Admin Google email authorized successfully', email: cleanEmail });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add admin email or email already exists' });
  }
});

// DELETE /api/admin/google-emails/:id
router.delete('/google-emails/:id', (req, res) => {
  const id = parseInt(req.params.id);
  try {
    db.prepare("DELETE FROM admin_google_emails WHERE id = ?").run(id);
    res.json({ message: 'Authorized admin email removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete admin email' });
  }
});

export default router;

