# YOLO 13类安全检测模型训练 Handoff 文档

## 1. 项目概述

### 项目名称
智询工匠 - 工程监理巡视问题闭环管理智能体系统

### YOLO模型用途
在监理巡视系统中，通过AI图片识别自动检测施工现场的安全违规和质量缺陷，识别结果自动填充到巡视记录中。

### 13类检测能力

| 类别ID | 英文名 | 中文名 | 类型 |
|--------|--------|--------|------|
| 0 | no_helmet | 未戴安全帽 | violation（违规） |
| 1 | helmet | 已戴安全帽 | compliant（合规） |
| 2 | no_vest | 未穿反光背心 | violation |
| 3 | vest | 已穿反光背心 | compliant |
| 4 | no_mask | 未戴口罩 | violation |
| 5 | mask | 已戴口罩 | compliant |
| 6 | gloves | 已戴手套 | compliant |
| 7 | crack | 裂缝 | defect（缺陷） |
| 8 | spalling | 剥落 | defect |
| 9 | exposed_rebar | 钢筋外露 | defect |
| 10 | rust | 锈蚀 | defect |
| 11 | scaling | 起皮 | defect |
| 12 | efflorescence | 泛霜 | defect |

---

## 2. 当前训练状态

### 训练环境（当前 - M1 Pro）
- 设备: Apple M1 Pro (MacBook Pro)
- GPU: MPS (Metal Performance Shaders)
- PyTorch: 2.1.2
- Python: 3.11.4 (conda)
- ultralytics: 8.2.103

### 训练进度
- **第1轮MPS训练**: Epoch 1/50 验证完成
- 之前CPU训练已完成5轮（mAP50≈32%），模型从该last.pt恢复
- 当前训练目录: `backend/train/runs/detect/merged_safety_mps/`
- 之前CPU训练目录: `backend/train/runs/detect/merged_safety/`
- results.csv路径: `backend/train/runs/detect/merged_safety_mps/results.csv`

### 已知问题
1. **no_helmet漏检**: 13类模型只训练5轮+1轮MPS，mAP50低，未戴安全帽检测能力不足
2. **置信度阈值已降至0.15**: `yolo_detector.py` 和 `yolo_infer.py` 中 conf=0.15
3. **M1 Pro热降频**: 训练速度从14s/batch降至26s/batch，每轮约3.5小时
4. **NMS超时警告**: 验证时NMS time limit exceeded，导致验证极慢（~2小时/轮验证）

### 当前部署的模型
- 路径: `backend/models/engine_safety.pt`
- 来源: 之前CPU训练5轮的best.pt（mAP50≈32%）
- 置信度阈值: 0.15

---

## 3. 数据集信息

### 合并数据集路径
```
backend/train/merged_dataset/
├── data.yaml          # YOLO配置文件（13类）
├── train/images/      # 9001张训练图片
├── train/labels/      # 9001个标签文件
├── valid/images/      # 3165张验证图片
├── valid/labels/      # 3165个标签文件
├── test/images/       # 2392张测试图片
└── test/labels/       # 2392个标签文件
```
总计: 14,558张图片

### data.yaml内容
```yaml
path: /Users/macbookpro/Desktop/智询工匠/backend/train/merged_dataset
train: train/images
val: valid/images
test: test/images
nc: 13
names: ['no_helmet', 'helmet', 'no_vest', 'vest', 'no_mask', 'mask', 'gloves', 'crack', 'spalling', 'exposed_rebar', 'rust', 'scaling', 'efflorescence']
```

### 数据来源
1. **Hard Hat Workers** (Roboflow): 7,035张，类别映射 head→no_helmet(0), helmet→helmet(1)
2. **PPE Detection** (Roboflow Universe): 717张，筛选7个类别（Hardhat→1, NO-Hardhat→0, Safety Vest→3, NO-Safety Vest→2, Mask→5, NO-Mask→4, Gloves→6）
3. **Concrete Defects** (SDNET2018): 6,806张，全6类映射（crack→7, spalling→8, exposed_rebar→9, rust→10, scaling→11, efflorescence→12）

### 合并脚本
`backend/train/merge_datasets.py` — 将3个数据集合并为13类统一格式

---

## 4. 在5060Ti设备上恢复训练

### 环境搭建

```bash
# 1. 克隆仓库
git clone <repo-url>
cd 智询工匠/backend

# 2. 创建conda环境
conda create -n yolo-train python=3.11 -y
conda activate yolo-train

# 3. 安装依赖
pip install ultralytics torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 4. 验证GPU
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0)}')"
# 应输出: CUDA: True, Device: NVIDIA GeForce RTX 5060 Ti
```

### 恢复训练命令

```bash
cd backend/train

# 方式1: 从MPS训练的last.pt恢复（推荐，包含Epoch 1的MPS训练成果）
python -c "
from ultralytics import YOLO

model = YOLO('runs/detect/merged_safety_mps/weights/last.pt')

model.train(
    data='merged_dataset/data.yaml',
    epochs=50,
    imgsz=640,       # 5060Ti显存大，恢复640分辨率
    batch=32,        # 5060Ti 16GB显存可支持
    device=0,        # CUDA GPU
    project='runs/detect',
    name='merged_safety_5060ti',
    exist_ok=True,
    patience=15,
    save=True,
    save_period=5,
    workers=8,       # Windows用4, Linux用8
    amp=True,        # NVIDIA GPU支持AMP混合精度
)
"
```

### 注意事项
- **data.yaml中的path需要更新**: 改为新设备的实际路径
- **不需要monkey-patch**: torch.meshgrid bug是torch 2.1.2特有的，新版torch已修复
- **AMP可以开启**: NVIDIA GPU支持自动混合精度，训练更快
- **5060Ti性能**: 预计每轮20-30分钟（vs M1 Pro的3.5小时），加速10倍+

