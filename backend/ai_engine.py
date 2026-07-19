"""
AI分析引擎
工程监理巡视问题分类闭环管理智能体

功能：
1. 问题现象提取与标准化描述生成
2. 问题类别识别（质量管理/安全管理/文明施工/进度管理）
3. 专业类型识别（土建/机电/装饰/消防/幕墙）
4. 风险等级判定（一般/较大/重大）
5. 整改要求、整改期限、复查要点生成
6. 责任主体建议
"""
import os
import json
import re
from datetime import datetime, timedelta
from typing import Optional

import httpx

# 知识库路径
KB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base.json")

# LLM配置 - 支持OpenAI兼容API
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")


class KnowledgeBase:
    """知识库加载与检索"""

    def __init__(self, content: dict = None):
        """初始化知识库
        
        Args:
            content: 知识库内容字典，为None时从文件加载
        """
        self.data = {}
        if content:
            self.data = content
            print(f"[知识库] 已加载(动态): {len(self.data.get('categories', []))} 个类别, "
                  f"{len(self.data.get('specialties', []))} 个专业, "
                  f"{len(self.data.get('rectification_templates', []))} 个整改模板")
        else:
            self._load()

    def _load(self):
        """从文件加载知识库"""
        with open(KB_PATH, "r", encoding="utf-8") as f:
            self.data = json.load(f)
        print(f"[知识库] 已加载: {len(self.data.get('categories', []))} 个类别, "
              f"{len(self.data.get('specialties', []))} 个专业, "
              f"{len(self.data.get('rectification_templates', []))} 个整改模板")

    def classify_category(self, text: str) -> tuple:
        """基于关键词匹配问题类别"""
        scores = {}
        for cat in self.data.get("categories", []):
            score = 0
            for kw in cat.get("keywords", []):
                if kw in text:
                    score += 1
            scores[cat["code"]] = (cat["name"], score)

        best = max(scores.items(), key=lambda x: x[1][1])
        if best[1][1] > 0:
            return best[0], best[1][0]
        return "QM", "质量管理"  # 默认

    def classify_specialty(self, text: str) -> tuple:
        """基于关键词匹配专业类型"""
        scores = {}
        for spec in self.data.get("specialties", []):
            score = 0
            for kw in spec.get("keywords", []):
                if kw in text:
                    score += 1
            scores[spec["code"]] = (spec["name"], score)

        best = max(scores.items(), key=lambda x: x[1][1])
        if best[1][1] > 0:
            return best[0], best[1][0]
        return "CIV", "土建"  # 默认

    def determine_risk_level(self, text: str, category_code: str) -> tuple:
        """基于风险指标判定风险等级"""
        risk_indicators = self.data.get("risk_indicators", {})

        # 先检查重大指标
        for kw in risk_indicators.get("重大", []):
            if kw in text:
                return "重大", f"描述中包含重大风险关键词「{kw}」"

        # 再检查较大指标
        for kw in risk_indicators.get("较大", []):
            if kw in text:
                return "较大", f"描述中包含较大风险关键词「{kw}」"

        # 最后检查一般指标
        for kw in risk_indicators.get("一般", []):
            if kw in text:
                return "一般", f"描述中包含一般风险关键词「{kw}」"

        # 根据类别默认判定
        if category_code == "SM":
            return "较大", "安全管理类问题默认较大风险"
        return "一般", "未检测到明显风险指标，默认一般风险"

    def match_template(self, text: str, category_code: str, specialty_code: str) -> Optional[dict]:
        """匹配整改模板"""
        templates = self.data.get("rectification_templates", [])
        best_match = None
        best_score = 0

        for tpl in templates:
            if tpl["category"] != category_code:
                continue
            # 专业匹配（模板可能适用于所有专业）
            if tpl["specialty"] != specialty_code and tpl["specialty"] != "GEN":
                continue

            score = 0
            for kw in tpl.get("keywords", []):
                if kw in text:
                    score += 1

            if score > best_score:
                best_score = score
                best_match = tpl

        return best_match

    def get_risk_rule(self, risk_level: str) -> dict:
        """获取风险等级规则"""
        for rule in self.data.get("risk_rules", []):
            if rule["level"] == risk_level:
                return rule
        return {"level": risk_level, "deadline_days": 7, "action": "下发整改通知，限期整改"}


