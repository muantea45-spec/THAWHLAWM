import express from 'express';
import { db, getTitheColumns } from '../db/database.js';
import { authenticateToken, requireBialUser } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, requireBialUser);

// Helper function to resolve target Bial ID
function getTargetBialId(req) {
  if (req.user.role === 'ADMIN') {
    const qVal = req.query.bial_id || req.body.bial_id;
    if (qVal === 'all') return 'all';
    return parseInt(qVal);
  }
  return req.user.bial_id;
}

// Helper function to check if a month is locked
function isMonthLocked(bialId, year, month) {
  if (bialId === 'all') return false;
  const targetBialId = parseInt(bialId);
  const targetYear = parseInt(year);
  const targetMonth = parseInt(month);

  // 1. Check explicit month_locks entry first
  const lock = db.prepare(`
    SELECT is_locked FROM month_locks
    WHERE bial_id = ? AND year = ? AND month = ?
  `).get(targetBialId, targetYear, targetMonth);

  if (lock !== undefined && lock !== null) {
    return lock.is_locked === 1;
  }

  // 2. If no explicit lock record, check if this year is the active financial year
  try {
    const activeYearRow = db.prepare('SELECT year FROM financial_years WHERE is_active = 1 LIMIT 1').get();
    if (activeYearRow && targetYear !== activeYearRow.year) {
      return true;
    }
  } catch (e) {
    // ignore
  }

  return false;
}

// Helper validation function for strictly numeric digits-only non-negative values
function cleanNumericInput(val) {
  if (val === null || val === undefined || val === '') return 0;
  const strVal = String(val).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(strVal)) {
    return null;
  }
  const parsed = parseFloat(strVal);
  return isNaN(parsed) || parsed < 0 ? null : parsed;
}

