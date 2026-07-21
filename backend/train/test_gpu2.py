"""YOLO 13类安全检测训练脚本 - Windows兼容版"""
import os
import sys

DATA_YAML = "C:/Users/PC/yolo_data.yaml"
TRAIN_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(TRAIN_DIR, "yolov8s.pt")


def main():
    sys.stdout.reconfigure(line_buffering=True)
    print(f"[INFO] Data: {DATA_YAML}")
    print(f"[INFO] Model: {MODEL_PATH}")
    print(f"[INFO] Train images: {len(os.listdir('C:/Users/PC/yolo_data/train/images'))}")

    from ultralytics import YOLO
    m = YOLO(MODEL_PATH)
    print("[INFO] Model loaded, starting training...")

    m.train(
        data=DATA_YAML,
        epochs=1,
        imgsz=640,
        batch=16,
        device=0,
        workers=2,
        amp=True,
        project=os.path.join(TRAIN_DIR, "runs", "detect"),
        name="test_run3",
        exist_ok=True,
        verbose=True,
    )
    print("[DONE] Training complete!")


if __name__ == "__main__":
    main()
