"""
YOLO 13类安全检测模型训练脚本
RTX 5060 Ti (8GB VRAM) + CUDA 12.8

使用方法:
    D:\\anaconda3\\envs\\yolo-train\\python.exe train_5060ti.py
"""
import os
import sys
import shutil

# 路径配置
TRAIN_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_YAML = "C:/Users/PC/yolo_data.yaml"  # Junction路径，避免中文路径I/O问题
MODEL_PATH = os.path.join(TRAIN_DIR, "yolov8s.pt")


def main():
    sys.stdout.reconfigure(line_buffering=True)

    print("=" * 60)
    print("YOLO 13类工程安全检测模型训练")
    print("设备: NVIDIA GeForce RTX 5060 Ti (8GB)")
    print(f"数据集: {DATA_YAML}")
    print(f"模型: {MODEL_PATH}")
    print(f"训练图片: {len(os.listdir('C:/Users/PC/yolo_data/train/images'))} 张")
    print(f"验证图片: {len(os.listdir('C:/Users/PC/yolo_data/valid/images'))} 张")
    print("=" * 60)

    from ultralytics import YOLO
    model = YOLO(MODEL_PATH)

    # 训练参数（针对8GB显存优化，已验证可运行）
    model.train(
        data=DATA_YAML,
        epochs=100,
        imgsz=640,
        batch=16,
        device=0,
        project=os.path.join(TRAIN_DIR, "runs", "detect"),
        name="merged_safety_5060ti",
        exist_ok=True,
        patience=20,
        save=True,
        save_period=5,
        workers=2,
        amp=True,
        cos_lr=True,
        close_mosaic=15,
        optimizer="auto",
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
        verbose=True,
    )

    print("\n" + "=" * 60)
    print("训练完成!")

    best_pt = os.path.join(TRAIN_DIR, "runs", "detect", "merged_safety_5060ti", "weights", "best.pt")
    if os.path.exists(best_pt):
        print(f"最佳模型: {best_pt}")
        deploy_path = os.path.join(TRAIN_DIR, "..", "models", "engine_safety.pt")
        shutil.copy2(best_pt, deploy_path)
        print(f"已部署到: {deploy_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
