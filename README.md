# 工程监理巡视问题分类闭环管理智能体

> 盈科杯参赛作品 · 智巡工匠队
>
> 围绕现场巡视问题的 **发现—识别—分类—整改—复查—销项** 全过程，开发轻量化 AI 辅助原型。

## 功能概览

| 模块 | 功能 |
|------|------|
| 首页看板 | 问题统计、状态/类别/风险分布图、最近巡视问题 |
| 问题输入 | 文字输入 / 图片上传 / Excel批量导入，AI 自动识别类别、风险等级 |
| 闭环台账 | 多条件筛选、问题详情、状态流转（待整改→已整改→复查→销项） |
| 成果输出 | 监理通知单 / 巡视记录 / 闭环台账 / 问题分析报告 |

## 技术栈

- **后端**：Python 3.11 + FastAPI + SQLAlchemy + SQLite
- **前端**：Next.js 16 + React 19 + TailwindCSS 4
- **AI引擎**：LLM（OpenAI兼容API）+ 规则引擎 fallback
- **知识库**：JSON 结构化存储（4类别 / 5专业 / 8整改模板）

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 主应用（API + 静态文件托管）
│   ├── ai_engine.py         # AI 分析引擎（LLM + 规则引擎）
│   ├── database.py          # 数据库模型（4张表）
│   ├── document_generator.py # 文档生成器（通知单/记录/台账/报告）
│   ├── knowledge_base.json  # 知识库（分类关键词/风险指标/整改模板）
│   ├── requirements.txt     # Python 依赖
│   └── static/              # 前端构建产物（由 FastAPI 托管）
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router 页面
│   │   │   ├── page.tsx     # 首页看板
│   │   │   ├── input/       # 问题输入（文字/图片/Excel）
│   │   │   ├── ledger/      # 闭环台账
│   │   │   └── documents/   # 成果输出
│   │   ├── components/      # 通用组件（Sidebar）
│   │   └── lib/api.ts       # API 工具库
│   ├── next.config.ts       # Next.js 配置（output: export）
│   └── package.json
├── render.yaml              # Render 部署配置
└── README.md
```

## 本地开发

### 1. 启动后端

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端启动后访问 http://localhost:8000/api/health 验证。

### 2. 构建前端（可选，如需修改前端）

```bash
cd frontend
npm install
npm run dev      # 开发模式，访问 http://localhost:3000
# 或
npm run build    # 构建静态文件
cp -r out/* ../backend/static/  # 复制到后端托管
```

> 生产模式下前端由后端 FastAPI 直接托管，无需单独运行 Next.js。

### 3. 可选：配置 LLM

设置环境变量启用大模型分析，未设置则自动降级为本地规则引擎：

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
```

## 部署到 Render（免费）

### 前置条件

- GitHub 账号
- Render 账号（https://render.com，可用 GitHub 登录）

### 方式一：Blueprint 自动部署（推荐）

1. Fork 或克隆本仓库到您的 GitHub
2. 登录 https://dashboard.render.com
3. 点击 **New +** → **Blueprint**
4. 选择您的 GitHub 仓库
5. Render 自动读取 `render.yaml` 配置，点击 **Apply**
6. 等待 2-3 分钟部署完成

### 方式二：手动创建 Web Service

1. 登录 Render → **New +** → **Web Service**
2. 连接 GitHub 仓库
3. 填写配置：

| 配置项 | 值 |
|--------|-----|
| Name | `zhixun-gongjiang` |
| Runtime | Python 3 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Plan | Free |

4. 点击 **Create Web Service**

### 部署完成后

- 访问地址：`https://zhixun-gongjiang.onrender.com`
- API 文档：`https://zhixun-gongjiang.onrender.com/api/docs`
- 首次访问可能需要等待 30 秒（免费计划冷启动）

### 重新构建前端（如修改了前端代码）

```bash
cd frontend
npm run build
cp -r out/* ../backend/static/
git add -A
git commit -m "update frontend"
git push
# Render 会自动重新部署
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| POST | `/api/problems/analyze` | AI 分析问题 |
| POST | `/api/problems` | 创建问题 |
| GET | `/api/problems` | 问题列表（支持筛选） |
| GET | `/api/problems/{id}` | 问题详情 |
| PUT | `/api/problems/{id}/status` | 更新状态 |
| POST | `/api/problems/{id}/rectification` | 提交整改反馈 |
| POST | `/api/problems/{id}/review` | 提交复查 |
| POST | `/api/upload/photo` | 上传图片 |
| POST | `/api/problems/import-excel` | Excel 批量导入 |
| GET | `/api/statistics/dashboard` | 看板统计数据 |
| POST | `/api/documents/notice/{id}` | 生成监理通知单 |
| POST | `/api/documents/inspection-record` | 生成巡视记录 |
| GET | `/api/documents/ledger` | 生成闭环台账 |
| POST | `/api/documents/analysis-report` | 生成分析报告 |

## 数据模型

| 表名 | 说明 |
|------|------|
| projects | 项目信息 |
| inspection_problems | 巡视问题（含AI分析结果、状态、图片） |
| rectification_records | 操作记录（状态流转日志） |
| output_documents | 生成的文档 |

## License

MIT
