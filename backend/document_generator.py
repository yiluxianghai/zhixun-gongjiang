"""
文档生成器
工程监理巡视问题分类闭环管理智能体

功能：
1. 生成监理通知单
2. 生成巡视记录
3. 生成问题闭环台账
4. 生成问题分析报告
"""
import json
from datetime import datetime, date
from typing import List

from database import InspectionProblem


def generate_notice(problem: InspectionProblem, project_name: str) -> dict:
    """生成监理通知单"""
    notice_no = f"监理通知〔{datetime.now().year}〕第{problem.id:04d}号"

    content = {
        "notice_no": notice_no,
        "project_name": project_name,
        "to_unit": problem.responsible_party or "总承包单位",
        "subject": f"关于{problem.inspection_area}巡视发现问题整改通知",
        "problem_detail": {
            "problem_no": problem.problem_no,
            "inspection_date": problem.inspection_date.isoformat() if problem.inspection_date else "",
            "inspection_area": problem.inspection_area,
            "inspector": problem.inspector,
            "problem_description": problem.standardized_desc or problem.raw_description,
            "category": problem.category_name,
            "specialty": problem.specialty_name,
            "risk_level": problem.risk_level,
        },
        "rectification_requirements": problem.rectification_req or "",
        "rectification_deadline": problem.rectification_deadline.isoformat() if problem.rectification_deadline else "",
        "review_points": problem.review_points or "",
        "supervision_unit": "XX工程监理咨询有限公司",
        "issue_date": datetime.now().strftime("%Y年%m月%d日"),
        "remark": "请施工单位按本通知要求进行整改，整改完成后将整改情况书面回复监理部，经复查合格后予以销项。",
    }

    return {
        "type": "监理通知单",
        "title": f"监理通知单 - {notice_no}",
        "content": content,
    }


def generate_inspection_record(problems: List[InspectionProblem], project_name: str,
                                 inspection_date: str = None, inspector: str = None) -> dict:
    """生成巡视记录"""
    if not inspection_date:
        inspection_date = datetime.now().strftime("%Y-%m-%d")

    areas = list(set(p.inspection_area for p in problems))
    inspectors = list(set(p.inspector for p in problems))
    if inspector:
        inspectors = [inspector]

    problem_summaries = []
    for p in problems:
        problem_summaries.append({
            "no": p.problem_no,
            "area": p.inspection_area,
            "description": p.standardized_desc or p.raw_description,
            "category": p.category_name,
            "risk_level": p.risk_level,
            "status": p.status,
        })

    content = {
        "record_no": f"巡视记录-{inspection_date}-{problems[0].id if problems else 0:04d}",
        "project_name": project_name,
        "inspection_date": inspection_date,
        "inspection_areas": areas,
        "inspectors": inspectors,
        "problem_count": len(problems),
        "problems": problem_summaries,
        "handling_opinion": "对巡视发现的问题，已下发监理通知单，要求施工单位限期整改，整改完成后报监理复查。",
        "supervision_unit": "XX工程监理咨询有限公司",
    }

    return {
        "type": "巡视记录",
        "title": f"监理巡视记录 - {inspection_date}",
        "content": content,
    }


def generate_ledger(problems: List[InspectionProblem]) -> dict:
    """生成问题闭环台账"""
    ledger_items = []
    for p in problems:
        ledger_items.append({
            "problem_no": p.problem_no,
            "inspection_date": p.inspection_date.isoformat() if p.inspection_date else "",
            "inspection_area": p.inspection_area,
            "category": p.category_name,
            "specialty": p.specialty_name,
            "risk_level": p.risk_level,
            "description": p.standardized_desc or p.raw_description,
            "responsible_party": p.responsible_party,
            "rectification_req": p.rectification_req or "",
            "rectification_deadline": p.rectification_deadline.isoformat() if p.rectification_deadline else "",
            "status": p.status,
            "rectification_date": p.rectification_date.isoformat() if p.rectification_date else "",
            "review_date": p.review_date.isoformat() if p.review_date else "",
            "review_result": p.review_result or "",
        })

    # 统计
    status_count = {}
    category_count = {}
    risk_count = {}
    for item in ledger_items:
        status_count[item["status"]] = status_count.get(item["status"], 0) + 1
        category_count[item["category"]] = category_count.get(item["category"], 0) + 1
        risk_count[item["risk_level"]] = risk_count.get(item["risk_level"], 0) + 1

    return {
        "type": "闭环台账",
        "title": f"问题闭环管理台账（共{len(ledger_items)}条）",
        "content": {
            "total": len(ledger_items),
            "status_summary": status_count,
            "category_summary": category_count,
            "risk_summary": risk_count,
            "items": ledger_items,
        }
    }


