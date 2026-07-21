"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Problem, type Project } from "@/lib/api";

export default function LedgerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState(1);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  // 筛选
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [keyword, setKeyword] = useState("");

  // 详情
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 整改反馈
  const [feedbackText, setFeedbackText] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [operator, setOperator] = useState("");

  // 删除确认
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProblems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProblems({
        project_id: selectedProject,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        risk_level: filterRisk || undefined,
        keyword: keyword || undefined,
      });
      setProblems(data);
    } catch (err) {
      console.error("加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, filterStatus, filterCategory, filterRisk, keyword]);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const openDetail = async (id: number) => {
    try {
      const detail = await api.getProblem(id);
      setSelectedProblem(detail);
      setShowDetail(true);
    } catch (err) {
      console.error("获取详情失败:", err);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedProblem) return;
    try {
      await api.updateStatus(selectedProblem.id, status, operator || "监理员");
      const updated = await api.getProblem(selectedProblem.id);
      setSelectedProblem(updated);
      loadProblems();
    } catch (err) {
      console.error("状态更新失败:", err);
    }
  };

  const handleRectification = async () => {
    if (!selectedProblem || !feedbackText.trim()) return;
    try {
      await api.submitRectification(selectedProblem.id, feedbackText, operator || "施工方");
      setFeedbackText("");
      const updated = await api.getProblem(selectedProblem.id);
      setSelectedProblem(updated);
      loadProblems();
    } catch (err) {
      console.error("提交失败:", err);
    }
  };

  const handleReview = async (result: string) => {
    if (!selectedProblem) return;
    try {
      await api.submitReview(selectedProblem.id, result, reviewComment, operator || "监理员");
      setReviewComment("");
      const updated = await api.getProblem(selectedProblem.id);
      setSelectedProblem(updated);
      loadProblems();
    } catch (err) {
      console.error("复查失败:", err);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await api.deleteProblem(id);
      // 如果删除的是当前查看详情的条目，关闭弹窗
      if (selectedProblem?.id === id) {
        setShowDetail(false);
        setSelectedProblem(null);
      }
      loadProblems();
    } catch (err) {
      console.error("删除失败:", err);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const riskClass = (level: string) => {
    if (level === "重大") return "risk-major";
    if (level === "较大") return "risk-larger";
    return "risk-normal";
  };

  const statusClass = (status: string) => {
    const map: Record<string, string> = {
      "待整改": "status-pending",
      "整改中": "status-progress",
      "待复查": "status-review",
      "已销项": "status-closed",
      "未通过": "status-failed",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">闭环台账</h1>
          <p className="text-sm text-gray-500 mt-1">问题从发现到销项的全过程跟踪管理</p>
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

      {/* 筛选栏 */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">全部状态</option>
          <option value="待整改">待整改</option>
          <option value="整改中">整改中</option>
          <option value="待复查">待复查</option>
          <option value="已销项">已销项</option>
          <option value="未通过">未通过</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">全部类别</option>
          <option value="QM">质量管理</option>
          <option value="SM">安全管理</option>
          <option value="CM">文明施工管理</option>
          <option value="PM">进度管理</option>
        </select>
        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">全部风险</option>
          <option value="一般">一般</option>
          <option value="较大">较大</option>
          <option value="重大">重大</option>
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索关键词..."
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
        />
        <button
          onClick={loadProblems}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          查询
        </button>
        <span className="text-sm text-gray-500 ml-auto">共 {problems.length} 条</span>
      </div>

      {/* 台账表格 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">加载中...</div>
        ) : problems.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm">暂无问题记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs">
                  <th className="text-left py-3 px-4 font-medium">问题编号</th>
                  <th className="text-left py-3 px-4 font-medium">发现日期</th>
                  <th className="text-left py-3 px-4 font-medium">巡视区域</th>
                  <th className="text-left py-3 px-4 font-medium">问题描述</th>
                  <th className="text-left py-3 px-4 font-medium">类别</th>
                  <th className="text-left py-3 px-4 font-medium">风险</th>
                  <th className="text-left py-3 px-4 font-medium">责任单位</th>
                  <th className="text-left py-3 px-4 font-medium">整改期限</th>
                  <th className="text-left py-3 px-4 font-medium">状态</th>
                  <th className="text-left py-3 px-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs text-blue-600">{p.problem_no}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{p.inspection_date}</td>
                    <td className="py-3 px-4 text-gray-700 max-w-32 truncate">{p.inspection_area}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-48 truncate">{p.standardized_desc || p.raw_description}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{p.category_name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${riskClass(p.risk_level)}`}>{p.risk_level}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs max-w-32 truncate">{p.responsible_party}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{p.rectification_deadline}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusClass(p.status)}`}>{p.status}</span>
                      {p.is_overdue && <span className="ml-1 text-xs text-red-500">超期</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDetail(p.id)}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          详情
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="text-red-500 text-xs hover:underline"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetail && selectedProblem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-800">问题详情</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">{selectedProblem.problem_no}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* 基本信息 */}
              <div className="grid grid-cols-3 gap-4">
                <InfoItem label="巡视区域" value={selectedProblem.inspection_area} />
                <InfoItem label="巡视人" value={selectedProblem.inspector} />
                <InfoItem label="发现日期" value={selectedProblem.inspection_date} />
              </div>

              {/* 分类标签 */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{selectedProblem.category_name}</span>
                <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">{selectedProblem.specialty_name}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${riskClass(selectedProblem.risk_level)}`}>{selectedProblem.risk_level}风险</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass(selectedProblem.status)}`}>{selectedProblem.status}</span>
              </div>

              {/* 原始描述 vs 标准化描述 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">原始描述</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{selectedProblem.raw_description}</div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">标准化描述</label>
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-700">{selectedProblem.standardized_desc}</div>
                </div>
              </div>

              {/* 整改信息 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">整改要求</label>
                <div className="p-3 bg-amber-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{selectedProblem.rectification_req}</div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <InfoItem label="整改期限" value={selectedProblem.rectification_deadline} />
                <InfoItem label="责任单位" value={selectedProblem.responsible_party || "-"} />
                <InfoItem label="AI置信度" value={`${(selectedProblem.ai_confidence * 100).toFixed(0)}%`} />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">复查要点</label>
                <div className="p-3 bg-green-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{selectedProblem.review_points}</div>
              </div>

              {/* 闭环操作区 */}
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">闭环操作</h3>

                {/* 状态流转按钮 */}
                <div className="flex flex-wrap gap-2">
                  {selectedProblem.status === "待整改" && (
                    <button onClick={() => handleStatusChange("整改中")} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
                      标记为整改中
                    </button>
                  )}
                  {(selectedProblem.status === "待整改" || selectedProblem.status === "整改中") && (
                    <>
                      <input
                        type="text"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="输入整改反馈..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button onClick={handleRectification} disabled={!feedbackText.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300">
                        提交整改反馈
                      </button>
                    </>
                  )}
                  {selectedProblem.status === "待复查" && (
                    <>
                      <input
                        type="text"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="复查意见..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button onClick={() => handleReview("通过")} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                        ✓ 复查通过（销项）
                      </button>
                      <button onClick={() => handleReview("不通过")} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                        ✗ 复查不通过（退回）
                      </button>
                    </>
                  )}
                  {selectedProblem.status === "已销项" && (
                    <div className="text-sm text-green-600 font-medium">✓ 该问题已销项闭环</div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="操作人姓名"
                    className="w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* 操作记录 */}
                {selectedProblem.records && selectedProblem.records.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">操作记录</label>
                    <div className="space-y-2">
                      {selectedProblem.records.map((r) => (
                        <div key={r.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs whitespace-nowrap">{r.record_type}</span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">{r.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{r.operator} · {r.created_at.slice(0, 19).replace("T", " ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 危险操作区 */}
              <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">此操作不可恢复</span>
                <button
                  onClick={() => setDeleteConfirmId(selectedProblem.id)}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  删除此问题
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-6" onClick={() => !deleting && setDeleteConfirmId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-6">
              该问题及其所有操作记录将被永久删除，此操作不可恢复。确定要继续吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <p className="text-sm text-gray-700">{value || "-"}</p>
    </div>
  );
}
