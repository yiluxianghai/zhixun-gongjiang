"""
轻量级进度监控 - 每分钟更新progress.txt，避免读取大日志
"""
import os
import time
import csv

LOG = '/Users/macbookpro/Desktop/智询工匠/backend/train/mps_train.log'
PROGRESS = '/Users/macbookpro/Desktop/智询工匠/backend/train/progress.txt'
RESULTS_CSV = '/Users/macbookpro/Desktop/智询工匠/backend/train/runs/detect/merged_safety_mps/results.csv'

def get_progress():
    """从日志最后一行提取进度"""
    try:
        # 只读最后2KB，不读全文
        with open(LOG, 'rb') as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 2048))
            tail = f.read().decode('utf-8', errors='ignore')
        
        lines = tail.strip().split('\n')
        last = lines[-1] if lines else ''
        
        # 提取关键信息
        info = {'raw': last[:200]}
        
        # 匹配 epoch/batch进度
        import re
        m = re.search(r'(\d+)/50.*?(\d+)/282.*?\[(\d+:\d+:\d+)<(\d+:\d+:\d+)>,\s*([\d.]+)s/it', last)
        if m:
            info['epoch'] = m.group(1)
            info['batch'] = m.group(2)
            info['elapsed'] = m.group(3)
            info['remaining'] = m.group(4)
            info['speed'] = m.group(5) + 's/it'
        
        # 匹配验证进度
        mv = re.search(r'(\d+)/50.*?\[(\d+:\d+)<(\d+:\d+)', last)
        if mv and '282' not in last:
            info['val_batch'] = mv.group(1)
            info['val_elapsed'] = mv.group(2)
            info['val_remaining'] = mv.group(3)
        
        # 提取loss值
        lm = re.search(r'(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)', last)
        if lm and 'Box' not in last:
            info['box_loss'] = lm.group(1)
            info['cls_loss'] = lm.group(2)
            info['dfl_loss'] = lm.group(3)
        
        return info
    except Exception as e:
        return {'error': str(e)}

def get_results():
    """读取results.csv最后几行"""
    try:
        if not os.path.exists(RESULTS_CSV):
            return None
        with open(RESULTS_CSV, 'r') as f:
            lines = f.readlines()
        if len(lines) <= 1:
            return None
        header = lines[0].strip().split(',')
        last = lines[-1].strip().split(',')
        result = dict(zip(header, last))
        return result
    except:
        return None

while True:
    info = get_progress()
    results = get_results()
    
    with open(PROGRESS, 'w') as f:
        f.write(f"更新时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"进程状态: {'运行中' if info else '未知'}\n")
        if 'epoch' in info:
            f.write(f"当前轮次: Epoch {info['epoch']}/50\n")
            f.write(f"批次进度: {info['batch']}/282\n")
            f.write(f"已用时间: {info['elapsed']}\n")
            f.write(f"预计剩余: {info['remaining']}\n")
            f.write(f"当前速度: {info['speed']}\n")
        if 'box_loss' in info:
            f.write(f"box_loss: {info['box_loss']}\n")
            f.write(f"cls_loss: {info['cls_loss']}\n")
            f.write(f"dfl_loss: {info['dfl_loss']}\n")
        if 'val_batch' in info:
            f.write(f"验证进度: {info['val_batch']}/50\n")
            f.write(f"验证已用: {info['val_elapsed']}\n")
            f.write(f"验证剩余: {info['val_remaining']}\n")
        
        if results:
            f.write(f"\n--- 最新验证结果 ---\n")
            for k, v in results.items():
                f.write(f"{k}: {v}\n")
        else:
            f.write(f"\nresults.csv: 尚未生成\n")
        
        # 计算已完成轮次
        if results:
            completed = len(lines) - 1 if os.path.exists(RESULTS_CSV) else 0
            f.write(f"\n已完成轮次: {completed}/50\n")
            remaining_epochs = 50 - completed
            f.write(f"剩余轮次: {remaining_epochs}\n")
            f.write(f"预计剩余总时间: ~{remaining_epochs * 1.5:.0f}小时\n")
    
    time.sleep(60)  # 每分钟更新一次
