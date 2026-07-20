"""
从last.pt恢复训练 - 继续13类安全检测模型训练
"""

import torch
import os
import shutil

# Monkey-patch torch meshgrid bug
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

LAST_PT = 'runs/detect/merged_safety/weights/last.pt'
BEST_PT = 'runs/detect/merged_safety/weights/best.pt'
TARGET = '/Users/macbookpro/Desktop/智询工匠/backend/models/engine_safety.pt'

print("=" * 60)
print("恢复训练 - 13类安全检测模型")
print("=" * 60)

model = YOLO(LAST_PT)

results = model.train(
    resume=True,
)

print("\n" + "=" * 60)
print("训练完成!")
print("=" * 60)

# 部署best.pt
if os.path.exists(BEST_PT):
    shutil.copy2(BEST_PT, TARGET)
    size_mb = os.path.getsize(TARGET) / 1024 / 1024
    print(f"best.pt 已部署: {TARGET} ({size_mb:.1f} MB)")
