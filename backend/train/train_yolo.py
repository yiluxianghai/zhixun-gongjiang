"""
YOLOv8 工程安全违规与质量缺陷检测模型训练脚本

功能：
1. 基于YOLOv8预训练模型进行迁移学习
2. 支持自定义数据集训练
3. 自动导出ONNX模型用于推理部署
4. 生成训练报告

使用方法：
    # 基本训练（使用默认参数）
    python train_yolo.py --dataset ./dataset

    # 指定预训练模型和训练轮次
    python train_yolo.py --dataset ./dataset --model yolov8s.pt --epochs 100

    # 使用GPU训练（自动检测）
    python train_yolo.py --dataset ./dataset --device 0

    # 导出已有模型为ONNX（不训练）
    python train_yolo.py --export ./runs/detect/train/weights/best.pt

训练流程：
    1. 准备数据集（运行 prepare_dataset.py）
    2. 运行训练（本脚本）
    3. 将导出的ONNX模型复制到 backend/models/ 目录
    4. 在系统设置中切换为"本地YOLO模型"

数据集推荐来源：
    - Roboflow Universe: 搜索 "construction safety" / "PPE detection"
    - Safety Helmet Detection (Kaggle)
    - SDNET2018 (桥梁裂缝检测)
    - 自行标注（使用LabelMe或Roboflow标注工具）
"""

import os
import sys
import argparse
import shutil
from pathlib import Path
from datetime import datetime


