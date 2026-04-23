import { Globe, Mic2, ChevronRight } from "lucide-react";
import type { Language, VoiceGender } from "@/lib/speechSynthesis";

interface SettingsPanelProps {
  language: Language;
  voice: VoiceGender;
  onLanguageChange: (lang: Language) => void;
  onVoiceChange: (voice: VoiceGender) => void;
  onContinue: () => void;
}

const SettingsPanel = ({ language, voice, onLanguageChange, onVoiceChange, onContinue }: SettingsPanelProps) => {
  return (
    <div className="w-full max-w-md">
      <h2 className="animate-fade-up mb-2 text-3xl font-bold">Configure</h2>
      <p className="animate-fade-up-delay-1 mb-8 text-muted-foreground">
        Choose your preferred language and voice
      </p>

      <div className="animate-fade-up-delay-1 mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4 text-primary" /> Language
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "en" as Language, label: "English", flag: "🇺🇸" },
            { value: "bn" as Language, label: "বাংলা", flag: "🇧🇩" },
          ]).map(({ value, label, flag }) => (
            <button
              key={value}
              onClick={() => onLanguageChange(value)}
              className={`glass-card flex items-center gap-3 px-5 py-4 transition-all ${
                language === value ? "glow-border border-primary/50" : "hover:border-border/60"
              }`}
            >
              <span className="text-2xl">{flag}</span>
              <span className={language === value ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-up-delay-2 mb-10">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Mic2 className="h-4 w-4 text-primary" /> Voice
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "male" as VoiceGender, label: "Male", icon: "♂" },
            { value: "female" as VoiceGender, label: "Female", icon: "♀" },
          ]).map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => onVoiceChange(value)}
              className={`glass-card flex items-center gap-3 px-5 py-4 transition-all ${
                voice === value ? "glow-border border-primary/50" : "hover:border-border/60"
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className={voice === value ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="animate-fade-up-delay-3 btn-glow gradient-bg flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold text-primary-foreground"
      >
        Start Detection <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};

export default SettingsPanel;
