import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import WelcomeScreen from "./components/WelcomeScreen";
import DetectionScreen from "./components/DetectionScreen";
import VoiceToText from "./components/VoiceToText";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/detect" element={<DetectionScreen />} />
        <Route path="/voice" element={<VoiceToText />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
