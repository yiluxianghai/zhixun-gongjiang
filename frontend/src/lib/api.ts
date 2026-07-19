/**
 * API 工具库
 * 工程监理巡视问题分类闭环管理智能体
 */

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.message || 'API返回错误');
  }
  return json.data as T;
}

// ========== 类型定义 ==========

export interface Project {
  id: number;
  project_code: string;
  project_name: string;
  problem_count?: number;
}

export interface AnalysisResult {
  standardized_description: string;
  category_code: string;
  category_name: string;
  specialty_code: string;
  specialty_name: string;
  risk_level: string;
  risk_reason: string;
  rectification_req: string;
  rectification_deadline_days: number;
  review_points: string;
  responsible_party: string;
  confidence: number;
}

export interface Problem {
  id: number;
  problem_no: string;
  inspection_date: string;
  inspection_area: string;
  inspector: string;
  raw_description: string;
  standardized_desc: string;
  category_code: string;
  category_name: string;
  specialty_code: string;
  specialty_name: string;
  risk_level: string;
  risk_reason: string;
  rectification_req: string;
  rectification_deadline: string;
  review_points: string;
  responsible_party: string;
  ai_confidence: number;
  status: string;
  is_overdue: boolean;
  rectification_feedback: string;
  rectification_date: string;
  review_date: string;
  review_result: string;
  created_at: string;
  records?: Array<{
    id: number;
    record_type: string;
    content: string;
    operator: string;
    created_at: string;
  }>;
}

export interface Dashboard {
  total: number;
  status_count: Record<string, number>;
  category_count: Record<string, number>;
  risk_count: Record<string, number>;
  overdue_count: number;
  closure_rate: number;
}

// ========== AI配置类型 ==========

export interface AIModelConfig {
  id: number;
  name: string;
  provider: string;
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
}

export interface KnowledgeBaseConfig {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  content?: string;
}

export interface AnalysisSkill {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  system_prompt?: string;
  user_prompt_template?: string;
}

export interface AIConfig {
  model: { id: number; name: string; provider: string; model_name: string } | null;
  knowledge_base: { id: number; name: string } | null;
  skill: { id: number; name: string } | null;
}

// ========== API 函数 ==========

export const api = {
  // 项目
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: { project_code: string; project_name: string }) =>
    request('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // 问题分析
  analyzeProblem: (data: {
    project_id: number;
    inspection_area: string;
    inspector: string;
    inspection_date: string;
    raw_description: string;
    model_id?: number;
    kb_id?: number;
    skill_id?: number;
  }) => request<AnalysisResult>('/problems/analyze', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // ========== AI配置管理 ==========

  getAIConfig: () => request<AIConfig>('/ai/config'),

  // 模型配置
  getModels: () => request<AIModelConfig[]>('/ai/models'),
  createModel: (data: Omit<AIModelConfig, 'id' | 'is_active' | 'created_at'>) =>
    request('/ai/models', { method: 'POST', body: JSON.stringify(data) }),
  updateModel: (id: number, data: Omit<AIModelConfig, 'id' | 'is_active' | 'created_at'>) =>
    request(`/ai/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModel: (id: number) =>
    request(`/ai/models/${id}`, { method: 'DELETE' }),
  activateModel: (id: number) =>
    request(`/ai/models/${id}/activate`, { method: 'POST' }),

  // 知识库配置
  getKnowledgeBases: () => request<KnowledgeBaseConfig[]>('/ai/knowledge-bases'),
  getKnowledgeBase: (id: number) => request<KnowledgeBaseConfig & { content: string }>(`/ai/knowledge-bases/${id}`),
  createKnowledgeBase: (data: { name: string; description: string; content: string }) =>
    request('/ai/knowledge-bases', { method: 'POST', body: JSON.stringify(data) }),
  updateKnowledgeBase: (id: number, data: { name: string; description: string; content: string }) =>
    request(`/ai/knowledge-bases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteKnowledgeBase: (id: number) =>
    request(`/ai/knowledge-bases/${id}`, { method: 'DELETE' }),
  activateKnowledgeBase: (id: number) =>
    request(`/ai/knowledge-bases/${id}/activate`, { method: 'POST' }),

  // 分析技能
  getSkills: () => request<AnalysisSkill[]>('/ai/skills'),
  getSkill: (id: number) => request<AnalysisSkill & { system_prompt: string; user_prompt_template: string }>(`/ai/skills/${id}`),
  createSkill: (data: { name: string; description: string; system_prompt: string; user_prompt_template: string }) =>
    request('/ai/skills', { method: 'POST', body: JSON.stringify(data) }),
  updateSkill: (id: number, data: { name: string; description: string; system_prompt: string; user_prompt_template: string }) =>
    request(`/ai/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSkill: (id: number) =>
    request(`/ai/skills/${id}`, { method: 'DELETE' }),
  activateSkill: (id: number) =>
    request(`/ai/skills/${id}/activate`, { method: 'POST' }),

  // 图片上传
  uploadPhoto: async (file: File): Promise<{ url: string; filename: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/photo`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`上传失败: ${res.status}`);
    const json = await res.json();
    return json.data;
  },

  // Excel批量导入
  importExcel: async (
    projectId: number,
    file: File
  ): Promise<{
    total: number;
    success: number;
    fail: number;
    results: Array<Record<string, unknown>>;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/problems/import-excel?project_id=${projectId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`导入失败: ${res.status}`);
    const json = await res.json();
    return json.data;
  },

  // 问题管理
  createProblem: (data: Record<string, unknown>) =>
    request<{ id: number; problem_no: string }>('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProblems: (params: {
    project_id: number;
    status?: string;
    category?: string;
    risk_level?: string;
    keyword?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('project_id', String(params.project_id));
    if (params.status) query.set('status', params.status);
    if (params.category) query.set('category', params.category);
    if (params.risk_level) query.set('risk_level', params.risk_level);
    if (params.keyword) query.set('keyword', params.keyword);
    return request<Problem[]>(`/problems?${query.toString()}`);
  },

  getProblem: (id: number) => request<Problem>(`/problems/${id}`),

  updateStatus: (id: number, status: string, operator?: string) =>
    request(`/problems/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, operator }),
    }),

  submitRectification: (id: number, feedback: string, operator: string) =>
    request(`/problems/${id}/rectification`, {
      method: 'POST',
      body: JSON.stringify({ feedback, operator }),
    }),

  submitReview: (id: number, result: string, review_comment: string, operator: string) =>
    request(`/problems/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ result, review_comment, operator }),
    }),

  // 统计
  getDashboard: (projectId: number) =>
    request<Dashboard>(`/statistics/dashboard?project_id=${projectId}`),

  // 文档生成
  generateNotice: (problemId: number) =>
    request(`/documents/notice/${problemId}`, { method: 'POST' }),

  generateInspectionRecord: (projectId: number, inspectionDate?: string) => {
    const query = `project_id=${projectId}${inspectionDate ? `&inspection_date=${inspectionDate}` : ''}`;
    return request(`/documents/inspection-record?${query}`, { method: 'POST' });
  },

  generateLedger: (projectId: number) =>
    request(`/documents/ledger?project_id=${projectId}`),

  generateAnalysisReport: (projectId: number) =>
    request(`/documents/analysis-report?project_id=${projectId}`, { method: 'POST' }),
};
