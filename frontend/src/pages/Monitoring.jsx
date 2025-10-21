import { useEffect, useRef, useState, useCallback } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import "./Monitoring.css";

export default function Monitoring() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoElementReady, setVideoElementReady] = useState(false);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const frameBufferRef = useRef([]);
  const lastAlertTimeRef = useRef(0);
  const alertTimeoutRef = useRef(null);
  const sessionIdRef = useRef(null);
  const frameCountRef = useRef(0);

  const [isLoading, setIsLoading] = useState(true);
  const [currentPosture, setCurrentPosture] = useState("correct");
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [sessionStats, setSessionStats] = useState({
    totalFrames: 0,
    correctFrames: 0,
    incorrectFrames: 0,
    postureBreakdown: {
      correct: 0,
      too_close: 0,
      too_far: 0,
      head_left: 0,
      head_right: 0,
      head_up: 0,
      head_down: 0,
    },
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const FRAME_BUFFER_SIZE = 50;

  // Helper function to select the largest detected face
  const selectLargestFace = useCallback(
    (faceLandmarks, videoWidth, videoHeight) => {
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
    },
    []
  );
  const ALERT_COOLDOWN = 5000; // 5 seconds
  const ALERT_DISPLAY_TIME = 2000; // 2 seconds
  const BACKEND_UPDATE_INTERVAL = 100; // Update backend every 100 frames

  // Normalization ranges based on your ML data analysis
  const NORMALIZATION_RANGES = {
    eye_distance_px: { min: 55, max: 122, baseline: 84 },
    face_height_px: { min: 110, max: 235, baseline: 169 },
    face_area_ratio: { min: 0.032, max: 0.143, baseline: 0.072 },
    head_tilt_h: { min: 41, max: 132, baseline: 85 },
    head_tilt_v: { min: -0.135, max: 0.144, baseline: 0.022 },
  };

  useEffect(() => {
    let stream = null;

    const initializeMediaPipe = async () => {
      try {
        setDebugInfo("Initializing MediaPipe...");

        // Initialize MediaPipe FaceLandmarker
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        setDebugInfo("Creating FaceLandmarker...");

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU", // Changed from GPU to CPU for better compatibility
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        faceLandmarkerRef.current = faceLandmarker;
        setDebugInfo("MediaPipe initialized successfully");

        // Wait for DOM to be ready and video element to exist
        setDebugInfo("Waiting for video element...");
        let attempts = 0;
        const maxAttempts = 50; // Increased from 10 to 50

        while (!videoRef.current && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
          setDebugInfo(
            `Waiting for video element... (attempt ${attempts}/${maxAttempts})`
          );
        }

        if (!videoRef.current) {
          setDebugInfo("Video element still not found after all attempts");
          throw new Error(
            `Video element not found after ${maxAttempts} attempts`
          );
        }

        setDebugInfo(`Video element found after ${attempts} attempts`);

        // Initialize webcam with flexible resolution
        setDebugInfo("Requesting camera access...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
            facingMode: "user",
          },
        });

        setDebugInfo("Camera access granted");

        // Verify videoRef still exists after camera access
        if (!videoRef.current) {
          throw new Error("Video element became unavailable");
        }

        setDebugInfo("Setting video source...");

        // Set the video source
        videoRef.current.srcObject = stream;

        // Wait for video to be ready using a Promise
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not available"));
            return;
          }

          const video = videoRef.current;

          // Set up event handlers
          const handleLoadedMetadata = () => {
            setDebugInfo("Video metadata loaded");
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("error", handleError);
            resolve();
          };

          const handleError = (e) => {
            console.error("Video error:", e);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("error", handleError);
            reject(new Error("Video playback failed"));
          };

          const handleCanPlay = () => {
            setDebugInfo("Video can start playing");
            video.removeEventListener("canplay", handleCanPlay);
          };

          const handlePlay = () => {
            setDebugInfo("Video started playing");
            video.removeEventListener("play", handlePlay);
          };

          // Add event listeners
          video.addEventListener("loadedmetadata", handleLoadedMetadata);
          video.addEventListener("error", handleError);
          video.addEventListener("canplay", handleCanPlay);
          video.addEventListener("play", handlePlay);

          // Set timeout for safety
          setTimeout(() => {
            if (video.readyState >= 1) {
              // HAVE_METADATA
              handleLoadedMetadata();
            }
          }, 1000);
        });

        setDebugInfo("Starting video playback...");

        // Start video playback
        try {
          await videoRef.current.play();
          setDebugInfo("Video playback started successfully");
        } catch (playError) {
          console.error("Play error:", playError);
          setDebugInfo("Video play failed, trying autoplay...");
          // Video might need user interaction, but we can still proceed
        }

        // Verify video is actually playing
        if (videoRef.current.readyState >= 2) {
          // HAVE_CURRENT_DATA
          setDebugInfo("Video is ready, starting monitoring...");
          setIsLoading(false);
          setDebugInfo("");
          await startMonitoringSession();
          startMonitoring();
        } else {
          // Wait a bit more for video to be ready
          setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              setDebugInfo("Video ready after delay, starting monitoring...");
              setIsLoading(false);
              setDebugInfo("");
              startMonitoringSession().then(() => {
                startMonitoring();
              });
            } else {
              setError("Video failed to load properly");
              setDebugInfo("");
            }
          }, 2000);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        let errorMessage = "Failed to initialize camera or MediaPipe.";

        if (err.name === "NotAllowedError") {
          errorMessage =
            "Camera access denied. Please allow camera permissions and refresh the page.";
        } else if (err.name === "NotFoundError") {
          errorMessage =
            "No camera found. Please connect a camera and refresh the page.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another application.";
        } else if (err.message.includes("MediaPipe")) {
          errorMessage =
            "MediaPipe initialization failed. Please check your internet connection.";
        } else if (err.message.includes("Video element")) {
          errorMessage = "Video element not found. Please refresh the page.";
        } else if (err.message.includes("Video playback")) {
          errorMessage = "Video playback failed. Please check your camera.";
        }

        setError(errorMessage);
        setDebugInfo("");
        setIsLoading(false);
      }
    };

    // Wait for video element to be ready before initializing
    const checkAndInitialize = () => {
      if (videoElementReady || videoRef.current) {
        initializeMediaPipe();
      } else {
        setTimeout(checkAndInitialize, 100);
      }
    };

    const timer = setTimeout(checkAndInitialize, 100);

    return () => {
      clearTimeout(timer);

      // Cleanup camera stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Cleanup MediaPipe
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }

      // Cleanup alert timeout
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }

      // Cleanup video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // End monitoring session on cleanup
      if (sessionIdRef.current) {
        endMonitoringSession();
      }
    };
  }, [videoElementReady]);

  // Start a new monitoring session
  const startMonitoringSession = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const response = await fetch(`${API_URL}/api/user/monitoring/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        sessionIdRef.current = data.session_id;
        console.log("Monitoring session started:", data.session_id);
      } else {
        console.error("Failed to start monitoring session:", response.status);
      }
    } catch (err) {
      console.error("Failed to start monitoring session:", err);
    }
  };

  // End monitoring session
  const endMonitoringSession = async () => {
    if (!sessionIdRef.current) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/user/monitoring/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          final_stats: sessionStats,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Monitoring session ended:", data.session_summary);
      }
    } catch (err) {
      console.error("Failed to end monitoring session:", err);
    }
  };

  // Update backend with posture data
  const updateBackendPosture = async (posture) => {
    if (
      !sessionIdRef.current ||
      frameCountRef.current % BACKEND_UPDATE_INTERVAL !== 0
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/user/monitoring/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          posture: posture,
          frame_count: sessionStats.totalFrames,
        }),
      });
    } catch (err) {
      console.error("Failed to update backend posture:", err);
    }
  };

  // Normalize features based on user's calibration and global ranges
  const normalizeFeatures = useCallback((features, userBaseline) => {
    if (!userBaseline) return features;

    // Adaptive normalization: blend user baseline with global ranges
    const normalized = { ...features };

    // Eye distance normalization
    const eyeRange = NORMALIZATION_RANGES.eye_distance_px;
    const eyeBaselineRatio = userBaseline.eye_distance_px / eyeRange.baseline;
    normalized.eye_distance_px = features.eye_distance_px / eyeBaselineRatio;

    // Face height normalization
    const heightRange = NORMALIZATION_RANGES.face_height_px;
    const heightBaselineRatio =
      userBaseline.face_height_px / heightRange.baseline;
    normalized.face_height_px = features.face_height_px / heightBaselineRatio;

    // Face area normalization
    const areaRange = NORMALIZATION_RANGES.face_area_ratio;
    const areaBaselineRatio = userBaseline.face_area_ratio / areaRange.baseline;
    normalized.face_area_ratio = features.face_area_ratio / areaBaselineRatio;

    // Head tilt normalization (relative to user's baseline)
    normalized.head_tilt_h = features.head_tilt_h - userBaseline.head_tilt_h;
    normalized.head_tilt_v = features.head_tilt_v - userBaseline.head_tilt_v;

    return normalized;
  }, []);

  // Calculate features using the same method as calibration
  const computeFaceFeatures = useCallback((landmarks) => {
    // Get actual video dimensions dynamically
    const video = videoRef.current;
    if (!video) return null;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    const toPx = (landmark, width, height) => [
      Math.floor(landmark.x * width),
      Math.floor(landmark.y * height),
    ];

    const IDX_EYE_R = 33;
    const IDX_EYE_L = 263;
    const IDX_FOREHEAD = 10;
    const IDX_CHIN = 152;

    const [xR, yR] = toPx(landmarks[IDX_EYE_R], w, h);
    const [xL, yL] = toPx(landmarks[IDX_EYE_L], w, h);
    const eye_distance_px = Math.floor(Math.hypot(xL - xR, yL - yR));

    const [xFh, yFh] = toPx(landmarks[IDX_FOREHEAD], w, h);
    const [xCh, yCh] = toPx(landmarks[IDX_CHIN], w, h);
    const face_height_px = Math.floor(Math.abs(yCh - yFh));

    const dx = xCh - xFh;
    const dy = yCh - yFh;
    const head_tilt_h =
      Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10000) / 10000;

    const head_tilt_v =
      Math.round((landmarks[IDX_CHIN].z - landmarks[IDX_FOREHEAD].z) * 10000) /
      10000;

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
  }, []);

  // Simple posture classification based on normalized features
  const classifyPosture = useCallback((normalizedFeatures) => {
    const {
      eye_distance_px,
      face_height_px,
      face_area_ratio,
      head_tilt_h,
      head_tilt_v,
    } = normalizedFeatures;

    // Distance thresholds (normalized)
    if (face_area_ratio > 0.12) return "too_close";
    if (face_area_ratio < 0.045) return "too_far";

    // Head tilt thresholds (relative to baseline)
    if (head_tilt_h > 20) return "head_left";
    if (head_tilt_h < -20) return "head_right";
    if (head_tilt_v > 0.08) return "head_down";
    if (head_tilt_v < -0.08) return "head_up";

    return "correct";
  }, []);

  // Show alert with cooldown
  const showPostureAlert = useCallback((posture) => {
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN) return;

    lastAlertTimeRef.current = now;

    const alertMessages = {
      too_close: "You're sitting too close to the screen! Move back a bit.",
      too_far: "You're sitting too far from the screen! Move closer.",
      head_left: "Your head is tilted left. Please straighten up.",
      head_right: "Your head is tilted right. Please straighten up.",
      head_up: "Your head is tilted up. Please lower your head slightly.",
      head_down: "Your head is tilted down. Please raise your head slightly.",
    };

    if (alertMessages[posture]) {
      setAlertMessage(alertMessages[posture]);
      setShowAlert(true);

      // Clear any existing timeout
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }

      // Auto-hide alert after 2 seconds
      alertTimeoutRef.current = setTimeout(() => {
        setShowAlert(false);
        setAlertMessage("");
      }, ALERT_DISPLAY_TIME);
    }
  }, []);

  // Update session statistics
  const updateSessionStats = useCallback((posture) => {
    setSessionStats((prev) => {
      const newStats = {
        totalFrames: prev.totalFrames + 1,
        correctFrames:
          posture === "correct" ? prev.correctFrames + 1 : prev.correctFrames,
        incorrectFrames:
          posture !== "correct"
            ? prev.incorrectFrames + 1
            : prev.incorrectFrames,
        postureBreakdown: {
          ...prev.postureBreakdown,
          [posture]: prev.postureBreakdown[posture] + 1,
        },
      };
      return newStats;
    });
  }, []);

  // Main monitoring loop
  const startMonitoring = useCallback(async () => {
    let userBaseline = null;

    // Fetch user's calibration baseline
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/user/calibrate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        userBaseline = data.baseline;
        console.log("User baseline loaded:", userBaseline);
      } else {
        console.warn(
          "No calibration baseline found. Using default normalization."
        );
      }
    } catch (err) {
      console.error("Failed to fetch user baseline:", err);
    }

    const processFrame = async () => {
      if (!faceLandmarkerRef.current || !videoRef.current) return;

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
              const normalizedFeatures = normalizeFeatures(
                features,
                userBaseline
              );
              const posture = classifyPosture(normalizedFeatures);

              // Add to frame buffer
              frameBufferRef.current.push(posture);
              if (frameBufferRef.current.length > FRAME_BUFFER_SIZE) {
                frameBufferRef.current.shift();
              }

              // Update current posture
              setCurrentPosture(posture);
              updateSessionStats(posture);
              frameCountRef.current++;

              // Update backend periodically
              updateBackendPosture(posture);

              // Show alert if posture is incorrect
              if (posture !== "correct") {
                showPostureAlert(posture);
              }

              // Draw landmarks
              drawLandmarks(selectedFace);
            }
          }
        }
      } catch (err) {
        console.error("Frame processing error:", err);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  }, [
    computeFaceFeatures,
    normalizeFeatures,
    classifyPosture,
    showPostureAlert,
    updateSessionStats,
    updateBackendPosture,
  ]);

  const drawLandmarks = useCallback(
    (landmarks) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Color landmarks based on posture
      const colors = {
        correct: "#00ff00",
        too_close: "#ff6b6b",
        too_far: "#ff6b6b",
        head_left: "#ffa726",
        head_right: "#ffa726",
        head_up: "#ffa726",
        head_down: "#ffa726",
      };

      ctx.fillStyle = colors[currentPosture] || "#00ff00";
      landmarks.forEach((landmark) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    },
    [currentPosture]
  );

  const handleBack = () => {
    window.location.href = "/";
  };

  const handleStopMonitoring = async () => {
    // Cleanup all resources before stopping
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (faceLandmarkerRef.current) {
      faceLandmarkerRef.current.close();
      faceLandmarkerRef.current = null;
    }

    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }

    await endMonitoringSession();
    window.location.href = "/";
  };

  const getPostureColor = (posture) => {
    const colors = {
      correct: "#4caf50",
      too_close: "#f44336",
      too_far: "#f44336",
      head_left: "#ff9800",
      head_right: "#ff9800",
      head_up: "#ff9800",
      head_down: "#ff9800",
    };
    return colors[posture] || "#4caf50";
  };

  const getPostureLabel = (posture) => {
    const labels = {
      correct: "Correct Posture",
      too_close: "Too Close",
      too_far: "Too Far",
      head_left: "Head Tilted Left",
      head_right: "Head Tilted Right",
      head_up: "Head Tilted Up",
      head_down: "Head Tilted Down",
    };
    return labels[posture] || "Unknown";
  };

  return (
    <div className="monitoring-container">
      <div className="monitoring-content">
        <div className="header">
          <h1>PostureGuard - Live Monitoring</h1>
          <button onClick={handleBack} className="btn secondary">
            Back to Home
          </button>
        </div>

        {/* Always render video element for ref access */}
        <div
          className="video-container"
          style={{ display: isLoading ? "none" : "block" }}
        >
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) {
                setVideoElementReady(true);
              }
            }}
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
        </div>

        {isLoading ? (
          <div className="loading">
            <p>Initializing camera...</p>
            {debugInfo && <p className="debug-info">{debugInfo}</p>}
          </div>
        ) : error ? (
          <div className="error">
            <p>{error}</p>
            <button onClick={handleBack} className="btn primary">
              Go Back
            </button>
          </div>
        ) : (
          <>
            {/* Live Status Display */}
            <div className="status-display">
              <div className="status-indicator">
                <div
                  className="status-circle"
                  style={{ backgroundColor: getPostureColor(currentPosture) }}
                ></div>
                <span className="status-text">
                  {getPostureLabel(currentPosture)}
                </span>
              </div>
            </div>

            {/* Session Statistics */}
            <div className="stats-container">
              <h3>Session Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Frames:</span>
                  <span className="stat-value">{sessionStats.totalFrames}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Correct Posture:</span>
                  <span className="stat-value">
                    {sessionStats.totalFrames > 0
                      ? Math.round(
                          (sessionStats.correctFrames /
                            sessionStats.totalFrames) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Current Status:</span>
                  <span
                    className="stat-value"
                    style={{ color: getPostureColor(currentPosture) }}
                  >
                    {getPostureLabel(currentPosture)}
                  </span>
                </div>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="button-group">
              <button onClick={handleStopMonitoring} className="btn primary">
                Stop Monitoring
              </button>
            </div>
          </>
        )}

        {/* Alert Display */}
        {showAlert && (
          <div className="alert-overlay">
            <div className="alert-box">
              <div className="alert-icon">⚠️</div>
              <p className="alert-message">{alertMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