// GET /api/tithes?bial_id=X&year=2026&month=1 - Get monthly ledger for Bial (or All Bials)
router.get('/', (req, res) => {
  const bialId = getTargetBialId(req);
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  if (!bialId) {
    return res.status(400).json({ error: 'bial_id is required' });
  }

  try {
    const isAll = bialId === 'all';
    const locked = isAll ? false : isMonthLocked(bialId, year, month);
    const columns = getTitheColumns();

    let rows;
    if (isAll) {
      const allBials = db.prepare('SELECT id, name, code FROM bials').all();
      allBials.sort((a, b) => {
        const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
        const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
        return numA - numB;
      });

      const rawRows = db.prepare(`
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
      `).all(year, month, year);

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
      const bialRows = db.prepare(`
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
      `).all(year, month, bialId, year);

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

    res.json({
      bial_id: bialId,
      year,
      month,
      is_locked: locked,
      members: rows,
      summary,
      columns
    });
  } catch (err) {
    console.error('Error fetching tithes ledger:', err);
    res.status(500).json({ error: 'Failed to fetch tithe records' });
  }
});

// POST /api/tithes/upsert - Single member tithe update
router.post('/upsert', (req, res) => {
  const { member_id, year, month } = req.body;
  const bialId = getTargetBialId(req);

  if (!bialId || !member_id || !year || !month) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (isMonthLocked(bialId, year, month) && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Month Locked by Admin. Data entry and edits are restricted.' });
  }

  const columns = getTitheColumns();
  const pr = cleanNumericInput(req.body.pathian_ram) || 0;
  const ram = cleanNumericInput(req.body.ramthar) || 0;
  const tual = cleanNumericInput(req.body.tualchhung) || 0;
  const bldg = cleanNumericInput(req.body.building) || 0;

  const extra = {};
  let extraSum = 0;
  columns.forEach(col => {
    if (!['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key)) {
      const val = cleanNumericInput(req.body[col.field_key]) || 0;
      extra[col.field_key] = val;
      extraSum += val;
    }
  });

  const rowTotal = pr + ram + tual + bldg + extraSum;
  const extraJson = JSON.stringify(extra);

  try {
    db.prepare(`
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
    `).run(member_id, bialId, year, month, pr, ram, tual, bldg, extraJson, rowTotal);

    res.json({
      message: 'Tithe entry saved successfully',
      entry: {
        member_id,
        year,
        month,
        pathian_ram: pr,
        ramthar: ram,
        tualchhung: tual,
        building: bldg,
        ...extra,
        total: rowTotal
      },
      columns
    });
  } catch (err) {
    console.error('Error saving tithe entry:', err);
    res.status(500).json({ error: 'Failed to save tithe entry' });
  }
});

// POST /api/tithes/bulk-upsert - Save whole monthly matrix in single batch
router.post('/bulk-upsert', (req, res) => {
  const { entries, year, month } = req.body;
  const bialId = getTargetBialId(req);

  if (!bialId || !year || !month || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid payload for bulk save' });
  }

  if (isMonthLocked(bialId, year, month) && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Month Locked by Admin. Edits are not allowed.' });
  }

  const columns = getTitheColumns();

  try {
    const stmt = db.prepare(`
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
    `);

    for (const item of entries) {
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

      stmt.run(item.member_id, bialId, year, month, pr, ram, tual, bldg, extraJson, rowTotal);
    }

    res.json({ message: 'Bulk tithes saved successfully', columns });
  } catch (err) {
    console.error('Bulk save error:', err);
    res.status(500).json({ error: 'Failed to complete bulk save' });
  }
});

// GET /api/tithes/yearly-summary?bial_id=X&year=2026 - Aggregated yearly collection for Bial
router.get('/yearly-summary', (req, res) => {
  const bialId = getTargetBialId(req);
  const year = parseInt(req.query.year) || new Date().getFullYear();

  if (!bialId) {
    return res.status(400).json({ error: 'bial_id is required' });
  }

  try {
    const bial = db.prepare('SELECT id, name, code FROM bials WHERE id = ?').get(bialId);
    if (!bial) {
      return res.status(404).json({ error: 'Bial not found' });
    }

    const columns = getTitheColumns();
    const financialMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const monthNames = {
      1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
      7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
    };

    const monthlyBreakdown = financialMonthOrder.map(m => {
      const isLocked = isMonthLocked(bialId, year, m);
      const mRows = db.prepare(`
        SELECT pathian_ram, ramthar, tualchhung, building, extra_amounts, total
        FROM tithes
        WHERE bial_id = ? AND year = ? AND month = ?
      `).all(bialId, year, m);

      const mSums = { total: 0 };
      columns.forEach(c => { mSums[c.field_key] = 0; });
      (mRows || []).forEach(r => {
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

      return {
        month: m,
        month_name: monthNames[m],
        is_locked: isLocked ? 1 : 0,
        ...mSums
      };
    });

    const memberList = db.prepare(`
      SELECT m.id as member_id, m.sl_no, m.name
      FROM members m
      WHERE m.bial_id = ? AND m.year = ?
      ORDER BY m.sl_no ASC, m.id ASC
    `).all(bialId, year);

    const allYearTithes = db.prepare(`
      SELECT t.member_id, t.pathian_ram, t.ramthar, t.tualchhung, t.building, t.extra_amounts, t.total
      FROM tithes t
      WHERE t.bial_id = ? AND t.year = ?
    `).all(bialId, year);

    const memberMap = new Map();
    (allYearTithes || []).forEach(t => {
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

    res.json({
      bial,
      year,
      monthlyBreakdown,
      memberTotals,
      grandTotals,
      columns
    });
  } catch (err) {
    console.error('Error fetching bial yearly summary:', err);
    res.status(500).json({ error: 'Failed to fetch yearly summary' });
  }
});

// GET /api/tithes/member-history?member_id=X&year=2026 - Individual member payment statement
router.get('/member-history', (req, res) => {
  const memberId = parseInt(req.query.member_id);
  const year = parseInt(req.query.year) || new Date().getFullYear();

  if (!memberId) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  try {
    const member = db.prepare(`
      SELECT m.id, m.sl_no, m.name, m.bial_id, b.name as bial_name, b.code as bial_code
      FROM members m
      JOIN bials b ON m.bial_id = b.id
      WHERE m.id = ?
    `).get(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (req.user.role !== 'ADMIN' && req.user.bial_id !== member.bial_id) {
      return res.status(403).json({ error: 'Access denied to member outside your Bial' });
    }

    const columns = getTitheColumns();
    const financialMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const monthNames = {
      1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
      7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
    };

    const annualSummary = { grand_total: 0 };
    columns.forEach(c => {
      annualSummary[c.field_key] = 0;
      annualSummary[`total_${c.field_key}`] = 0;
    });

    const monthlyEntries = financialMonthOrder.map(m => {
      const isLocked = isMonthLocked(member.bial_id, year, m);
      const entry = db.prepare(`
        SELECT pathian_ram, ramthar, tualchhung, building, extra_amounts, total
        FROM tithes
        WHERE member_id = ? AND year = ? AND month = ?
      `).get(memberId, year, m);

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

      return mObj;
    });

    annualSummary.total_pathian_ram = annualSummary.pathian_ram || 0;
    annualSummary.total_ramthar = annualSummary.ramthar || 0;
    annualSummary.total_tualchhung = annualSummary.tualchhung || 0;
    annualSummary.total_building = annualSummary.building || 0;

    res.json({
      member,
      year,
      monthlyEntries,
      annualSummary,
      columns
    });
  } catch (err) {
    console.error('Error fetching member history:', err);
    res.status(500).json({ error: 'Failed to fetch member payment history' });
  }
});

export default router;
