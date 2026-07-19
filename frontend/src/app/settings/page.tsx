"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type AIModelConfig, type KnowledgeBaseConfig, type AnalysisSkill, type AIConfig } from "@/lib/api";

type TabType = "models" | "knowledge" | "skills";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("models");
  const [message, setMessage] = useState("");

  // 模型
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);

  // 知识库
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseConfig[]>([]);
  const [editingKB, setEditingKB] = useState<KnowledgeBaseConfig | null>(null);
  const [showKBForm, setShowKBForm] = useState(false);

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
    } catch (err) {
      setMessage(`加载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">配置AI大语言模型的API连接参数</p>
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

      {/* ========== 知识库管理 ========== */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">管理问题分类、专业类型、风险指标等知识库内容</p>
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
                    </div>
                    {kb.description && (
                      <p className="mt-1 text-xs text-gray-500">{kb.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">创建于 {kb.created_at.slice(0, 10)}</p>
                  </div>
                  <div className="flex gap-2">
                    {!kb.is_active && (
                      <button
                        onClick={async () => {
                          await api.activateKnowledgeBase(kb.id);
                          setMessage(`已激活知识库: ${kb.name}`);
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
                          const detail = await api.getKnowledgeBase(kb.id);
                          setEditingKB({ ...kb, content: detail.content });
                          setShowKBForm(true);
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
                        if (confirm(`确认删除知识库「${kb.name}」？`)) {
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

// ========== 子组件：知识库表单 ==========

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
  const [content, setContent] = useState(kb?.content || '{"categories": [], "specialties": [], "risk_indicators": {}, "rectification_templates": [], "risk_rules": []}');

  const handleSubmit = () => {
    if (!name.trim()) return;
    // 验证JSON
    try {
      JSON.parse(content);
    } catch {
      alert("知识库内容不是有效的JSON格式");
      return;
    }
    onSave({ name, description, content });
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(content);
      setContent(JSON.stringify(parsed, null, 2));
    } catch {
      alert("当前内容不是有效的JSON");
    }
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
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">知识库内容 (JSON格式)</label>
          <button onClick={formatJson} className="text-xs text-blue-600 hover:underline">格式化JSON</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50 resize-y"
          placeholder='{"categories": [...], "specialties": [...], ...}'
        />
        <p className="text-xs text-gray-400 mt-1">包含：categories(问题类别)、specialties(专业类型)、risk_indicators(风险指标)、rectification_templates(整改模板)、risk_rules(风险规则)</p>
      </div>
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
