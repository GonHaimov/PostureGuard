import { useEffect, useRef, useState } from "react";

export default function VideoTest() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState("");

  useEffect(() => {
    const testCamera = async () => {
      try {
        setStatus("Requesting camera access...");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
        });

        setStatus("Camera access granted");

        if (!videoRef.current) {
          throw new Error("Video element not found");
        }

        setStatus("Setting video source...");
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const video = videoRef.current;

          const handleLoadedMetadata = () => {
            setStatus("Video metadata loaded");
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("error", handleError);
            resolve();
          };

          const handleError = (e) => {
            setStatus("Video error occurred");
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("error", handleError);
            reject(e);
          };

          video.addEventListener("loadedmetadata", handleLoadedMetadata);
          video.addEventListener("error", handleError);

          // Timeout after 5 seconds
          setTimeout(() => {
            if (video.readyState >= 1) {
              handleLoadedMetadata();
            } else {
              handleError(new Error("Timeout waiting for video metadata"));
            }
          }, 5000);
        });

        setStatus("Starting video playback...");

        try {
          await videoRef.current.play();
          setStatus("Video is playing successfully!");
        } catch (playError) {
          console.error("Play error:", playError);
          setStatus("Video play failed, but stream is connected");
        }
      } catch (err) {
        console.error("Camera test error:", err);
        setError(`Error: ${err.message}`);
        setStatus("Failed");
      }
    };

    testCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Camera Test</h2>
      <p>
        <strong>Status:</strong> {status}
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div
        style={{
          margin: "20px auto",
          width: "640px",
          height: "480px",
          backgroundColor: "#000",
          border: "2px solid #ccc",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          width="640"
          height="480"
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      <div style={{ marginTop: "20px" }}>
        <button onClick={() => (window.location.href = "/")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
