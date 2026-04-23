import { Hand, Mic, Languages, Camera, AudioLines } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-hand.jpg";

const WelcomeScreen = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="animate-fade-up relative mb-8 h-44 w-44 md:h-60 md:w-60">
        <img
          src={heroImage}
          alt="SignSpeak hero — glowing hand"
          className="float-animation h-full w-full rounded-full object-cover"
          width={256}
          height={256}
        />
        <div className="pulse-ring absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
      </div>

      <h1 className="animate-fade-up-delay-1 mb-3 text-center text-5xl font-bold tracking-tight md:text-6xl">
        <span className="gradient-text">SignSpeak</span>
      </h1>

      <p className="animate-fade-up-delay-2 mb-10 max-w-md text-center text-lg text-muted-foreground">
        Sign language to voice — and voice to text — in real time.
      </p>

      <div className="animate-fade-up-delay-2 mb-10 flex flex-wrap justify-center gap-3">
        {[
          { icon: Hand, label: "Hand Detection" },
          { icon: Languages, label: "Bilingual" },
          { icon: Mic, label: "Voice Output" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="glass-card flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </div>
        ))}
      </div>

      <div className="animate-fade-up-delay-3 flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Link
          to="/detect"
          className="btn-glow gradient-bg flex flex-1 items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-semibold text-primary-foreground"
        >
          <Camera className="h-5 w-5" />
          Sign → Voice
        </Link>
        <Link
          to="/voice"
          className="glass-card-strong glow-border flex flex-1 items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-semibold text-foreground transition-transform hover:-translate-y-0.5"
        >
          <AudioLines className="h-5 w-5 text-primary" />
          Voice → Text
        </Link>
      </div>
    </div>
  );
};

export default WelcomeScreen;
