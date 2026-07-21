"""
合并三个数据集为统一的YOLO训练数据集
1. Hard Hat Workers (head/helmet)
2. PPE Detection (Hardhat/NO-Hardhat/Vest/NO-Vest/Mask/NO-Mask/Gloves)
3. Concrete Defects (crack/spalling/exposed_rebar/rust/scaling/efflorescence)

统一为13类:
0: no_helmet      (未戴安全帽) - violation
1: helmet          (已戴安全帽) - compliant
2: no_vest         (未穿反光背心) - violation
3: vest            (已穿反光背心) - compliant
4: no_mask         (未戴口罩) - violation
5: mask            (已戴口罩) - compliant
6: gloves          (已戴手套) - compliant
7: crack           (裂缝) - defect
8: spalling        (剥落) - defect
9: exposed_rebar   (钢筋外露) - defect
10: rust           (锈蚀) - defect
11: scaling        (起皮) - defect
12: efflorescence  (泛霜) - defect
"""

import os
import shutil
import glob
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "merged_dataset"

# 统一类别
UNIFIED_CLASSES = [
    "no_helmet",       # 0
    "helmet",          # 1
    "no_vest",         # 2
    "vest",            # 3
    "no_mask",         # 4
    "mask",            # 5
    "gloves",          # 6
    "crack",           # 7
    "spalling",        # 8
    "exposed_rebar",   # 9
    "rust",            # 10
    "scaling",         # 11
    "efflorescence",   # 12
]

# Hard Hat Workers 映射 (0:head, 1:helmet)
HARDHAT_MAP = {0: 0, 1: 1}

# PPE Detection 映射 (原类别名 -> 新ID)
PPE_MAP = {
    "Hardhat": 1,
    "NO-Hardhat": 0,
    "Safety Vest": 3,
    "NO-Safety Vest": 2,
    "Mask": 5,
    "NO-Mask": 4,
    "Gloves": 6,
}
# PPE原类别列表顺序
PPE_ORIGINAL_NAMES = [
    'Excavator', 'Gloves', 'Hardhat', 'Ladder', 'Mask', 'NO-Hardhat',
    'NO-Mask', 'NO-Safety Vest', 'Person', 'SUV', 'Safety Cone',
    'Safety Vest', 'bus', 'dump truck', 'fire hydrant', 'machinery',
    'mini-van', 'sedan', 'semi', 'trailer', 'truck', 'truck and trailer',
    'van', 'vehicle', 'wheel loader'
]
# 构建原ID -> 新ID映射
PPE_ID_MAP = {}
for idx, name in enumerate(PPE_ORIGINAL_NAMES):
    if name in PPE_MAP:
        PPE_ID_MAP[idx] = PPE_MAP[name]

# Concrete Defect 映射 (原类别名 -> 新ID)
CRACK_ORIGINAL_NAMES = [
    'Exposed_reinforcement', 'Ruststrain', 'Scaling', 'Spalling',
    'crack', 'efflorescence'
]
CRACK_MAP = {
    'Exposed_reinforcement': 9,   # exposed_rebar
    'Ruststrain': 10,             # rust
    'Scaling': 11,                # scaling
    'Spalling': 8,                # spalling
    'crack': 7,                   # crack
    'efflorescence': 12,          # efflorescence
}
CRACK_ID_MAP = {}
for idx, name in enumerate(CRACK_ORIGINAL_NAMES):
    if name in CRACK_MAP:
        CRACK_ID_MAP[idx] = CRACK_MAP[name]


