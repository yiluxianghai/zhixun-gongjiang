"""
数据集下载脚本
自动下载工程安全相关的公开数据集

使用方法：
    python download_datasets.py --dataset ppe
    python download_datasets.py --dataset helmet
    python download_datasets.py --dataset all
"""

import os
import sys
import zipfile
import urllib.request
import argparse
from pathlib import Path

DATASETS = {
    "ppe": {
        "name": "PPE Detection (Roboflow)",
        "description": "个人防护装备检测：安全帽、反光衣、手套等",
        "url": "https://universe.roboflow.com/ds/aB72YHA2h6?key=YOUR_KEY",
        "note": "需要Roboflow API Key，请访问 https://universe.roboflow.com 搜索 PPE detection",
    },
    "helmet": {
        "name": "Safety Helmet Detection",
        "description": "安全帽检测数据集（AndrewMTR版）",
        "url": "https://github.com/njvisionpower/Safety-Helmet-Wearing-Dataset",
        "method": "git_clone",
        "note": "从GitHub克隆，包含760+张标注图片",
    },
    "construction_safety": {
        "name": "Construction Safety (Roboflow)",
        "description": "施工现场安全检测综合数据集",
        "url": "https://universe.roboflow.com/ds/YOUR_KEY",
        "note": "需要Roboflow API Key",
    },
}


def download_helmet_dataset(target_dir):
    """
    下载安全帽检测数据集
    来源: https://github.com/njvisionpower/Safety-Helmet-Wearing-Dataset
    包含760+张标注图片，已标注helmet和no_helmet
    """
    import subprocess

    repo_url = "https://github.com/njvisionpower/Safety-Helmet-Wearing-Dataset.git"
    repo_dir = os.path.join(target_dir, "Safety-Helmet-Wearing-Dataset")

    print(f"[信息] 下载安全帽检测数据集...")
    print(f"  来源: {repo_url}")

    if os.path.exists(repo_dir):
        print(f"  目录已存在，跳过下载: {repo_dir}")
    else:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, repo_dir],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"[错误] git clone失败: {result.stderr}")
            return False
        print(f"  下载完成: {repo_dir}")

    # 检查数据集结构
    for subdir in ["images", "annotations", "DATA"]:
        path = os.path.join(repo_dir, subdir)
        if os.path.exists(path):
            files = os.listdir(path)
            print(f"  {subdir}/: {len(files)} 文件")

    return True


def download_roboflow_dataset(api_key, workspace, project, version, target_dir):
    """
    通过Roboflow API下载数据集

    需要先安装: pip install roboflow
    获取API Key: https://app.roboflow.com/settings/api

    使用方法：
        download_roboflow_dataset("YOUR_KEY", "workspace", "project", 1, "./dataset")
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("[错误] 未安装roboflow，请运行: pip install roboflow")
        return False

    print(f"[信息] 从Roboflow下载数据集: {workspace}/{project} v{version}")

    rf = Roboflow(api_key=api_key)
    project_obj = rf.workspace(workspace).project(project)
    dataset = project_obj.version(version).download("yolov8", location=target_dir)

    print(f"[完成] 数据集已下载到: {target_dir}")
    return True


def list_popular_roboflow_datasets():
    """列出Roboflow Universe上的热门数据集"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║           Roboflow Universe 热门工程安全数据集                ║
╠══════════════════════════════════════════════════════════════╣
║                                                                ║
║  1. PPE Detection (个人防护装备)                                ║
║     https://universe.roboflow.com/search?q=PPE+detection       ║
║     类别: helmet, vest, gloves, goggles                        ║
║                                                                ║
║  2. Hard Hat Detection (安全帽检测)                             ║
║     https://universe.roboflow.com/search?q=hard+hat            ║
║     类别: helmet, no-helmet                                     ║
║                                                                ║
║  3. Construction Safety (施工安全)                              ║
║     https://universe.roboflow.com/search?q=construction+safety ║
║     类别: 多类别综合                                             ║
║                                                                ║
║  4. Safety Vest Detection (反光衣检测)                          ║
║     https://universe.roboflow.com/search?q=safety+vest         ║
║     类别: vest, no-vest                                         ║
║                                                                ║
║  下载方法：                                                     ║
║  1. 访问上述链接，选择数据集                                     ║
║  2. 点击 "Download Dataset"                                     ║
║  3. 选择格式: YOLOv8                                            ║
║  4. 复制下载代码（包含API Key）                                  ║
║  5. 运行: python download_datasets.py --roboflow                ║
║         粘贴代码即可                                             ║
║                                                                ║
╚══════════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="下载工程安全数据集")
    parser.add_argument("--dataset", type=str, default="helmet",
                        choices=["helmet", "ppe", "all"],
                        help="要下载的数据集 (默认: helmet)")
    parser.add_argument("--target", type=str, default="./raw_data",
                        help="下载目标目录")
    parser.add_argument("--roboflow", action="store_true",
                        help="交互式下载Roboflow数据集")
    parser.add_argument("--list", action="store_true",
                        help="列出热门数据集")

    args = parser.parse_args()

    if args.list:
        list_popular_roboflow_datasets()
        return

    os.makedirs(args.target, exist_ok=True)

    if args.dataset == "helmet" or args.dataset == "all":
        download_helmet_dataset(args.target)

    if args.dataset == "ppe" or args.dataset == "all":
        print("\n[提示] PPE数据集需要从Roboflow下载")
        print("  1. 访问 https://universe.roboflow.com/search?q=PPE+detection")
        print("  2. 选择数据集 → Download → YOLOv8格式")
        print("  3. 复制下载代码并运行")
        list_popular_roboflow_datasets()


if __name__ == "__main__":
    main()
