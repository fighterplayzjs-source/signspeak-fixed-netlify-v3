import { createFileRoute } from "@tanstack/react-router";
import VoiceToText from "@/components/VoiceToText";

export const Route = createFileRoute("/voice")({
  component: VoicePage,
  head: () => ({
    meta: [
      { title: "Voice to Text — SignSpeak" },
      { name: "description", content: "Convert your voice into text in real time, with multi-language support." },
    ],
  }),
});

function VoicePage() {
  return <VoiceToText />;
}
