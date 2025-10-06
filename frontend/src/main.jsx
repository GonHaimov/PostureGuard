import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Calibration from "./pages/Calibration.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import VideoTest from "./pages/VideoTest.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/calibration" element={<Calibration />} />
      <Route path="/monitoring" element={<Monitoring />} />
      <Route path="/video-test" element={<VideoTest />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);
