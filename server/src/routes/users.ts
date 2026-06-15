import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.get('/', authenticateToken, requireRole('admin', 'supervisor'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { department, role } = req.query;
  let sql = `
    SELECT u.id, u.username, u.name, u.email, u.role, u.department,
           u.supervisor_id, s.name as supervisor_name, u.created_at
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (department) {
    sql += ' AND u.department = ?';
    params.push(department);
  }
  if (role) {
    sql += ' AND u.role = ?';
    params.push(role);
  }

  if (req.user!.role === 'supervisor') {
    sql += ' AND u.role = ? AND u.supervisor_id = ?';
    params.push('employee', req.user!.userId);
  }

  sql += ' ORDER BY u.department, u.name';

  const users = db.prepare(sql).all(...params);
  res.json(users);
});

router.get('/subordinates', authenticateToken, requireRole('supervisor'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.department, u.created_at
    FROM users u
    WHERE u.supervisor_id = ? AND u.role = 'employee'
    ORDER BY u.name
  `).all(req.user.userId);

  res.json(users);
});

router.get('/departments', authenticateToken, (req, res) => {
  const departments = db.prepare(`
    SELECT DISTINCT department FROM users 
    WHERE department IS NOT NULL AND department != ''
    ORDER BY department
  `).all() as { department: string }[];

  res.json(departments.map(d => d.department));
});

router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { username, password, name, email, role, department, supervisor_id } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: '用户名、密码和姓名为必填项' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const stmt = db.prepare(`
    INSERT INTO users (username, password, name, email, role, department, supervisor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    username, hashedPassword, name, email || null,
    role || 'employee', department || null, supervisor_id || null
  );

  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.department,
           u.supervisor_id, s.name as supervisor_name, u.created_at
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE u.id = ?
  `).get(result.lastInsertRowid);

  res.json(user);
});

router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, email, role, department, supervisor_id, password } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '用户不存在' });
  }

  let sql = 'UPDATE users SET name = ?, email = ?, role = ?, department = ?, supervisor_id = ?';
  const params: any[] = [name, email || null, role || 'employee', department || null, supervisor_id || null];

  if (password) {
    sql += ', password = ?';
    params.push(bcrypt.hashSync(password, 10));
  }

  sql += ' WHERE id = ?';
  params.push(id);

  db.prepare(sql).run(...params);

  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.department,
           u.supervisor_id, s.name as supervisor_name, u.created_at
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE u.id = ?
  `).get(id);

  res.json(user);
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '用户不存在' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
