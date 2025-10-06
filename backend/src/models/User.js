import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    calibration_baseline: {
      type: {
        eye_distance_px: Number,
        face_height_px: Number,
        face_area_ratio: Number,
        head_tilt_h: Number,
        head_tilt_v: Number,
      },
      required: false,
      default: null,
    },
    posture_sessions: [
      {
        session_id: String,
        start_time: Date,
        end_time: Date,
        total_frames: Number,
        posture_breakdown: {
          correct: Number,
          too_close: Number,
          too_far: Number,
          head_left: Number,
          head_right: Number,
          head_up: Number,
          head_down: Number,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