### 训练完成后部署

```bash
# 复制best.pt到模型目录
cp runs/detect/merged_safety_5060ti/weights/best.pt models/engine_safety.pt

# 后端使用conda Python推理（subprocess方案）
# yolo_detector.py通过subprocess调用conda Python执行推理
# yolo_infer.py是实际推理脚本
```

---

## 5. 关键文件清单

### 训练相关
| 文件 | 用途 |
|------|------|
| `backend/train/merge_datasets.py` | 合并3个数据集为13类 |
| `backend/train/train_mps.py` | MPS加速训练脚本（当前使用） |
| `backend/train/resume_train.py` | CPU恢复训练脚本 |
| `backend/train/train_merged.py` | 初始13类训练脚本 |
| `backend/train/progress_monitor.py` | 轻量级进度监控（生成progress.txt） |
| `backend/train/wait_and_deploy.py` | 等待N轮后自动部署脚本 |
| `backend/train/merged_dataset/data.yaml` | 数据集配置 |

### 推理相关
| 文件 | 用途 |
|------|------|
| `backend/yolo_detector.py` | YOLO推理入口模块，平台调用 |
| `backend/yolo_infer.py` | 实际推理脚本（由conda Python执行） |
| `backend/models/engine_safety.pt` | 部署的模型文件 |

### 后端集成
| 文件 | 用途 |
|------|------|
| `backend/main.py` | FastAPI后端，YOLO激活端点 |
| `backend/ai_engine.py` | AI分析引擎，图片识别调度 |

### 关键配置（yolo_detector.py）
```python
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
PT_MODEL_PATH = os.path.join(MODEL_DIR, "engine_safety.pt")
INFER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yolo_infer.py")
CONDA_PYTHON = "/Users/macbookpro/anaconda3/bin/python3"  # 新设备需修改此路径
CONF_THRESHOLD = "0.15"  # 置信度阈值
```

---

## 6. subprocess推理架构

```
后端 (venv Python 3.13, FastAPI)
  └─ yolo_detector.py
       └─ subprocess.call([
            CONDA_PYTHON,        # conda Python 3.11
            INFER_SCRIPT,        # yolo_infer.py
            tmp_image_path,
            PT_MODEL_PATH,
            "0.15"              # 置信度阈值
          ])
            └─ yolo_infer.py
                 └─ ultralytics.YOLO(model).predict(image, conf=0.15)
                      └─ 返回JSON检测结果
```

**原因**: venv后端无torch/ultralytics，通过subprocess调用conda Python执行推理。

---

## 7. 在新设备上需要修改的配置

1. **CONDA_PYTHON路径** (`yolo_detector.py`):
   - 当前: `/Users/macbookpro/anaconda3/bin/python3`
   - 新设备: 改为实际conda Python路径

2. **data.yaml中的path** (`merged_dataset/data.yaml`):
   - 当前: `/Users/macbookpro/Desktop/智询工匠/backend/train/merged_dataset`
   - 新设备: 改为实际数据集路径

3. **MODEL_DIR路径** (`yolo_detector.py`):
   - 自动检测，无需修改

4. **模型文件** (`models/engine_safety.pt`):
   - 部署训练好的best.pt到此处

---

## 8. 训练优化建议（5060Ti）

### 推荐参数
```python
model.train(
    data='merged_dataset/data.yaml',
    epochs=100,      # 增加到100轮
    imgsz=640,       # 恢复640分辨率
    batch=32,        # 5060Ti 16GB可支持
    device=0,        # CUDA
    patience=20,     # 增加耐心值
    workers=8,       # 更多数据加载线程
    amp=True,        # 混合精度训练
    cos_lr=True,     # 余弦学习率
    close_mosaic=15, # 最后15轮关闭mosaic增强
)
```

### 预期效果
- 每轮训练: ~15-20分钟（vs M1 Pro 86分钟）
- 每轮验证: ~3-5分钟（vs M1 Pro 120分钟）
- 50轮总计: ~15-20小时（vs M1 Pro 175小时）
- mAP50目标: >60%（当前32%）

### 可能的问题
1. **CUDA版本兼容**: 5060Ti需要CUDA 12.4+，确保安装对应版本PyTorch
2. **Windows路径**: 如果用Windows，路径用反斜杠，workers建议设4
3. **数据集传输**: 14,558张图片约2GB，建议打包传输

---

## 9. Git提交信息

本次提交包含:
- 13类合并数据集配置 (merged_dataset/data.yaml)
- MPS训练脚本 (train_mps.py)
- 进度监控脚本 (progress_monitor.py)
- 更新后的推理代码 (yolo_detector.py, yolo_infer.py)
- 当前部署的模型 (models/engine_safety.pt)
- 本handoff文档

---

## 10. 快速恢复流程

```bash
# 1. 克隆代码到新设备
git clone <repo-url>
cd 智询工匠/backend

# 2. 安装环境
conda create -n yolo-train python=3.11 -y
conda activate yolo-train
pip install ultralytics torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 3. 修改data.yaml中的path为新设备路径
vim train/merged_dataset/data.yaml

# 4. 从last.pt恢复训练
cd train
python -c "
from ultralytics import YOLO
model = YOLO('runs/detect/merged_safety_mps/weights/last.pt')
model.train(data='merged_dataset/data.yaml', epochs=100, imgsz=640, batch=32, device=0, patience=20, workers=8, amp=True, project='runs/detect', name='merged_safety_5060ti', exist_ok=True)
"

# 5. 训练完成后部署
cp runs/detect/merged_safety_5060ti/weights/best.pt models/engine_safety.pt

# 6. 修改yolo_detector.py中CONDA_PYTHON路径
# 7. 启动后端测试
```
