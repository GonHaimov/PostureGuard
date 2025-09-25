import pandas as pd
from pathlib import Path
import argparse

LABEL_FILES = [
    "correct.csv",
    "head_down.csv",
    "head_left.csv",
    "head_right.csv",
    "head_up.csv",
    "too_close.csv",
    "too_far.csv",
]

FEATURES = [
    "eye_distance_px",
    "face_height_px",
    "face_area_ratio",
    "head_tilt_h",
    "head_tilt_v",
    "label",
]

def build_dataset(data_dir: Path) -> pd.DataFrame:
    dfs = []
    missing = []
    for fname in LABEL_FILES:
        p = data_dir / fname
        if not p.exists():
            missing.append(fname)
            continue
        dfs.append(pd.read_csv(p))
    if missing:
        raise FileNotFoundError(f"Missing files: {missing}")
    full = pd.concat(dfs, ignore_index=True)
    ds = full[FEATURES].dropna()
    return ds

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", default="ml/data")
    ap.add_argument("--out", default="ml/data/dataset.csv")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    ds = build_dataset(data_dir)
    ds.to_csv(out_path, index=False)
    print(f"saved: {out_path}  shape={ds.shape}")
