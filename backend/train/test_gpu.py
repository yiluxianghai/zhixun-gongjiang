"""快速验证1轮训练 - 修复路径问题"""
import os, sys
train_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(train_dir)
sys.stdout.reconfigure(line_buffering=True)

print(f"[信息] 工作目录: {train_dir}")
print(f"[信息] data.yaml: {os.path.join(train_dir, 'merged_dataset', 'data.yaml')}")

from ultralytics import YOLO
m = YOLO(os.path.join(train_dir, 'yolov8s.pt'))
print("[信息] 模型加载完成, 开始训练...")

r = m.train(
    data=os.path.join(train_dir, 'merged_dataset', 'data.yaml'),
    epochs=1,
    imgsz=640,
    batch=16,
    device=0,
    workers=2,
    amp=True,
    project=os.path.join(train_dir, 'runs', 'detect'),
    name='test_run',
    exist_ok=True,
    verbose=True,
)
print("[完成] 1轮验证训练成功!")
