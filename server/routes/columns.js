import express from 'express';
import { db, getTitheColumns } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/columns
router.get('/', (req, res) => {
  try {
    const columns = getTitheColumns();
    res.json({ columns });
  } catch (err) {
    console.error('Error fetching columns:', err);
    res.status(500).json({ error: 'Failed to fetch columns' });
  }
});

// POST /api/columns
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { name, code, color } = req.body;
  const colName = String(name || '').trim();
  const colCode = String(code || '').trim();
  const colColor = String(color || '#6366f1').trim();

  if (!colName || !colCode) {
    return res.status(400).json({ error: 'Column full name and short code header are required.' });
  }

  try {
    const baseSlug = colName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 16);
    const fieldKey = `col_${baseSlug}_${Date.now().toString(36)}`;

    const maxOrderRow = db.prepare('SELECT COALESCE(MAX(display_order), 0) as max_order FROM tithe_columns').get();
    const nextOrder = (maxOrderRow?.max_order || 0) + 1;

    const info = db.prepare(
      'INSERT INTO tithe_columns (name, code, field_key, color, display_order) VALUES (?, ?, ?, ?, ?)'
    ).run(colName, colCode, fieldKey, colColor, nextOrder);

    const newCol = {
      id: info.lastInsertRowid,
      name: colName,
      code: colCode,
      field_key: fieldKey,
      color: colColor,
      display_order: nextOrder
    };

    const columns = getTitheColumns();
    res.json({ message: 'Column created successfully', column: newCol, columns });
  } catch (err) {
    console.error('Error creating column:', err);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

// PUT /api/columns/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const colId = parseInt(req.params.id);
  const { name, code, color, display_order } = req.body;
  const colName = String(name || '').trim();
  const colCode = String(code || '').trim();

  if (!colName || !colCode) {
    return res.status(400).json({ error: 'Column full name and short code header are required.' });
  }

  try {
    if (color && display_order !== undefined) {
      db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ?, color = ?, display_order = ? WHERE id = ?'
      ).run(colName, colCode, String(color).trim(), parseInt(display_order), colId);
    } else if (color) {
      db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ?, color = ? WHERE id = ?'
      ).run(colName, colCode, String(color).trim(), colId);
    } else {
      db.prepare(
        'UPDATE tithe_columns SET name = ?, code = ? WHERE id = ?'
      ).run(colName, colCode, colId);
    }

    const columns = getTitheColumns();
    res.json({ message: 'Column updated successfully', columns });
  } catch (err) {
    console.error('Error updating column:', err);
    res.status(500).json({ error: 'Failed to update column' });
  }
});

// DELETE /api/columns/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const colId = parseInt(req.params.id);

  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM tithe_columns').get();
    if ((countRow?.count || 0) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining contribution column. At least 1 column is required.' });
    }

    db.prepare('DELETE FROM tithe_columns WHERE id = ?').run(colId);
    const columns = getTitheColumns();
    res.json({ message: 'Column deleted successfully', columns });
  } catch (err) {
    console.error('Error deleting column:', err);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// PUT /api/columns/reorder
router.put('/reorder', authenticateToken, requireAdmin, (req, res) => {
  const { orders } = req.body;

  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'Orders array is required' });
  }

  try {
    const stmt = db.prepare('UPDATE tithe_columns SET display_order = ? WHERE id = ?');
    for (const item of orders) {
      if (item.id && item.display_order !== undefined) {
        stmt.run(item.display_order, item.id);
      }
    }
    const columns = getTitheColumns();
    res.json({ message: 'Columns reordered successfully', columns });
  } catch (err) {
    console.error('Error reordering columns:', err);
    res.status(500).json({ error: 'Failed to reorder columns' });
  }
});

export default router;

