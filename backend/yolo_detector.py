"""
YOLO图片识别推理模块
工程安全违规与质量缺陷检测

功能：
1. 加载本地ONNX模型进行推理
2. 将检测结果映射为与LLM Vision相同的JSON格式
3. 支持混合模式：YOLO检测 + LLM生成描述（可选）

模型文件：backend/models/engine_safety.onnx
"""

import os
import json
import base64
import io
from typing import Optional
from pathlib import Path

import numpy as np

# 模型文件路径
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
ONNX_MODEL_PATH = os.path.join(MODEL_DIR, "engine_safety.onnx")

# 类别定义（与训练数据集一致）
CLASS_NAMES = {
    0: {"en": "person_no_helmet", "cn": "未戴安全帽", "type": "violation"},
    1: {"en": "person_no_vest", "cn": "未穿反光衣", "type": "violation"},
    2: {"en": "person_no_belt", "cn": "未系安全带", "type": "violation"},
    3: {"en": "crack", "cn": "裂缝", "type": "defect"},
    4: {"en": "rebar_exposure", "cn": "钢筋外露", "type": "defect"},
    5: {"en": "spalling", "cn": "剥落/蜂窝麻面", "type": "defect"},
    6: {"en": "water_seepage", "cn": "渗水", "type": "defect"},
    7: {"en": "edge_protection", "cn": "临边防护缺失", "type": "violation"},
    8: {"en": "formwork_issue", "cn": "模板支撑问题", "type": "defect"},
    9: {"en": "material_disorder", "cn": "材料堆放不规范", "type": "violation"},
}

# 风险等级映射
RISK_MAP = {
    "person_no_helmet": "较大",
    "person_no_vest": "一般",
    "person_no_belt": "重大",
    "crack": "较大",
    "rebar_exposure": "一般",
    "spalling": "一般",
    "water_seepage": "一般",
    "edge_protection": "较大",
    "formwork_issue": "较大",
    "material_disorder": "一般",
}

# 整改建议
RECOMMENDATIONS = {
    "person_no_helmet": "立即要求相关人员佩戴安全帽，加强安全教育培训",
    "person_no_vest": "要求人员穿戴反光马甲，确保施工现场人员可见性",
    "person_no_belt": "立即停止高空作业，要求正确佩戴安全带后复工",
    "crack": "对裂缝部位进行检测评估，必要时进行修补或加固处理",
    "rebar_exposure": "检查钢筋保护层厚度，对外露钢筋进行防锈处理",
    "spalling": "对剥落部位进行修补，检查周边区域是否存在类似问题",
    "water_seepage": "查找渗水来源，进行防水处理，评估结构安全",
    "edge_protection": "立即补设临边防护栏杆和安全网，禁止无防护作业",
    "formwork_issue": "检查模板支撑体系，加固扫地杆和水平拉结，确保稳定",
    "material_disorder": "规范材料堆放，分类存放并设置标识",
}

# 全局模型缓存
_onnx_session = None


def is_model_available() -> bool:
    """检查本地YOLO模型是否可用"""
    return os.path.exists(ONNX_MODEL_PATH)


def get_model_path() -> str:
    """获取模型文件路径"""
    return ONNX_MODEL_PATH


def _load_model():
    """加载ONNX模型（懒加载，首次调用时加载）"""
    global _onnx_session

    if _onnx_session is not None:
        return _onnx_session

    if not is_model_available():
        return None

    try:
        import onnxruntime as ort

        # 创建ONNX推理会话
        providers = ["CPUExecutionProvider"]
        # 尝试使用GPU（如果可用）
        available = ort.get_available_providers()
        if "CUDAExecutionProvider" in available:
            providers.insert(0, "CUDAExecutionProvider")

        _onnx_session = ort.InferenceSession(ONNX_MODEL_PATH, providers=providers)
        print(f"[YOLO] 模型加载成功: {ONNX_MODEL_PATH}")
        print(f"[YOLO] 推理引擎: {providers}")
        return _onnx_session
    except ImportError:
        print("[YOLO] 未安装 onnxruntime，请运行: pip install onnxruntime")
        return None
    except Exception as e:
        print(f"[YOLO] 模型加载失败: {e}")
        return None


