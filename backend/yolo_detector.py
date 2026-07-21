"""
YOLO图片识别推理模块
工程安全违规与质量缺陷检测

功能：
1. 通过子进程调用ultralytics加载.pt模型进行推理
2. 将检测结果映射为与LLM Vision相同的JSON格式
3. 支持混合模式：YOLO检测 + LLM生成描述（可选）

模型文件：backend/models/engine_safety.pt
推理脚本：backend/yolo_infer.py（由conda Python执行）
"""

import os
import json
import subprocess
import tempfile
from typing import Optional
from pathlib import Path

# 模型文件路径
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
PT_MODEL_PATH = os.path.join(MODEL_DIR, "engine_safety.pt")

# 推理脚本路径
INFER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yolo_infer.py")

# conda Python路径（安装了torch + ultralytics）
CONDA_PYTHON = r"D:\anaconda3\envs\yolo-train\python.exe"

# 13类统一类别定义（Hard Hat Workers + PPE Detection + Concrete Defects）
# 违规操作 (violation)
CLASS_NAMES = {
    0: {"en": "no_helmet", "cn": "未戴安全帽", "type": "violation"},
    1: {"en": "helmet", "cn": "已戴安全帽", "type": "compliant"},
    2: {"en": "no_vest", "cn": "未穿反光背心", "type": "violation"},
    3: {"en": "vest", "cn": "已穿反光背心", "type": "compliant"},
    4: {"en": "no_mask", "cn": "未戴口罩", "type": "violation"},
    5: {"en": "mask", "cn": "已戴口罩", "type": "compliant"},
    6: {"en": "gloves", "cn": "已戴手套", "type": "compliant"},
    # 工程质量缺陷 (defect)
    7: {"en": "crack", "cn": "裂缝", "type": "defect"},
    8: {"en": "spalling", "cn": "剥落", "type": "defect"},
    9: {"en": "exposed_rebar", "cn": "钢筋外露", "type": "defect"},
    10: {"en": "rust", "cn": "锈蚀", "type": "defect"},
    11: {"en": "scaling", "cn": "起皮", "type": "defect"},
    12: {"en": "efflorescence", "cn": "泛霜", "type": "defect"},
}

# 风险等级映射
RISK_MAP = {
    "no_helmet": "较大",
    "no_vest": "较大",
    "no_mask": "一般",
    "crack": "较大",
    "spalling": "较大",
    "exposed_rebar": "重大",
    "rust": "一般",
    "scaling": "一般",
    "efflorescence": "一般",
}

# 整改建议
RECOMMENDATIONS = {
    "no_helmet": "立即要求相关人员佩戴安全帽，加强安全教育培训",
    "no_vest": "要求穿戴反光背心，确保施工人员可见性",
    "no_mask": "要求佩戴口罩，做好个人防护",
    "crack": "对裂缝部位进行结构检测，评估裂缝宽度和深度，及时修补处理",
    "spalling": "清除剥落部位松散混凝土，进行修补加固处理",
    "exposed_rebar": "立即对外露钢筋进行防锈处理，覆盖保护层混凝土",
    "rust": "对锈蚀部位进行除锈处理，涂刷防锈漆",
    "scaling": "清除起皮部位，重新抹面处理",
    "efflorescence": "排查水分来源，清理泛霜表面，做好防水处理",
}

def is_model_available() -> bool:
    """检查本地YOLO模型是否可用"""
    return os.path.exists(PT_MODEL_PATH) and os.path.exists(INFER_SCRIPT)


def get_model_path() -> str:
    """获取模型文件路径"""
    return PT_MODEL_PATH


