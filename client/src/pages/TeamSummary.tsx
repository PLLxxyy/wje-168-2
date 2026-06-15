import { useState, useEffect, useCallback } from 'react';
import { Table, DatePicker, Button, Card, message } from 'antd';
import { Download } from 'lucide-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import { getTeamSummary, getTeamProjects, exportMonthly } from '../api/stats';
import type { TeamMemberSummary, ProjectStats } from '../types';

export default function TeamSummary() {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [summary, setSummary] = useState<TeamMemberSummary[]>([]);
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, projectData] = await Promise.all([
        getTeamSummary(month.year(), month.month() + 1),
        getTeamProjects(month.year(), month.month() + 1),
      ]);
      setSummary(summaryData);
      setProjects(projectData);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const data = await exportMonthly(month.year(), month.month() + 1);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '工时报表');
      XLSX.writeFile(wb, `工时报表_${month.format('YYYY-MM')}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '出勤天数', dataIndex: 'work_days', key: 'work_days', sorter: (a: TeamMemberSummary, b: TeamMemberSummary) => a.work_days - b.work_days },
    { title: '已批工时', dataIndex: 'approved_hours', key: 'approved_hours', sorter: (a: TeamMemberSummary, b: TeamMemberSummary) => a.approved_hours - b.approved_hours, render: (v: number) => v.toFixed(1) },
    { title: '待批工时', dataIndex: 'pending_hours', key: 'pending_hours', sorter: (a: TeamMemberSummary, b: TeamMemberSummary) => a.pending_hours - b.pending_hours, render: (v: number) => v.toFixed(1) },
    { title: '加班工时', dataIndex: 'overtime_hours', key: 'overtime_hours', sorter: (a: TeamMemberSummary, b: TeamMemberSummary) => a.overtime_hours - b.overtime_hours, render: (v: number) => v.toFixed(1) },
  ];

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}h ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}h' },
        data: projects.map((p) => ({ name: p.name || '未分配', value: Number(p.total_hours) })),
      },
    ],
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">团队工时汇总</h1>
        <div className="flex items-center gap-3">
          <DatePicker
            picker="month"
            value={month}
            onChange={(v) => v && setMonth(v)}
          />
          <Button icon={<Download size={14} />} onClick={handleExport}>
            导出报表
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="团队成员汇总">
            <Table
              columns={columns}
              dataSource={summary}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
            />
          </Card>
        </div>
        <div>
          <Card title="项目工时分布">
            {projects.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: 350 }} />
            ) : (
              <div className="text-center text-gray-400 py-12">暂无数据</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
