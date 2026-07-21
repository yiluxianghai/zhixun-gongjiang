"""
YOLO推理脚本 - 使用ultralytics直接加载.pt模型进行推理
由yolo_detector.py通过子进程调用

用法: python yolo_infer.py <image_path> <model_path> [confidence_threshold]
输出: JSON格式检测结果到stdout
"""

import sys
import os
import json

# Monkey-patch torch meshgrid bug (torch 2.1.2 compatibility)
import torch
original_meshgrid = torch.meshgrid
def patched_meshgrid(*tensors, indexing=None):
    if len(tensors) == 1 and isinstance(tensors[0], (list, tuple)):
        tensors = tuple(tensors[0])
    if indexing is None:
        indexing = 'ij'
    try:
        return original_meshgrid(*tensors, indexing=indexing)
    except TypeError:
        return torch._VF.meshgrid(tensors, indexing=indexing)
torch.meshgrid = patched_meshgrid
import ultralytics.utils.tal as tal
tal.torch.meshgrid = patched_meshgrid


def run_inference(image_path, model_path, conf_threshold=0.15):
    """运行YOLO推理并返回检测结果"""
    from ultralytics import YOLO

    model = YOLO(model_path)
    results = model(image_path, conf=conf_threshold, verbose=False)

    detections = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # 13类统一类别定义
            cls_names = {
                0: "no_helmet", 1: "helmet",
                2: "no_vest", 3: "vest",
                4: "no_mask", 5: "mask",
                6: "gloves",
                7: "crack", 8: "spalling", 9: "exposed_rebar",
                10: "rust", 11: "scaling", 12: "efflorescence",
            }
            cls_cns = {
                0: "未戴安全帽", 1: "已戴安全帽",
                2: "未穿反光背心", 3: "已穿反光背心",
                4: "未戴口罩", 5: "已戴口罩",
                6: "已戴手套",
                7: "裂缝", 8: "剥落", 9: "钢筋外露",
                10: "锈蚀", 11: "起皮", 12: "泛霜",
            }
            cls_types = {
                0: "violation", 1: "compliant",
                2: "violation", 3: "compliant",
                4: "violation", 5: "compliant",
                6: "compliant",
                7: "defect", 8: "defect", 9: "defect",
                10: "defect", 11: "defect", 12: "defect",
            }

            detections.append({
                "class_id": cls_id,
                "class_name": cls_names.get(cls_id, f"unknown_{cls_id}"),
                "class_cn": cls_cns.get(cls_id, f"未知({cls_id})"),
                "type": cls_types.get(cls_id, "defect"),
                "confidence": round(conf, 4),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            })

    return detections


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python yolo_infer.py <image_path> <model_path> [conf_threshold]"}))
        sys.exit(1)

    image_path = sys.argv[1]
    model_path = sys.argv[2]
    conf_threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4

    try:
        detections = run_inference(image_path, model_path, conf_threshold)
        print(json.dumps({"success": True, "detections": detections}, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)