def _map_to_result(detections: list, inspection_area: str) -> dict:
    """
    将检测结果映射为与LLM Vision相同的JSON格式

    Args:
        detections: YOLO检测结果列表
        inspection_area: 巡视区域

    Returns:
        {
            has_issues, violations, defects, risk_level,
            description, recommendations, confidence
        }
    """
    if not detections:
        return {
            "has_issues": False,
            "violations": [],
            "defects": [],
            "risk_level": "一般",
            "description": f"巡视区域[{inspection_area}]未发现明显安全违规或质量缺陷",
            "recommendations": [],
            "confidence": 0.85,
        }

    violations = []
    defects = []
    compliant_items = []
    recommendations = []
    risk_levels = []

    for det in detections:
        cn_name = det["class_cn"]
        conf = det["confidence"]
        conf_str = f"{conf * 100:.0f}%"

        if det["type"] == "violation":
            violations.append(f"{cn_name}（置信度{conf_str}）")
        elif det["type"] == "defect":
            defects.append(f"{cn_name}（置信度{conf_str}）")
        elif det["type"] == "compliant":
            compliant_items.append(f"{cn_name}（置信度{conf_str}）")

        # 添加整改建议（对违规项和缺陷项）
        if det["type"] in ("violation", "defect"):
            rec = RECOMMENDATIONS.get(det["class_name"])
            if rec and rec not in recommendations:
                recommendations.append(rec)

        # 收集风险等级（对违规项和缺陷项）
        if det["type"] in ("violation", "defect"):
            risk = RISK_MAP.get(det["class_name"], "一般")
            risk_levels.append(risk)

    # 确定最高风险等级
    risk_priority = {"一般": 1, "较大": 2, "重大": 3}
    max_risk = max(risk_levels, key=lambda r: risk_priority.get(r, 1)) if risk_levels else "一般"

    # 生成描述
    parts = []
    if violations:
        parts.append(f"安全违规{len(violations)}项：{'、'.join(violations)}")
    if defects:
        parts.append(f"质量缺陷{len(defects)}项：{'、'.join(defects)}")
    if compliant_items:
        parts.append(f"合规项{len(compliant_items)}项：{'、'.join(compliant_items)}")

    if violations or defects:
        description = f"巡视区域[{inspection_area}]AI识别发现："
        description += "；".join(parts) + "。"
    else:
        if compliant_items:
            description = f"巡视区域[{inspection_area}]AI识别未发现安全违规或质量缺陷，检测到{len(compliant_items)}项合规项。"
        else:
            description = f"巡视区域[{inspection_area}]未发现明显安全违规或质量缺陷"
        if not recommendations:
            recommendations.append("现场安全规范，继续保持")

    # 平均置信度
    avg_conf = sum(d["confidence"] for d in detections) / len(detections)

    return {
        "has_issues": len(violations) > 0 or len(defects) > 0,
        "violations": violations,
        "defects": defects,
        "risk_level": max_risk,
        "description": description,
        "recommendations": recommendations,
        "confidence": round(avg_conf, 2),
        "detections": [
            {
                "class_name": d["class_cn"],
                "confidence": round(d["confidence"], 2),
                "bbox": [round(v, 1) for v in d["bbox"]],
            }
            for d in detections
        ],
    }


def detect_image(image_bytes: bytes, inspection_area: str = "") -> Optional[dict]:
    """
    使用本地YOLO模型检测图片
    通过子进程调用conda Python执行ultralytics推理

    Args:
        image_bytes: 图片字节流
        inspection_area: 巡视区域描述

    Returns:
        分析结果dict（与LLM Vision格式一致），或None（模型不可用）
    """
    if not is_model_available():
        print(f"[YOLO] 模型不可用: {PT_MODEL_PATH}")
        return None

    try:
        # 将图片字节写入临时文件
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_img:
            tmp_img.write(image_bytes)
            tmp_img_path = tmp_img.name

        try:
            # 调用conda Python执行推理
            cmd = [
                CONDA_PYTHON,
                INFER_SCRIPT,
                tmp_img_path,
                PT_MODEL_PATH,
                "0.15",  # 置信度阈值
            ]

            print(f"[YOLO] 调用推理子进程...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60,  # 60秒超时
            )

            if result.returncode != 0:
                print(f"[YOLO] 推理子进程失败 (exit={result.returncode})")
                print(f"[YOLO] stderr: {result.stderr[:500]}")
                return None

            # 解析JSON输出（取最后一行，避免warning干扰）
            output_lines = result.stdout.strip().split("\n")
            json_line = None
            for line in reversed(output_lines):
                line = line.strip()
                if line.startswith("{"):
                    json_line = line
                    break

            if not json_line:
                print(f"[YOLO] 未找到JSON输出")
                print(f"[YOLO] stdout: {result.stdout[:500]}")
                return None

            data = json.loads(json_line)

            if not data.get("success"):
                print(f"[YOLO] 推理失败: {data.get('error', 'unknown')}")
                return None

            detections = data.get("detections", [])
            print(f"[YOLO] 检测完成: 发现{len(detections)}个目标")

            # 映射为统一结果格式
            result = _map_to_result(detections, inspection_area)
            return result

        finally:
            # 清理临时文件
            try:
                os.unlink(tmp_img_path)
            except OSError:
                pass

    except subprocess.TimeoutExpired:
        print("[YOLO] 推理超时（60秒）")
        return None
    except Exception as e:
        print(f"[YOLO] 检测失败: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_model_info() -> dict:
    """获取模型信息"""
    available = is_model_available()
    info = {
        "available": available,
        "model_path": PT_MODEL_PATH if available else None,
        "model_size_mb": round(os.path.getsize(PT_MODEL_PATH) / 1024 / 1024, 1) if available else 0,
        "num_classes": len(CLASS_NAMES),
        "classes": [{"id": k, "name": v["cn"], "type": v["type"]} for k, v in CLASS_NAMES.items()],
        "engine": "ultralytics (subprocess)",
        "python": CONDA_PYTHON,
    }
    return info
