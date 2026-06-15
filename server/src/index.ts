import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import timeEntryRoutes from './routes/timeEntries';
import approvalRoutes from './routes/approvals';
import statsRoutes from './routes/stats';
import notificationRoutes from './routes/notifications';
import userRoutes from './routes/users';

const app = express();
const PORT = process.env.PORT || 3001;

initDatabase();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`\n🚀 工时管理系统后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📡 API 前缀: http://localhost:${PORT}/api`);
  console.log(`\n💡 提示: 首次运行请执行 "cd server && npm run seed" 导入测试数据\n`);
});
