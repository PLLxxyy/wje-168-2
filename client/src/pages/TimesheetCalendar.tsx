import { useState, useEffect, useCallback } from 'react';
import { Card, DatePicker, message } from 'antd';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import { getCalendarData } from '../api/timeEntries';
import { getPersonalSummary, getPersonalProjects } from '../api/stats';
import { useAuthStore } from '../store/authStore';
import type { CalendarData, PersonalSummary, ProjectStats } from '../types';

export default function TimesheetCalendar() {
  const { user } = useAuthStore();
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [calendarData, setCalendarData] = useState<CalendarData[]>([]);
  const [summary, setSummary] = useState<PersonalSummary | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);

  const fetchData = useCallback(async () => {
    const year = selectedMonth.year();
    const month = selectedMonth.month() + 1;
    try {
      const [calData, summaryData, projData] = await Promise.all([
        getCalendarData(year, month, user?.id),
        getPersonalSummary(year, month),
        getPersonalProjects(year, month),
      ]);
      setCalendarData(calData);
      setSummary(summaryData);
      setProjectStats(projData);
    } catch {
      message.error('加载数据失败');
    }
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const year = selectedMonth.year();
  const month = selectedMonth.month() + 1;
  const startDate = dayjs(new Date(year, month - 1, 1)).format('YYYY-MM-DD');
  const endDate = dayjs(new Date(year, month, 0)).format('YYYY-MM-DD');

  const heatmapData = calendarData.map(d => [d.entry_date, d.total_hours]);

  const heatmapOption = {
    tooltip: {
      formatter: (params: any) => {
        const date = params.value[0];
        const hours = params.value[1];
        const info = calendarData.find(d => d.entry_date === date);
        const overtime = info?.overtime_hours ?? 0;
        return `<div style="font-size:13px">
          <div style="font-weight:600;margin-bottom:4px">${date}</div>
          <div>总工时: <b>${hours}</b> 小时</div>
          ${overtime > 0 ? `<div style="color:#ef4444">加班: <b>${overtime}</b> 小时</div>` : ''}
        </div>`;
      },
    },
    visualMap: {
      min: 0,
      max: 12,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#e5e7eb', '#86efac', '#22c55e', '#fbbf24', '#ef4444'],
      },
      text: ['12h', '0h'],
      textStyle: { color: '#6b7280' },
    },
    calendar: {
      top: 40,
      left: 60,
      right: 60,
      bottom: 60,
      range: [startDate, endDate],
      cellSize: ['auto', 40],
      splitLine: { show: true, lineStyle: { color: '#e5e7eb' } },
      itemStyle: {
        borderWidth: 2,
        borderColor: '#fff',
      },
      yearLabel: { show: false },
      monthLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        nameMap: 'ZH',
        color: '#6b7280',
        fontSize: 12,
      },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: heatmapData,
        itemStyle: {
          borderRadius: 4,
        },
      },
    ],
  };

  const pieOption = {
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c}h ({d}%)',
    },
    legend: {
      orient: 'vertical' as const,
      right: 10,
      top: 'center',
      textStyle: { fontSize: 12, color: '#6b7280' },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{c}h',
          fontSize: 11,
        },
        data: projectStats.map(p => ({
          name: p.name || '未分配项目',
          value: Number(p.total_hours),
        })),
      },
    ],
    color: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899'],
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={d => d && setSelectedMonth(d)}
            format="YYYY年MM月"
            allowClear={false}
          />
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-600">已填报</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-300" />
              <span className="text-gray-600">未填报</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-gray-600">加班</span>
            </div>
          </div>
        </div>
      </div>

      <Card size="small" title="月度工时热力图" className="shadow-sm">
        {heatmapData.length > 0 ? (
          <ReactECharts option={heatmapOption} style={{ height: 320 }} />
        ) : (
          <div className="py-12 text-center text-gray-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <div>当月暂无工时数据</div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <Card size="small" title="项目工时分布" className="shadow-sm h-full">
            {projectStats.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: 320 }} />
            ) : (
              <div className="py-12 text-center text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <div>当月暂无已通过的项目工时</div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-5">
          <Card size="small" title="月度汇总" className="shadow-sm h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700">出勤天数</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{summary?.work_days ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">天</span></span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">已批工时</span>
                </div>
                <span className="text-xl font-bold text-green-600">{summary?.approved_hours?.toFixed(1) ?? '0.0'}<span className="text-sm font-normal text-gray-500 ml-1">小时</span></span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700">待批工时</span>
                </div>
                <span className="text-xl font-bold text-orange-600">{summary?.pending_hours?.toFixed(1) ?? '0.0'}<span className="text-sm font-normal text-gray-500 ml-1">小时</span></span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <span className="text-gray-700">加班工时</span>
                </div>
                <span className="text-xl font-bold text-red-600">{summary?.overtime_hours?.toFixed(1) ?? '0.0'}<span className="text-sm font-normal text-gray-500 ml-1">小时</span></span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">总记录数</span>
                </div>
                <span className="text-xl font-bold text-gray-700">{summary?.total_entries ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">条</span></span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
