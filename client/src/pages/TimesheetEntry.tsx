import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, InputNumber, Select, Modal, Badge, Tag, message, Popconfirm } from 'antd';
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit3, Send, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Calendar } from 'antd';
import { getTimeEntries, getCalendarData, saveTimeEntries, updateTimeEntry, deleteTimeEntry } from '../api/timeEntries';
import { getPersonalSummary } from '../api/stats';
import { getProjects } from '../api/projects';
import { useAuthStore } from '../store/authStore';
import type { TimeEntry, CalendarData, PersonalSummary, Project } from '../types';

const { TextArea } = Input;

interface EntryForm {
  task_name: string;
  hours: number;
  project_id: number | undefined;
  description: string;
}

const emptyForm: EntryForm = { task_name: '', hours: 8, project_id: undefined, description: '' };

export default function TimesheetEntry() {
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [calendarData, setCalendarData] = useState<CalendarData[]>([]);
  const [summary, setSummary] = useState<PersonalSummary | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [loading, setLoading] = useState(false);

  const fetchCalendarData = useCallback(async () => {
    try {
      const data = await getCalendarData(currentMonth.year(), currentMonth.month() + 1, user?.id);
      setCalendarData(data);
    } catch {
      message.error('加载日历数据失败');
    }
  }, [currentMonth, user?.id]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getPersonalSummary(currentMonth.year(), currentMonth.month() + 1);
      setSummary(data);
    } catch {
      message.error('加载统计摘要失败');
    }
  }, [currentMonth]);

  const fetchEntries = useCallback(async () => {
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const data = await getTimeEntries({ startDate: dateStr, endDate: dateStr });
      setEntries(data);
    } catch {
      message.error('加载工时记录失败');
    }
  }, [selectedDate]);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => message.error('加载项目列表失败'));
  }, []);

  useEffect(() => {
    fetchCalendarData();
    fetchSummary();
  }, [fetchCalendarData, fetchSummary]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handlePrevMonth = () => {
    const prev = currentMonth.subtract(1, 'month');
    setCurrentMonth(prev);
  };

  const handleNextMonth = () => {
    const next = currentMonth.add(1, 'month');
    setCurrentMonth(next);
  };

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  const handlePanelChange = (date: Dayjs) => {
    setCurrentMonth(date);
  };

  const getCalendarDayInfo = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    return calendarData.find(d => d.entry_date === dateStr);
  };

  const cellRender = (date: Dayjs) => {
    const info = getCalendarDayInfo(date);
    if (!info) {
      return (
        <div className="w-full h-full min-h-[28px] rounded cursor-pointer hover:bg-gray-100 transition-colors">
          <div className="text-xs text-gray-300 text-center">{date.date()}</div>
        </div>
      );
    }
    const isOvertime = info.overtime_hours > 0;
    const bgClass = isOvertime ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300';
    return (
      <div className={`w-full h-full min-h-[28px] rounded cursor-pointer border ${bgClass} hover:opacity-80 transition-opacity`}>
        <div className={`text-xs text-center ${isOvertime ? 'text-red-600' : 'text-green-700'}`}>{date.date()}</div>
        <div className={`text-[10px] text-center ${isOvertime ? 'text-red-500' : 'text-green-600'}`}>{info.total_hours}h</div>
      </div>
    );
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setForm({
      task_name: entry.task_name,
      hours: entry.hours,
      project_id: entry.project_id,
      description: entry.description || '',
    });
    setModalOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!form.task_name.trim()) {
      message.warning('请输入任务名称');
      return;
    }
    if (!form.hours || form.hours <= 0) {
      message.warning('请输入有效工时');
      return;
    }
    try {
      if (editingEntry) {
        await updateTimeEntry(editingEntry.id, {
          task_name: form.task_name,
          hours: form.hours,
          project_id: form.project_id,
          description: form.description,
        });
        message.success('更新成功');
      }
      setModalOpen(false);
      fetchEntries();
      fetchCalendarData();
      fetchSummary();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      await deleteTimeEntry(id);
      message.success('删除成功');
      fetchEntries();
      fetchCalendarData();
      fetchSummary();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (entries.length === 0) {
      message.warning('没有可提交的工时记录');
      return;
    }
    const submittable = entries.filter(e => e.status === 'pending' || e.status === 'rejected');
    if (submittable.length === 0) {
      message.info('当前日期没有待提交的记录');
      return;
    }
    setLoading(true);
    try {
      await saveTimeEntries(
        submittable.map(e => ({
          task_name: e.task_name,
          hours: e.hours,
          project_id: e.project_id,
          description: e.description,
          entry_date: selectedDate.format('YYYY-MM-DD'),
        }))
      );
      message.success('提交成功');
      fetchEntries();
      fetchCalendarData();
      fetchSummary();
    } catch {
      message.error('提交失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAndSubmit = async () => {
    if (!form.task_name.trim()) {
      message.warning('请输入任务名称');
      return;
    }
    setLoading(true);
    try {
      await saveTimeEntries([{
        task_name: form.task_name,
        hours: form.hours,
        project_id: form.project_id,
        description: form.description,
        entry_date: selectedDate.format('YYYY-MM-DD'),
      }]);
      message.success('添加并提交成功');
      setModalOpen(false);
      fetchEntries();
      fetchCalendarData();
      fetchSummary();
    } catch {
      message.error('提交失败');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const isOvertime = totalHours > 8;

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'orange', icon: <Clock className="w-3 h-3" />, label: '待审批' },
    approved: { color: 'green', icon: <CheckCircle2 className="w-3 h-3" />, label: '已通过' },
    rejected: { color: 'red', icon: <XCircle className="w-3 h-3" />, label: '已打回' },
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ChevronLeft className="w-4 h-4" />} onClick={handlePrevMonth} />
          <span className="text-lg font-semibold text-gray-800 min-w-[140px] text-center">
            {currentMonth.format('YYYY年MM月')}
          </span>
          <Button icon={<ChevronRight className="w-4 h-4" />} onClick={handleNextMonth} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card size="small" className="border-l-4 border-l-blue-500">
          <div className="text-sm text-gray-500">出勤天数</div>
          <div className="text-2xl font-bold text-blue-600">{summary?.work_days ?? 0}</div>
        </Card>
        <Card size="small" className="border-l-4 border-l-green-500">
          <div className="text-sm text-gray-500">已批工时</div>
          <div className="text-2xl font-bold text-green-600">{summary?.approved_hours?.toFixed(1) ?? '0.0'}</div>
        </Card>
        <Card size="small" className="border-l-4 border-l-orange-500">
          <div className="text-sm text-gray-500">待批工时</div>
          <div className="text-2xl font-bold text-orange-600">{summary?.pending_hours?.toFixed(1) ?? '0.0'}</div>
        </Card>
        <Card size="small" className="border-l-4 border-l-red-500">
          <div className="text-sm text-gray-500">加班工时</div>
          <div className="text-2xl font-bold text-red-600">{summary?.overtime_hours?.toFixed(1) ?? '0.0'}</div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5">
          <Card size="small" title="日历" className="shadow-sm">
            <Calendar
              fullscreen={false}
              value={selectedDate}
              onSelect={handleDateSelect}
              onPanelChange={handlePanelChange}
              cellRender={(current, info) => {
                if (info.type === 'date') return cellRender(current);
                return info.originNode;
              }}
            />
          </Card>
        </div>

        <div className="col-span-7">
          <Card
            size="small"
            title={
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">
                  {selectedDate.format('YYYY年MM月DD日')}
                </span>
                <Button type="primary" size="small" icon={<Plus className="w-3.5 h-3.5" />} onClick={openAddModal}>
                  添加任务
                </Button>
              </div>
            }
            className="shadow-sm"
          >
            {entries.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <div>暂无工时记录，点击"添加任务"开始填写</div>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map(entry => {
                  const status = statusConfig[entry.status] || statusConfig.pending;
                  return (
                    <div key={entry.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800 truncate">{entry.task_name}</span>
                            <Tag color={status.color} icon={status.icon} className="text-xs">
                              {status.label}
                            </Tag>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {entry.hours}小时
                            </span>
                            {entry.project_name && (
                              <span className="text-blue-600">{entry.project_name}</span>
                            )}
                          </div>
                          {entry.description && (
                            <div className="mt-1 text-xs text-gray-400 truncate">{entry.description}</div>
                          )}
                        </div>
                        {(entry.status === 'pending' || entry.status === 'rejected') && (
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              type="text"
                              size="small"
                              icon={<Edit3 className="w-3.5 h-3.5" />}
                              onClick={() => openEditModal(entry)}
                            />
                            <Popconfirm title="确定删除？" onConfirm={() => handleDeleteEntry(entry.id)}>
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                              />
                            </Popconfirm>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-lg z-50">
        <div className="flex items-center gap-4">
          <span className="text-gray-600">
            当日总工时：<span className={`text-xl font-bold ${isOvertime ? 'text-red-600' : 'text-green-600'}`}>{totalHours.toFixed(1)}</span> 小时
          </span>
          {isOvertime && (
            <Badge count="加班" style={{ backgroundColor: '#ef4444' }} />
          )}
        </div>
        <Button
          type="primary"
          size="large"
          icon={<Send className="w-4 h-4" />}
          loading={loading}
          onClick={handleSubmit}
          disabled={entries.length === 0}
        >
          提交工时
        </Button>
      </div>

      <Modal
        title={editingEntry ? '编辑任务' : '添加任务'}
        open={modalOpen}
        onOk={editingEntry ? handleSaveEntry : handleAddAndSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingEntry ? '保存' : '添加并提交'}
        confirmLoading={loading}
        destroyOnClose
      >
        <div className="space-y-4 py-2">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">任务名称</div>
            <Input
              placeholder="请输入任务名称"
              value={form.task_name}
              onChange={e => setForm({ ...form, task_name: e.target.value })}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">工时（小时）</div>
            <InputNumber
              min={0.5}
              max={12}
              step={0.5}
              value={form.hours}
              onChange={v => setForm({ ...form, hours: v ?? 0.5 })}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">所属项目</div>
            <Select
              placeholder="请选择项目"
              value={form.project_id}
              onChange={v => setForm({ ...form, project_id: v })}
              className="w-full"
              options={projects.map(p => ({ label: p.name, value: p.id }))}
              allowClear
            />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">工作描述</div>
            <TextArea
              rows={3}
              placeholder="请输入工作描述"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
