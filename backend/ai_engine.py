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

    def __init__(self):
        self.data = {}
        self._load()

    def _load(self):
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


# 全局知识库实例
kb = KnowledgeBase()


# ========== LLM调用 ==========

SYSTEM_PROMPT = """你是一位资深的工程监理专家，具有丰富的现场巡视和质量安全管理经验。
请根据巡视问题信息进行智能分析，返回JSON格式的分析结果。"""

USER_PROMPT_TEMPLATE = """请根据以下巡视问题信息，进行智能分析和结构化输出。

【巡视信息】
- 巡视区域：{inspection_area}
- 原始描述：{raw_description}

【分类标准】
- 问题类别：质量管理(QM)、安全管理(SM)、文明施工管理(CM)、进度管理(PM)
- 专业类型：土建(CIV)、机电(MEP)、装饰(DEC)、消防(FIR)、幕墙(CUR)
- 风险等级：一般、较大、重大

请严格按照以下JSON格式输出（不要输出其他内容）：
{{
  "standardized_description": "标准化问题描述（50-100字，使用工程规范术语）",
  "category_code": "类别代码",
  "category_name": "类别名称",
  "specialty_code": "专业代码",
  "specialty_name": "专业名称",
  "risk_level": "风险等级",
  "risk_reason": "风险定级理由（一句话）",
  "rectification_req": "整改要求（具体、可操作，分条列出）",
  "rectification_deadline_days": 3,
  "review_points": "复查要点（分条列出）",
  "responsible_party": "建议责任主体",
  "confidence": 0.9
}}

【注意事项】
1. 问题描述应使用工程规范术语，避免口语化表达
2. 整改要求应具体可操作
3. 风险等级应根据问题严重程度和潜在影响综合判断
4. confidence为分析置信度（0.0-1.0）"""


async def call_llm(raw_description: str, inspection_area: str) -> Optional[dict]:
    """调用LLM进行智能分析"""
    if not LLM_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": USER_PROMPT_TEMPLATE.format(
                            inspection_area=inspection_area,
                            raw_description=raw_description
                        )}
                    ],
                    "temperature": 0.3,
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


def rule_based_analysis(raw_description: str, inspection_area: str) -> dict:
    """基于规则的智能分析（LLM不可用时使用）"""
    text = f"{raw_description} {inspection_area}"

    # 1. 分类
    cat_code, cat_name = kb.classify_category(text)
    spec_code, spec_name = kb.classify_specialty(text)

    # 2. 风险定级
    risk_level, risk_reason = kb.determine_risk_level(text, cat_code)

    # 3. 标准化描述
    std_desc = standardize_description(raw_description, inspection_area)

    # 4. 整改模板匹配
    template = kb.match_template(text, cat_code, spec_code)

    if template:
        rectification_req = template["template"]
        deadline_days = template["deadline_days"]
        review_points = template["review_points"]
    else:
        # 通用整改要求
        risk_rule = kb.get_risk_rule(risk_level)
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

async def analyze_problem(raw_description: str, inspection_area: str) -> dict:
    """
    智能分析入口：优先使用LLM，不可用时使用规则引擎
    """
    # 尝试LLM
    llm_result = await call_llm(raw_description, inspection_area)

    if llm_result:
        # 补充规则引擎的补充信息
        if "rectification_deadline_days" not in llm_result:
            text = f"{raw_description} {inspection_area}"
            cat_code, _ = kb.classify_category(text)
            risk_level, _ = kb.determine_risk_level(text, cat_code)
            risk_rule = kb.get_risk_rule(risk_level)
            llm_result["rectification_deadline_days"] = risk_rule["deadline_days"]

        print(f"[AI引擎] LLM分析完成，置信度: {llm_result.get('confidence', 'N/A')}")
        return llm_result
    else:
        # 使用规则引擎
        print("[AI引擎] 使用规则引擎进行分析")
        return rule_based_analysis(raw_description, inspection_area)
