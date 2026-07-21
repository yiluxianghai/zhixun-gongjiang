import os, time, shutil, subprocess, signal

RESULTS_CSV = '/Users/macbookpro/Desktop/智询工匠/backend/train/runs/detect/merged_safety/results.csv'
BEST_PT = '/Users/macbookpro/Desktop/智询工匠/backend/train/runs/detect/merged_safety/weights/best.pt'
LAST_PT = '/Users/macbookpro/Desktop/智询工匠/backend/train/runs/detect/merged_safety/weights/last.pt'
TARGET = '/Users/macbookpro/Desktop/智询工匠/backend/models/engine_safety.pt'

print("等待第5轮训练完成...")
while True:
    with open(RESULTS_CSV, 'r') as f:
        lines = f.read().strip().split('\n')
    completed = len(lines) - 1  # 减去header
    if completed >= 5:
        print(f"第5轮已完成！共完成{completed}轮")
        break
    print(f"  已完成{completed}轮，等待第5轮...")
    time.sleep(60)

# 停止训练进程
print("停止训练进程...")
subprocess.run(['pkill', '-f', 'train_merged.py'], capture_output=True)
time.sleep(3)
subprocess.run(['pkill', '-f', 'train_resume_after_pause'], capture_output=True)
time.sleep(2)
print("训练进程已停止")

# 复制best.pt
src = BEST_PT if os.path.exists(BEST_PT) else LAST_PT
if os.path.exists(src):
    shutil.copy2(src, TARGET)
    size_mb = os.path.getsize(TARGET) / 1024 / 1024
    print(f"模型已部署: {TARGET} ({size_mb:.1f} MB)")
else:
    print(f"错误: 未找到模型文件 {src}")
    exit(1)

# 打印第5轮结果
with open(RESULTS_CSV, 'r') as f:
    lines = f.read().strip().split('\n')
last_line = lines[-1]
parts = [p.strip() for p in last_line.split(',')]
print(f"\n第{parts[0]}轮结果: P={float(parts[4])*100:.1f}% R={float(parts[5])*100:.1f}% mAP50={float(parts[6])*100:.1f}%")
print("部署完成!")
