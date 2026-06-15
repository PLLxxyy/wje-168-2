import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';
import { generateToken, authenticateToken } from '../middleware/auth';
import { User, UserRole } from '../types';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password, name, email, role, department, supervisor_id } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: '用户名、密码和姓名为必填项' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userRole: UserRole = role === 'admin' || role === 'supervisor' ? role : 'employee';

  const stmt = db.prepare(`
    INSERT INTO users (username, password, name, email, role, department, supervisor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(username, hashedPassword, name, email || null, userRole, department || null, supervisor_id || null);
  const userId = result.lastInsertRowid as number;

  const user = db.prepare('SELECT id, username, name, email, role, department, supervisor_id FROM users WHERE id = ?').get(userId) as User;
  const token = generateToken({ userId, username, role: user.role });

  res.json({ user, token });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码为必填项' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User & { password: string };
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const isValidPassword = bcrypt.compareSync(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken({ userId: user.id, username: user.username, role: user.role });
  const { password: _, ...userWithoutPassword } = user;

  res.json({ user: userWithoutPassword, token });
});

router.get('/me', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.department, u.supervisor_id,
           s.name as supervisor_name
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE u.id = ?
  `).get(req.user.userId);

  res.json(user);
});

export default router;
