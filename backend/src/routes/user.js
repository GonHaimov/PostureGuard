import express from "express";
import User from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Calibrate endpoint - saves user's baseline posture data
router.post("/calibrate", authenticateToken, async (req, res) => {
  try {
    const {
      eye_distance_px,
      face_height_px,
      face_area_ratio,
      head_tilt_h,
      head_tilt_v,
    } = req.body;

    // Validate required fields
    if (
      eye_distance_px === undefined ||
      face_height_px === undefined ||
      face_area_ratio === undefined ||
      head_tilt_h === undefined ||
      head_tilt_v === undefined
    ) {
      return res
        .status(400)
        .json({ error: "All baseline values are required" });
    }

    // Validate that values are numbers
    if (
      typeof eye_distance_px !== "number" ||
      typeof face_height_px !== "number" ||
      typeof face_area_ratio !== "number" ||
      typeof head_tilt_h !== "number" ||
      typeof head_tilt_v !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "All baseline values must be numbers" });
    }

    // Update user's calibration baseline
    const user = await User.findByIdAndUpdate(
      req.user.uid,
      {
        calibration_baseline: {
          eye_distance_px,
          face_height_px,
          face_area_ratio,
          head_tilt_h,
          head_tilt_v,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      message: "Calibration saved successfully",
      baseline: user.calibration_baseline,
    });
  } catch (e) {
    console.error("Calibration error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get user's calibration baseline
router.get("/calibrate", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.uid).select(
      "calibration_baseline"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      baseline: user.calibration_baseline,
    });
  } catch (e) {
    console.error("Get calibration error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// Start a new posture monitoring session
router.post("/monitoring/start", authenticateToken, async (req, res) => {
  try {
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const user = await User.findByIdAndUpdate(
      req.user.uid,
      {
        $push: {
          posture_sessions: {
            session_id: sessionId,
            start_time: new Date(),
            total_frames: 0,
            posture_breakdown: {
              correct: 0,
              too_close: 0,
              too_far: 0,
              head_left: 0,
              head_right: 0,
              head_up: 0,
              head_down: 0,
            },
          },
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      session_id: sessionId,
      message: "Monitoring session started",
    });
  } catch (e) {
    console.error("Start monitoring error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// Update posture data during monitoring
router.post("/monitoring/update", authenticateToken, async (req, res) => {
  try {
    const { session_id, posture, frame_count } = req.body;

    if (!session_id || !posture) {
      return res
        .status(400)
        .json({ error: "Session ID and posture are required" });
    }

    const validPostures = [
      "correct",
      "too_close",
      "too_far",
      "head_left",
      "head_right",
      "head_up",
      "head_down",
    ];
    if (!validPostures.includes(posture)) {
      return res.status(400).json({ error: "Invalid posture category" });
    }

    const user = await User.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the current session
    const sessionIndex = user.posture_sessions.findIndex(
      (session) => session.session_id === session_id && !session.end_time
    );

    if (sessionIndex === -1) {
      return res
        .status(404)
        .json({ error: "Active monitoring session not found" });
    }

    // Update the session data
    user.posture_sessions[sessionIndex].total_frames =
      frame_count || user.posture_sessions[sessionIndex].total_frames + 1;
    user.posture_sessions[sessionIndex].posture_breakdown[posture] += 1;

    await user.save();

    return res.json({
      success: true,
      message: "Posture data updated",
    });
  } catch (e) {
    console.error("Update monitoring error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// End a posture monitoring session
router.post("/monitoring/end", authenticateToken, async (req, res) => {
  try {
    const { session_id, final_stats } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const user = await User.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find and end the session
    const sessionIndex = user.posture_sessions.findIndex(
      (session) => session.session_id === session_id && !session.end_time
    );

    if (sessionIndex === -1) {
      return res
        .status(404)
        .json({ error: "Active monitoring session not found" });
    }

    // Update session with end time and final stats
    user.posture_sessions[sessionIndex].end_time = new Date();
    if (final_stats) {
      user.posture_sessions[sessionIndex].total_frames =
        final_stats.totalFrames ||
        user.posture_sessions[sessionIndex].total_frames;
      user.posture_sessions[sessionIndex].posture_breakdown =
        final_stats.postureBreakdown ||
        user.posture_sessions[sessionIndex].posture_breakdown;
    }

    await user.save();

    return res.json({
      success: true,
      message: "Monitoring session ended",
      session_summary: user.posture_sessions[sessionIndex],
    });
  } catch (e) {
    console.error("End monitoring error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get user's posture monitoring history
router.get("/monitoring/history", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.uid).select("posture_sessions");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sort sessions by start time (newest first)
    const sortedSessions = user.posture_sessions.sort(
      (a, b) => new Date(b.start_time) - new Date(a.start_time)
    );

    return res.json({
      sessions: sortedSessions,
    });
  } catch (e) {
    console.error("Get monitoring history error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
