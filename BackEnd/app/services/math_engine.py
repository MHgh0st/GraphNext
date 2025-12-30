import numpy as np

def calculate_stats(data: list[float]):
    arr = np.array(data)
    
    # انجام محاسبات
    mean_val = np.mean(arr)
    std_val = np.std(arr)
    
    return {
        "mean": mean_val,
        "std_dev": std_val
    }