"""
数据集准备脚本
将原始标注数据转换为YOLO格式

支持的输入格式：
1. Roboflow导出（YOLO格式直接使用）
2. LabelMe JSON标注（自动转换）
3. COCO格式JSON（自动转换）
4. 手动组织文件夹结构

使用方法：
    python prepare_dataset.py --source /path/to/raw_data --format roboflow
    python prepare_dataset.py --source /path/to/labelme_jsons --format labelme
    python prepare_dataset.py --source /path/to/coco.json --format coco --images /path/to/images

数据集目录结构（转换后）：
    dataset/
    ├── images/
    │   ├── train/    # 80%图片
    │   └── val/      # 20%图片
    ├── labels/
    │   ├── train/    # 对应标注txt
    │   └── val/
    └── dataset.yaml  # 自动生成

YOLO标注格式（每行一个目标）：
    class_id x_center y_center width height
    坐标值归一化到0-1（相对于图片宽高）
"""

import os
import sys
import json
import shutil
import random
import argparse
from pathlib import Path


# 类别映射表
CLASS_MAP = {
    "person_no_helmet": 0,
    "no_helmet": 0,
    "helmet_missing": 0,
    "person_no_vest": 1,
    "no_vest": 1,
    "vest_missing": 1,
    "person_no_belt": 2,
    "no_belt": 2,
    "belt_missing": 2,
    "crack": 3,
    "concrete_crack": 3,
    "rebar_exposure": 4,
    "rebar": 4,
    "exposed_rebar": 4,
    "spalling": 5,
    "honeycomb": 5,
    "剥落": 5,
    "water_seepage": 6,
    "seepage": 6,
    "leakage": 6,
    "edge_protection": 7,
    "edge_protection_missing": 7,
    "formwork_issue": 8,
    "formwork": 8,
    "material_disorder": 9,
    "material": 9,
}

# 反向映射：ID -> 中文名
ID_TO_CN = {
    0: "未戴安全帽",
    1: "未穿反光衣",
    2: "未系安全带",
    3: "裂缝",
    4: "钢筋外露",
    5: "剥落/蜂窝麻面",
    6: "渗水",
    7: "临边防护缺失",
    8: "模板支撑问题",
    9: "材料堆放不规范",
}


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def split_dataset(image_files, train_ratio=0.8):
    """随机划分训练集和验证集"""
    random.shuffle(image_files)
    split_idx = int(len(image_files) * train_ratio)
    return image_files[:split_idx], image_files[split_idx:]


def copy_yolo_format(source_dir, target_dir):
    """
    处理Roboflow导出的YOLO格式数据集
    Roboflow导出已包含images/和labels/目录及data.yaml
    """
    source = Path(source_dir)
    target = Path(target_dir)

    # 查找所有图片
    image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_files = []

    # Roboflow通常有train/valid/test子目录
    for subdir in ["train", "valid", "test", "", "."]:
        search_dir = source / subdir if subdir else source
        if search_dir.exists():
            for f in search_dir.rglob("*"):
                if f.suffix.lower() in image_exts:
                    image_files.append(f)

    if not image_files:
        print(f"[错误] 在 {source_dir} 中未找到图片文件")
        return False

    print(f"[信息] 找到 {len(image_files)} 张图片")

    # 划分数据集
    train_files, val_files = split_dataset(image_files, 0.8)
    print(f"[信息] 训练集: {len(train_files)} 张，验证集: {len(val_files)} 张")

    # 复制图片和标注
    for files, split_name in [(train_files, "train"), (val_files, "val")]:
        img_target = target / "images" / split_name
        lbl_target = target / "labels" / split_name
        ensure_dir(img_target)
        ensure_dir(lbl_target)

        for img_path in files:
            # 复制图片
            shutil.copy2(img_path, img_target / img_path.name)

            # 查找对应标注（同名txt文件）
            lbl_path = img_path.with_suffix(".txt")
            # 也检查上级labels目录
            if not lbl_path.exists():
                possible = img_path.parent / "labels" / img_path.stem + ".txt"
                lbl_path = Path(str(possible))

            if lbl_path.exists() and lbl_path.is_file():
                shutil.copy2(lbl_path, lbl_target / lbl_path.name)
            else:
                print(f"[警告] 未找到标注文件: {img_path.name}")

    print(f"[完成] 数据集已准备到 {target_dir}")
    return True


