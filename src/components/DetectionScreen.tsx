import { useState, useRef, useEffect, useCallback } from "react";
import { Settings, Volume2, VolumeX, Trash2, Camera, CameraOff, Hand, LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { speak, stopSpeaking, speakLetter, initVoices } from "@/lib/speechSynthesis";
import type { Language, VoiceGender } from "@/lib/speechSynthesis";
import { classifyGesture, GestureBuffer, DynamicGestureTracker } from "@/lib/gestureClassifier";
import type { HandLandmark } from "@/lib/gestureClassifier";
import { mapLetterToLanguage } from "@/lib/banglaMapping";
import SettingsPanel from "./SettingsPanel";

const DetectionScreen = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureBufferRef = useRef(new GestureBuffer(8));
  const dynamicTrackerRef = useRef(new DynamicGestureTracker());
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handLandmarkerRef = useRef<any>(null);
  const lastDetectedRef = useRef<string>("");
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const currentWordRef = useRef<string>("");

  const [language, setLanguage] = useState<Language>("en");
  const [voice, setVoice] = useState<VoiceGender>("female");
  const languageRef = useRef<Language>(language);
  const voiceRef = useRef<VoiceGender>(voice);

  const [showSettings, setShowSettings] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [detectedText, setDetectedText] = useState("");
  const [currentGesture, setCurrentGesture] = useState("?");
  const [confidence, setConfidence] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => { languageRef.current = language; voiceRef.current = voice; }, [language, voice]);
  useEffect(() => { initVoices(); }, []);

  // Initialize MediaPipe HandLandmarker (dynamic import for SSR safety)
  useEffect(() => {
    if (showSettings) return;
    let cancelled = false;
    const init = async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) return;
        handLandmarkerRef.current = landmarker;
        setIsModelLoading(false);
      } catch (err) {
        console.error("HandLandmarker init failed:", err);
        setIsModelLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
      handLandmarkerRef.current = null;
    };
  }, [showSettings]);

  const processFrame = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const landmarker = handLandmarkerRef.current;

    if (!video || !canvas || !ctx || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const results = landmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      setHandDetected(true);
      const raw = results.landmarks[0];
      const lm: HandLandmark[] = raw.map((l: HandLandmark) => ({ x: l.x, y: l.y, z: l.z }));

      // Draw landmarks
      ctx.fillStyle = "#22d3ee";
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      for (const p of raw) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
      const conns = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17],
      ];
      ctx.globalAlpha = 0.55;
      for (const [a, b] of conns) {
        ctx.beginPath();
        ctx.moveTo(raw[a].x * canvas.width, raw[a].y * canvas.height);
        ctx.lineTo(raw[b].x * canvas.width, raw[b].y * canvas.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const result = classifyGesture(lm);

      // Dynamic J / Z
      const tracker = dynamicTrackerRef.current;
      if (result.letter === "I") {
        tracker.addPoint(lm[20].x, lm[20].y);
        if (tracker.detectJ()) { result.letter = "J"; result.confidence = 0.85; tracker.clear(); }
      } else if (result.letter === "D") {
        tracker.addPoint(lm[8].x, lm[8].y);
        if (tracker.detectZ()) { result.letter = "Z"; result.confidence = 0.85; tracker.clear(); }
      } else {
        tracker.clear();
      }

      const smoothed = gestureBufferRef.current.add(result.letter);
      setCurrentGesture(smoothed);
      setConfidence(result.confidence);

      if (smoothed !== "?" && smoothed !== lastDetectedRef.current && result.confidence >= 0.75) {
        lastDetectedRef.current = smoothed;
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        const displayLetter = mapLetterToLanguage(smoothed, languageRef.current);
        setDetectedText((prev) => prev + displayLetter);
        currentWordRef.current += displayLetter;
        pauseTimerRef.current = setTimeout(() => {
          lastDetectedRef.current = "";
          const word = currentWordRef.current.trim();
          if (word.length > 1) {
            speak(word, languageRef.current, voiceRef.current).catch(() => {});
          } else if (word.length === 1) {
            speakLetter(word, languageRef.current, voiceRef.current);
          }
          currentWordRef.current = "";
          setDetectedText((prev) => prev + " ");
        }, 1800);
      }
    } else {
      setHandDetected(false);
      setCurrentGesture("?");
      setConfidence(0);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  // Camera lifecycle
  useEffect(() => {
    if (!cameraOn || isModelLoading || showSettings) return;
    let stopped = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          runningRef.current = true;
          rafRef.current = requestAnimationFrame(processFrame);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };
    startCamera();
    return () => {
      stopped = true;
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOn, isModelLoading, processFrame, showSettings]);

  const toggleCamera = () => {
    if (cameraOn && streamRef.current) {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(!cameraOn);
  };

  const handleSpeak = async () => {
    if (!detectedText.trim()) return;
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(true);
    try { await speak(detectedText.trim(), language, voice); } catch (e) { console.error(e); }
    setSpeaking(false);
  };

  const handleClear = () => {
    setDetectedText("");
    lastDetectedRef.current = "";
    gestureBufferRef.current.clear();
    stopSpeaking();
    setSpeaking(false);
  };

  const handleEndSession = async () => {
    setSessionEnded(true);
    const thankYouText = language === "en" ? "Thank you!" : "ধন্যবাদ!";
    setDetectedText((prev) => prev + (prev ? " " : "") + thankYouText);
    try { await speak(thankYouText, language, voice); } catch (e) { console.error(e); }
    setTimeout(() => setSessionEnded(false), 3000);
  };

  if (showSettings) {
    return (
      <div className="relative flex min-h-screen flex-col items-center px-6 py-12">
        <Link to="/" className="absolute left-6 top-8 text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Back
        </Link>
        <div className="mt-12">
          <SettingsPanel
            language={language}
            voice={voice}
            onLanguageChange={setLanguage}
            onVoiceChange={setVoice}
            onContinue={() => setShowSettings(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="glass-card-strong sticky top-0 z-20 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3">
        <h1 className="text-xl font-bold">
          <span className="gradient-text">SignSpeak</span>
          <span className="ml-2 text-sm font-normal text-foreground/70">
            {language === "en" ? "EN" : "BN"} · {voice === "male" ? "♂" : "♀"}
          </span>
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {sessionEnded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="animate-scale-up text-center">
            <div className="mb-4 text-6xl">🙏</div>
            <h2 className="gradient-text text-3xl font-bold">{language === "en" ? "Thank You!" : "ধন্যবাদ!"}</h2>
            <p className="mt-2 text-muted-foreground">{language === "en" ? "Session ended" : "সেশন শেষ"}</p>
          </div>
        </div>
      )}

      <div className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <div className="glass-card glow-border relative aspect-[4/3] w-full overflow-hidden">
          {cameraOn ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
              {isModelLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Loading hand detection model...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <CameraOff className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>{language === "en" ? "Camera is off" : "ক্যামেরা বন্ধ"}</p>
              </div>
            </div>
          )}

          {handDetected && currentGesture !== "?" && (
            <div className="animate-scale-up absolute right-3 top-3">
              <div className="glass-card-strong glow-border flex items-center gap-2 px-4 py-2">
                <Hand className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-primary">{mapLetterToLanguage(currentGesture, language)}</span>
                <span className="text-xs text-muted-foreground">{Math.round(confidence * 100)}%</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
              handDetected ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
            }`}>
              <div className={`h-2 w-2 rounded-full ${handDetected ? "pulse-ring bg-primary" : "bg-muted-foreground"}`} />
              {handDetected
                ? language === "en" ? "Hand Detected" : "হাত শনাক্ত"
                : language === "en" ? "No Hand" : "হাত নেই"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={toggleCamera}
            className={`glass-card flex items-center gap-2 px-4 py-2.5 text-sm transition-all ${
              cameraOn ? "text-foreground" : "border-destructive/30 text-destructive"
            }`}
          >
            {cameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
            {cameraOn
              ? language === "en" ? "Camera On" : "ক্যামেরা চালু"
              : language === "en" ? "Camera Off" : "ক্যামেরা বন্ধ"}
          </button>
          <button
            onClick={handleEndSession}
            className="glass-card flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
            {language === "en" ? "Thank You" : "ধন্যবাদ"}
          </button>
        </div>
      </div>

      <div className="glass-card-strong sticky bottom-0 rounded-none border-x-0 border-b-0 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 min-h-[60px] rounded-xl bg-background/50 p-4 font-mono text-lg">
            {detectedText ? (
              <span className="text-foreground">{detectedText}</span>
            ) : (
              <span className="text-muted-foreground/50">
                {language === "en" ? "Detected text will appear here..." : "এখানে শনাক্তকৃত টেক্সট দেখা যাবে..."}
              </span>
            )}
            <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-primary" />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSpeak}
              disabled={!detectedText.trim()}
              className="btn-glow gradient-bg flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 font-medium text-primary-foreground transition-all disabled:opacity-40 disabled:shadow-none"
            >
              {speaking ? (
                <><VolumeX className="h-5 w-5" />{language === "en" ? "Stop" : "থামান"}</>
              ) : (
                <><Volume2 className="h-5 w-5" />{language === "en" ? "Play Voice" : "ভয়েস চালু করুন"}</>
              )}
            </button>
            <button
              onClick={handleClear}
              className="glass-card flex items-center gap-2 px-4 py-3 text-muted-foreground transition-all hover:border-destructive/30 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {language === "en" ? "Clear" : "মুছুন"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionScreen;