def check_dependencies():
    """检查必要的依赖"""
    try:
        import ultralytics
        print(f"[✓] ultralytics 版本: {ultralytics.__version__}")
    except ImportError:
        print("[✗] 未安装 ultralytics")
        print("    安装命令: pip install ultralytics")
        print("    或: pip install ultralytics[export]  (支持ONNX导出)")
        return False

    try:
        import torch
        print(f"[✓] torch 版本: {torch.__version__}")
        print(f"    CUDA可用: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"    GPU: {torch.cuda.get_device_name(0)}")
        else:
            print("    [提示] 未检测到GPU，将使用CPU训练（速度较慢）")
    except ImportError:
        print("[✗] 未安装 torch")
        print("    安装命令: pip install torch torchvision")
        return False

    return True


def train_model(dataset_dir, model_name="yolov8s.pt", epochs=100, imgsz=640, batch=16, device="auto"):
    """
    训练YOLOv8模型

    Args:
        dataset_dir: 数据集目录（包含dataset.yaml或使用默认yaml）
        model_name: 预训练模型名称
        epochs: 训练轮次
        imgsz: 输入图片尺寸
        batch: 批次大小
        device: 训练设备（auto/0/1/cpu）
    """
    from ultralytics import YOLO

    # 确定数据集配置文件路径
    dataset_yaml = os.path.join(dataset_dir, "dataset.yaml")
    if not os.path.exists(dataset_yaml):
        # 使用默认配置
        default_yaml = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset.yaml")
        if os.path.exists(default_yaml):
            # 复制到数据集目录
            shutil.copy2(default_yaml, dataset_yaml)
            print(f"[信息] 已复制默认dataset.yaml到 {dataset_yaml}")
        else:
            print(f"[错误] 未找到数据集配置文件: {dataset_yaml}")
            return None

    print(f"\n{'='*60}")
    print(f"开始训练 YOLOv8 工程安全检测模型")
    print(f"{'='*60}")
    print(f"  数据集配置: {dataset_yaml}")
    print(f"  预训练模型: {model_name}")
    print(f"  训练轮次: {epochs}")
    print(f"  图片尺寸: {imgsz}")
    print(f"  批次大小: {batch}")
    print(f"  训练设备: {device}")
    print(f"  开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    # 加载预训练模型
    model = YOLO(model_name)

    # 开始训练
    results = model.train(
        data=dataset_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project="runs/detect",
        name="engine_safety",
        exist_ok=True,
        patience=20,  # 早停：20轮无提升则停止
        save=True,
        save_period=10,  # 每10轮保存一次
        plots=True,  # 生成训练曲线图
        verbose=True,
    )

    # 获取最佳模型路径
    best_model_path = os.path.join("runs/detect/engine_safety/weights/best.pt")
    print(f"\n[完成] 训练结束")
    print(f"  最佳模型: {best_model_path}")
    print(f"  完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return best_model_path


def export_onnx(model_path, output_dir=None):
    """
    导出模型为ONNX格式

    Args:
        model_path: PyTorch模型路径（.pt文件）
        output_dir: 输出目录（默认: backend/models/）
    """
    from ultralytics import YOLO

    if output_dir is None:
        # 默认输出到项目models目录
        output_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..",
            "models"
        )

    ensure_dir(output_dir)

    print(f"\n[信息] 导出ONNX模型: {model_path} -> {output_dir}")

    model = YOLO(model_path)

    # 导出ONNX
    onnx_path = model.export(
        format="onnx",
        imgsz=640,
        dynamic=False,  # 固定输入尺寸，推理更快
        simplify=True,  # 简化模型结构
        opset=12,
    )

    # 复制到models目录
    if isinstance(onnx_path, str) and os.path.exists(onnx_path):
        target_path = os.path.join(output_dir, "engine_safety.onnx")
        shutil.copy2(onnx_path, target_path)
        print(f"[完成] ONNX模型已保存到: {target_path}")
        print(f"  模型大小: {os.path.getsize(target_path) / 1024 / 1024:.1f} MB")
        return target_path
    else:
        print(f"[完成] ONNX模型已导出: {onnx_path}")
        return onnx_path


def evaluate_model(model_path, dataset_yaml):
    """评估模型性能"""
    from ultralytics import YOLO

    model = YOLO(model_path)
    results = model.val(data=dataset_yaml, verbose=True)

    print(f"\n{'='*60}")
    print(f"模型评估结果")
    print(f"{'='*60}")
    print(f"  mAP50:      {results.box.map50:.4f}  (平均精度@IoU=0.5)")
    print(f"  mAP50-95:   {results.box.map:.4f}  (平均精度@IoU=0.5-0.95)")
    print(f"  精确率:      {results.box.mp:.4f}")
    print(f"  召回率:      {results.box.mr:.4f}")
    print(f"{'='*60}\n")

    return results


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(
        description="YOLOv8 工程安全检测模型训练工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:

  1. 准备数据集:
     python prepare_dataset.py --source ./roboflow_export --format roboflow

  2. 开始训练:
     python train_yolo.py --dataset ./dataset --epochs 100

  3. 导出ONNX（仅导出，不训练）:
     python train_yolo.py --export ./runs/detect/engine_safety/weights/best.pt

  4. 评估模型:
     python train_yolo.py --eval ./runs/detect/engine_safety/weights/best.pt --dataset ./dataset

  5. 完整流程（训练+评估+导出）:
     python train_yolo.py --dataset ./dataset --epochs 100 --full
        """
    )

    parser.add_argument("--dataset", type=str, help="数据集目录路径")
    parser.add_argument("--model", type=str, default="yolov8s.pt",
                        help="预训练模型 (yolov8n.pt/yolov8s.pt/yolov8m.pt/yolov8l.pt，默认: yolov8s.pt)")
    parser.add_argument("--epochs", type=int, default=100, help="训练轮次（默认: 100）")
    parser.add_argument("--imgsz", type=int, default=640, help="输入图片尺寸（默认: 640）")
    parser.add_argument("--batch", type=int, default=16, help="批次大小（默认: 16）")
    parser.add_argument("--device", type=str, default="auto", help="训练设备 (auto/0/1/cpu)")
    parser.add_argument("--export", type=str, help="仅导出ONNX（指定.pt模型路径）")
    parser.add_argument("--eval", type=str, help="仅评估模型（指定.pt模型路径）")
    parser.add_argument("--full", action="store_true", help="完整流程：训练+评估+导出")
    parser.add_argument("--check", action="store_true", help="检查依赖环境")

    args = parser.parse_args()

    if args.check:
        check_dependencies()
        return

    # 仅导出
    if args.export:
        if not check_dependencies():
            return
        export_onnx(args.export)
        return

    # 仅评估
    if args.eval:
        if not check_dependencies():
            return
        if not args.dataset:
            print("[错误] 评估需要指定 --dataset 参数")
            return
        dataset_yaml = os.path.join(args.dataset, "dataset.yaml")
        evaluate_model(args.eval, dataset_yaml)
        return

    # 训练
    if not args.dataset:
        parser.print_help()
        return

    if not check_dependencies():
        return

    # 训练模型
    best_model = train_model(
        dataset_dir=args.dataset,
        model_name=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
    )

    if not best_model:
        print("[错误] 训练失败")
        return

    # 完整流程：评估 + 导出
    if args.full:
        dataset_yaml = os.path.join(args.dataset, "dataset.yaml")
        evaluate_model(best_model, dataset_yaml)
        export_onnx(best_model)

    print(f"\n{'='*60}")
    print(f"训练流程完成！")
    print(f"")
    print(f"下一步操作:")
    print(f"  1. 将ONNX模型复制到 backend/models/ 目录")
    print(f"     (如果尚未自动复制)")
    print(f"  2. 在系统设置中选择 '本地YOLO模型' 作为AI模型")
    print(f"  3. 上传工程现场照片测试识别效果")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
