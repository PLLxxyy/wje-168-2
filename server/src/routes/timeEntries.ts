import { Router } from 'express';
import db from '../database';
import { authenticateToken } from '../middleware/auth';
import { TimeEntry, TimeEntryWithUser } from '../types';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { startDate, endDate, status, userId } = req.query;
  let sql = `
    SELECT te.*, p.name as project_name, u.name as user_name, u.department
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    LEFT JOIN users u ON te.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user.role === 'employee' || !userId) {
    sql += ' AND te.user_id = ?';
    params.push(req.user.userId);
  } else if (userId && userId !== 'all') {
    sql += ' AND te.user_id = ?';
    params.push(userId);
  }

  if (startDate) {
    sql += ' AND te.entry_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND te.entry_date <= ?';
    params.push(endDate);
  }
  if (status) {
    sql += ' AND te.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY te.entry_date DESC, te.created_at DESC';

  const entries = db.prepare(sql).all(...params) as TimeEntryWithUser[];
  res.json(entries);
});

router.get('/calendar', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { month, year, userId } = req.query;
  const targetUserId = userId && req.user.role !== 'employee' ? Number(userId) : req.user.userId;

  const sql = `
    SELECT entry_date, 
           SUM(hours) as total_hours,
           SUM(CASE WHEN is_overtime = 1 THEN hours ELSE 0 END) as overtime_hours,
           COUNT(*) as entry_count,
           MAX(status) as status
    FROM time_entries
    WHERE user_id = ?
      AND strftime('%Y', entry_date) = ?
      AND strftime('%m', entry_date) = ?
    GROUP BY entry_date
    ORDER BY entry_date
  `;

  const data = db.prepare(sql).all(targetUserId, String(year), String(month).padStart(2, '0'));
  res.json(data);
});

router.post('/', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { entries } = req.body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: '请至少填写一条工时记录' });
  }

  const entryDate = entries[0].entry_date;
  if (!entryDate) {
    return res.status(400).json({ error: '请选择日期' });
  }

  const totalHours = entries.reduce((sum: number, e: any) => sum + Number(e.hours || 0), 0);
  const isOvertime = totalHours > 8;

  const insertStmt = db.prepare(`
    INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, description, is_overtime, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const deleteStmt = db.prepare(`
    DELETE FROM time_entries 
    WHERE user_id = ? AND entry_date = ? AND status IN ('pending', 'rejected')
  `);

  const transaction = db.transaction(() => {
    deleteStmt.run(req.user!.userId, entryDate);

    const insertedIds: number[] = [];
    for (const entry of entries) {
      const entryOvertime = isOvertime ? 1 : 0;
      const result = insertStmt.run(
        req.user!.userId,
        entryDate,
        entry.task_name,
        Number(entry.hours),
        entry.project_id || null,
        entry.description || null,
        entryOvertime
      );
      insertedIds.push(result.lastInsertRowid as number);
    }

    return insertedIds;
  });

  try {
    const insertedIds = transaction();
    const savedEntries = db.prepare(`
      SELECT te.*, p.name as project_name
      FROM time_entries te
      LEFT JOIN projects p ON te.project_id = p.id
      WHERE te.id IN (${insertedIds.map(() => '?').join(',')})
    `).all(...insertedIds) as TimeEntry[];

    res.json({ entries: savedEntries, totalHours, isOvertime });
  } catch (error) {
    console.error('Save time entries error:', error);
    res.status(500).json({ error: '保存失败，请重试' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { id } = req.params;
  const { task_name, hours, project_id, description } = req.body;

  const existing = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntry;
  if (!existing) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (existing.user_id !== req.user.userId && req.user.role === 'employee') {
    return res.status(403).json({ error: '只能修改自己的记录' });
  }

  if (existing.status === 'approved') {
    return res.status(400).json({ error: '已通过的记录不能修改' });
  }

  const stmt = db.prepare(`
    UPDATE time_entries 
    SET task_name = ?, hours = ?, project_id = ?, description = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(task_name, Number(hours), project_id || null, description || null, id);

  const dateEntries = db.prepare('SELECT * FROM time_entries WHERE user_id = ? AND entry_date = ?').all(
    existing.user_id,
    existing.entry_date
  ) as TimeEntry[];
  const totalHours = dateEntries.reduce((sum, e) => sum + e.hours, 0);
  const isOvertime = totalHours > 8 ? 1 : 0;

  db.prepare('UPDATE time_entries SET is_overtime = ? WHERE user_id = ? AND entry_date = ?').run(
    isOvertime,
    existing.user_id,
    existing.entry_date
  );

  const updated = db.prepare(`
    SELECT te.*, p.name as project_name
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    WHERE te.id = ?
  `).get(id) as TimeEntry;

  res.json(updated);
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntry;

  if (!existing) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (existing.user_id !== req.user.userId && req.user.role === 'employee') {
    return res.status(403).json({ error: '只能删除自己的记录' });
  }

  if (existing.status === 'approved') {
    return res.status(400).json({ error: '已通过的记录不能删除' });
  }

  db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
