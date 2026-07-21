"use client";

import { useState, useEffect } from "react";
import { api, type Problem, type Project } from "@/lib/api";

type DocType = "notice" | "record" | "ledger" | "report";

interface DocResult {
  type: string;
  title: string;
  content: Record<string, unknown>;
}

export default function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState(1);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeTab, setActiveTab] = useState<DocType>("notice");
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [result, setResult] = useState<DocResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    api.getProblems({ project_id: selectedProject }).then(setProblems).catch(console.error);
  }, [selectedProject]);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage("");
    setResult(null);
    try {
      let data: DocResult;
      if (activeTab === "notice") {
        if (!selectedProblemId) {
          setMessage("请选择一条问题");
          setLoading(false);
          return;
        }
        data = await api.generateNotice(selectedProblemId) as DocResult;
      } else if (activeTab === "record") {
        data = await api.generateInspectionRecord(selectedProject) as DocResult;
      } else if (activeTab === "ledger") {
        data = await api.generateLedger(selectedProject) as DocResult;
      } else {
        data = await api.generateAnalysisReport(selectedProject) as DocResult;
      }
      setResult(data);
    } catch (err) {
      setMessage(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: DocType; label: string; icon: string; desc: string }[] = [
    { key: "notice", label: "监理通知单", icon: "📋", desc: "针对单条问题生成标准化监理通知单" },
    { key: "record", label: "巡视记录", icon: "📝", desc: "生成结构化监理巡视记录表" },
    { key: "ledger", label: "闭环台账", icon: "📊", desc: "导出问题闭环管理台账" },
    { key: "report", label: "分析报告", icon: "📈", desc: "按类别/专业/风险等级统计分析" },
  ];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">成果输出</h1>
          <p className="text-sm text-gray-500 mt-1">自动生成监理通知单、巡视记录、闭环台账和分析报告</p>
        </div>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.project_name}</option>
          ))}
        </select>
      </div>

      {message && (
        <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{message}</div>
      )}

      {/* 标签页 */}
      <div className="grid grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setResult(null); setMessage(""); }}
            className={`p-4 rounded-xl border-2 text-left transition ${
              activeTab === tab.key
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">{tab.icon}</div>
            <div className={`text-sm font-medium ${activeTab === tab.key ? "text-blue-700" : "text-gray-700"}`}>{tab.label}</div>
            <div className="text-xs text-gray-400 mt-1">{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* 操作区 */}
      <div className="card p-6">
        {activeTab === "notice" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">选择问题</label>
            <select
              value={selectedProblemId || ""}
              onChange={(e) => setSelectedProblemId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">请选择一条问题</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.problem_no}] {p.inspection_area} - {(p.standardized_desc || p.raw_description).slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition"
        >
          {loading ? "生成中..." : `生成${tabs.find((t) => t.key === activeTab)?.label}`}
        </button>
      </div>

      {/* 结果展示 */}
      {result && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{result.title}</h3>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              🖨️ 打印
            </button>
          </div>

          {activeTab === "notice" && <NoticeView content={result.content} />}
          {activeTab === "record" && <RecordView content={result.content} />}
          {activeTab === "ledger" && <LedgerView content={result.content} />}
          {activeTab === "report" && <ReportView content={result.content} />}
        </div>
      )}
    </div>
  );
}

// ========== 监理通知单视图 ==========
function NoticeView({ content }: { content: Record<string, unknown> }) {
  const c = content as {
    notice_no: string;
    project_name: string;
    to_unit: string;
    subject: string;
    problem_detail: {
      problem_no: string;
      inspection_date: string;
      inspection_area: string;
      inspector: string;
      problem_description: string;
      category: string;
      specialty: string;
      risk_level: string;
    };
    rectification_requirements: string;
    rectification_deadline: string;
    review_points: string;
    supervision_unit: string;
    issue_date: string;
    remark: string;
  };

  return (
    <div className="space-y-5">
      <div className="text-center border-b border-gray-300 pb-4">
        <h2 className="text-xl font-bold">监理通知单</h2>
        <p className="text-sm text-gray-500 mt-1">{c.notice_no}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">工程名称：</span>{c.project_name}</div>
        <div><span className="text-gray-500">致：</span>{c.to_unit}</div>
      </div>

      <div className="text-sm">
        <span className="text-gray-500">事由：</span>{c.subject}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="text-sm font-semibold mb-3">问题详情</h4>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="text-gray-500 py-1 w-28">问题编号</td><td className="font-mono text-blue-600">{c.problem_detail.problem_no}</td></tr>
            <tr><td className="text-gray-500 py-1">巡视日期</td><td>{c.problem_detail.inspection_date}</td></tr>
            <tr><td className="text-gray-500 py-1">问题部位</td><td>{c.problem_detail.inspection_area}</td></tr>
            <tr><td className="text-gray-500 py-1">巡视人</td><td>{c.problem_detail.inspector}</td></tr>
            <tr><td className="text-gray-500 py-1">问题类别</td><td>{c.problem_detail.category} / {c.problem_detail.specialty}</td></tr>
            <tr><td className="text-gray-500 py-1">风险等级</td><td className="font-medium text-orange-600">{c.problem_detail.risk_level}</td></tr>
            <tr><td className="text-gray-500 py-1 align-top">问题描述</td><td>{c.problem_detail.problem_description}</td></tr>
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">整改要求</h4>
        <div className="p-3 bg-amber-50 rounded-lg text-sm whitespace-pre-wrap">{c.rectification_requirements}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">整改期限</h4>
          <p className="text-sm text-red-600 font-medium">{c.rectification_deadline}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">复查要点</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.review_points}</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-600">{c.remark}</div>

      <div className="flex justify-end mt-8">
        <div className="text-right text-sm">
          <p>监理单位：{c.supervision_unit}</p>
          <p className="mt-1">签发日期：{c.issue_date}</p>
          <p className="mt-4 text-gray-400">（盖章）</p>
        </div>
      </div>
    </div>
  );
}

// ========== 巡视记录视图 ==========
function RecordView({ content }: { content: Record<string, unknown> }) {
  const c = content as {
    record_no: string;
    project_name: string;
    inspection_date: string;
    inspection_areas: string[];
    inspectors: string[];
    problem_count: number;
    problems: Array<{ no: string; area: string; description: string; category: string; risk_level: string; status: string }>;
    handling_opinion: string;
    supervision_unit: string;
    message?: string;
  };

  if (c.message) {
    return <div className="text-center text-gray-400 py-8">{c.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-center border-b border-gray-300 pb-4">
        <h2 className="text-xl font-bold">监理巡视记录</h2>
        <p className="text-sm text-gray-500 mt-1">{c.record_no}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">工程名称：</span>{c.project_name}</div>
        <div><span className="text-gray-500">巡视日期：</span>{c.inspection_date}</div>
        <div><span className="text-gray-500">巡视区域：</span>{c.inspection_areas.join("、")}</div>
        <div><span className="text-gray-500">巡视人员：</span>{c.inspectors.join("、")}</div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 px-3">编号</th>
              <th className="text-left py-2 px-3">巡视区域</th>
              <th className="text-left py-2 px-3">问题描述</th>
              <th className="text-left py-2 px-3">类别</th>
              <th className="text-left py-2 px-3">风险</th>
              <th className="text-left py-2 px-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {c.problems.map((p, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-3 font-mono text-xs text-blue-600">{p.no}</td>
                <td className="py-2 px-3 text-gray-700">{p.area}</td>
                <td className="py-2 px-3 text-gray-600 max-w-xs">{p.description}</td>
                <td className="py-2 px-3 text-gray-500 text-xs">{p.category}</td>
                <td className="py-2 px-3 text-xs">{p.risk_level}</td>
                <td className="py-2 px-3 text-xs">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">处理意见</h4>
        <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">{c.handling_opinion}</p>
      </div>

      <div className="flex justify-end text-sm text-gray-500">
        <p>监理单位：{c.supervision_unit}</p>
      </div>
    </div>
  );
}

// ========== 闭环台账视图 ==========
function LedgerView({ content }: { content: Record<string, unknown> }) {
  const c = content as {
    total: number;
    status_summary: Record<string, number>;
    category_summary: Record<string, number>;
    risk_summary: Record<string, number>;
    items: Array<Record<string, string>>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">总数</p>
          <p className="text-2xl font-bold text-blue-600">{c.total}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">已销项</p>
          <p className="text-2xl font-bold text-green-600">{c.status_summary["已销项"] || 0}</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">待整改</p>
          <p className="text-2xl font-bold text-red-600">{c.status_summary["待整改"] || 0}</p>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">较大/重大风险</p>
          <p className="text-2xl font-bold text-orange-600">{(c.risk_summary["较大"] || 0) + (c.risk_summary["重大"] || 0)}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
              <th className="text-left py-2 px-2">编号</th>
              <th className="text-left py-2 px-2">日期</th>
              <th className="text-left py-2 px-2">区域</th>
              <th className="text-left py-2 px-2">描述</th>
              <th className="text-left py-2 px-2">类别</th>
              <th className="text-left py-2 px-2">风险</th>
              <th className="text-left py-2 px-2">责任单位</th>
              <th className="text-left py-2 px-2">期限</th>
              <th className="text-left py-2 px-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {c.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 px-2 font-mono text-blue-600">{item.problem_no}</td>
                <td className="py-1.5 px-2 text-gray-500">{item.inspection_date}</td>
                <td className="py-1.5 px-2 text-gray-700 max-w-24 truncate">{item.inspection_area}</td>
                <td className="py-1.5 px-2 text-gray-600 max-w-40 truncate">{item.description}</td>
                <td className="py-1.5 px-2 text-gray-500">{item.category}</td>
                <td className="py-1.5 px-2">{item.risk_level}</td>
                <td className="py-1.5 px-2 text-gray-500 max-w-24 truncate">{item.responsible_party}</td>
                <td className="py-1.5 px-2 text-gray-500">{item.rectification_deadline}</td>
                <td className="py-1.5 px-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== 分析报告视图 ==========
function ReportView({ content }: { content: Record<string, unknown> }) {
  const c = content as {
    project_name: string;
    report_date: string;
    summary: {
      total_problems: number;
      closure_rate: number;
      overdue_count: number;
      pending_count: number;
      in_progress_count: number;
      review_count: number;
      closed_count: number;
    };
    category_distribution: Record<string, number>;
    risk_distribution: Record<string, number>;
    status_distribution: Record<string, number>;
    area_distribution: Record<string, number>;
    top_areas: Array<{ area: string; count: number }>;
    top_categories: Array<{ category: string; count: number }>;
    analysis: string;
    suggestions: string[];
    message?: string;
  };

  if (c.message) {
    return <div className="text-center text-gray-400 py-8">{c.message}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="text-center border-b border-gray-300 pb-4">
        <h2 className="text-xl font-bold">问题分析报告</h2>
        <p className="text-sm text-gray-500 mt-1">{c.project_name} · {c.report_date}</p>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-5 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">问题总数</p>
          <p className="text-xl font-bold text-blue-600">{c.summary.total_problems}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">闭环率</p>
          <p className="text-xl font-bold text-green-600">{c.summary.closure_rate}%</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">超期数</p>
          <p className="text-xl font-bold text-red-600">{c.summary.overdue_count}</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">待整改</p>
          <p className="text-xl font-bold text-amber-600">{c.summary.pending_count}</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">已销项</p>
          <p className="text-xl font-bold text-purple-600">{c.summary.closed_count}</p>
        </div>
      </div>

      {/* 分布统计 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">类别分布</h4>
          {Object.entries(c.category_distribution).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-600 w-24">{cat}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.summary.total_problems > 0 ? (count / c.summary.total_problems * 100) : 0}%` }} />
              </div>
              <span className="text-xs font-medium w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">风险分布</h4>
          {Object.entries(c.risk_distribution).map(([risk, count]) => (
            <div key={risk} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-600 w-12">{risk}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                <div className={`h-full rounded-full ${risk === "重大" ? "bg-red-400" : risk === "较大" ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${c.summary.total_problems > 0 ? (count / c.summary.total_problems * 100) : 0}%` }} />
              </div>
              <span className="text-xs font-medium w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 高频区域 */}
      {c.top_areas && c.top_areas.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">问题高发区域 Top 3</h4>
          <div className="flex gap-3">
            {c.top_areas.map((item, i) => (
              <div key={i} className="flex-1 p-3 border border-gray-200 rounded-lg text-center">
                <p className="text-xs text-gray-500">No.{i + 1}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{item.area}</p>
                <p className="text-lg font-bold text-blue-600 mt-1">{item.count} 条</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分析文字 */}
      <div>
        <h4 className="text-sm font-semibold mb-2">分析说明</h4>
        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{c.analysis}</div>
      </div>

      {/* 管理建议 */}
      <div>
        <h4 className="text-sm font-semibold mb-2">管理建议</h4>
        <div className="space-y-2">
          {c.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
              <span className="text-amber-500 text-sm">💡</span>
              <p className="text-sm text-gray-700">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
