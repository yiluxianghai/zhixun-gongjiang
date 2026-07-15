"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type AnalysisResult, type Project } from "@/lib/api";

type TabType = "text" | "image" | "excel";

export default function InputPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("text");

  // 表单
  const [projectId, setProjectId] = useState(1);
  const [inspectionArea, setInspectionArea] = useState("");
  const [inspector, setInspector] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [rawDescription, setRawDescription] = useState("");

  // AI分析
  const [analyzing, setAnalyzing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<AnalysisResult | null>(null);

  // 保存
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 图片上传
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel导入
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelResult, setExcelResult] = useState<{
    total: number;
    success: number;
    fail: number;
    results: Array<Record<string, unknown>>;
  } | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  // ========== 图片上传 ==========

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage("");
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const result = await api.uploadPhoto(file);
        setUploadedPhotos((prev) => [...prev, result.url]);
      }
    } catch (err) {
      setMessage(`图片上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handlePhotoUpload(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) handlePhotoUpload({ 0: file, length: 1, item: () => file } as unknown as FileList);
      }
    }
  };

  const removePhoto = (url: string) => {
    setUploadedPhotos((prev) => prev.filter((u) => u !== url));
  };

  // ========== AI分析 ==========

  const handleAnalyze = async () => {
    if (!rawDescription.trim()) {
      setMessage("请输入问题描述");
      return;
    }
    setAnalyzing(true);
    setMessage("");
    try {
      const result = await api.analyzeProblem({
        project_id: projectId,
        inspection_area: inspectionArea,
        inspector: inspector,
        inspection_date: inspectionDate,
        raw_description: rawDescription,
      });
      setEditedAnalysis(result);
    } catch (err) {
      setMessage(`分析失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ========== 保存 ==========

  const handleSave = async () => {
    if (!editedAnalysis) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await api.createProblem({
        project_id: projectId,
        inspection_area: inspectionArea,
        inspector: inspector,
        inspection_date: inspectionDate,
        raw_description: rawDescription,
        standardized_desc: editedAnalysis.standardized_description,
        category_code: editedAnalysis.category_code,
        category_name: editedAnalysis.category_name,
        specialty_code: editedAnalysis.specialty_code,
        specialty_name: editedAnalysis.specialty_name,
        risk_level: editedAnalysis.risk_level,
        risk_reason: editedAnalysis.risk_reason,
        rectification_req: editedAnalysis.rectification_req,
        rectification_deadline_days: editedAnalysis.rectification_deadline_days,
        review_points: editedAnalysis.review_points,
        responsible_party: editedAnalysis.responsible_party,
        confidence: editedAnalysis.confidence,
        photo_urls: JSON.stringify(uploadedPhotos),
      });
      setMessage(`保存成功！问题编号：${result.problem_no}`);
      setTimeout(() => router.push("/ledger"), 1500);
    } catch (err) {
      setMessage(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // ========== Excel导入 ==========

  const handleExcelImport = async (file: File | null) => {
    if (!file) return;
    setExcelImporting(true);
    setMessage("");
    setExcelResult(null);
    try {
      const result = await api.importExcel(projectId, file);
      setExcelResult(result);
      setMessage(`导入完成: 成功 ${result.success} 条, 失败 ${result.fail} 条`);
    } catch (err) {
      setMessage(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExcelImporting(false);
    }
  };

  // 下载Excel模板
  const downloadTemplate = () => {
    const csv = "巡视区域,巡视人,发现日期,问题描述\nA区地下室顶板,王永春,2025-07-14,模板支撑体系扫地杆缺失\nB区外脚手架,林祖泉,2025-07-14,连墙件设置不足安全网破损";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "巡视问题导入模板.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskClass = (level: string) => {
    if (level === "重大") return "risk-major";
    if (level === "较大") return "risk-larger";
    return "risk-normal";
  };

  const examples = [
    "顶板模板支撑体系扫地杆缺失，部分立杆间距偏大约1.2m",
    "脚手架连墙件设置不足，安全网局部破损",
    "地下室钢筋绑扎间距不均匀，保护层垫块不足",
    "临时用电配电箱未设漏电保护器，电线裸露",
    "现场材料堆放混乱，裸露土方未覆盖防尘网",
  ];

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "text", label: "文字输入", icon: "✏️" },
    { key: "image", label: "图片上传", icon: "📷" },
    { key: "excel", label: "Excel导入", icon: "📊" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">问题输入与智能分析</h1>
        <p className="text-sm text-gray-500 mt-1">支持文字输入、现场照片上传、Excel批量导入三种方式</p>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setMessage(""); }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("成功") || message.includes("完成") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* ========== 文字输入 / 图片上传 共用表单 + AI分析 ========== */}
      {(activeTab === "text" || activeTab === "image") && (
        <div className="grid grid-cols-2 gap-6">
          {/* 左侧：输入区 */}
          <div className="space-y-4">
            <div className="card p-6">
              {/* 项目选择 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">项目</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">巡视区域/部位</label>
                    <input
                      type="text"
                      value={inspectionArea}
                      onChange={(e) => setInspectionArea(e.target.value)}
                      placeholder="如：A区地下室顶板"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">巡视人</label>
                    <input
                      type="text"
                      value={inspector}
                      onChange={(e) => setInspector(e.target.value)}
                      placeholder="如：王永春"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">发现日期</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* 图片上传区域 */}
                {activeTab === "image" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">现场照片</label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onPaste={handlePaste}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                        dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
                      }`}
                    >
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-sm text-gray-500">点击或拖拽图片到此处上传</p>
                      <p className="text-xs text-gray-400 mt-1">支持 JPG / PNG / WebP / GIF，可粘贴截图</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files)}
                      />
                    </div>

                    {/* 已上传图片预览 */}
                    {uploadedPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {uploadedPhotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`照片${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                            <button
                              onClick={(e) => { e.stopPropagation(); removePhoto(url); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {uploading && <p className="text-xs text-blue-500 mt-2">上传中...</p>}
                  </div>
                )}

                {/* 问题描述 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {activeTab === "image" ? "问题描述（根据照片填写）" : "问题描述"}
                  </label>
                  <textarea
                    value={rawDescription}
                    onChange={(e) => setRawDescription(e.target.value)}
                    placeholder={
                      activeTab === "image"
                        ? "根据上传的现场照片，描述发现的问题部位、现象和风险情况..."
                        : "请输入现场巡视发现的问题描述，可尽量详细描述问题部位、现象和风险情况..."
                    }
                    rows={activeTab === "image" ? 4 : 5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>

                {/* 示例 */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">示例问题（点击填入）：</p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setRawDescription(ex)}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition"
                      >
                        {ex.slice(0, 15)}...
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !rawDescription.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  {analyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span> AI智能分析中...
                    </span>
                  ) : (
                    "🤖 AI智能分析"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：AI分析结果 */}
          <div className="space-y-4">
            {!editedAnalysis ? (
              <div className="card p-12 flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-sm">输入问题描述后点击"AI智能分析"</p>
                <p className="text-xs mt-2">系统将自动识别问题类别、专业类型、风险等级</p>
                <p className="text-xs">并生成标准化描述、整改要求和复查要点</p>
              </div>
            ) : (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">AI分析结果</h3>
                  <span className="text-xs text-gray-400">
                    置信度: {(editedAnalysis.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {editedAnalysis.category_name}
                  </span>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                    {editedAnalysis.specialty_name}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${riskClass(editedAnalysis.risk_level)}`}>
                    {editedAnalysis.risk_level}风险
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">标准化描述</label>
                  <textarea
                    value={editedAnalysis.standardized_description}
                    onChange={(e) => setEditedAnalysis({ ...editedAnalysis, standardized_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">风险定级理由</label>
                  <input
                    type="text"
                    value={editedAnalysis.risk_reason}
                    onChange={(e) => setEditedAnalysis({ ...editedAnalysis, risk_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">整改要求</label>
                  <textarea
                    value={editedAnalysis.rectification_req}
                    onChange={(e) => setEditedAnalysis({ ...editedAnalysis, rectification_req: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">整改期限（天）</label>
                    <input
                      type="number"
                      value={editedAnalysis.rectification_deadline_days}
                      onChange={(e) => setEditedAnalysis({ ...editedAnalysis, rectification_deadline_days: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">责任主体</label>
                    <input
                      type="text"
                      value={editedAnalysis.responsible_party}
                      onChange={(e) => setEditedAnalysis({ ...editedAnalysis, responsible_party: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">复查要点</label>
                  <textarea
                    value={editedAnalysis.review_points}
                    onChange={(e) => setEditedAnalysis({ ...editedAnalysis, review_points: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setEditedAnalysis(null); }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    重新分析
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 transition"
                  >
                    {saving ? "保存中..." : "✓ 确认保存"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== Excel批量导入 ========== */}
      {activeTab === "excel" && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Excel批量导入</h3>
                <p className="text-xs text-gray-500 mt-1">上传Excel文件，系统自动逐条AI分析并创建问题</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
              >
                📥 下载导入模板
              </button>
            </div>

            {/* 项目选择 */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">导入到项目</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>

            {/* 上传区域 */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleExcelImport(e.dataTransfer.files[0]); }}
              onClick={() => excelInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-12 text-center cursor-pointer transition bg-gray-50"
            >
              <div className="text-5xl mb-3">📊</div>
              <p className="text-sm text-gray-600 font-medium">点击或拖拽Excel文件到此处</p>
              <p className="text-xs text-gray-400 mt-1">支持 .xlsx / .xls 格式，自动识别表头列</p>
              <p className="text-xs text-gray-400">每行数据将自动进行AI分类、定级和整改建议生成</p>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleExcelImport(e.target.files?.[0] || null)}
              />
            </div>

            {excelImporting && (
              <div className="mt-4 flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin text-4xl mb-3">⚙️</div>
                  <p className="text-sm text-gray-500">正在批量AI分析并创建问题，请稍候...</p>
                  <p className="text-xs text-gray-400 mt-1">每条问题都会经过智能分类、风险定级和整改建议生成</p>
                </div>
              </div>
            )}

            {/* 导入结果 */}
            {excelResult && !excelImporting && (
              <div className="mt-6 space-y-4">
                {/* 统计 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">总行数</p>
                    <p className="text-2xl font-bold text-blue-600">{excelResult.total}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">成功导入</p>
                    <p className="text-2xl font-bold text-green-600">{excelResult.success}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">失败</p>
                    <p className="text-2xl font-bold text-red-600">{excelResult.fail}</p>
                  </div>
                </div>

                {/* 明细表 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs">
                        <th className="text-left py-2 px-3">行号</th>
                        <th className="text-left py-2 px-3">状态</th>
                        <th className="text-left py-2 px-3">问题编号</th>
                        <th className="text-left py-2 px-3">巡视区域</th>
                        <th className="text-left py-2 px-3">问题描述</th>
                        <th className="text-left py-2 px-3">类别</th>
                        <th className="text-left py-2 px-3">风险</th>
                        <th className="text-left py-2 px-3">失败原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelResult.results.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-500">{r.row as number}</td>
                          <td className="py-2 px-3">
                            {r.status === "success" ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">成功</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">失败</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-blue-600">{(r.problem_no as string) || "-"}</td>
                          <td className="py-2 px-3 text-gray-700 max-w-32 truncate">{(r.area as string) || "-"}</td>
                          <td className="py-2 px-3 text-gray-600 max-w-40 truncate">{(r.desc as string) || "-"}</td>
                          <td className="py-2 px-3 text-gray-500 text-xs">{(r.category as string) || "-"}</td>
                          <td className="py-2 px-3">
                            {r.risk_level ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${riskClass(r.risk_level as string)}`}>{r.risk_level as string}</span>
                            ) : "-"}
                          </td>
                          <td className="py-2 px-3 text-red-500 text-xs">{(r.reason as string) || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3">
                  <Link href="/ledger" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                    查看台账 →
                  </Link>
                  <button
                    onClick={() => { setExcelResult(null); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    继续导入
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 格式说明 */}
          <div className="card p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Excel格式说明</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <p>• 支持的列名（自动识别）：巡视区域/部位、巡视人/发现人、发现日期/时间、问题描述/问题</p>
              <p>• 如无表头，将按以下固定列顺序解析：第1列=巡视区域，第2列=巡视人，第3列=发现日期，第4列=问题描述</p>
              <p>• 日期格式支持：2025-07-14 或 2025/07/14</p>
              <p>• 问题描述为必填项，空行将自动跳过</p>
              <p>• 每条问题都会自动经过AI智能分析，生成分类、定级、整改建议</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
