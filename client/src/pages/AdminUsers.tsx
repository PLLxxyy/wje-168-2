import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Space, message } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getUsers, getDepartments, createUser, updateUser, deleteUser } from '../api/users';
import type { User } from '../types';

const roleColors: Record<string, string> = {
  admin: 'red',
  supervisor: 'blue',
  employee: 'green',
};

const roleLabels: Record<string, string> = {
  admin: '管理员',
  supervisor: '主管',
  employee: '员工',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [filterRole, setFilterRole] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [supervisors, setSupervisors] = useState<User[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterDept) params.department = filterDept;
      if (filterRole) params.role = filterRole;
      const data = await getUsers(params);
      setUsers(data);
      const sups = data.filter((u: User) => u.role === 'supervisor' || u.role === 'admin');
      setSupervisors(sups);
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterRole]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      supervisor_id: user.supervisor_id,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      message.success('删除成功');
      fetchUsers();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await updateUser(editingUser.id, values);
        message.success('更新成功');
      } else {
        await createUser(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchUsers();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email', render: (v: string) => v || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (v: string) => <Tag color={roleColors[v]}>{roleLabels[v] || v}</Tag>,
    },
    { title: '部门', dataIndex: 'department', key: 'department', render: (v: string) => v || '-' },
    { title: '主管', dataIndex: 'supervisor_name', key: 'supervisor_name', render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="link" size="small" icon={<Pencil size={14} />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">用户管理</h1>
        <Space>
          <Select
            placeholder="筛选部门"
            value={filterDept}
            onChange={setFilterDept}
            allowClear
            style={{ width: 150 }}
            options={departments.map((d) => ({ label: d, value: d }))}
          />
          <Select
            placeholder="筛选角色"
            value={filterRole}
            onChange={setFilterRole}
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '管理员', value: 'admin' },
              { label: '主管', value: 'supervisor' },
              { label: '员工', value: 'employee' },
            ]}
          />
          <Button type="primary" icon={<Plus size={14} />} onClick={handleAdd}>
            添加用户
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? '留空则不修改' : ''} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              options={[
                { label: '管理员', value: 'admin' },
                { label: '主管', value: 'supervisor' },
                { label: '员工', value: 'employee' },
              ]}
            />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Select allowClear options={departments.map((d) => ({ label: d, value: d }))} />
          </Form.Item>
          <Form.Item name="supervisor_id" label="主管">
            <Select
              allowClear
              options={supervisors.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