def convert_label(src_label_path, dst_label_path, id_map):
    """转换单个标签文件，重新映射类别ID，过滤不需要的类别"""
    with open(src_label_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        old_id = int(parts[0])
        if old_id not in id_map:
            continue  # 跳过不需要的类别
        new_id = id_map[old_id]
        rest = ' '.join(parts[1:])
        new_lines.append(f"{new_id} {rest}\n")

    with open(dst_label_path, 'w') as f:
        f.writelines(new_lines)


def process_dataset(src_dir, dataset_name, id_map, prefix):
    """处理一个数据集，转换并复制到输出目录"""
    stats = {"images": 0, "labels": 0, "skipped": 0}

    for split in ["train", "valid", "test"]:
        src_split = src_dir / split
        if not src_split.exists():
            # 有些数据集用val而不是valid
            if split == "valid":
                src_split = src_dir / "val"
                if not src_split.exists():
                    continue
            else:
                continue

        # 输出split名统一：valid -> valid
        out_split = split if split != "valid" else "valid"

        dst_img_dir = OUTPUT_DIR / out_split / "images"
        dst_lbl_dir = OUTPUT_DIR / out_split / "labels"
        dst_img_dir.mkdir(parents=True, exist_ok=True)
        dst_lbl_dir.mkdir(parents=True, exist_ok=True)

        src_img_dir = src_split / "images"
        src_lbl_dir = src_split / "labels"

        if not src_img_dir.exists():
            print(f"  [{dataset_name}] {split}/images 不存在，跳过")
            continue

        images = glob.glob(str(src_img_dir / "*.jpg")) + \
                 glob.glob(str(src_img_dir / "*.jpeg")) + \
                 glob.glob(str(src_img_dir / "*.png"))

        for img_path in images:
            img_path = Path(img_path)
            img_name = f"{prefix}_{img_path.name}"
            dst_img = dst_img_dir / img_name

            # 复制图片
            shutil.copy2(img_path, dst_img)
            stats["images"] += 1

            # 转换标签
            label_name = img_path.stem + ".txt"
            src_label = src_lbl_dir / label_name
            dst_label = dst_lbl_dir / f"{prefix}_{img_path.stem}.txt"

            if src_label.exists():
                convert_label(src_label, dst_label, id_map)
                stats["labels"] += 1
            else:
                # 无标签则创建空标签
                dst_label.touch()
                stats["skipped"] += 1

    print(f"  [{dataset_name}] 图片={stats['images']}, 标签={stats['labels']}, 无标签={stats['skipped']}")
    return stats


def main():
    # 清理输出目录
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)

    total = {"images": 0, "labels": 0, "skipped": 0}

    # 1. Hard Hat Workers
    print("处理 Hard Hat Workers 数据集...")
    hh_dir = BASE_DIR / "dataset"
    if hh_dir.exists():
        s = process_dataset(hh_dir, "HardHat", HARDHAT_MAP, "hh")
        for k in total:
            total[k] += s[k]

    # 2. PPE Detection
    print("处理 PPE Detection 数据集...")
    ppe_dir = BASE_DIR / "ppe_dataset"
    if ppe_dir.exists():
        s = process_dataset(ppe_dir, "PPE", PPE_ID_MAP, "ppe")
        for k in total:
            total[k] += s[k]

    # 3. Concrete Defects
    print("处理 Concrete Defects 数据集...")
    crack_dir = BASE_DIR / "crack_dataset"
    if crack_dir.exists():
        s = process_dataset(crack_dir, "Crack", CRACK_ID_MAP, "crk")
        for k in total:
            total[k] += s[k]

    print(f"\n总计: 图片={total['images']}, 标签={total['labels']}, 无标签={total['skipped']}")

    # 生成data.yaml
    yaml_content = f"""path: {OUTPUT_DIR}
train: train/images
val: valid/images
test: test/images

nc: {len(UNIFIED_CLASSES)}
names: {UNIFIED_CLASSES}
"""
    yaml_path = OUTPUT_DIR / "data.yaml"
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
    print(f"\ndata.yaml 已生成: {yaml_path}")
    print(f"类别数: {len(UNIFIED_CLASSES)}")
    for i, name in enumerate(UNIFIED_CLASSES):
        print(f"  {i}: {name}")

    # 统计各split图片数
    for split in ["train", "valid", "test"]:
        split_dir = OUTPUT_DIR / split / "images"
        if split_dir.exists():
            count = len(list(split_dir.glob("*")))
            print(f"  {split}: {count} 张图片")


if __name__ == "__main__":
    main()
