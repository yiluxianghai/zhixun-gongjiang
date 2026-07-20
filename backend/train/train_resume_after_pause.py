"""
训练自动恢复脚本
1. 等待当前训练进程(train_merged.py)完成
2. 暂停30分钟（让CPU降温休息）
3. 从last.pt恢复训练
4. 训练完成后自动复制best.pt到models目录
"""

import torch
import os
import shutil
import time
import subprocess
import signal

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

PROJECT = 'runs/detect'
NAME = 'merged_safety'
LAST_PT = f'{PROJECT}/{NAME}/weights/last.pt'
BEST_PT = f'{PROJECT}/{NAME}/weights/best.pt'
TARGET = '/Users/macbookpro/Desktop/智询工匠/backend/models/engine_safety.pt'
PAUSE_MINUTES = 30

print("=" * 60)
print("训练自动恢复脚本")
print("=" * 60)

# Step 1: 等待当前训练进程完成
print(f"\n[Step 1] 等待当前训练进程完成...")
# 查找 train_merged.py 进程
while True:
    result = subprocess.run(
        ['pgrep', '-f', 'train_merged.py'],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("  当前训练进程已结束")
        break
    pid = result.stdout.strip().split('\n')[0]
    print(f"  训练进程 {pid} 仍在运行，等待中...")
    time.sleep(60)  # 每分钟检查一次

# Step 2: 暂停30分钟
print(f"\n[Step 2] 暂停 {PAUSE_MINUTES} 分钟（让设备休息降温）...")
for i in range(PAUSE_MINUTES, 0, -1):
    if i % 5 == 0:
        print(f"  剩余 {i} 分钟...")
    time.sleep(60)
print("  暂停结束，准备恢复训练")

# Step 3: 检查last.pt是否存在
if not os.path.exists(LAST_PT):
    print(f"\n[错误] 未找到 {LAST_PT}，无法恢复训练")
    # 尝试用best.pt继续
    if os.path.exists(BEST_PT):
        print(f"  使用 best.pt 作为恢复起点")
        resume_model_path = BEST_PT
    else:
        print(f"  best.pt 也不存在，退出")
        exit(1)
else:
    resume_model_path = LAST_PT
    print(f"\n[Step 3] 从 {LAST_PT} 恢复训练")

# Step 4: 恢复训练
print(f"\n[Step 4] 恢复训练...")
model = YOLO(resume_model_path)

results = model.train(
    resume=True,
    data='/Users/macbookpro/Desktop/智询工匠/backend/train/merged_dataset/data.yaml',
)

print("\n" + "=" * 60)
print("恢复训练完成!")
print("=" * 60)

# Step 5: 复制best.pt到models目录
if os.path.exists(BEST_PT):
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    shutil.copy2(BEST_PT, TARGET)
    size_mb = os.path.getsize(TARGET) / 1024 / 1024
    print(f"best.pt 已复制到: {TARGET} ({size_mb:.1f} MB)")
else:
    print(f"警告: best.pt 未找到: {BEST_PT}")

# 打印最终结果
if hasattr(results, 'results_dict'):
    print("\n最终训练结果:")
    for k, v in results.results_dict.items():
        print(f"  {k}: {v}")

print("\n全部完成!")