# 全局知识库实例（从文件加载，作为兜底）
kb = KnowledgeBase()

# 默认提示词
DEFAULT_SYSTEM_PROMPT = """你是一位资深的工程监理专家，具有丰富的现场巡视和质量安全管理经验。\n请根据巡视问题信息进行智能分析，返回JSON格式的分析结果。"""

DEFAULT_USER_PROMPT_TEMPLATE = """请根据以下巡视问题信息，进行智能分析和结构化输出。\n\n【巡视信息】\n- 巡视区域：{inspection_area}\n- 原始描述：{raw_description}\n\n【分类标准】\n- 问题类别：质量管理(QM)、安全管理(SM)、文明施工管理(CM)、进度管理(PM)\n- 专业类型：土建(CIV)、机电(MEP)、装饰(DEC)、消防(FIR)、幕墙(CUR)\n- 风险等级：一般、较大、重大\n\n请严格按照以下JSON格式输出（不要输出其他内容）：\n{{\n  "standardized_description": "标准化问题描述（50-100字，使用工程规范术语）",\n  "category_code": "类别代码",\n  "category_name": "类别名称",\n  "specialty_code": "专业代码",\n  "specialty_name": "专业名称",\n  "risk_level": "风险等级",\n  "risk_reason": "风险定级理由（一句话）",\n  "rectification_req": "整改要求（具体、可操作，分条列出）",\n  "rectification_deadline_days": 3,\n  "review_points": "复查要点（分条列出）",\n  "responsible_party": "建议责任主体",\n  "confidence": 0.9\n}}\n\n【注意事项】\n1. 问题描述应使用工程规范术语，避免口语化表达\n2. 整改要求应具体可操作\n3. 风险等级应根据问题严重程度和潜在影响综合判断\n4. confidence为分析置信度（0.0-1.0）"""


async def call_llm(
    raw_description: str,
    inspection_area: str,
    api_key: str = None,
    base_url: str = None,
    model: str = None,
    temperature: float = 0.3,
    system_prompt: str = None,
    user_prompt_template: str = None,
    rag_context: str = None,
) -> Optional[dict]:
    """调用LLM进行智能分析（支持动态配置 + RAG上下文）"""
    _api_key = api_key or LLM_API_KEY
    _base_url = base_url or LLM_BASE_URL
    _model = model or LLM_MODEL
    _sys_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
    _usr_prompt = user_prompt_template or DEFAULT_USER_PROMPT_TEMPLATE

    if not _api_key or not _model:
        return None

    # 构建用户消息内容（注入RAG上下文）
    user_content = _usr_prompt.format(
        inspection_area=inspection_area,
        raw_description=raw_description
    )
    if rag_context:
        user_content = f"【知识库参考内容】\n以下是从知识库中检索到的相关规范和参考内容，请结合这些内容进行分析：\n\n{rag_context}\n\n---\n\n{user_content}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _model,
                    "messages": [
                        {"role": "system", "content": _sys_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": temperature,
                }
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]

            # 提取JSON
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
            return None
    except Exception as e:
        print(f"[AI引擎] LLM调用失败: {e}")
        return None


# ========== 规则引擎（LLM不可用时的兜底方案）==========

def standardize_description(raw_description: str, inspection_area: str) -> str:
    """规则化的标准化描述"""
    # 提取关键信息
    desc = raw_description.strip()

    # 尝试结构化
    parts = []
    parts.append(inspection_area)

    # 按标点分割提取问题点
    problem_points = re.split(r'[，,。；;、]', desc)
    problem_points = [p.strip() for p in problem_points if p.strip() and len(p.strip()) > 2]

    if problem_points:
        parts.append("：".join(problem_points[:5]))  # 最多5个要点
    else:
        parts.append(desc)

    return "；".join(parts)