def _preprocess_image(image_bytes: bytes, target_size: int = 640) -> np.ndarray:
    """
    图片预处理：resize + 归一化 + NCHW格式

    Args:
        image_bytes: 图片字节流
        target_size: 目标尺寸（640x640）

    Returns:
        预处理后的numpy数组 (1, 3, 640, 640)
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    original_w, original_h = img.size

    # 转RGB（处理RGBA和灰度图）
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Letterbox缩放（保持比例）
    scale = min(target_size / original_w, target_size / original_h)
    new_w = int(original_w * scale)
    new_h = int(original_h * scale)

    img_resized = img.resize((new_w, new_h), Image.BILINEAR)

    # 创建640x640画布，居中放置
    canvas = Image.new("RGB", (target_size, target_size), (114, 114, 114))
    pad_x = (target_size - new_w) // 2
    pad_y = (target_size - new_h) // 2
    canvas.paste(img_resized, (pad_x, pad_y))

    # 转numpy并归一化
    img_array = np.array(canvas, dtype=np.float32) / 255.0

    # HWC -> CHW
    img_array = img_array.transpose(2, 0, 1)

    # 添加batch维度
    img_array = np.expand_dims(img_array, axis=0)

    return img_array, (original_w, original_h, scale, pad_x, pad_y)


def _postprocess_detections(
    output: np.ndarray,
    original_size: tuple,
    preprocess_info: tuple,
    conf_threshold: float = 0.4,
    iou_threshold: float = 0.5,
) -> list:
    """
    后处理YOLOv8输出：NMS + 坐标还原

    Args:
        output: ONNX模型输出 (1, num_classes+4, num_boxes) 或 (1, num_boxes, num_classes+4)
        original_size: 原始图片尺寸 (w, h)
        preprocess_info: 预处理信息 (orig_w, orig_h, scale, pad_x, pad_y)
        conf_threshold: 置信度阈值
        iou_threshold: NMS IoU阈值

    Returns:
        检测结果列表 [{class_id, class_name, confidence, bbox: [x1,y1,x2,y2]}]
    """
    orig_w, orig_h, scale, pad_x, pad_y = preprocess_info

    # YOLOv8输出格式: (batch, 4+num_classes, num_boxes) 或 (batch, num_boxes, 4+num_classes)
    if output.shape[2] < output.shape[1]:
        # (1, 4+nc, num_boxes) -> 转置为 (1, num_boxes, 4+nc)
        output = output[0].T
    else:
        output = output[0]

    num_classes = len(CLASS_NAMES)

    # 提取边界框和类别概率
    boxes = output[:, :4]  # cx, cy, w, h (在640x640空间)
    scores = output[:, 4:4 + num_classes]  # 类别概率

    # 获取每个box的最大概率和对应类别
    class_ids = np.argmax(scores, axis=1)
    max_scores = np.max(scores, axis=1)

    # 置信度过滤
    mask = max_scores > conf_threshold
    boxes = boxes[mask]
    class_ids = class_ids[mask]
    max_scores = max_scores[mask]

    if len(boxes) == 0:
        return []

    # 转换坐标：cxcywh -> xyxy
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2

    # 还原到原始图片坐标
    x1 = (x1 - pad_x) / scale
    y1 = (y1 - pad_y) / scale
    x2 = (x2 - pad_x) / scale
    y2 = (y2 - pad_y) / scale

    # 裁剪到图片范围
    x1 = np.clip(x1, 0, orig_w)
    y1 = np.clip(y1, 0, orig_h)
    x2 = np.clip(x2, 0, orig_w)
    y2 = np.clip(y2, 0, orig_h)

    # NMS（非极大值抑制）
    keep = _nms(x1, y1, x2, y2, max_scores, iou_threshold)

    results = []
    for idx in keep:
        class_id = int(class_ids[idx])
        class_info = CLASS_NAMES.get(class_id, {"cn": f"未知({class_id})", "type": "defect"})
        results.append({
            "class_id": class_id,
            "class_name": class_info["en"],
            "class_cn": class_info["cn"],
            "type": class_info["type"],
            "confidence": float(max_scores[idx]),
            "bbox": [float(x1[idx]), float(y1[idx]), float(x2[idx]), float(y2[idx])],
        })

    return results


def _nms(x1, y1, x2, y2, scores, iou_threshold):
    """非极大值抑制"""
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)

        if order.size == 1:
            break

        # 计算IoU
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0, xx2 - xx1)
        h = np.maximum(0, yy2 - yy1)
        inter = w * h
        union = areas[i] + areas[order[1:]] - inter
        iou = inter / (union + 1e-7)

        # 保留IoU低于阈值的
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return keep


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
    recommendations = []
    risk_levels = []

    for det in detections:
        cn_name = det["class_cn"]
        conf = det["confidence"]
        conf_str = f"{conf * 100:.0f}%"

        if det["type"] == "violation":
            violations.append(f"{cn_name}（置信度{conf_str}）")
        else:
            defects.append(f"{cn_name}（置信度{conf_str}）")

        # 添加整改建议
        rec = RECOMMENDATIONS.get(det["class_name"])
        if rec and rec not in recommendations:
            recommendations.append(rec)

        # 收集风险等级
        risk = RISK_MAP.get(det["class_name"], "一般")
        risk_levels.append(risk)

    # 确定最高风险等级
    risk_priority = {"一般": 1, "较大": 2, "重大": 3}
    max_risk = max(risk_levels, key=lambda r: risk_priority.get(r, 1))

    # 生成描述
    all_issues = violations + defects
    description = f"巡视区域[{inspection_area}]AI识别发现{len(all_issues)}个问题："
    if violations:
        description += f"\n安全违规{len(violations)}项：{'、'.join(v for v in violations)}。"
    if defects:
        description += f"\n质量缺陷{len(defects)}项：{'、'.join(d for d in defects)}。"

    # 平均置信度
    avg_conf = sum(d["confidence"] for d in detections) / len(detections)

    return {
        "has_issues": True,
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

    Args:
        image_bytes: 图片字节流
        inspection_area: 巡视区域描述

    Returns:
        分析结果dict（与LLM Vision格式一致），或None（模型不可用）
    """
    session = _load_model()
    if session is None:
        return None

    try:
        # 预处理
        input_data, preprocess_info = _preprocess_image(image_bytes, target_size=640)

        # 推理
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: input_data})
        output = outputs[0]

        # 后处理
        orig_w, orig_h = preprocess_info[0], preprocess_info[1]
        detections = _postprocess_detections(
            output,
            (orig_w, orig_h),
            preprocess_info,
            conf_threshold=0.4,
            iou_threshold=0.5,
        )

        print(f"[YOLO] 检测完成: 发现{len(detections)}个目标")

        # 映射为统一结果格式
        result = _map_to_result(detections, inspection_area)
        return result

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
        "model_path": ONNX_MODEL_PATH if available else None,
        "model_size_mb": round(os.path.getsize(ONNX_MODEL_PATH) / 1024 / 1024, 1) if available else 0,
        "num_classes": len(CLASS_NAMES),
        "classes": [{"id": k, "name": v["cn"], "type": v["type"]} for k, v in CLASS_NAMES.items()],
    }
    return info
