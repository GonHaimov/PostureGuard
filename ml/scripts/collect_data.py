# collect_data.py 
import os
import cv2
import csv
import uuid
import time
import math
import argparse
from statistics import mean, pstdev

import mediapipe as mp

# -------------------- CLI --------------------
parser = argparse.ArgumentParser()
parser.add_argument("--label", required=True, help="one of: correct, too_close, too_far, head_left, head_right, head_up, head_down")
parser.add_argument("--outdir", default="ml/data", help="output directory for CSVs")
parser.add_argument("--frames", type=int, default=100, help="frames per run")
parser.add_argument("--cam", type=int, default=0, help="camera index")
parser.add_argument("--no-preview", action="store_true", dest="no_preview", help="disable preview window")
args = parser.parse_args()

os.makedirs(args.outdir, exist_ok=True)
data_file = os.path.join(args.outdir, f"{args.label}.csv")
summary_file = os.path.join(args.outdir, "summary_stats.csv")

# -------------------- CSV setup --------------------
data_fields = [
    "run_id", "frame_idx", "ts",
    "eye_distance_px", "face_height_px", "face_area_ratio",
    "head_tilt_h", "head_tilt_v",
    "label"
]
summary_fields = [
    "run_id", "label", "count",
    "eye_dist_mean", "eye_dist_std",
    "face_height_mean", "face_height_std",
    "face_area_mean", "face_area_std",
    "head_tilt_h_mean", "head_tilt_h_std",
    "head_tilt_v_mean", "head_tilt_v_std"
]

data_exists = os.path.isfile(data_file)
summary_exists = os.path.isfile(summary_file)

data_fh = open(data_file, "a", newline="", encoding="utf-8")
summary_fh = open(summary_file, "a", newline="", encoding="utf-8")

data_writer = csv.DictWriter(data_fh, fieldnames=data_fields)
summary_writer = csv.DictWriter(summary_fh, fieldnames=summary_fields)

if not data_exists:
    data_writer.writeheader()
if not summary_exists:
    summary_writer.writeheader()

# -------------------- helpers --------------------
mp_face_mesh = mp.solutions.face_mesh

# MediaPipe indices commonly used:
# 33 (right eye outer), 263 (left eye outer), 10 (forehead), 152 (chin)
IDX_EYE_R, IDX_EYE_L, IDX_FOREHEAD, IDX_CHIN = 33, 263, 10, 152

def to_px(landmark, w, h):
    return int(landmark.x * w), int(landmark.y * h)

def calc_features(landmarks, w, h):
    # eyes distance in pixels
    xR, yR = to_px(landmarks[IDX_EYE_R], w, h)
    xL, yL = to_px(landmarks[IDX_EYE_L], w, h)
    eye_distance_px = int(math.hypot(xL - xR, yL - yR))

    # face height in pixels (forehead->chin)
    xFh, yFh = to_px(landmarks[IDX_FOREHEAD], w, h)
    xCh, yCh = to_px(landmarks[IDX_CHIN], w, h)
    face_height_px = int(abs(yCh - yFh))

    # head tilt horizontal (degrees). IMPORTANT: fastAtan2(y, x)
    dx = xCh - xFh
    dy = yCh - yFh
    head_tilt_h = float(cv2.fastAtan2(dy, dx))  # degrees

    # head tilt vertical using Z (chin - forehead). Z is unitless
    head_tilt_v = float(landmarks[IDX_CHIN].z - landmarks[IDX_FOREHEAD].z)

    # face area ratio via bounding box
    xs = [int(l.x * w) for l in landmarks]
    ys = [int(l.y * h) for l in landmarks]
    bb_w = max(xs) - min(xs)
    bb_h = max(ys) - min(ys)
    face_area_ratio = (bb_w * bb_h) / float(w * h)

    # rounding policy
    face_area_ratio = round(face_area_ratio, 4)
    head_tilt_h = round(head_tilt_h, 4)
    head_tilt_v = round(head_tilt_v, 4)

    return eye_distance_px, face_height_px, face_area_ratio, head_tilt_h, head_tilt_v

# -------------------- main loop --------------------
run_id = uuid.uuid4().hex[:8]
cap = cv2.VideoCapture(args.cam)

values_eye = []
values_height = []
values_area = []
values_h_tilt = []
values_v_tilt = []

frames_target = args.frames
frames_collected = 0

try:
    with mp_face_mesh.FaceMesh(
        max_num_faces=3,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:

        while frames_collected < frames_target:
            ok, frame = cap.read()
            if not ok:
                continue

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = face_mesh.process(rgb)

            if result.multi_face_landmarks:
                # choose largest face by bounding box area
                candidates = []
                for fl in result.multi_face_landmarks:
                    xs = [int(l.x * w) for l in fl.landmark]
                    ys = [int(l.y * h) for l in fl.landmark]
                    area = (max(xs) - min(xs)) * (max(ys) - min(ys))
                    candidates.append((area, fl.landmark))
                _, lm = max(candidates, key=lambda t: t[0])

                epx, fhpx, far, hth, htv = calc_features(lm, w, h)

                now_ms = int(time.time() * 1000)
                row = {
                    "run_id": run_id,
                    "frame_idx": frames_collected,
                    "ts": now_ms,
                    "eye_distance_px": epx,
                    "face_height_px": fhpx,
                    "face_area_ratio": far,
                    "head_tilt_h": hth,
                    "head_tilt_v": htv,
                    "label": args.label
                }
                data_writer.writerow(row)

                values_eye.append(epx)
                values_height.append(fhpx)
                values_area.append(far)
                values_h_tilt.append(hth)
                values_v_tilt.append(htv)

                frames_collected += 1

            if not args.no_preview:
                cv2.putText(frame, f"{frames_collected}/{frames_target}", (10, 32),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.imshow("Collecting Data", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

finally:
    # write summary if collected any frames
    if frames_collected > 0:
        def m(v, intify=False):
            return int(mean(v)) if intify else round(mean(v), 4)

        def s(v):
            return round(pstdev(v), 4) if len(v) > 1 else 0.0

        summary_row = {
            "run_id": run_id,
            "label": args.label,
            "count": frames_collected,
            "eye_dist_mean": m(values_eye, intify=True),
            "eye_dist_std": s(values_eye),
            "face_height_mean": m(values_height, intify=True),
            "face_height_std": s(values_height),
            "face_area_mean": m(values_area),
            "face_area_std": s(values_area),
            "head_tilt_h_mean": m(values_h_tilt),
            "head_tilt_h_std": s(values_h_tilt),
            "head_tilt_v_mean": m(values_v_tilt),
            "head_tilt_v_std": s(values_v_tilt),
        }
        summary_writer.writerow(summary_row)

    cap.release()
    try:
        cv2.destroyAllWindows()
    except Exception:
        pass
    data_fh.close()
    summary_fh.close()
