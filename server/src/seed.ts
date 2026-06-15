import bcrypt from 'bcryptjs';
import db, { initDatabase } from './database';

initDatabase();

const hashPassword = (password: string) => bcrypt.hashSync(password, 10);

const seedData = () => {
  console.log('开始导入测试数据...');

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, email, role, department, supervisor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProject = db.prepare(`
    INSERT INTO projects (name, code, description, department, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTimeEntry = db.prepare(`
    INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, description, is_overtime, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run(
    'admin',
    hashPassword('admin123'),
    '系统管理员',
    'admin@company.com',
    'admin',
    '技术部',
    null
  ).lastInsertRowid as number;

  const supervisor1Id = insertUser.run(
    'manager1',
    hashPassword('123456'),
    '张经理',
    'zhang@company.com',
    'supervisor',
    '技术部',
    null
  ).lastInsertRowid as number;

  const supervisor2Id = insertUser.run(
    'manager2',
    hashPassword('123456'),
    '李总监',
    'li@company.com',
    'supervisor',
    '产品部',
    null
  ).lastInsertRowid as number;

  const employees = [
    { username: 'emp1', name: '王开发', dept: '技术部', supervisor: supervisor1Id },
    { username: 'emp2', name: '刘开发', dept: '技术部', supervisor: supervisor1Id },
    { username: 'emp3', name: '陈设计', dept: '技术部', supervisor: supervisor1Id },
    { username: 'emp4', name: '赵产品', dept: '产品部', supervisor: supervisor2Id },
    { username: 'emp5', name: '孙运营', dept: '产品部', supervisor: supervisor2Id },
  ];

  const employeeIds: number[] = [];
  for (const emp of employees) {
    const id = insertUser.run(
      emp.username,
      hashPassword('123456'),
      emp.name,
      `${emp.username}@company.com`,
      'employee',
      emp.dept,
      emp.supervisor
    ).lastInsertRowid as number;
    employeeIds.push(id);
  }

  const projects = [
    { name: '电商平台重构', code: 'EP-001', dept: '技术部' },
    { name: '移动端APP开发', code: 'APP-002', dept: '技术部' },
    { name: '数据分析系统', code: 'DATA-003', dept: '技术部' },
    { name: '用户增长项目', code: 'UG-004', dept: '产品部' },
    { name: '会员体系建设', code: 'VIP-005', dept: '产品部' },
    { name: '基础设施升级', code: 'INF-006', dept: '技术部' },
  ];

  const projectIds: number[] = [];
  for (const proj of projects) {
    const id = insertProject.run(
      proj.name,
      proj.code,
      `${proj.name}项目`,
      proj.dept,
      'active'
    ).lastInsertRowid as number;
    projectIds.push(id);
  }

  const taskNames = ['需求评审', '开发', '测试', '会议', '代码审查', '技术调研', '文档编写', 'Bug修复'];

  const today = new Date();
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    for (let i = 0; i < employeeIds.length; i++) {
      if (Math.random() > 0.2) {
        const numEntries = Math.floor(Math.random() * 3) + 2;
        let totalHours = 0;

        for (let j = 0; j < numEntries; j++) {
          const hours = Math.floor(Math.random() * 4) + 1;
          if (totalHours + hours > 10) break;
          totalHours += hours;

          const taskName = taskNames[Math.floor(Math.random() * taskNames.length)];
          const projIndex = i < 3
            ? Math.floor(Math.random() * 4)
            : Math.floor(Math.random() * 2) + 3;

          const isOvertime = totalHours > 8 ? 1 : 0;
          const statusOptions: Array<'pending' | 'approved' | 'rejected'> = ['approved', 'approved', 'approved', 'pending'];
          const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

          insertTimeEntry.run(
            employeeIds[i],
            dateStr,
            taskName,
            hours,
            projectIds[projIndex],
            `完成${taskName}相关工作`,
            isOvertime,
            status
          );
        }
      }
    }
  }

  console.log('测试数据导入完成！');
  console.log('\n测试账号：');
  console.log('管理员: admin / admin123');
  console.log('主管(技术部): manager1 / 123456');
  console.log('主管(产品部): manager2 / 123456');
  console.log('员工: emp1-emp5 / 123456');
};

try {
  seedData();
} catch (error) {
  console.error('导入数据失败:', error);
}

process.exit(0);
