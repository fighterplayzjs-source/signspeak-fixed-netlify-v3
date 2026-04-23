import { createFileRoute } from "@tanstack/react-router";
import WelcomeScreen from "@/components/WelcomeScreen";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SignSpeak — Sign language to voice & voice to text" },
      {
        name: "description",
        content:
          "Real-time sign language detection and voice-to-text in one beautiful, accessible app.",
      },
    ],
  }),
});

function Index() {
  return <WelcomeScreen />;
}
