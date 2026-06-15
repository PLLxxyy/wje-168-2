import { useState, useEffect, useCallback } from 'react';
import { Table, DatePicker, Card, Button, Statistic, Row, Col, message } from 'antd';
import { Download, Users, Clock, Flame, CalendarCheck } from 'lucide-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import { getCompanySummary, getOvertimeRanking, getAttendance, exportMonthly } from '../api/stats';
import type { DepartmentSummary, OvertimeRank, AttendanceData } from '../types';

export default function AdminDashboard() {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [deptSummary, setDeptSummary] = useState<DepartmentSummary[]>([]);
  const [overtimeRank, setOvertimeRank] = useState<OvertimeRank[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dept, overtime, attend] = await Promise.all([
        getCompanySummary(month.year(), month.month() + 1),
        getOvertimeRanking(month.year(), month.month() + 1, 10),
        getAttendance(month.year(), month.month() + 1),
      ]);
      setDeptSummary(dept);
      setOvertimeRank(overtime);
      setAttendance(attend);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalEmployees = deptSummary.reduce((s, d) => s + d.employee_count, 0);
  const totalHours = deptSummary.reduce((s, d) => s + (d.total_hours || 0), 0);
  const totalOvertime = deptSummary.reduce((s, d) => s + (d.total_overtime_hours || 0), 0);
  const avgAttendance = totalEmployees > 0
    ? (deptSummary.reduce((s, d) => s + (d.total_attendance_days || 0), 0) / totalEmployees).toFixed(1)
    : '0';

  const handleExport = async () => {
    try {
      const data = await exportMonthly(month.year(), month.month() + 1);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '月度报表');
      XLSX.writeFile(wb, `月度报表_${month.format('YYYY-MM')}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const deptColumns = [
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '员工数', dataIndex: 'employee_count', key: 'employee_count' },
    { title: '出勤天数', dataIndex: 'total_attendance_days', key: 'total_attendance_days' },
    { title: '总工时', dataIndex: 'total_hours', key: 'total_hours', render: (v: number) => (v || 0).toFixed(1) },
    { title: '加班工时', dataIndex: 'total_overtime_hours', key: 'total_overtime_hours', render: (v: number) => (v || 0).toFixed(1) },
  ];

  const attendColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '填报天数', dataIndex: 'filled_days', key: 'filled_days', sorter: (a: AttendanceData, b: AttendanceData) => a.filled_days - b.filled_days },
  ];

  const barOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: overtimeRank.map((r) => r.name),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '加班工时(h)' },
    series: [
      {
        type: 'bar',
        data: overtimeRank.map((r) => r.overtime_hours.toFixed(1)),
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#ff7875' },
      },
    ],
    grid: { left: 60, right: 20, bottom: 60, top: 20 },
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">管理员仪表盘</h1>
        <div className="flex items-center gap-3">
          <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} />
          <Button icon={<Download size={14} />} onClick={handleExport}>
            导出报表
          </Button>
        </div>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card>
            <Statistic title="总员工数" value={totalEmployees} prefix={<Users size={16} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总工时" value={totalHours.toFixed(1)} prefix={<Clock size={16} />} suffix="h" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总加班" value={totalOvertime.toFixed(1)} prefix={<Flame size={16} />} suffix="h" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均出勤天数" value={avgAttendance} prefix={<CalendarCheck size={16} />} suffix="天" />
          </Card>
        </Col>
      </Row>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="部门汇总">
          <Table
            columns={deptColumns}
            dataSource={deptSummary}
            rowKey="department"
            loading={loading}
            pagination={false}
            size="middle"
          />
        </Card>
        <Card title="加班排行 Top 10">
          {overtimeRank.length > 0 ? (
            <ReactECharts option={barOption} style={{ height: 300 }} />
          ) : (
            <div className="text-center text-gray-400 py-12">暂无加班数据</div>
          )}
        </Card>
      </div>

      <Card title="出勤情况">
        <Table
          columns={attendColumns}
          dataSource={attendance}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