def convert_labelme_to_yolo(source_dir, target_dir):
    """
    将LabelMe JSON标注转换为YOLO格式
    LabelMe格式：每个图片一个JSON文件，包含shapes列表
    """
    source = Path(source_dir)
    target = Path(target_dir)

    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    json_files = list(source.rglob("*.json"))

    if not json_files:
        print(f"[错误] 在 {source_dir} 中未找到JSON标注文件")
        return False

    print(f"[信息] 找到 {len(json_files)} 个LabelMe JSON文件")

    train_jsons, val_jsons = split_dataset(json_files, 0.8)

    for json_files_split, split_name in [(train_jsons, "train"), (val_jsons, "val")]:
        img_target = target / "images" / split_name
        lbl_target = target / "labels" / split_name
        ensure_dir(img_target)
        ensure_dir(lbl_target)

        for json_path in json_files_split:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 获取图片路径
            img_filename = data.get("imagePath", "")
            if not img_filename:
                img_filename = json_path.stem + ".jpg"
            img_path = json_path.parent / img_filename

            if not img_path.exists():
                # 尝试同目录下查找图片
                for ext in image_exts:
                    candidate = json_path.with_suffix(ext)
                    if candidate.exists():
                        img_path = candidate
                        break

            if not img_path.exists():
                print(f"[警告] 未找到图片: {img_filename}")
                continue

            # 复制图片
            shutil.copy2(img_path, img_target / img_path.name)

            # 获取图片尺寸
            img_w = data.get("imageWidth", 0)
            img_h = data.get("imageHeight", 0)
            if not img_w or not img_h:
                print(f"[警告] 图片尺寸未知: {json_path.name}，跳过")
                continue

            # 转换标注
            yolo_lines = []
            for shape in data.get("shapes", []):
                label = shape.get("label", "").lower().strip()
                class_id = CLASS_MAP.get(label)
                if class_id is None:
                    print(f"[警告] 未知类别 '{label}'，跳过")
                    continue

                points = shape.get("points", [])
                if len(points) < 2:
                    continue

                # 计算边界框
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)

                # 转YOLO格式（归一化）
                x_center = (x_min + x_max) / 2.0 / img_w
                y_center = (y_min + y_max) / 2.0 / img_h
                width = (x_max - x_min) / img_w
                height = (y_max - y_min) / img_h

                yolo_lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

            # 写入标注文件
            lbl_file = lbl_target / (img_path.stem + ".txt")
            with open(lbl_file, "w") as f:
                f.write("\n".join(yolo_lines))

    print(f"[完成] LabelMe数据集已转换到 {target_dir}")
    return True


def convert_coco_to_yolo(coco_json_path, images_dir, target_dir):
    """
    将COCO格式标注转换为YOLO格式
    COCO格式：单个JSON包含所有标注，使用category_id
    """
    with open(coco_json_path, "r", encoding="utf-8") as f:
        coco = json.load(f)

    target = Path(target_dir)

    # 构建类别映射
    categories = {cat["id"]: cat["name"] for cat in coco.get("categories", [])}
    print(f"[信息] COCO类别: {categories}")

    # 建立图片ID到标注的映射
    img_info = {img["id"]: img for img in coco.get("images", [])}
    annotations = {}
    for ann in coco.get("annotations", []):
        img_id = ann["image_id"]
        if img_id not in annotations:
            annotations[img_id] = []
        annotations[img_id].append(ann)

    # 划分数据集
    all_img_ids = list(img_info.keys())
    train_ids, val_ids = split_dataset(all_img_ids, 0.8)

    for img_ids, split_name in [(train_ids, "train"), (val_ids, "val")]:
        img_target = target / "images" / split_name
        lbl_target = target / "labels" / split_name
        ensure_dir(img_target)
        ensure_dir(lbl_target)

        for img_id in img_ids:
            info = img_info[img_id]
            img_filename = info["file_name"]
            img_w = info["width"]
            img_h = info["height"]

            img_path = Path(images_dir) / img_filename
            if not img_path.exists():
                print(f"[警告] 未找到图片: {img_filename}")
                continue

            shutil.copy2(img_path, img_target / img_filename)

            # 转换标注
            yolo_lines = []
            for ann in annotations.get(img_id, []):
                cat_name = categories.get(ann["category_id"], "").lower().strip()
                class_id = CLASS_MAP.get(cat_name)
                if class_id is None:
                    # 尝试直接用category_id（如果是0-indexed且匹配我们的类别）
                    if ann["category_id"] < 10:
                        class_id = ann["category_id"]
                    else:
                        print(f"[警告] 未知类别 '{cat_name}' (id={ann['category_id']})，跳过")
                        continue

                # COCO bbox格式: [x_min, y_min, width, height]（像素值）
                x, y, w, h = ann["bbox"]
                x_center = (x + w / 2.0) / img_w
                y_center = (y + h / 2.0) / img_h
                width = w / img_w
                height = h / img_h

                yolo_lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

            lbl_file = lbl_target / (Path(img_filename).stem + ".txt")
            with open(lbl_file, "w") as f:
                f.write("\n".join(yolo_lines))

    print(f"[完成] COCO数据集已转换到 {target_dir}")
    return True


