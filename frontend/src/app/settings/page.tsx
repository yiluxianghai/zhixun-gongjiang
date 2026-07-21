"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type AIModelConfig, type KnowledgeBaseConfig, type AnalysisSkill, type AIConfig, type KnowledgeDocument, type YoloModelInfo } from "@/lib/api";

type TabType = "models" | "knowledge" | "skills";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("models");
  const [message, setMessage] = useState("");

  // 模型
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);

  // 快速API配置
  const [quickProvider, setQuickProvider] = useState('deepseek');
  const [quickApiKey, setQuickApiKey] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // 本地YOLO模型
  const [yoloInfo, setYoloInfo] = useState<YoloModelInfo | null>(null);
  const [yoloActivating, setYoloActivating] = useState(false);

  const providerPresets: Record<string, { name: string; provider: string; base_url: string; model_name: string; label: string; vision: boolean }> = {
    deepseek: { name: 'DeepSeek Chat', provider: 'deepseek', base_url: 'https://api.deepseek.com/v1', model_name: 'deepseek-chat', label: 'DeepSeek（国内直连·性价比高）', vision: false },
    'gpt-4o': { name: 'GPT-4o', provider: 'openai', base_url: 'https://api.openai.com/v1', model_name: 'gpt-4o', label: 'OpenAI GPT-4o（支持图片识别）', vision: true },
    'gpt-4o-mini': { name: 'GPT-4o-mini', provider: 'openai', base_url: 'https://api.openai.com/v1', model_name: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini（便宜）', vision: true },
    glm: { name: 'GLM-4V', provider: 'custom', base_url: 'https://open.bigmodel.cn/api/paas/v4', model_name: 'glm-4v', label: '智谱GLM-4V（支持图片识别）', vision: true },
    qwen: { name: 'Qwen-VL-Plus', provider: 'custom', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model_name: 'qwen-vl-plus', label: '通义千问VL（支持图片识别）', vision: true },
  };

  // 知识库
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseConfig[]>([]);
  const [editingKB, setEditingKB] = useState<KnowledgeBaseConfig | null>(null);
  const [showKBForm, setShowKBForm] = useState(false);
  // 知识库文档
  const [documents, setDocuments] = useState<Record<number, KnowledgeDocument[]>>({});  // {kbId: docs}
  const [uploadingKbId, setUploadingKbId] = useState<number | null>(null);
  // 每个知识库独立的文件输入ref，避免共享ref导致只能操作最后一个KB
  const docFileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // 技能
  const [skills, setSkills] = useState<AnalysisSkill[]>([]);
  const [editingSkill, setEditingSkill] = useState<AnalysisSkill | null>(null);
  const [showSkillForm, setShowSkillForm] = useState(false);

  // 当前激活配置
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [m, k, s, c] = await Promise.all([
        api.getModels(),
        api.getKnowledgeBases(),
        api.getSkills(),
        api.getAIConfig(),
      ]);
      setModels(m);
      setKnowledgeBases(k);
      setSkills(s);
      setAIConfig(c);
      // 加载YOLO模型状态
      try {
        const yoloStatus = await api.getYoloStatus();
        setYoloInfo(yoloStatus);
      } catch { setYoloInfo(null); }
      // 加载每个知识库的文档
      const docsMap: Record<number, KnowledgeDocument[]> = {};
      for (const kb of k) {
        try {
          docsMap[kb.id] = await api.getDocuments(kb.id);
        } catch { docsMap[kb.id] = []; }
      }
      setDocuments(docsMap);
    } catch (err) {
      setMessage(`加载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 快速配置API：保存并激活
  const handleQuickSave = async () => {
    if (!quickApiKey.trim()) {
      setMessage("请输入API Key");
      return;
    }
    setQuickSaving(true);
    setMessage("");
    try {
      const preset = providerPresets[quickProvider];
      // 查找现有的非规则引擎模型
      const existingModel = models.find((m) => m.provider !== 'rule_engine');
      if (existingModel) {
        // 更新现有模型
        await api.updateModel(existingModel.id, {
          name: preset.name, provider: preset.provider, api_key: quickApiKey.trim(),
          base_url: preset.base_url, model_name: preset.model_name,
          temperature: 0.3, max_tokens: 2000,
        });
        await api.activateModel(existingModel.id);
      } else {
        // 创建新模型
        await api.createModel({
          name: preset.name, provider: preset.provider, api_key: quickApiKey.trim(),
          base_url: preset.base_url, model_name: preset.model_name,
          temperature: 0.3, max_tokens: 2000,
        });
        // 激活新创建的模型（取最后一个）
        const refreshed = await api.getModels();
        const newModel = refreshed.find((m) => m.provider !== 'rule_engine');
        if (newModel) await api.activateModel(newModel.id);
      }
      setMessage(`✅ ${preset.label} 配置成功并已激活！${preset.vision ? '支持图片识别。' : '不支持图片识别，仅文字分析。'}`);
      setQuickApiKey('');
      loadData();
    } catch (err) {
      setMessage(`配置失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setQuickSaving(false);
    }
  };

  // 激活本地YOLO模型
  const handleActivateYolo = async () => {
    setYoloActivating(true);
    setMessage('');
    try {
      await api.activateYolo();
      setMessage('✅ 本地YOLO模型已激活！图片识别将使用本地模型，无需API Key。');
      loadData();
    } catch (err) {
      setMessage(`YOLO模型激活失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setYoloActivating(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "models", label: "AI模型配置", icon: "🤖" },
    { key: "knowledge", label: "知识库管理", icon: "📚" },
    { key: "skills", label: "分析技能", icon: "⚡" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">AI配置管理</h1>
        <p className="text-sm text-gray-500 mt-1">管理AI模型、知识库和分析技能，支持动态切换</p>
      </div>

      {/* 当前激活配置摘要 */}
      {aiConfig && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">当前激活配置</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="text-xs text-gray-400">模型</p>
                <p className="text-sm font-medium text-gray-700">
                  {aiConfig.model ? `${aiConfig.model.name} (${aiConfig.model.model_name})` : "未配置"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <div>
                <p className="text-xs text-gray-400">知识库</p>
                <p className="text-sm font-medium text-gray-700">
                  {aiConfig.knowledge_base ? aiConfig.knowledge_base.name : "未配置"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <div>
                <p className="text-xs text-gray-400">技能</p>
                <p className="text-sm font-medium text-gray-700">
                  {aiConfig.skill ? aiConfig.skill.name : "未配置"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("成功") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
          <button onClick={() => setMessage("")} className="ml-2 text-xs underline">关闭</button>
        </div>
      )}

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

      {/* ========== 模型配置 ========== */}
      {activeTab === "models" && (
        <div className="space-y-4">
          {/* 快速API配置面板 */}
          <div className="card p-5 border-2 border-purple-200 bg-purple-50/30">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">⚡ 快速配置AI模型</h3>
            <p className="text-xs text-gray-500 mb-3">选择平台并填入API Key，保存后自动激活。无需手动填写Base URL和模型名称。</p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 mb-1">AI平台</label>
                <select
                  value={quickProvider}
                  onChange={(e) => setQuickProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {Object.entries(providerPresets).map(([key, p]) => (
                    <option key={key} value={key}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-6">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <input
                  value={quickApiKey}
                  onChange={(e) => setQuickApiKey(e.target.value)}
                  type="password"
                  placeholder="粘贴你的API Key..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <button
                  onClick={handleQuickSave}
                  disabled={quickSaving}
                  className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {quickSaving ? "保存中..." : "保存并激活"}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
              <span>💡 DeepSeek: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">获取Key</a>（新用户免费）</span>
              <span>💡 OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">获取Key</a>（需充值）</span>
            </div>
          </div>

          {/* 本地YOLO模型面板 */}
          <div className="card p-4 border border-green-200 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">🔒 本地YOLO模型（离线图片识别）</h3>
                <p className="text-xs text-gray-500 mt-0.5">使用本地训练的YOLOv8模型识别安全违规和质量缺陷，无需API Key</p>
              </div>
              {yoloInfo?.available ? (
                <button
                  onClick={handleActivateYolo}
                  disabled={yoloActivating}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50"
                >
                  {yoloActivating ? "激活中..." : "⚡ 激活YOLO模型"}
                </button>
              ) : (
                <span className="text-xs text-gray-400 px-3 py-1.5 bg-gray-100 rounded-lg">未安装模型</span>
              )}
            </div>
            {yoloInfo?.available ? (
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <span className="text-gray-400">模型大小</span>
                  <p className="font-medium text-gray-700 mt-0.5">{yoloInfo.model_size_mb} MB</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <span className="text-gray-400">检测类别</span>
                  <p className="font-medium text-gray-700 mt-0.5">{yoloInfo.num_classes} 类</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <span className="text-gray-400">状态</span>
                  <p className="font-medium text-green-600 mt-0.5">✅ 可用</p>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-100">
                <p className="font-medium text-gray-600 mb-1">📋 如何训练本地YOLO模型：</p>
                <ol className="list-decimal list-inside space-y-0.5 text-gray-500">
                  <li>获取数据集：<a href="https://universe.roboflow.com/search?q=construction+safety" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Roboflow</a> 搜索 "construction safety" / "PPE detection"</li>
                  <li>准备数据集：<code className="bg-gray-100 px-1 rounded">cd backend/train && python prepare_dataset.py --source /path/to/data --format roboflow</code></li>
                  <li>训练模型：<code className="bg-gray-100 px-1 rounded">python train_yolo.py --dataset ./dataset --epochs 100 --full</code></li>
                  <li>训练完成后，ONNX模型自动保存到 <code className="bg-gray-100 px-1 rounded">backend/models/</code> 目录</li>
                  <li>刷新此页面，点击「激活YOLO模型」即可使用</li>
                </ol>
              </div>
            )}
            {yoloInfo?.available && yoloInfo.classes && (
              <div className="mt-2 flex flex-wrap gap-1">
                {yoloInfo.classes.map((c) => (
                  <span key={c.id} className={`text-xs px-2 py-0.5 rounded ${c.type === 'violation' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">高级配置（手动填写Base URL等参数）</p>
            <button
              onClick={() => { setEditingModel(null); setShowModelForm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            >
              + 新增模型
            </button>
          </div>

          {showModelForm && (
            <ModelForm
              model={editingModel}
              onSave={async (data) => {
                try {
                  if (editingModel) {
                    await api.updateModel(editingModel.id, data);
                    setMessage("模型更新成功");
                  } else {
                    await api.createModel(data);
                    setMessage("模型创建成功");
                  }
                  setShowModelForm(false);
                  setEditingModel(null);
                  loadData();
                } catch (err) {
                  setMessage(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              onCancel={() => { setShowModelForm(false); setEditingModel(null); }}
            />
          )}

          <div className="space-y-3">
            {models.map((m) => (
              <div key={m.id} className={`card p-4 ${m.is_active ? "ring-2 ring-blue-400" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-800">{m.name}</h4>
                      {m.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">已激活</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Provider: <span className="text-gray-700">{m.provider}</span></span>
                      <span>模型: <span className="text-gray-700">{m.model_name}</span></span>
                      <span>Base URL: <span className="text-gray-700 truncate">{m.base_url}</span></span>
                      <span>温度: <span className="text-gray-700">{m.temperature}</span></span>
                      <span>API Key: <span className="text-gray-700">{m.api_key ? m.api_key.slice(0, 8) + "****" : "未设置"}</span></span>
                      <span>Max Tokens: <span className="text-gray-700">{m.max_tokens}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!m.is_active && (
                      <button
                        onClick={async () => {
                          await api.activateModel(m.id);
                          setMessage(`已激活模型: ${m.name}`);
                          loadData();
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition"
                      >
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingModel(m); setShowModelForm(true); }}
                      className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`确认删除模型「${m.name}」？`)) {
                          await api.deleteModel(m.id);
                          setMessage("模型已删除");
                          loadData();
                        }
                      }}
                      className="px-3 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {models.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                <p className="text-sm">暂无模型配置，点击「新增模型」创建</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 知识库管理（RAG文档） ========== */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">上传PDF/DOCX规范文档，系统自动处理为AI可用的知识库（RAG检索）</p>
            <button
              onClick={() => { setEditingKB(null); setShowKBForm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            >
              + 新增知识库
            </button>
          </div>

          {showKBForm && (
            <KBForm
              kb={editingKB}
              onSave={async (data) => {
                try {
                  if (editingKB) {
                    await api.updateKnowledgeBase(editingKB.id, data);
                    setMessage("知识库更新成功");
                  } else {
                    await api.createKnowledgeBase(data);
                    setMessage("知识库创建成功");
                  }
                  setShowKBForm(false);
                  setEditingKB(null);
                  loadData();
                } catch (err) {
                  setMessage(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              onCancel={() => { setShowKBForm(false); setEditingKB(null); }}
            />
          )}

          <div className="space-y-3">
            {knowledgeBases.map((kb) => (
              <div key={kb.id} className={`card p-4 ${kb.is_active ? "ring-2 ring-blue-400" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-800">{kb.name}</h4>
                      {kb.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">已激活</span>
                      )}
                      {documents[kb.id]?.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                          {documents[kb.id].length} 个文档
                        </span>
                      )}
                    </div>
                    {kb.description && (
                      <p className="mt-1 text-xs text-gray-500 ml-5">{kb.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!kb.is_active && (
                      <button
                        onClick={async () => {
                          try {
                            await api.activateKnowledgeBase(kb.id);
                            setMessage(`已激活知识库: ${kb.name}`);
                            loadData();
                          } catch (err) {
                            setMessage(`激活失败: ${err instanceof Error ? err.message : String(err)}`);
                          }
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition"
                      >
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => docFileRefs.current[kb.id]?.click()}
                      className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-300 rounded text-xs hover:bg-blue-100 transition"
                      disabled={uploadingKbId === kb.id}
                    >
                      {uploadingKbId === kb.id ? "处理中..." : "📎 上传文档"}
                    </button>
                    <button
                      onClick={() => { setEditingKB(kb); setShowKBForm(true); }}
                      className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`确认删除知识库「${kb.name}」？所有文档将一并删除。`)) {
                          await api.deleteKnowledgeBase(kb.id);
                          setMessage("知识库已删除");
                          loadData();
                        }
                      }}
                      className="px-3 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 transition"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* 文档管理区域（始终可见） */}
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                  {/* 上传区域 */}
                  <div
                    onClick={() => docFileRefs.current[kb.id]?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-4 text-center cursor-pointer transition bg-gray-50"
                  >
                    {uploadingKbId === kb.id ? (
                      <p className="text-sm text-blue-600">正在上传并处理文档...</p>
                    ) : (
                      <>
                        <div className="text-2xl mb-1">📎</div>
                        <p className="text-sm text-gray-600">点击上传PDF/DOCX/TXT文档</p>
                        <p className="text-xs text-gray-400 mt-1">系统将自动提取文本、分块、生成向量嵌入</p>
                      </>
                    )}
                    <input
                      ref={(el) => { docFileRefs.current[kb.id] = el; }}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingKbId(kb.id);
                        setMessage("");
                        try {
                          const result = await api.uploadDocument(kb.id, file);
                          setMessage(`文档「${result.filename}」已处理：${result.chunk_count}个分块，状态：${result.status === "ready" ? "就绪" : result.status === "error" ? "错误" : "处理中"}`);
                          // 重新加载文档列表
                          const docs = await api.getDocuments(kb.id);
                          setDocuments((prev) => ({ ...prev, [kb.id]: docs }));
                        } catch (err) {
                          setMessage(`文档上传失败: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
                          setUploadingKbId(null);
                          const el = docFileRefs.current[kb.id];
                          if (el) el.value = "";
                        }
                      }}
                    />
                  </div>

                  {/* 文档列表 */}
                  {documents[kb.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {documents[kb.id].map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-lg">
                              {doc.file_type === "pdf" ? "📕" : doc.file_type === "docx" || doc.file_type === "doc" ? "📘" : "📄"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{doc.filename}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                <span>{doc.chunk_count} 个分块</span>
                                {doc.status === "ready" && (
                                  <span className="text-green-600">✓ 就绪</span>
                                )}
                                {doc.status === "processing" && (
                                  <span className="text-blue-600">处理中...</span>
                                )}
                                {doc.status === "error" && (
                                  <span className="text-red-600" title={doc.error_message}>✗ 处理失败</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm(`确认删除文档「${doc.filename}」？`)) {
                                await api.deleteDocument(kb.id, doc.id);
                                const docs = await api.getDocuments(kb.id);
                                setDocuments((prev) => ({ ...prev, [kb.id]: docs }));
                                setMessage("文档已删除");
                              }
                            }}
                            className="px-2 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 transition"
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">暂无文档，点击上方区域上传PDF/DOCX文件</p>
                  )}
                </div>
              </div>
            ))}
            {knowledgeBases.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                <p className="text-sm">暂无知识库，点击「新增知识库」创建</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 分析技能 ========== */}
      {activeTab === "skills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">管理AI分析的提示词模板（System Prompt + User Prompt）</p>
            <button
              onClick={() => { setEditingSkill(null); setShowSkillForm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            >
              + 新增技能
            </button>
          </div>

          {showSkillForm && (
            <SkillForm
              skill={editingSkill}
              onSave={async (data) => {
                try {
                  if (editingSkill) {
                    await api.updateSkill(editingSkill.id, data);
                    setMessage("技能更新成功");
                  } else {
                    await api.createSkill(data);
                    setMessage("技能创建成功");
                  }
                  setShowSkillForm(false);
                  setEditingSkill(null);
                  loadData();
                } catch (err) {
                  setMessage(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              onCancel={() => { setShowSkillForm(false); setEditingSkill(null); }}
            />
          )}

          <div className="space-y-3">
            {skills.map((s) => (
              <div key={s.id} className={`card p-4 ${s.is_active ? "ring-2 ring-blue-400" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-800">{s.name}</h4>
                      {s.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">已激活</span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 text-xs text-gray-500">{s.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">创建于 {s.created_at.slice(0, 10)}</p>
                  </div>
                  <div className="flex gap-2">
                    {!s.is_active && (
                      <button
                        onClick={async () => {
                          await api.activateSkill(s.id);
                          setMessage(`已激活技能: ${s.name}`);
                          loadData();
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition"
                      >
                        激活
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const detail = await api.getSkill(s.id);
                          setEditingSkill({ ...s, system_prompt: detail.system_prompt, user_prompt_template: detail.user_prompt_template });
                          setShowSkillForm(true);
                        } catch (err) {
                          setMessage(`加载详情失败: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }}
                      className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`确认删除技能「${s.name}」？`)) {
                          await api.deleteSkill(s.id);
                          setMessage("技能已删除");
                          loadData();
                        }
                      }}
                      className="px-3 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {skills.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                <p className="text-sm">暂无技能，点击「新增技能」创建</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 子组件：模型表单 ==========

function ModelForm({
  model,
  onSave,
  onCancel,
}: {
  model: AIModelConfig | null;
  onSave: (data: { name: string; provider: string; api_key: string; base_url: string; model_name: string; temperature: number; max_tokens: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(model?.name || "");
  const [provider, setProvider] = useState(model?.provider || "openai");
  const [apiKey, setApiKey] = useState(model?.api_key || "");
  const [baseUrl, setBaseUrl] = useState(model?.base_url || "https://api.openai.com/v1");
  const [modelName, setModelName] = useState(model?.model_name || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(model?.temperature ?? 0.3);
  const [maxTokens, setMaxTokens] = useState(model?.max_tokens ?? 2000);

  const providers = [
    { value: "openai", label: "OpenAI" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "custom", label: "自定义 (OpenAI兼容)" },
    { value: "rule_engine", label: "规则引擎 (无需API)" },
  ];

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name, provider, api_key: apiKey, base_url: baseUrl, model_name: modelName, temperature, max_tokens: maxTokens });
  };

  return (
    <div className="card p-6 space-y-4 border-2 border-blue-200">
      <h3 className="text-sm font-semibold text-gray-800">{model ? "编辑模型" : "新增模型"}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：GPT-4o" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {providers.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">API Key</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="sk-..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">模型名称</label>
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="gpt-4o-mini" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">温度 (0-1)</label>
          <input value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} type="number" min="0" max="1" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Tokens</label>
          <input value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} type="number" min="100" step="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          {model ? "保存修改" : "创建"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
          取消
        </button>
      </div>
    </div>
  );
}

// ========== 子组件：知识库表单（简化版，无JSON编辑） ==========

function KBForm({
  kb,
  onSave,
  onCancel,
}: {
  kb: KnowledgeBaseConfig | null;
  onSave: (data: { name: string; description: string; content: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(kb?.name || "");
  const [description, setDescription] = useState(kb?.description || "");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name, description, content: "{}" });
  };

  return (
    <div className="card p-6 space-y-4 border-2 border-blue-200">
      <h3 className="text-sm font-semibold text-gray-800">{kb ? "编辑知识库" : "新增知识库"}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：标准工程监理知识库" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">描述</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="知识库简要说明" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <p className="text-xs text-gray-400">创建知识库后，可展开上传PDF/DOCX规范文档，系统将自动处理为RAG可用的知识库内容。</p>
      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          {kb ? "保存修改" : "创建"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
          取消
        </button>
      </div>
    </div>
  );
}

// ========== 子组件：技能表单 ==========

function SkillForm({
  skill,
  onSave,
  onCancel,
}: {
  skill: AnalysisSkill | null;
  onSave: (data: { name: string; description: string; system_prompt: string; user_prompt_template: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(skill?.name || "");
  const [description, setDescription] = useState(skill?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(skill?.system_prompt || "");
  const [userPromptTemplate, setUserPromptTemplate] = useState(skill?.user_prompt_template || "");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name, description, system_prompt: systemPrompt, user_prompt_template: userPromptTemplate });
  };

  return (
    <div className="card p-6 space-y-4 border-2 border-blue-200">
      <h3 className="text-sm font-semibold text-gray-800">{skill ? "编辑技能" : "新增技能"}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：标准分析技能" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">描述</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="技能简要说明" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">System Prompt (系统提示词)</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y"
          placeholder="你是一位资深的工程监理专家..."
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">User Prompt Template (用户提示词模板)</label>
        <textarea
          value={userPromptTemplate}
          onChange={(e) => setUserPromptTemplate(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y"
          placeholder="请根据以下巡视问题信息进行分析...&#10;巡视区域：{inspection_area}&#10;原始描述：{raw_description}"
        />
        <p className="text-xs text-gray-400 mt-1">使用 {`{inspection_area}`} 和 {`{raw_description}`} 作为变量占位符</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          {skill ? "保存修改" : "创建"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
          取消
        </button>
      </div>
    </div>
  );
}
