import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Space, message } from 'antd';
import { Plus, Pencil, Trash2, FolderKanban } from 'lucide-react';
import { getProjects, createProject, updateProject, deleteProject } from '../api/projects';
import { getDepartments as getUserDepartments } from '../api/users';
import type { Project } from '../types';

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  archived: 'orange',
};

const statusLabels: Record<string, string> = {
  active: '进行中',
  inactive: '已暂停',
  archived: '已归档',
};

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [form] = Form.useForm();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      const data = await getProjects(params);
      setProjects(data);
    } catch {
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterStatus]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await getUserDepartments();
      setDepartments(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleAdd = () => {
    setEditingProject(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      code: project.code,
      description: project.description,
      department: project.department,
      status: project.status,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      message.success('删除成功');
      fetchProjects();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingProject) {
        await updateProject(editingProject.id, values);
        message.success('更新成功');
      } else {
        await createProject(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchProjects();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '项目编码',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
    },
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    { title: '所属部门', dataIndex: 'department', key: 'department', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v] || 'gray'}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Project) => (
        <Space>
          <Button type="link" size="small" icon={<Pencil size={14} />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此项目？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
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
        <h1 className="text-xl font-bold">项目管理</h1>
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
            placeholder="筛选状态"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '进行中', value: 'active' },
              { label: '已暂停', value: 'inactive' },
              { label: '已归档', value: 'archived' },
            ]}
          />
          <Button type="primary" icon={<Plus size={14} />} onClick={handleAdd}>
            添加项目
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={projects}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingProject ? '编辑项目' : '添加项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="项目编码" rules={[{ required: true, message: '请输入项目编码' }]}>
            <Input placeholder="例如：EP-001" disabled={!!editingProject} />
          </Form.Item>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} placeholder="请输入项目描述" />
          </Form.Item>
          <Form.Item name="department" label="所属部门">
            <Select allowClear options={departments.map((d) => ({ label: d, value: d }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: '进行中', value: 'active' },
                { label: '已暂停', value: 'inactive' },
                { label: '已归档', value: 'archived' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
