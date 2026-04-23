export const englishToBangla: Record<string, string> = {
  A: "অ", B: "ব", C: "চ", D: "দ", E: "এ", F: "ফ", G: "গ", H: "হ", I: "ই",
  J: "জ", K: "ক", L: "ল", M: "ম", N: "ন", O: "ও", P: "প", Q: "ক্ব", R: "র",
  S: "স", T: "ত", U: "উ", V: "ভ", W: "ওয়", X: "ক্স", Y: "য", Z: "জ্",
};

export function mapLetterToLanguage(letter: string, language: "en" | "bn"): string {
  if (language === "en") return letter;
  return englishToBangla[letter] || letter;
}
