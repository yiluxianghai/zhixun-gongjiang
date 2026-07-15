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
  }) => request<AnalysisResult>('/problems/analyze', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

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