def rule_based_analysis(raw_description: str, inspection_area: str, kb_instance: KnowledgeBase = None) -> dict:
    """基于规则的智能分析（LLM不可用时使用）"""
    _kb = kb_instance or kb
    text = f"{raw_description} {inspection_area}"

    # 1. 分类
    cat_code, cat_name = _kb.classify_category(text)
    spec_code, spec_name = _kb.classify_specialty(text)

    # 2. 风险定级
    risk_level, risk_reason = _kb.determine_risk_level(text, cat_code)

    # 3. 标准化描述
    std_desc = standardize_description(raw_description, inspection_area)

    # 4. 整改模板匹配
    template = _kb.match_template(text, cat_code, spec_code)

    if template:
        rectification_req = template["template"]
        deadline_days = template["deadline_days"]
        review_points = template["review_points"]
    else:
        # 通用整改要求
        risk_rule = _kb.get_risk_rule(risk_level)
        rectification_req = f"1.{risk_rule['action']}；\n2.按相关规范要求进行整改；\n3.整改完成后经监理复查合格方可进行下道工序。"
        deadline_days = risk_rule["deadline_days"]
        review_points = f"1.整改措施落实情况；\n2.整改后是否符合规范要求；\n3.相关记录和资料是否齐全。"

    # 5. 责任主体
    responsible_party = "总承包单位"
    if spec_code == "MEP":
        responsible_party = "总承包单位（机电安装班组）"
    elif spec_code == "DEC":
        responsible_party = "总承包单位（装饰装修班组）"
    elif spec_code == "FIR":
        responsible_party = "总承包单位（消防施工单位）"
    elif spec_code == "CUR":
        responsible_party = "幕墙专业分包单位"

    # 6. 整改期限
    deadline = (datetime.now() + timedelta(days=deadline_days)).date()

    # 7. 置信度（规则匹配，给中等置信度）
    confidence = 0.75 if template else 0.65

    return {
        "standardized_description": std_desc,
        "category_code": cat_code,
        "category_name": cat_name,
        "specialty_code": spec_code,
        "specialty_name": spec_name,
        "risk_level": risk_level,
        "risk_reason": risk_reason,
        "rectification_req": rectification_req,
        "rectification_deadline_days": deadline_days,
        "review_points": review_points,
        "responsible_party": responsible_party,
        "confidence": confidence,
    }


# ========== 统一分析入口 ==========

async def analyze_problem(
    raw_description: str,
    inspection_area: str,
    model_config: dict = None,
    kb_content: dict = None,
    skill: dict = None,
    rag_context: str = None,
) -> dict:
    """
    智能分析入口（支持动态配置 + RAG）
    
    Args:
        raw_description: 原始问题描述
        inspection_area: 巡视区域
        model_config: AI模型配置 {provider, api_key, base_url, model_name, temperature}
        kb_content: 知识库内容字典（为None时用全局kb，用于规则引擎分类）
        skill: 分析技能 {system_prompt, user_prompt_template}
        rag_context: RAG检索到的上下文文本（来自文档知识库）
    """
    # 选择知识库（用于规则引擎的分类/模板匹配）
    _kb = KnowledgeBase(content=kb_content) if kb_content else kb

    # 解析模型配置
    _provider = "rule_engine"
    _api_key = ""
    _base_url = ""
    _model = ""
    _temperature = 0.3
    _sys_prompt = None
    _usr_prompt = None

    if model_config:
        _provider = model_config.get("provider", "rule_engine")
        _api_key = model_config.get("api_key", "")
        _base_url = model_config.get("base_url", "")
        _model = model_config.get("model_name", "")
        _temperature = model_config.get("temperature", 0.3)

    if skill:
        _sys_prompt = skill.get("system_prompt")
        _usr_prompt = skill.get("user_prompt_template")

    # 如果配置了API key且不是规则引擎，尝试LLM（注入RAG上下文）
    if _provider != "rule_engine" and _api_key:
        llm_result = await call_llm(
            raw_description, inspection_area,
            api_key=_api_key, base_url=_base_url, model=_model,
            temperature=_temperature,
            system_prompt=_sys_prompt, user_prompt_template=_usr_prompt,
            rag_context=rag_context,
        )
        if llm_result:
            # 补充规则引擎的补充信息
            if "rectification_deadline_days" not in llm_result:
                text = f"{raw_description} {inspection_area}"
                cat_code, _ = _kb.classify_category(text)
                risk_level, _ = _kb.determine_risk_level(text, cat_code)
                risk_rule = _kb.get_risk_rule(risk_level)
                llm_result["rectification_deadline_days"] = risk_rule["deadline_days"]
            print(f"[AI引擎] LLM分析完成（RAG={"有" if rag_context else "无"}），置信度: {llm_result.get("confidence", "N/A")}")
            return llm_result

    # 使用规则引擎
    print("[AI引擎] 使用规则引擎进行分析")
    return rule_based_analysis(raw_description, inspection_area, _kb)
