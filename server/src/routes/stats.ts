import { Router } from 'express';
import db from '../database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/personal/summary', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { year, month } = req.query;
  const userId = req.user.userId;

  const sql = `
    WITH daily_summary AS (
      SELECT
        entry_date,
        SUM(CASE WHEN status = 'approved' THEN hours ELSE 0 END) as daily_approved_hours,
        SUM(CASE WHEN status = 'pending' THEN hours ELSE 0 END) as daily_pending_hours,
        SUM(CASE WHEN status = 'rejected' THEN hours ELSE 0 END) as daily_rejected_hours,
        MAX(is_overtime) as is_overtime,
        COUNT(*) as daily_entries
      FROM time_entries
      WHERE user_id = ?
        AND strftime('%Y', entry_date) = ?
        AND strftime('%m', entry_date) = ?
      GROUP BY entry_date
    )
    SELECT
      COUNT(*) as work_days,
      SUM(daily_approved_hours) as approved_hours,
      SUM(daily_pending_hours) as pending_hours,
      SUM(daily_rejected_hours) as rejected_hours,
      SUM(CASE WHEN is_overtime = 1 AND daily_approved_hours > 8 THEN daily_approved_hours - 8 ELSE 0 END) as overtime_hours,
      SUM(daily_entries) as total_entries
    FROM daily_summary
  `;

  const data = db.prepare(sql).get(userId, String(year), String(month).padStart(2, '0'));
  res.json(data);
});

router.get('/personal/projects', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { year, month } = req.query;
  const userId = req.user.userId;

  const sql = `
    SELECT
      p.id,
      p.name,
      p.code,
      SUM(te.hours) as total_hours,
      COUNT(*) as entry_count
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    WHERE te.user_id = ?
      AND strftime('%Y', te.entry_date) = ?
      AND strftime('%m', te.entry_date) = ?
      AND te.status = 'approved'
    GROUP BY p.id, p.name, p.code
    ORDER BY total_hours DESC
  `;

  const data = db.prepare(sql).all(userId, String(year), String(month).padStart(2, '0'));
  res.json(data);
});

router.get('/team/summary', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { year, month, department } = req.query;

  let userCondition = '';
  const params: any[] = [String(year), String(month).padStart(2, '0')];

  if (req.user.role === 'supervisor') {
    userCondition = 'u.supervisor_id = ?';
    params.push(req.user.userId);
  } else if (department) {
    userCondition = 'u.department = ?';
    params.push(department);
  }

  const sql = `
    WITH user_daily AS (
      SELECT
        te.user_id,
        te.entry_date,
        SUM(CASE WHEN te.status = 'approved' THEN te.hours ELSE 0 END) as daily_approved_hours,
        SUM(CASE WHEN te.status = 'pending' THEN te.hours ELSE 0 END) as daily_pending_hours,
        MAX(te.is_overtime) as is_overtime
      FROM time_entries te
      WHERE strftime('%Y', te.entry_date) = ?
        AND strftime('%m', te.entry_date) = ?
      GROUP BY te.user_id, te.entry_date
    )
    SELECT
      u.id,
      u.name,
      u.department,
      COUNT(DISTINCT ud.entry_date) as work_days,
      COALESCE(SUM(ud.daily_approved_hours), 0) as approved_hours,
      COALESCE(SUM(ud.daily_pending_hours), 0) as pending_hours,
      COALESCE(SUM(CASE WHEN ud.is_overtime = 1 AND ud.daily_approved_hours > 8 THEN ud.daily_approved_hours - 8 ELSE 0 END), 0) as overtime_hours
    FROM users u
    LEFT JOIN user_daily ud ON u.id = ud.user_id
    WHERE u.role = 'employee'
      ${userCondition ? 'AND ' + userCondition : ''}
    GROUP BY u.id, u.name, u.department
    ORDER BY approved_hours DESC
  `;

  const data = db.prepare(sql).all(...params);
  res.json(data);
});

router.get('/team/projects', authenticateToken, requireRole('supervisor', 'admin'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { year, month, department } = req.query;

  let userCondition = '';
  const params: any[] = [String(year), String(month).padStart(2, '0')];

  if (req.user.role === 'supervisor') {
    userCondition = 'u.supervisor_id = ?';
    params.push(req.user.userId);
  } else if (department) {
    userCondition = 'u.department = ?';
    params.push(department);
  }

  const sql = `
    SELECT
      p.id,
      p.name,
      p.code,
      p.department,
      SUM(te.hours) as total_hours,
      COUNT(DISTINCT te.user_id) as participant_count
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    LEFT JOIN users u ON te.user_id = u.id
    WHERE strftime('%Y', te.entry_date) = ?
      AND strftime('%m', te.entry_date) = ?
      AND te.status = 'approved'
      ${userCondition ? 'AND ' + userCondition : ''}
    GROUP BY p.id, p.name, p.code, p.department
    ORDER BY total_hours DESC
  `;

  const data = db.prepare(sql).all(...params);
  res.json(data);
});

