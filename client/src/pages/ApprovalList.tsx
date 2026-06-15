import { useState, useEffect, useCallback } from 'react';
import { Card, Input, DatePicker, Tag, Button, Table, Modal, message, Space } from 'antd';
import { CheckCircle, XCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { getPendingApprovals, approveEntry, rejectEntry, batchApprove, batchReject } from '../api/approvals';
import type { PendingGroup, TimeEntry } from '../types';

const { RangePicker } = DatePicker;

export default function ApprovalList() {
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; entryId: number | null; isBatch: boolean; userId?: number; entryDate?: string }>({
    visible: false,
    entryId: null,
    isBatch: false,
  });
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingApprovals();
      setGroups(data);
    } catch {
      message.error('获取审批列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleApprove = async (id: number) => {
    try {
      await approveEntry(id);
      message.success('已通过');
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleRejectClick = (entryId: number) => {
    setRejectModal({ visible: true, entryId, isBatch: false });
    setRejectReason('');
  };

  const handleBatchRejectClick = (userId: number, entryDate: string) => {
    setRejectModal({ visible: true, entryId: null, isBatch: true, userId, entryDate });
    setRejectReason('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      message.warning('请填写打回理由');
      return;
    }
    try {
      if (rejectModal.isBatch && rejectModal.userId && rejectModal.entryDate) {
        await batchReject(rejectModal.userId, rejectModal.entryDate, rejectReason);
        message.success('已全部打回');
      } else if (rejectModal.entryId) {
        await rejectEntry(rejectModal.entryId, rejectReason);
        message.success('已打回');
      }
      setRejectModal({ visible: false, entryId: null, isBatch: false });
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleBatchApprove = async (userId: number, entryDate: string) => {
    try {
      await batchApprove(userId, entryDate);
      message.success('已全部通过');
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (searchName && !g.user_name.includes(searchName)) return false;
    if (dateRange) {
      const entryDate = dayjs(g.entry_date);
      if (entryDate.isBefore(dateRange[0], 'day') || entryDate.isAfter(dateRange[1], 'day')) return false;
    }
    return true;
  });

  const renderEntries = (entries: TimeEntry[]) => {
    const columns = [
      { title: '任务名称', dataIndex: 'task_name', key: 'task_name' },
      { title: '工时(h)', dataIndex: 'hours', key: 'hours', width: 80 },
      { title: '项目', dataIndex: 'project_name', key: 'project_name', render: (v: string) => v || '-' },
      { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-', ellipsis: true },
      {
        title: '操作',
        key: 'action',
        width: 160,
        render: (_: unknown, record: TimeEntry) => (
          <Space>
            <Button type="link" size="small" icon={<CheckCircle size={14} />} onClick={() => handleApprove(record.id)}>
              通过
            </Button>
            <Button type="link" size="small" danger icon={<XCircle size={14} />} onClick={() => handleRejectClick(record.id)}>
              打回
            </Button>
          </Space>
        ),
      },
    ];
    return <Table columns={columns} dataSource={entries} rowKey="id" pagination={false} size="small" />;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">审批管理</h1>
        <Space>
          <RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)} />
          <Input
            placeholder="搜索员工姓名"
            prefix={<Search size={14} />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
        </Space>
      </div>

      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const key = `${group.user_id}_${group.entry_date}`;
          const expanded = expandedKeys.has(key);
          return (
            <Card key={key} size="small" className="shadow-sm">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(key)}
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">{group.user_name}</span>
                  <span className="text-gray-500">{group.department}</span>
                  <span className="text-gray-400">{group.entry_date}</span>
                  <span>总工时: {group.total_hours.toFixed(1)}h</span>
                  {group.is_overtime === 1 && <Tag color="orange">加班</Tag>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBatchApprove(group.user_id, group.entry_date);
                    }}
                  >
                    全部通过
                  </Button>
                  <Button
                    danger
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBatchRejectClick(group.user_id, group.entry_date);
                    }}
                  >
                    全部打回
                  </Button>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
              {expanded && <div className="mt-3">{renderEntries(group.entries)}</div>}
            </Card>
          );
        })}
      </div>

      {filteredGroups.length === 0 && !loading && (
        <div className="text-center text-gray-400 py-12">暂无待审批记录</div>
      )}

      <Modal
        title="打回理由"
        open={rejectModal.visible}
        onOk={handleRejectConfirm}
        onCancel={() => setRejectModal({ visible: false, entryId: null, isBatch: false })}
        okText="确认打回"
        cancelText="取消"
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入打回理由（必填）"
        />
      </Modal>
    </div>
  );
}
