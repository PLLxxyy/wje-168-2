import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'test-budget.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  DROP TABLE IF EXISTS approvals;
  DROP TABLE IF EXISTS notifications;
  DROP TABLE IF EXISTS time_entries;
  DROP TABLE IF EXISTS projects;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'employee',
    department TEXT,
    supervisor_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
  );

  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    department TEXT,
    status TEXT DEFAULT 'active',
    budget_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    task_name TEXT NOT NULL,
    hours REAL NOT NULL,
    project_id INTEGER,
    description TEXT,
    is_overtime INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_entry_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id),
    FOREIGN KEY (approver_id) REFERENCES users(id)
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    is_read INTEGER DEFAULT 0,
    related_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const hashPassword = (p: string) => bcrypt.hashSync(p, 10);

const adminId = db
  .prepare(
    'INSERT INTO users (username, password, name, email, role, department) VALUES (?, ?, ?, ?, ?, ?)'
  )
  .run('admin', hashPassword('admin123'), '系统管理员', 'admin@test.com', 'admin', '技术部')
  .lastInsertRowid as number;

const admin2Id = db
  .prepare(
    'INSERT INTO users (username, password, name, email, role, department) VALUES (?, ?, ?, ?, ?, ?)'
  )
  .run('admin2', hashPassword('admin123'), '副管理员', 'admin2@test.com', 'admin', '产品部')
  .lastInsertRowid as number;

const supervisorId = db
  .prepare(
    'INSERT INTO users (username, password, name, email, role, department) VALUES (?, ?, ?, ?, ?, ?)'
  )
  .run('manager1', hashPassword('123456'), '张经理', 'manager@test.com', 'supervisor', '技术部')
  .lastInsertRowid as number;

