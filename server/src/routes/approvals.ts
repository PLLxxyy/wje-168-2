import { Router } from 'express';
import db from '../database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { TimeEntryWithUser } from '../types';

const router = Router();

function checkProjectBudgetAndNotify(projectId: number | null | undefined) {
  if (!projectId) return;

  const project = db
    .prepare('SELECT id, name, budget_hours FROM projects WHERE id = ?')
    .get(projectId) as { id: number; name: string; budget_hours: number };
  if (!project || project.budget_hours <= 0) return;

  const used = db
    .prepare(
      "SELECT COALESCE(SUM(hours), 0) as used FROM time_entries WHERE project_id = ? AND status = 'approved'"
    )
    .get(projectId) as { used: number };

  if (used.used > project.budget_hours) {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as { id: number }[];
    const notificationStmt = db.prepare(`
      INSERT INTO notifications (user_id, type, title, content, related_id)
      VALUES (?, 'budget_exceed', ?, ?, ?)
    `);
    for (const admin of admins) {
      notificationStmt.run(
        admin.id,
        '项目预算工时超支',
        `项目【${project.name}】已用工时 ${used.used} 小时，超出预算 ${project.budget_hours} 小时`,
        project.id
      );
    }
  }
}

router.get('/pending', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const sql = `
    SELECT te.*, p.name as project_name, u.name as user_name, u.department
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    LEFT JOIN users u ON te.user_id = u.id
    WHERE te.status = 'pending'
  `;

  const params: any[] = [];
  const finalSql = req.user.role === 'supervisor'
    ? sql + ' AND u.supervisor_id = ? ORDER BY te.entry_date DESC'
    : sql + ' ORDER BY te.entry_date DESC';

  if (req.user.role === 'supervisor') {
    params.push(req.user.userId);
  }

  const entries = db.prepare(finalSql).all(...params) as TimeEntryWithUser[];

  const grouped = entries.reduce((acc: any, entry) => {
    const key = `${entry.user_id}_${entry.entry_date}`;
    if (!acc[key]) {
      acc[key] = {
        user_id: entry.user_id,
        user_name: entry.user_name,
        department: entry.department,
        entry_date: entry.entry_date,
        entries: [],
        total_hours: 0,
        is_overtime: entry.is_overtime
      };
    }
    acc[key].entries.push(entry);
    acc[key].total_hours += entry.hours;
    return acc;
  }, {});

  res.json(Object.values(grouped));
});

router.post('/:id/approve', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { comment } = req.body;
  const timeEntryId = Number(req.params.id);

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(timeEntryId);
  if (!entry) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const updateStmt = db.prepare('UPDATE time_entries SET status = ? WHERE id = ?');
  const approvalStmt = db.prepare(`
    INSERT INTO approvals (time_entry_id, approver_id, status, comment)
    VALUES (?, ?, ?, ?)
  `);
  const notificationStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, 'approval', ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    updateStmt.run('approved', timeEntryId);
    approvalStmt.run(timeEntryId, req.user!.userId, 'approved', comment || null);
    notificationStmt.run(
      (entry as any).user_id,
      '工时审批通过',
      `您 ${(entry as any).entry_date} 的工时已通过审批`,
      timeEntryId
    );
  });

  try {
    transaction();
    checkProjectBudgetAndNotify((entry as any).project_id);
    res.json({ success: true, status: 'approved' });
  } catch (error) {
    res.status(500).json({ error: '审批失败' });
  }
});

router.post('/:id/reject', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { comment } = req.body;
  const timeEntryId = Number(req.params.id);

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(timeEntryId);
  if (!entry) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const updateStmt = db.prepare('UPDATE time_entries SET status = ? WHERE id = ?');
  const approvalStmt = db.prepare(`
    INSERT INTO approvals (time_entry_id, approver_id, status, comment)
    VALUES (?, ?, ?, ?)
  `);
  const notificationStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, 'rejection', ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    updateStmt.run('rejected', timeEntryId);
    approvalStmt.run(timeEntryId, req.user!.userId, 'rejected', comment || null);
    notificationStmt.run(
      (entry as any).user_id,
      '工时被打回',
      `您 ${(entry as any).entry_date} 的工时已被打回，原因：${comment || '无'}`,
      timeEntryId
    );
  });

  try {
    transaction();
    res.json({ success: true, status: 'rejected' });
  } catch (error) {
    res.status(500).json({ error: '操作失败' });
  }
});

router.post('/batch/approve', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { userId, entryDate, comment } = req.body;

  const entries = db.prepare(`
    SELECT id, project_id FROM time_entries 
    WHERE user_id = ? AND entry_date = ? AND status = 'pending'
  `).all(userId, entryDate) as { id: number; project_id: number | null }[];

  if (entries.length === 0) {
    return res.status(400).json({ error: '没有待审批的记录' });
  }

  const updateStmt = db.prepare('UPDATE time_entries SET status = ? WHERE id = ?');
  const approvalStmt = db.prepare(`
    INSERT INTO approvals (time_entry_id, approver_id, status, comment)
    VALUES (?, ?, ?, ?)
  `);
  const notificationStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, 'approval', ?, ?, ?)
  `);

  const projectIds = new Set<number>();

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      updateStmt.run('approved', entry.id);
      approvalStmt.run(entry.id, req.user!.userId, 'approved', comment || null);
      if (entry.project_id) projectIds.add(entry.project_id);
    }
    notificationStmt.run(
      userId,
      '工时审批通过',
      `您 ${entryDate} 的工时已通过审批`,
      entries[0].id
    );
  });

  try {
    transaction();
    for (const pid of projectIds) {
      checkProjectBudgetAndNotify(pid);
    }
    res.json({ success: true, count: entries.length });
  } catch (error) {
    res.status(500).json({ error: '批量审批失败' });
  }
});

router.post('/batch/reject', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { userId, entryDate, comment } = req.body;

  const entries = db.prepare(`
    SELECT id FROM time_entries 
    WHERE user_id = ? AND entry_date = ? AND status = 'pending'
  `).all(userId, entryDate) as { id: number }[];

  if (entries.length === 0) {
    return res.status(400).json({ error: '没有待审批的记录' });
  }

  const updateStmt = db.prepare('UPDATE time_entries SET status = ? WHERE id = ?');
  const approvalStmt = db.prepare(`
    INSERT INTO approvals (time_entry_id, approver_id, status, comment)
    VALUES (?, ?, ?, ?)
  `);
  const notificationStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, 'rejection', ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      updateStmt.run('rejected', entry.id);
      approvalStmt.run(entry.id, req.user!.userId, 'rejected', comment || null);
    }
    notificationStmt.run(
      userId,
      '工时被打回',
      `您 ${entryDate} 的工时已被打回，原因：${comment || '无'}`,
      entries[0].id
    );
  });

  try {
    transaction();
    res.json({ success: true, count: entries.length });
  } catch (error) {
    res.status(500).json({ error: '操作失败' });
  }
});

export default router;