router.get('/company/summary', authenticateToken, requireRole('admin'), (req, res) => {
  const { year, month } = req.query;

  const sql = `
    WITH user_daily AS (
      SELECT
        te.user_id,
        te.entry_date,
        SUM(CASE WHEN te.status = 'approved' THEN te.hours ELSE 0 END) as daily_approved_hours,
        MAX(te.is_overtime) as is_overtime
      FROM time_entries te
      WHERE strftime('%Y', te.entry_date) = ?
        AND strftime('%m', te.entry_date) = ?
      GROUP BY te.user_id, te.entry_date
    )
    SELECT
      u.department,
      COUNT(DISTINCT u.id) as employee_count,
      COUNT(DISTINCT ud.entry_date || '_' || ud.user_id) as total_attendance_days,
      COALESCE(SUM(ud.daily_approved_hours), 0) as total_hours,
      COALESCE(SUM(CASE WHEN ud.is_overtime = 1 AND ud.daily_approved_hours > 8 THEN ud.daily_approved_hours - 8 ELSE 0 END), 0) as total_overtime_hours
    FROM users u
    LEFT JOIN user_daily ud ON u.id = ud.user_id
    WHERE u.role = 'employee'
    GROUP BY u.department
    ORDER BY total_hours DESC
  `;

  const data = db.prepare(sql).all(String(year), String(month).padStart(2, '0'));
  res.json(data);
});

router.get('/company/overtime-ranking', authenticateToken, requireRole('admin'), (req, res) => {
  const { year, month, limit } = req.query;

  const sql = `
    WITH user_daily AS (
      SELECT
        te.user_id,
        te.entry_date,
        SUM(CASE WHEN te.status = 'approved' THEN te.hours ELSE 0 END) as daily_approved_hours,
        MAX(te.is_overtime) as is_overtime
      FROM time_entries te
      WHERE strftime('%Y', te.entry_date) = ?
        AND strftime('%m', te.entry_date) = ?
      GROUP BY te.user_id, te.entry_date
    )
    SELECT
      u.id,
      u.name,
      u.department,
      COALESCE(SUM(CASE WHEN ud.is_overtime = 1 AND ud.daily_approved_hours > 8 THEN ud.daily_approved_hours - 8 ELSE 0 END), 0) as overtime_hours
    FROM users u
    LEFT JOIN user_daily ud ON u.id = ud.user_id
    WHERE u.role = 'employee'
    GROUP BY u.id, u.name, u.department
    HAVING overtime_hours > 0
    ORDER BY overtime_hours DESC
    LIMIT ?
  `;

  const data = db.prepare(sql).all(String(year), String(month).padStart(2, '0'), Number(limit) || 10);
  res.json(data);
});

router.get('/company/attendance', authenticateToken, requireRole('admin'), (req, res) => {
  const { year, month } = req.query;

  const sql = `
    SELECT
      u.id,
      u.name,
      u.department,
      COUNT(DISTINCT te.entry_date) as filled_days
    FROM users u
    LEFT JOIN time_entries te ON u.id = te.user_id
      AND strftime('%Y', te.entry_date) = ?
      AND strftime('%m', te.entry_date) = ?
      AND te.status IN ('approved', 'pending')
    WHERE u.role = 'employee'
    GROUP BY u.id, u.name, u.department
    ORDER BY filled_days DESC
  `;

  const data = db.prepare(sql).all(String(year), String(month).padStart(2, '0'));
  res.json(data);
});

router.get('/export/monthly', authenticateToken, requireRole('admin', 'supervisor'), (req, res) => {
  const { year, month, format } = req.query;

  const sql = `
    SELECT
      u.name as 员工姓名,
      u.department as 部门,
      te.entry_date as 日期,
      p.name as 项目名称,
      te.task_name as 任务名称,
      te.hours as 工时,
      CASE WHEN te.is_overtime = 1 THEN '是' ELSE '否' END as 是否加班,
      CASE te.status
        WHEN 'approved' THEN '已通过'
        WHEN 'pending' THEN '待审批'
        WHEN 'rejected' THEN '已打回'
        ELSE te.status
      END as 状态,
      te.description as 工作描述,
      te.created_at as 创建时间
    FROM time_entries te
    LEFT JOIN users u ON te.user_id = u.id
    LEFT JOIN projects p ON te.project_id = p.id
    WHERE strftime('%Y', te.entry_date) = ?
      AND strftime('%m', te.entry_date) = ?
    ORDER BY u.department, u.name, te.entry_date
  `;

  const data = db.prepare(sql).all(String(year), String(month).padStart(2, '0'));
  res.json(data);
});

export default router;
