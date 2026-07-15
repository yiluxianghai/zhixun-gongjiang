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


def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)
    # 创建默认项目
    db = SessionLocal()
    try:
        existing = db.query(Project).filter(Project.project_code == "DEMO").first()
        if not existing:
            project = Project(
                project_code="DEMO",
                project_name="示范项目"
            )
            db.add(project)
            db.commit()
            print(f"[数据库] 已创建默认项目: {project.project_name} (ID: {project.id})")
    except Exception as e:
        print(f"[数据库] 初始化默认项目失败: {e}")
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