def generate_analysis_report(problems: List[InspectionProblem], project_name: str) -> dict:
    """生成问题分析报告"""
    total = len(problems)
    if total == 0:
        return {
            "type": "分析报告",
            "title": "问题分析报告",
            "content": {"message": "暂无问题数据"}
        }

    # 分类统计
    category_stats = {}
    specialty_stats = {}
    risk_stats = {}
    status_stats = {}
    area_stats = {}
    responsible_stats = {}

    # 高频问题
    problem_keywords = {}

    for p in problems:
        # 类别统计
        cat = p.category_name or "未分类"
        category_stats[cat] = category_stats.get(cat, 0) + 1

        # 专业统计
        spec = p.specialty_name or "未分类"
        specialty_stats[spec] = specialty_stats.get(spec, 0) + 1

        # 风险统计
        risk = p.risk_level or "未定级"
        risk_stats[risk] = risk_stats.get(risk, 0) + 1

        # 状态统计
        status_stats[p.status] = status_stats.get(p.status, 0) + 1

        # 区域统计
        area = p.inspection_area or "未知"
        area_stats[area] = area_stats.get(area, 0) + 1

        # 责任单位统计
        party = p.responsible_party or "未指定"
        responsible_stats[party] = responsible_stats.get(party, 0) + 1

    # 闭环率
    closed_count = status_stats.get("已销项", 0)
    closure_rate = round(closed_count / total * 100, 1) if total > 0 else 0

    # 超期未整改
    overdue_count = 0
    today = date.today()
    for p in problems:
        if p.status in ["待整改", "整改中"] and p.rectification_deadline:
            if p.rectification_deadline < today:
                overdue_count += 1

    # 高频问题区域（Top 3）
    top_areas = sorted(area_stats.items(), key=lambda x: x[1], reverse=True)[:3]

    # 高频问题类别（Top 3）
    top_categories = sorted(category_stats.items(), key=lambda x: x[1], reverse=True)[:3]

    content = {
        "project_name": project_name,
        "report_date": datetime.now().strftime("%Y-%m-%d"),
        "summary": {
            "total_problems": total,
            "closure_rate": closure_rate,
            "overdue_count": overdue_count,
            "pending_count": status_stats.get("待整改", 0),
            "in_progress_count": status_stats.get("整改中", 0),
            "review_count": status_stats.get("待复查", 0),
            "closed_count": closed_count,
        },
        "category_distribution": category_stats,
        "specialty_distribution": specialty_stats,
        "risk_distribution": risk_stats,
        "status_distribution": status_stats,
        "area_distribution": area_stats,
        "responsible_distribution": responsible_stats,
        "top_areas": [{"area": a, "count": c} for a, c in top_areas],
        "top_categories": [{"category": c, "count": n} for c, n in top_categories],
        "analysis": _generate_analysis_text(total, category_stats, risk_stats, closure_rate, overdue_count, top_areas),
        "suggestions": _generate_suggestions(risk_stats, overdue_count, top_categories),
    }

    return {
        "type": "分析报告",
        "title": f"问题分析报告 - {project_name}",
        "content": content,
    }


def _generate_analysis_text(total, cat_stats, risk_stats, closure_rate, overdue_count, top_areas):
    """生成分析文字"""
    parts = []

    parts.append(f"本期共记录监理巡视问题{total}条。")

    # 类别分析
    if cat_stats:
        top_cat = max(cat_stats.items(), key=lambda x: x[1])
        parts.append(f"从问题类别看，{top_cat[0]}类问题最多，共{top_cat[1]}条，"
                     f"占比{round(top_cat[1]/total*100, 1)}%。")

    # 风险分析
    major_count = risk_stats.get("重大", 0)
    larger_count = risk_stats.get("较大", 0)
    if major_count > 0:
        parts.append(f"存在重大风险问题{major_count}条，需重点关注。")
    if larger_count > 0:
        parts.append(f"较大风险问题{larger_count}条，需及时整改。")

    # 闭环情况
    parts.append(f"问题闭环率为{closure_rate}%。")
    if overdue_count > 0:
        parts.append(f"有{overdue_count}条问题超期未整改，需加强跟踪督促。")

    # 高频区域
    if top_areas:
        areas_text = "、".join([f"{a}({c}条)" for a, c in top_areas])
        parts.append(f"问题高发区域：{areas_text}，建议加强巡视。")

    return "\n\n".join(parts)


def _generate_suggestions(risk_stats, overdue_count, top_categories):
    """生成管理建议"""
    suggestions = []

    if risk_stats.get("重大", 0) > 0:
        suggestions.append("存在重大风险问题，建议立即组织专项检查，全面排查类似隐患。")

    if overdue_count > 0:
        suggestions.append(f"有{overdue_count}条问题超期未整改，建议向施工单位发出督促通知，必要时约谈项目经理。")

    for cat, count in top_categories:
        if cat == "安全管理" and count >= 3:
            suggestions.append(f"安全管理类问题较多（{count}条），建议开展安全专项教育和现场检查。")
        elif cat == "质量管理" and count >= 3:
            suggestions.append(f"质量管理类问题较多（{count}条），建议加强工序验收和技术交底。")
        elif cat == "文明施工管理" and count >= 3:
            suggestions.append(f"文明施工类问题较多（{count}条），建议落实文明施工责任制，加强日常管理。")

    if not suggestions:
        suggestions.append("当前问题总体可控，建议继续保持常态化巡视和闭环管理。")

    return suggestions
