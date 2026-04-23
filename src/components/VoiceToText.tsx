import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Mic, MicOff, Trash2, Copy, Check, Languages, AudioLines } from "lucide-react";

type Lang = { code: string; label: string; flag: string };

const LANGUAGES: Lang[] = [
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
  { code: "en-GB", label: "English (UK)", flag: "🇬🇧" },
  { code: "bn-BD", label: "বাংলা", flag: "🇧🇩" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

const VoiceToText = () => {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [lang, setLang] = useState("en-US");
  const [copied, setCopied] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recogRef = useRef<SR | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const wantListeningRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) {
      setSupported(false);
    }
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (const v of data) sum += v;
        setLevel(Math.min(1, sum / data.length / 128));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Mic level meter unavailable:", e);
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported) return;
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog: SR = new SRClass();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = lang;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (event: any) => {
      let interimT = "";
      let finalT = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalT += transcript;
        else interimT += transcript;
      }
      if (finalT) {
        setFinalText((prev) => (prev ? prev + " " : "") + finalT.trim());
        setInterim("");
      } else {
        setInterim(interimT);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onerror = (e: any) => {
      console.error("SpeechRecognition error:", e);
      if (e.error === "not-allowed") setError("Microphone permission denied.");
      else if (e.error === "no-speech") setError("No speech detected. Try again.");
      else setError(`Error: ${e.error}`);
    };
    recog.onend = () => {
      // Auto-restart if user still wants to listen (some browsers stop after silence)
      if (wantListeningRef.current) {
        try { recog.start(); } catch { /* ignore */ }
      } else {
        setListening(false);
        stopMeter();
      }
    };

    recogRef.current = recog;
    wantListeningRef.current = true;
    try {
      recog.start();
      setListening(true);
      await startMeter();
    } catch (e) {
      console.error(e);
      setError("Could not start microphone.");
    }
  }, [lang, supported, startMeter, stopMeter]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch { /* ignore */ }
    }
    setListening(false);
    stopMeter();
  }, [stopMeter]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recogRef.current) { try { recogRef.current.abort(); } catch { /* ignore */ } }
      stopMeter();
    };
  }, [stopMeter]);

  const handleClear = () => {
    setFinalText("");
    setInterim("");
  };

  const handleCopy = async () => {
    const text = (finalText + " " + interim).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="glass-card-strong sticky top-0 z-20 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3">
        <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Home
        </Link>
        <h1 className="text-lg font-bold">
          <span className="gradient-text">Voice → Text</span>
        </h1>
        <div className="w-12" />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        {/* Language selector */}
        <div className="animate-fade-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Languages className="h-4 w-4 text-primary" /> Recognition language
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                disabled={listening}
                className={`glass-card flex items-center gap-2 px-3 py-2 text-sm transition-all disabled:opacity-50 ${
                  lang === l.code ? "glow-border border-primary/50" : "hover:border-border/60"
                }`}
              >
                <span className="text-lg">{l.flag}</span>
                <span className={lang === l.code ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {l.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mic visualizer */}
        <div className="animate-fade-up-delay-1 glass-card glow-border relative flex flex-col items-center justify-center gap-4 px-6 py-10">
          {!supported && (
            <p className="text-center text-sm text-destructive">
              Speech recognition isn't supported in this browser. Try Chrome, Edge, or Safari.
            </p>
          )}

          {/* Pulsing mic */}
          <div className="relative flex h-32 w-32 items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full transition-all ${
                listening ? "bg-primary/30" : "bg-muted/30"
              }`}
              style={{
                transform: `scale(${1 + level * 0.6})`,
                filter: `blur(${listening ? 8 + level * 12 : 0}px)`,
              }}
            />
            <div
              className={`absolute inset-2 rounded-full transition-all ${
                listening ? "bg-primary/40" : "bg-muted/40"
              }`}
              style={{ transform: `scale(${1 + level * 0.35})` }}
            />
            <button
              onClick={listening ? stop : start}
              disabled={!supported}
              className={`btn-glow relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground transition-all disabled:opacity-50 ${
                listening ? "gradient-bg" : "bg-primary"
              }`}
              aria-label={listening ? "Stop listening" : "Start listening"}
            >
              {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {listening ? (
              <span className="inline-flex items-center gap-2">
                <AudioLines className="h-4 w-4 animate-pulse text-primary" />
                Listening… speak now
              </span>
            ) : (
              "Tap the mic to start"
            )}
          </p>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </div>

        {/* Transcript */}
        <div className="animate-fade-up-delay-2 glass-card-strong flex flex-col gap-3 px-5 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Transcript</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!finalText && !interim}
                className="glass-card flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:text-foreground disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleClear}
                disabled={!finalText && !interim}
                className="glass-card flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-destructive/30 hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>
          <div className="min-h-[140px] rounded-xl bg-background/40 p-4 text-base leading-relaxed">
            {finalText && <span className="text-foreground">{finalText}</span>}
            {interim && (
              <span className={finalText ? " ml-1 text-muted-foreground italic" : "text-muted-foreground italic"}>
                {finalText ? " " : ""}
                {interim}
              </span>
            )}
            {!finalText && !interim && (
              <span className="text-muted-foreground/50">
                Your spoken words will appear here in real time…
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceToText;
