import { Router } from 'express';
import db from '../database';
import { authenticateToken } from '../middleware/auth';
import { Notification } from '../types';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { unread, limit, offset } = req.query;

  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: any[] = [req.user.userId];

  if (unread === 'true') {
    sql += ' AND is_read = 0';
  }

  sql += ' ORDER BY created_at DESC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  }
  if (offset) {
    sql += ' OFFSET ?';
    params.push(Number(offset));
  }

  const notifications = db.prepare(sql).all(...params) as Notification[];

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.userId) as { count: number };

  res.json({ notifications, unreadCount: unreadCount.count });
});

router.put('/:id/read', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { id } = req.params;

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification;
  if (!notification) {
    return res.status(404).json({ error: '通知不存在' });
  }

  if (notification.user_id !== req.user.userId) {
    return res.status(403).json({ error: '无权操作此通知' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ success: true });
});

router.put('/read-all', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.userId);
  res.json({ success: true });
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { id } = req.params;

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification;
  if (!notification) {
    return res.status(404).json({ error: '通知不存在' });
  }

  if (notification.user_id !== req.user.userId) {
    return res.status(403).json({ error: '无权操作此通知' });
  }

  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
