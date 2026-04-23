export type VoiceGender = "male" | "female";
export type Language = "en" | "bn";

let cachedVoices: SpeechSynthesisVoice[] = [];

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

function findVoice(lang: Language, gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : getAvailableVoices();
  const langCode = lang === "en" ? "en" : "bn";
  const genderKeywords =
    gender === "female"
      ? ["female", "woman", "zira", "samantha", "karen", "fiona"]
      : ["male", "man", "david", "daniel", "james", "mark"];

  let match = voices.find(
    (v) => v.lang.startsWith(langCode) && genderKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  if (!match) match = voices.find((v) => v.lang.startsWith(langCode));
  if (!match && lang === "bn") match = voices.find((v) => v.lang.startsWith("hi"));
  if (!match && lang === "en") match = voices.find((v) => v.lang.startsWith("en"));
  return match || null;
}

export function speak(text: string, lang: Language = "en", gender: VoiceGender = "female", rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "en" ? "en-US" : "bn-BD";
    u.rate = rate;
    u.pitch = gender === "female" ? 1.1 : 0.9;
    const v = findVoice(lang, gender);
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = (e) => reject(e);
    window.speechSynthesis.speak(u);
  });
}

export function speakLetter(letter: string, lang: Language = "en", gender: VoiceGender = "female"): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(letter);
  u.lang = lang === "en" ? "en-US" : "bn-BD";
  u.rate = 1.2;
  u.pitch = gender === "female" ? 1.1 : 0.9;
  u.volume = 0.8;
  const v = findVoice(lang, gender);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve([]);
    const voices = getAvailableVoices();
    if (voices.length > 0) return resolve(voices);
    window.speechSynthesis.onvoiceschanged = () => resolve(getAvailableVoices());
    setTimeout(() => resolve(getAvailableVoices()), 1000);
  });
}
