"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type Dashboard, type Problem, type Project } from "@/lib/api";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number>(1);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [recentProblems, setRecentProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectList, dash, problems] = await Promise.all([
        api.getProjects(),
        api.getDashboard(selectedProject),
        api.getProblems({ project_id: selectedProject }),
      ]);
      setProjects(projectList);
      setDashboard(dash);
      setRecentProblems(problems.slice(0, 8));
    } catch (err) {
      console.error("加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statusMap: Record<string, { label: string; cls: string }> = {
    "待整改": { label: "待整改", cls: "status-pending" },
    "整改中": { label: "整改中", cls: "status-progress" },
    "待复查": { label: "待复查", cls: "status-review" },
    "已销项": { label: "已销项", cls: "status-closed" },
    "未通过": { label: "未通过", cls: "status-failed" },
  };

  const riskClass = (level: string) => {
    if (level === "重大") return "risk-major";
    if (level === "较大") return "risk-larger";
    return "risk-normal";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">首页看板</h1>
          <p className="text-sm text-gray-500 mt-1">监理巡视问题闭环管理总览</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
          <Link
            href="/input"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            + 录入问题
          </Link>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="问题总数" value={dashboard?.total || 0} icon="📋" color="bg-blue-50 text-blue-600" />
        <StatCard title="待整改" value={dashboard?.status_count["待整改"] || 0} icon="⏳" color="bg-red-50 text-red-600" />
        <StatCard title="超期未整改" value={dashboard?.overdue_count || 0} icon="⚠️" color="bg-orange-50 text-orange-600" />
        <StatCard title="闭环率" value={`${dashboard?.closure_rate || 0}%`} icon="✅" color="bg-green-50 text-green-600" />
      </div>

      {/* 分布统计 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 状态分布 */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">状态分布</h3>
          <div className="space-y-3">
            {dashboard && Object.entries(dashboard.status_count).map(([status, count]) => {
              const info = statusMap[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
              const pct = dashboard.total > 0 ? (count / dashboard.total * 100).toFixed(0) : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${info.cls}`}>{info.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 类别分布 */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">类别分布</h3>
          <div className="space-y-3">
            {dashboard && Object.entries(dashboard.category_count).map(([cat, count]) => {
              const pct = dashboard.total > 0 ? (count / dashboard.total * 100).toFixed(0) : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">{count}</span>
                  </div>
                </div>
              );
            })}
            {(!dashboard || Object.keys(dashboard.category_count).length === 0) && (
              <div className="text-sm text-gray-400">暂无数据</div>
            )}
          </div>
        </div>

        {/* 风险分布 */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">风险分布</h3>
          <div className="space-y-3">
            {dashboard && Object.entries(dashboard.risk_count).map(([level, count]) => (
              <div key={level} className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs ${riskClass(level)}`}>{level}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${level === "重大" ? "bg-red-400" : level === "较大" ? "bg-orange-400" : "bg-green-400"}`}
                    style={{ width: `${dashboard.total > 0 ? (count / dashboard.total * 100) : 0}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 最近问题 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-600">最近巡视问题</h3>
          <Link href="/ledger" className="text-xs text-blue-600 hover:underline">查看全部 →</Link>
        </div>
        {recentProblems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">暂无巡视问题记录</p>
            <Link href="/input" className="text-blue-600 text-sm hover:underline mt-2 inline-block">点击录入第一条问题</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                  <th className="text-left py-2 px-3 font-medium">问题编号</th>
                  <th className="text-left py-2 px-3 font-medium">巡视区域</th>
                  <th className="text-left py-2 px-3 font-medium">问题类别</th>
                  <th className="text-left py-2 px-3 font-medium">风险等级</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-left py-2 px-3 font-medium">发现日期</th>
                </tr>
              </thead>
              <tbody>
                {recentProblems.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-xs text-blue-600">{p.problem_no}</td>
                    <td className="py-2 px-3 text-gray-700 max-w-48 truncate">{p.inspection_area}</td>
                    <td className="py-2 px-3 text-gray-600">{p.category_name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${riskClass(p.risk_level)}`}>{p.risk_level}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${(statusMap[p.status] || { cls: "" }).cls}`}>
                        {p.status}
                      </span>
                      {p.is_overdue && <span className="ml-1 text-xs text-red-500">超期</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{p.inspection_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
