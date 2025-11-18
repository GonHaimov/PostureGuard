import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import "./Calibration.css";

export default function Calibration() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceLandmarkerRef = useRef(null); // mediapipe face landmarker object
  const animationFrameRef = useRef(null); // reference to the animation frame
  const capturedDataRef = useRef([]); // reference to the captured data

  const [isLoading, setIsLoading] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [message, setMessage] = useState("Initializing camera...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const TARGET_FRAMES = 100;
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const CALIBRATION_BOUNDS = {
    faceAreaRatio: { min: 0.04, max: 0.11 },
    eyeDistanceRatio: { min: 0.09, max: 0.22 },
    faceHeightRatio: { min: 0.28, max: 0.48 },
    headTiltHorizontalMaxDeviation: 12, // degrees from vertical (≈90°)
    headTiltVertical: { min: -0.06, max: 0.06 },
  };

  // Helper function to select the largest detected face
  const selectLargestFace = (faceLandmarks, videoWidth, videoHeight) => {
    if (!faceLandmarks || faceLandmarks.length === 0) return null;
    if (faceLandmarks.length === 1) return faceLandmarks[0];

    // Calculate bounding box area for each face and select the largest
    let largestFace = null;
    let largestArea = 0;

    faceLandmarks.forEach((landmarks) => {
      const xs = landmarks.map((l) => l.x * videoWidth);
      const ys = landmarks.map((l) => l.y * videoHeight);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      const area = width * height;

      if (area > largestArea) {
        largestArea = area;
        largestFace = landmarks;
      }
    });

    return largestFace;
  };

  // Validate calibration quality using normalized bounds derived from the dataset
  const validateCalibrationQuality = (features, videoWidth, videoHeight) => {
    const { face_area_ratio, eye_distance_px, face_height_px, head_tilt_h, head_tilt_v } =
      features;

    if (!videoWidth || !videoHeight) {
      return {
        valid: false,
        message: "Camera feed is not ready yet. Please wait a moment.",
      };
    }

    const normalizedEyeDistance = eye_distance_px / videoWidth;
    const normalizedFaceHeight = face_height_px / videoHeight;
    const faceAreaBounds = CALIBRATION_BOUNDS.faceAreaRatio;
    const eyeBounds = CALIBRATION_BOUNDS.eyeDistanceRatio;
    const heightBounds = CALIBRATION_BOUNDS.faceHeightRatio;
    const tiltBounds = CALIBRATION_BOUNDS.headTiltVertical;

    if (face_area_ratio < faceAreaBounds.min) {
      return {
        valid: false,
        message:
          "You're sitting too far away. Move closer until your face fills more of the frame.",
      };
    }

    if (face_area_ratio > faceAreaBounds.max) {
      return {
        valid: false,
        message:
          "You're sitting too close. Move back slightly so your face fits inside the guide.",
      };
    }

    if (normalizedEyeDistance < eyeBounds.min || normalizedFaceHeight < heightBounds.min) {
      return {
        valid: false,
        message:
          "Make sure your full face is centered in good lighting and move closer slightly.",
      };
    }

    if (normalizedEyeDistance > eyeBounds.max || normalizedFaceHeight > heightBounds.max) {
      return {
        valid: false,
        message: "Move back a little—the camera needs to see your full face.",
      };
    }

    const horizontalDeviation = Math.abs(90 - head_tilt_h);
    if (horizontalDeviation > CALIBRATION_BOUNDS.headTiltHorizontalMaxDeviation) {
      return {
        valid: false,
        message:
          head_tilt_h < 90
            ? "Your head is tilted to the right. Sit up straight before calibrating."
            : "Your head is tilted to the left. Sit up straight before calibrating.",
      };
    }

    if (head_tilt_v < tiltBounds.min) {
      return {
        valid: false,
        message: "You're leaning back. Bring your chin down slightly and face forward.",
      };
    }

    if (head_tilt_v > tiltBounds.max) {
      return {
        valid: false,
        message: "You're leaning forward. Lift your head slightly and face forward.",
      };
    }

    return { valid: true, message: "Calibration quality looks good!" };
  };

  const isCameraActive = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return false;
    const stream = videoElement.srcObject;
    if (!stream) return false;
    const tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
    return tracks.length > 0 && tracks[0].readyState === "live";
  };

  useEffect(() => {
    let stream = null;

    const initializeMediaPipe = async () => {
      try {
        // Initialize MediaPipe FaceLandmarker
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        faceLandmarkerRef.current = faceLandmarker;

        // Initialize webcam with flexible resolution
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsLoading(false);
            setMessage("Position your face inside the circle");
          };
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError(
          "Failed to initialize camera or MediaPipe. Please check permissions."
        );
        setIsLoading(false);
      }
    };

    initializeMediaPipe();

    return () => {
      // Cleanup all resources
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // FIXED: Now matches Python script calculations exactly (ml/scripts/collect_data.py)
  const computeFaceFeatures = (landmarks) => {
    // Get actual video dimensions dynamically
    const video = videoRef.current;
    if (!video) return null;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    // Convert landmark to pixel coordinates (matching Python to_px function)
    const toPx = (landmark, width, height) => [
      Math.floor(landmark.x * width),
      Math.floor(landmark.y * height),
    ];

    // Landmark indices (matching Python script exactly)
    const IDX_EYE_R = 33; // Right eye
    const IDX_EYE_L = 263; // Left eye
    const IDX_FOREHEAD = 10; // Forehead
    const IDX_CHIN = 152; // Chin

    // 1. Eye distance in pixels (matching Python: math.hypot)
    const [xR, yR] = toPx(landmarks[IDX_EYE_R], w, h);
    const [xL, yL] = toPx(landmarks[IDX_EYE_L], w, h);
    const eye_distance_px = Math.floor(Math.hypot(xL - xR, yL - yR));

    // 2. Face height in pixels (matching Python: abs(yCh - yFh))
    const [xFh, yFh] = toPx(landmarks[IDX_FOREHEAD], w, h);
    const [xCh, yCh] = toPx(landmarks[IDX_CHIN], w, h);
    const face_height_px = Math.floor(Math.abs(yCh - yFh));

    // 3. Head tilt horizontal (matching Python: cv2.fastAtan2 using chin-forehead)
    const dx = xCh - xFh;
    const dy = yCh - yFh;
    // JavaScript equivalent of cv2.fastAtan2(dy, dx)
    const head_tilt_h =
      Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10000) / 10000;

    // 4. Head tilt vertical using Z coordinate (matching Python exactly)
    const head_tilt_v =
      Math.round((landmarks[IDX_CHIN].z - landmarks[IDX_FOREHEAD].z) * 10000) /
      10000;

    // 5. Face area ratio via bounding box (matching Python exactly)
    const xs = landmarks.map((l) => Math.floor(l.x * w));
    const ys = landmarks.map((l) => Math.floor(l.y * h));
    const bb_w = Math.max(...xs) - Math.min(...xs);
    const bb_h = Math.max(...ys) - Math.min(...ys);
    const face_area_ratio =
      Math.round(((bb_w * bb_h) / (w * h)) * 10000) / 10000;

    return {
      eye_distance_px,
      face_height_px,
      face_area_ratio,
      head_tilt_h,
      head_tilt_v,
    };
  };

  const startCalibration = async () => {
    if (!faceLandmarkerRef.current || !videoRef.current) {
      setError("Camera not ready");
      return;
    }

    if (!isCameraActive() || videoRef.current.readyState < 2) {
      setError("Camera is off. Please turn it on and allow access to continue.");
      setMessage("Turn on your camera, then press Start Calibration again.");
      return;
    }

    setIsCalibrating(true);
    setMessage("Calibrating... Keep your face steady inside the circle");
    setProgress(0);
    setError("");
    capturedDataRef.current = [];

    const captureFrame = async () => {
      if (capturedDataRef.current.length >= TARGET_FRAMES) {
        // Calibration complete - compute averages
        await finishCalibration();
        return;
      }

      try {
        const video = videoRef.current;
        const results = faceLandmarkerRef.current.detectForVideo(
          video,
          Date.now()
        );

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const video = videoRef.current;
          const videoWidth = video.videoWidth || 640;
          const videoHeight = video.videoHeight || 480;

          const selectedFace = selectLargestFace(
            results.faceLandmarks,
            videoWidth,
            videoHeight
          );

          if (selectedFace) {
            const features = computeFaceFeatures(selectedFace);
            if (features) {
              // Validate calibration quality
              const validation = validateCalibrationQuality(
                features,
                videoWidth,
                videoHeight
              );

              if (validation.valid) {
                capturedDataRef.current.push(features);
                setProgress(
                  Math.floor(
                    (capturedDataRef.current.length / TARGET_FRAMES) * 100
                  )
                );
                setMessage(`Calibrating... ${validation.message}`);
              } else {
                setMessage(validation.message);
              }

              // Draw face landmarks on canvas
              drawLandmarks(selectedFace);
            }
          }
        }
      } catch (err) {
        console.error("Frame capture error:", err);
      }

      // Continue capturing
      animationFrameRef.current = requestAnimationFrame(captureFrame);
    };

    captureFrame();
  };

  const drawLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw landmarks
    ctx.fillStyle = "#00ff00";
    landmarks.forEach((landmark) => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const finishCalibration = async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsCalibrating(false);

    // Check if we have enough valid frames
    if (capturedDataRef.current.length < TARGET_FRAMES * 0.8) {
      setError(
        `Calibration incomplete. Only captured ${capturedDataRef.current.length} valid frames out of ${TARGET_FRAMES} required. Please try again with better lighting and positioning.`
      );
      setMessage("");
      return;
    }

    setMessage("Computing averages...");

    // Compute average values
    const averages = {
      eye_distance_px: 0,
      face_height_px: 0,
      face_area_ratio: 0,
      head_tilt_h: 0,
      head_tilt_v: 0,
    };

    capturedDataRef.current.forEach((data) => {
      averages.eye_distance_px += data.eye_distance_px;
      averages.face_height_px += data.face_height_px;
      averages.face_area_ratio += data.face_area_ratio;
      averages.head_tilt_h += data.head_tilt_h;
      averages.head_tilt_v += data.head_tilt_v;
    });

    const count = capturedDataRef.current.length;
    averages.eye_distance_px /= count;
    averages.face_height_px /= count;
    averages.face_area_ratio /= count;
    averages.head_tilt_h /= count;
    averages.head_tilt_v /= count;

    // Apply same rounding as Python script (matching ml/scripts/collect_data.py)
    averages.eye_distance_px = Math.round(averages.eye_distance_px);
    averages.face_height_px = Math.round(averages.face_height_px);
    averages.face_area_ratio =
      Math.round(averages.face_area_ratio * 10000) / 10000;
    averages.head_tilt_h = Math.round(averages.head_tilt_h * 10000) / 10000;
    averages.head_tilt_v = Math.round(averages.head_tilt_v * 10000) / 10000;

    // Send to backend - this will UPDATE existing user record, not create new one
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/user/calibrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(averages),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Calibration updated successfully! ✓");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setError(data.error || "Failed to save calibration");
        setMessage("");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save calibration. Check your connection.");
      setMessage("");
    }
  };

  const handleBack = () => {
    window.location.href = "/";
  };

  return (
    <div className="calibration-container">
      <div className="calibration-content">
        <h1>Face Calibration</h1>
        <p className="instructions">
          Position your face inside the circle and maintain good posture. We'll
          capture your baseline measurements using the same calculations as our
          ML model.
        </p>

        <div className="video-container">
          <video
            ref={videoRef}
            className="video-feed"
            width="640"
            height="480"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="canvas-overlay"
            width="640"
            height="480"
          />
          <div className="face-guide-circle" />
        </div>

        {message && <div className="message">{message}</div>}
        {error && <div className="error">{error}</div>}

        {isCalibrating && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
            <span className="progress-text">{progress}%</span>
          </div>
        )}

        <div className="button-group">
          <button
            onClick={handleBack}
            className="btn secondary"
            disabled={isCalibrating}
          >
            Back
          </button>
          <button
            onClick={startCalibration}
            className="btn primary"
            disabled={isLoading || isCalibrating}
          >
            {isCalibrating ? "Calibrating..." : "Start Calibration"}
          </button>
        </div>
      </div>
    </div>
  );
}
