"""
训练YOLOv8多类别模型 - 13类安全帽/PPE/工程缺陷检测
使用合并后的数据集（Hard Hat Workers + PPE + Concrete Defects）
"""

import torch
import os
import shutil

# Monkey-patch torch meshgrid bug (torch 2.1.2 compatibility)
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

from ultralytics import YOLO

# 数据集配置
DATA_YAML = '/Users/macbookpro/Desktop/智询工匠/backend/train/merged_dataset/data.yaml'
PROJECT = 'runs/detect'
NAME = 'merged_safety'

# 训练参数
EPOCHS = 50
IMGSZ = 640
BATCH = 16
DEVICE = 'cpu'
PATIENCE = 15

print("=" * 60)
print("YOLOv8 多类别安全检测训练")
print("=" * 60)
print(f"数据集: {DATA_YAML}")
print(f"训练轮次: {EPOCHS} (patience={PATIENCE})")
print(f"图片尺寸: {IMGSZ}, Batch: {BATCH}, 设备: {DEVICE}")
print(f"输出: {PROJECT}/{NAME}")
print("=" * 60)

# 加载预训练模型
model = YOLO('yolov8s.pt')
print(f"预训练模型: yolov8s.pt")

# 开始训练
results = model.train(
    data=DATA_YAML,
    epochs=EPOCHS,
    imgsz=IMGSZ,
    batch=BATCH,
    device=DEVICE,
    project=PROJECT,
    name=NAME,
    exist_ok=True,
    patience=PATIENCE,
    save=True,
    save_period=10,
    plots=True,
    verbose=True,
    workers=4,
)

print("\n" + "=" * 60)
print("训练完成!")
print("=" * 60)

# 复制best.pt到models目录
best_path = f'{PROJECT}/{NAME}/weights/best.pt'
target = '/Users/macbookpro/Desktop/智询工匠/backend/models/engine_safety.pt'

if os.path.exists(best_path):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(best_path, target)
    size_mb = os.path.getsize(target) / 1024 / 1024
    print(f"best.pt 已复制到: {target} ({size_mb:.1f} MB)")
else:
    print(f"警告: best.pt 未找到: {best_path}")

# 打印最终结果
if hasattr(results, 'results_dict'):
    print("\n最终训练结果:")
    for k, v in results.results_dict.items():
        print(f"  {k}: {v}")
