"""
数据库模型与连接管理
工程监理巡视问题分类闭环管理智能体
"""
import os
from datetime import datetime, date
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import OperationalError

# 数据库文件路径
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "inspection.db")

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Project(Base):
    """项目表"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), nullable=False)
    project_name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    problems = relationship("InspectionProblem", back_populates="project")


class InspectionProblem(Base):
    """巡视问题表"""
    __tablename__ = "inspection_problems"

    id = Column(Integer, primary_key=True, index=True)
    problem_no = Column(String(50), unique=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # 巡视信息
    inspection_date = Column(Date, nullable=False)
    inspection_area = Column(String(200), nullable=False)
    inspector = Column(String(50), nullable=False)
    raw_description = Column(Text, nullable=False)

    # AI分析结果
    standardized_desc = Column(Text)
    category_code = Column(String(10))
    category_name = Column(String(50))
    specialty_code = Column(String(10))
    specialty_name = Column(String(50))
    risk_level = Column(String(10))
    risk_reason = Column(Text)
    rectification_req = Column(Text)
    rectification_deadline = Column(Date)
    review_points = Column(Text)
    responsible_party = Column(String(200))
    ai_confidence = Column(Float, default=0.0)

    # 闭环管理
    status = Column(String(20), default="待整改")
    rectification_feedback = Column(Text)
    rectification_date = Column(Date)
    review_date = Column(Date)
    review_result = Column(String(20))

    # 附加信息
    photo_urls = Column(Text)  # JSON数组字符串
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="problems")
    records = relationship("RectificationRecord", back_populates="problem", cascade="all, delete-orphan")


class RectificationRecord(Base):
    """整改记录表"""
    __tablename__ = "rectification_records"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("inspection_problems.id"), nullable=False)
    record_type = Column(String(20), nullable=False)  # 整改通知/整改反馈/复查记录
    content = Column(Text)
    operator = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    problem = relationship("InspectionProblem", back_populates="records")


class OutputDocument(Base):
    """输出文档表"""
    __tablename__ = "output_documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    doc_type = Column(String(20), nullable=False)  # 通知单/巡视记录/台账/分析报告
    doc_title = Column(String(200))
    doc_content = Column(Text)  # JSON字符串
    problem_ids = Column(Text)  # JSON数组字符串
    created_at = Column(DateTime, default=datetime.utcnow)


class AIModelConfig(Base):
    """AI模型配置表"""
    __tablename__ = "ai_model_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 显示名称
    provider = Column(String(50), default="openai")  # openai/deepseek/custom/rule_engine
    api_key = Column(Text, default="")  # API密钥
    base_url = Column(String(255), default="https://api.openai.com/v1")  # API地址
    model_name = Column(String(100), default="gpt-4o-mini")  # 模型名称
    temperature = Column(Float, default=0.3)  # 温度参数
    max_tokens = Column(Integer, default=2000)  # 最大token数
    is_active = Column(Integer, default=0)  # 是否当前启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeBaseConfig(Base):
    """知识库配置表"""
    __tablename__ = "kb_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 显示名称
    description = Column(Text, default="")  # 描述
    content = Column(Text, default="{}")  # JSON格式知识库内容
    is_active = Column(Integer, default=0)  # 是否当前启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalysisSkill(Base):
    """分析技能表（提示词模板）"""
    __tablename__ = "analysis_skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 显示名称
    description = Column(Text, default="")  # 描述
    system_prompt = Column(Text, default="")  # 系统提示词
    user_prompt_template = Column(Text, default="")  # 用户提示词模板
    is_active = Column(Integer, default=0)  # 是否当前启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeDocument(Base):
    """知识库文档表（RAG文档管理）"""
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    kb_id = Column(Integer, ForeignKey("kb_configs.id"), nullable=False)  # 关联知识库
    filename = Column(String(255), nullable=False)  # 原始文件名
    file_path = Column(String(500), nullable=False)  # 存储路径
    file_type = Column(String(20), nullable=False)  # pdf/docx/txt
    file_size = Column(Integer, default=0)  # 文件大小(字节)
    text_content = Column(Text, default="")  # 提取的全文文本
    chunk_count = Column(Integer, default=0)  # 分块数量
    status = Column(String(20), default="processing")  # processing/ready/error
    error_message = Column(Text, default="")  # 处理错误信息
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    """文档分块表（RAG向量检索）"""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False)
    chunk_index = Column(Integer, default=0)  # 分块序号
    content = Column(Text, nullable=False)  # 分块文本内容
    embedding = Column(Text, default="")  # JSON格式的嵌入向量
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 创建默认项目
        existing = db.query(Project).filter(Project.project_code == "DEMO").first()
        if not existing:
            project = Project(project_code="DEMO", project_name="示范项目")
            db.add(project)
            db.commit()
            print(f"[数据库] 已创建默认项目: {project.project_name} (ID: {project.id})")

        # 创建默认AI模型配置
        import os, json
        if db.query(AIModelConfig).count() == 0:
            # 规则引擎（兜底）
            rule_model = AIModelConfig(
                name="规则引擎（本地）",
                provider="rule_engine",
                api_key="",
                base_url="",
                model_name="",
                temperature=0.3,
                is_active=1,
            )
            db.add(rule_model)
            # OpenAI兼容API
            env_key = os.environ.get("LLM_API_KEY", "")
            env_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
            env_model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
            llm_model = AIModelConfig(
                name="LLM大模型",
                provider="openai",
                api_key=env_key,
                base_url=env_url,
                model_name=env_model,
                temperature=0.3,
                is_active=0 if env_key else 0,
            )
            db.add(llm_model)
            db.commit()
            print(f"[数据库] 已创建默认AI模型配置")

        # 创建默认知识库
        if db.query(KnowledgeBaseConfig).count() == 0:
            kb_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base.json")
            with open(kb_path, "r", encoding="utf-8") as f:
                kb_content = f.read()
            kb = KnowledgeBaseConfig(
                name="默认工程监理知识库",
                description="包含4个问题类别、5个专业类型、8个整改模板的标准知识库",
                content=kb_content,
                is_active=1,
            )
            db.add(kb)
            db.commit()
            print(f"[数据库] 已创建默认知识库")

        # 创建默认分析技能
        if db.query(AnalysisSkill).count() == 0:
            default_skill = AnalysisSkill(
                name="标准分析技能",
                description="针对工程监理巡视问题进行智能分类、风险定级和整改建议生成",
                system_prompt="""你是一位资深的工程监理专家，具有丰富的现场巡视和质量安全管理经验。\n请根据巡视问题信息进行智能分析，返回JSON格式的分析结果。""",
                user_prompt_template="""请根据以下巡视问题信息，进行智能分析和结构化输出。\n\n【巡视信息】\n- 巡视区域：{inspection_area}\n- 原始描述：{raw_description}\n\n【分类标准】\n- 问题类别：质量管理(QM)、安全管理(SM)、文明施工管理(CM)、进度管理(PM)\n- 专业类型：土建(CIV)、机电(MEP)、装饰(DEC)、消防(FIR)、幕墙(CUR)\n- 风险等级：一般、较大、重大\n\n请严格按照以下JSON格式输出（不要输出其他内容）：\n{{\n  "standardized_description": "标准化问题描述（50-100字，使用工程规范术语）",\n  "category_code": "类别代码",\n  "category_name": "类别名称",\n  "specialty_code": "专业代码",\n  "specialty_name": "专业名称",\n  "risk_level": "风险等级",\n  "risk_reason": "风险定级理由（一句话）",\n  "rectification_req": "整改要求（具体、可操作，分条列出）",\n  "rectification_deadline_days": 3,\n  "review_points": "复查要点（分条列出）",\n  "responsible_party": "建议责任主体",\n  "confidence": 0.9\n}}\n\n【注意事项】\n1. 问题描述应使用工程规范术语，避免口语化表达\n2. 整改要求应具体可操作\n3. 风险等级应根据问题严重程度和潜在影响综合判断\n4. confidence为分析置信度（0.0-1.0）""",
                is_active=1,
            )
            db.add(default_skill)
            db.commit()
            print(f"[数据库] 已创建默认分析技能")

    except Exception as e:
        print(f"[数据库] 初始化失败: {e}")
        db.rollback()
    finally:
        db.close()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_problem_no(project_code: str, specialty_code: str, seq: int) -> str:
    """生成问题编号: [项目代号]-[专业代码]-[年月]-[序号]"""
    now = datetime.now()
    return f"{project_code}-{specialty_code}-{now.strftime('%y%m')}-{seq:04d}"


def get_next_seq(db, project_id: int) -> int:
    """获取下一个序号"""
    count = db.query(InspectionProblem).filter(
        InspectionProblem.project_id == project_id
    ).count()
    return count + 1
