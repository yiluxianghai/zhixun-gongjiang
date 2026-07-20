"""
MPS加速训练 - 13类安全检测模型
使用Apple Silicon GPU (MPS) + 优化参数加速训练
预计比CPU快3-5倍
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

DATA_YAML = '/Users/macbookpro/Desktop/智询工匠/backend/train/merged_dataset/data.yaml'
PROJECT = 'runs/detect'
NAME = 'merged_safety_mps'
BEST_PT = f'{PROJECT}/{NAME}/weights/best.pt'
TARGET = '/Users/macbookpro/Desktop/智询工匠/backend/models/engine_safety.pt'

# 从之前训练的last.pt继续（已训练5轮）
RESUME_FROM = '/Users/macbookpro/Desktop/智询工匠/backend/train/runs/detect/merged_safety/weights/last.pt'

print("=" * 60)
print("MPS加速训练 - 13类安全检测模型")
print("=" * 60)
print(f"设备: MPS (Apple Silicon GPU)")
print(f"恢复自: {RESUME_FROM}")
print(f"数据集: {DATA_YAML}")

# 验证MPS可用性
assert torch.backends.mps.is_available(), "MPS不可用！"
print(f"MPS状态: 可用 ✓")

# 加载已训练5轮的模型
model = YOLO(RESUME_FROM)
print(f"模型加载完成")

# 训练参数（MPS优化）
results = model.train(
    data=DATA_YAML,
    epochs=50,
    imgsz=480,        # 从640降至480，减少44%计算量
    batch=32,         # MPS内存更大，增大batch
    device='mps',    # Apple Silicon GPU加速
    project=PROJECT,
    name=NAME,
    exist_ok=True,
    patience=15,
    save=True,
    save_period=5,
    plots=True,
    verbose=True,
    workers=4,
    amp=False,        # MPS不支持AMP，关闭
)

print("\n" + "=" * 60)
print("训练完成!")
print("=" * 60)

# 部署best.pt
if os.path.exists(BEST_PT):
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    shutil.copy2(BEST_PT, TARGET)
    size_mb = os.path.getsize(TARGET) / 1024 / 1024
    print(f"best.pt 已部署: {TARGET} ({size_mb:.1f} MB)")
else:
    print(f"警告: best.pt 未找到: {BEST_PT}")

if hasattr(results, 'results_dict'):
    print("\n最终训练结果:")
    for k, v in results.results_dict.items():
        print(f"  {k}: {v}")