const employeeId = db
  .prepare(
    'INSERT INTO users (username, password, name, email, role, department, supervisor_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  .run('emp1', hashPassword('123456'), '王开发', 'emp@test.com', 'employee', '技术部', supervisorId)
  .lastInsertRowid as number;

function checkProjectBudgetAndNotify(projectId: number | null | undefined) {
  if (!projectId) {
    console.log('[check] projectId 为空，跳过');
    return false;
  }

  const project = db
    .prepare('SELECT id, name, budget_hours FROM projects WHERE id = ?')
    .get(projectId) as { id: number; name: string; budget_hours: number };
  if (!project || project.budget_hours <= 0) {
    console.log(`[check] 项目 ${projectId} 不存在或预算为0，跳过`);
    return false;
  }

  const used = db
    .prepare(
      "SELECT COALESCE(SUM(hours), 0) as used FROM time_entries WHERE project_id = ? AND status = 'approved'"
    )
    .get(projectId) as { used: number };

  console.log(
    `[check] 项目【${project.name}】预算: ${project.budget_hours}h, 已用: ${used.used}h, 超支: ${used.used > project.budget_hours}`
  );

  if (used.used > project.budget_hours) {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as { id: number }[];
    console.log(`[notify] 发现超支！向 ${admins.length} 位管理员发送通知`);

    const notificationStmt = db.prepare(`
      INSERT INTO notifications (user_id, type, title, content, related_id)
      VALUES (?, 'budget_exceed', ?, ?, ?)
    `);
    let inserted = 0;
    for (const admin of admins) {
      const info = notificationStmt.run(
        admin.id,
        '项目预算工时超支',
        `项目【${project.name}】已用工时 ${used.used} 小时，超出预算 ${project.budget_hours} 小时`,
        project.id
      );
      if (info.changes > 0) inserted++;
      console.log(
        `  → 管理员 ${admin.id} 通知ID=${info.lastInsertRowid}, 标题=项目预算工时超支, related_id=${project.id}`
      );
    }
    console.log(`[notify] 成功插入 ${inserted} 条通知`);
    return inserted === admins.length;
  }
  return false;
}

function showNotifications(label: string) {
  console.log(`\n===== ${label} =====`);
  const list = db
    .prepare('SELECT id, user_id, type, title, content, related_id, is_read FROM notifications ORDER BY id')
    .all();
  if (list.length === 0) {
    console.log('(无通知)');
  } else {
    for (const n of list as any[]) {
      console.log(
        `[#${n.id}] user=${n.user_id} type=${n.type} read=${n.is_read} related=${n.related_id}\n     title: ${n.title}\n     content: ${n.content}`
      );
    }
  }
}

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ ${msg}`);
    process.exitCode = 1;
    throw new Error('ASSERT FAILED: ' + msg);
  }
}

function resetTables() {
  db.exec(
    'DELETE FROM approvals; DELETE FROM notifications; DELETE FROM time_entries; DELETE FROM projects;'
  );
}

const results: { name: string; pass: boolean }[] = [];
function runScenario(name: string, fn: () => void) {
  console.log(`\n==== 场景：${name} ====`);
  resetTables();
  try {
    fn();
    results.push({ name, pass: true });
    console.log(`✅ 场景【${name}】通过`);
  } catch (e: any) {
    results.push({ name, pass: false });
    console.error(`❌ 场景【${name}】失败: ${e.message}`);
  }
}

const updateStmt = db.prepare("UPDATE time_entries SET status = 'approved' WHERE id = ?");
const approvalStmt = db.prepare(
  'INSERT INTO approvals (time_entry_id, approver_id, status) VALUES (?, ?, ?)'
);
const userNotifyStmt = db.prepare(
  "INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, 'approval', ?, ?, ?)"
);

console.log('==== 开始测试：预算超支通知 ====');

runScenario('1. 单个审批-未超预算不通知', () => {
  const pId = db
    .prepare('INSERT INTO projects (name, code, department, budget_hours) VALUES (?, ?, ?, ?)')
    .run('预算项目1', 'B-001', '技术部', 10)
    .lastInsertRowid as number;

  const eId = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    )
    .run(employeeId, '2026-06-15', '核心开发', 8, pId).lastInsertRowid as number;
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(eId) as any;

  const tx = db.transaction(() => {
    updateStmt.run(eId);
    approvalStmt.run(eId, supervisorId, 'approved');
    userNotifyStmt.run(entry.user_id, '工时审批通过', '您 2026-06-15 的工时已通过审批', eId);
  });
  tx();

  const notified = checkProjectBudgetAndNotify(entry.project_id);
  assert(notified === false, '未超预算不应触发通知');

  const budgetNotifys = (
    db.prepare("SELECT COUNT(*) as c FROM notifications WHERE type = 'budget_exceed'").get() as {
      c: number;
    }
  ).c;
  assert(budgetNotifys === 0, '数据库中应该没有 budget_exceed 通知');

  const approvalNotifys = (
    db.prepare("SELECT COUNT(*) as c FROM notifications WHERE type = 'approval'").get() as {
      c: number;
    }
  ).c;
  assert(approvalNotifys === 1, '应该有 1 条审批通过通知');
});

runScenario('2. 单个审批-超预算通知管理员', () => {
  const pId = db
    .prepare('INSERT INTO projects (name, code, department, budget_hours) VALUES (?, ?, ?, ?)')
    .run('预算项目2', 'B-002', '技术部', 10)
    .lastInsertRowid as number;

  const e1 = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'approved')"
    )
    .run(employeeId, '2026-06-14', '前期开发', 8, pId).lastInsertRowid as number;

  const e2 = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    )
    .run(employeeId, '2026-06-15', '功能完善', 5, pId).lastInsertRowid as number;
  const entry2 = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(e2) as any;

  const tx = db.transaction(() => {
    updateStmt.run(e2);
    approvalStmt.run(e2, supervisorId, 'approved');
    userNotifyStmt.run(entry2.user_id, '工时审批通过', '您 2026-06-15 的工时已通过审批', e2);
  });
  tx();

  const notified = checkProjectBudgetAndNotify(entry2.project_id);
  assert(notified === true, '超预算应该触发通知');

  const budgetNotifys = db
    .prepare(
      "SELECT id, user_id, type, title, content, related_id FROM notifications WHERE type = 'budget_exceed' ORDER BY id"
    )
    .all() as any[];
  assert(budgetNotifys.length === 2, `应该给 2 位管理员各发 1 条，实际 ${budgetNotifys.length} 条`);
  assert(budgetNotifys[0].user_id === adminId, '第1条通知的接收人是 admin1');
  assert(budgetNotifys[1].user_id === admin2Id, '第2条通知的接收人是 admin2');
  assert(
    budgetNotifys[0].related_id === pId && budgetNotifys[1].related_id === pId,
    'related_id 应该等于项目ID'
  );
  assert(
    budgetNotifys[0].title === '项目预算工时超支',
    '通知标题应为「项目预算工时超支」'
  );
  assert(
    budgetNotifys[0].content?.includes('预算项目2') && budgetNotifys[0].content?.includes('13'),
    '通知内容应该包含项目名「预算项目2」和已用工时 13'
  );
  showNotifications('场景2 通知详情');
});

runScenario('3. 批量审批-超预算通知管理员', () => {
  const pId = db
    .prepare('INSERT INTO projects (name, code, department, budget_hours) VALUES (?, ?, ?, ?)')
    .run('预算项目3', 'B-003', '技术部', 12)
    .lastInsertRowid as number;

  const batchDate = '2026-06-17';
  const entries: { id: number; project_id: number | null }[] = [];
  const data = [
    { task: '前端开发', hours: 4 },
    { task: '后端开发', hours: 5 },
    { task: '测试联调', hours: 4 },
  ];
  for (const d of data) {
    const id = db
      .prepare(
        "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
      )
      .run(employeeId, batchDate, d.task, d.hours, pId).lastInsertRowid as number;
    entries.push({ id, project_id: pId });
  }

  const projectIds = new Set<number>();

  const txBatch = db.transaction(() => {
    for (const e of entries) {
      updateStmt.run(e.id);
      approvalStmt.run(e.id, supervisorId, 'approved');
      if (e.project_id) projectIds.add(e.project_id);
    }
    userNotifyStmt.run(
      employeeId,
      '工时审批通过',
      `您 ${batchDate} 的工时已通过审批`,
      entries[0].id
    );
  });
  txBatch();

  let allNotified = true;
  for (const pid of projectIds) {
    const ok = checkProjectBudgetAndNotify(pid);
    if (!ok) allNotified = false;
  }
  assert(allNotified === true, '批量审批超预算应触发通知');

  const budgetNotifys = db
    .prepare(
      "SELECT id, user_id, related_id FROM notifications WHERE type = 'budget_exceed' ORDER BY id"
    )
    .all() as any[];
  assert(budgetNotifys.length === 2, `批量审批应该产生 2 条预算超支通知，实际 ${budgetNotifys.length}`);
  assert(
    budgetNotifys[0].related_id === pId && budgetNotifys[1].related_id === pId,
    '批量通知的 related_id 正确'
  );
  showNotifications('场景3 通知详情');
});

runScenario('4. 边界值-刚好用完不通知', () => {
  const pId = db
    .prepare('INSERT INTO projects (name, code, department, budget_hours) VALUES (?, ?, ?, ?)')
    .run('预算项目4', 'B-004', '产品部', 20)
    .lastInsertRowid as number;

  const eId = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    )
    .run(employeeId, '2026-06-10', '需求文档', 20, pId).lastInsertRowid as number;
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(eId) as any;

  const tx = db.transaction(() => {
    updateStmt.run(eId);
    approvalStmt.run(eId, supervisorId, 'approved');
    userNotifyStmt.run(entry.user_id, '工时审批通过', '您 2026-06-10 的工时已通过审批', eId);
  });
  tx();

  const notified = checkProjectBudgetAndNotify(entry.project_id);
  assert(notified === false, '刚好用完预算（等于）不应该触发通知');

  const budgetNotifys = (
    db.prepare("SELECT COUNT(*) as c FROM notifications WHERE type = 'budget_exceed'").get() as {
      c: number;
    }
  ).c;
  assert(budgetNotifys === 0, '数据库中应该没有 budget_exceed 通知');
});

runScenario('5. 预算为0-不触发通知', () => {
  const pId = db
    .prepare('INSERT INTO projects (name, code, department, budget_hours) VALUES (?, ?, ?, ?)')
    .run('预算项目5', 'B-005', '产品部', 0)
    .lastInsertRowid as number;

  const eId = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    )
    .run(employeeId, '2026-06-11', '随便工作', 100, pId).lastInsertRowid as number;
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(eId) as any;

  const tx = db.transaction(() => {
    updateStmt.run(eId);
    approvalStmt.run(eId, supervisorId, 'approved');
    userNotifyStmt.run(entry.user_id, '工时审批通过', '您 2026-06-11 的工时已通过审批', eId);
  });
  tx();

  const notified = checkProjectBudgetAndNotify(entry.project_id);
  assert(notified === false, '预算为0不应该触发通知');
  const budgetNotifys = (
    db.prepare("SELECT COUNT(*) as c FROM notifications WHERE type = 'budget_exceed'").get() as {
      c: number;
    }
  ).c;
  assert(budgetNotifys === 0, '预算为0时无 budget_exceed 通知');
});

runScenario('6. 工时未关联项目-跳过检查', () => {
  const eId = db
    .prepare(
      "INSERT INTO time_entries (user_id, entry_date, task_name, hours, project_id, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    )
    .run(employeeId, '2026-06-12', '会议', 2, null).lastInsertRowid as number;
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(eId) as any;

  const tx = db.transaction(() => {
    updateStmt.run(eId);
    approvalStmt.run(eId, supervisorId, 'approved');
    userNotifyStmt.run(entry.user_id, '工时审批通过', '您 2026-06-12 的工时已通过审批', eId);
  });
  tx();

  const notified = checkProjectBudgetAndNotify(entry.project_id);
  assert(notified === false, '未关联项目不应触发通知');
});

console.log('\n============ 测试汇总 ============');
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.name}`);
}
const passCount = results.filter((r) => r.pass).length;
console.log(
  `\n总计: ${passCount}/${results.length} 通过` +
    (passCount === results.length ? ' 🎉 全部通过' : ' 存在失败')
);
process.exit(passCount === results.length ? 0 : 1);