def print_usage():
    print("""
╔══════════════════════════════════════════════════════════╗
║        工程安全YOLO数据集准备工具                         ║
╠══════════════════════════════════════════════════════════╣
║                                                            ║
║  用法:                                                     ║
║                                                            ║
║  1. Roboflow导出的YOLO格式:                                ║
║     python prepare_dataset.py --source ./roboflow_export   ║
║           --format roboflow                                ║
║                                                            ║
║  2. LabelMe JSON标注:                                      ║
║     python prepare_dataset.py --source ./labelme_data      ║
║           --format labelme                                 ║
║                                                            ║
║  3. COCO格式JSON:                                          ║
║     python prepare_dataset.py --source ./coco.json         ║
║           --format coco --images ./images                  ║
║                                                            ║
║  4. 查看类别定义:                                          ║
║     python prepare_dataset.py --list-classes               ║
║                                                            ║
╚══════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="工程安全YOLO数据集准备工具")
    parser.add_argument("--source", type=str, help="源数据路径")
    parser.add_argument("--format", type=str, default="roboflow",
                        choices=["roboflow", "labelme", "coco"],
                        help="源数据格式")
    parser.add_argument("--images", type=str, help="图片目录（COCO格式需要）")
    parser.add_argument("--target", type=str, default="./dataset",
                        help="输出目录（默认: ./dataset）")
    parser.add_argument("--list-classes", action="store_true",
                        help="显示类别定义")
    parser.add_argument("--ratio", type=float, default=0.8,
                        help="训练集比例（默认: 0.8）")

    args = parser.parse_args()

    if args.list_classes:
        print("\n检测类别定义:")
        print("-" * 50)
        for class_id, cn_name in ID_TO_CN.items():
            print(f"  ID {class_id}: {cn_name}")
        print("-" * 50)
        print(f"共 {len(ID_TO_CN)} 个类别\n")
        return

    if not args.source:
        print_usage()
        return

    print(f"\n{'='*50}")
    print(f"数据集准备工具")
    print(f"格式: {args.format}")
    print(f"源路径: {args.source}")
    print(f"目标路径: {args.target}")
    print(f"{'='*50}\n")

    if args.format == "roboflow":
        copy_yolo_format(args.source, args.target)
    elif args.format == "labelme":
        convert_labelme_to_yolo(args.source, args.target)
    elif args.format == "coco":
        if not args.images:
            print("[错误] COCO格式需要指定 --images 图片目录")
            return
        convert_coco_to_yolo(args.source, args.images, args.target)

    # 检查结果
    train_imgs = list(Path(args.target, "images", "train").glob("*"))
    val_imgs = list(Path(args.target, "images", "val").glob("*"))
    train_lbls = list(Path(args.target, "labels", "train").glob("*"))
    val_lbls = list(Path(args.target, "labels", "val").glob("*"))

    print(f"\n{'='*50}")
    print(f"数据集准备完成！")
    print(f"  训练集: {len(train_imgs)} 图片, {len(train_lbls)} 标注")
    print(f"  验证集: {len(val_imgs)} 图片, {len(val_lbls)} 标注")
    print(f"\n下一步: 运行训练脚本")
    print(f"  python train_yolo.py --dataset {args.target}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
