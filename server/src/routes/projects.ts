import { Router } from 'express';
import db from '../database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Project } from '../types';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  const { department, status } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params: any[] = [];

  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY name';

  const projects = db.prepare(sql).all(...params) as Project[];

  const usedHoursSql = `
    SELECT project_id, SUM(hours) as used_hours
    FROM time_entries
    WHERE status = 'approved' AND project_id IS NOT NULL
    GROUP BY project_id
  `;
  const usedHoursMap = db.prepare(usedHoursSql).all() as { project_id: number; used_hours: number }[];
  const usedHoursByProject = new Map<number, number>();
  for (const row of usedHoursMap) {
    usedHoursByProject.set(row.project_id, row.used_hours);
  }

  const projectsWithStats = projects.map((p) => {
    const used = usedHoursByProject.get(p.id) || 0;
    const ratio = p.budget_hours > 0 ? (used / p.budget_hours) * 100 : 0;
    return {
      ...p,
      used_hours: used,
      usage_ratio: Number(ratio.toFixed(2)),
    };
  });

  res.json(projectsWithStats);
});

router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, code, description, department, status, budget_hours } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: '项目名称和编码为必填项' });
  }

  const existing = db.prepare('SELECT id FROM projects WHERE code = ?').get(code);
  if (existing) {
    return res.status(400).json({ error: '项目编码已存在' });
  }

  const stmt = db.prepare(`
    INSERT INTO projects (name, code, description, department, status, budget_hours)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    code,
    description || null,
    department || null,
    status || 'active',
    budget_hours || 0
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid) as Project;

  res.json(project);
});

router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, code, description, department, status, budget_hours } = req.body;

  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '项目不存在' });
  }

  const stmt = db.prepare(`
    UPDATE projects SET name = ?, code = ?, description = ?, department = ?, status = ?, budget_hours = ?
    WHERE id = ?
  `);

  stmt.run(
    name,
    code,
    description || null,
    department || null,
    status || 'active',
    budget_hours || 0,
    id
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;

  res.json(project);
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '项目不存在' });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
