import { createFileRoute } from "@tanstack/react-router";
import DetectionScreen from "@/components/DetectionScreen";

export const Route = createFileRoute("/detect")({
  component: DetectPage,
  head: () => ({
    meta: [
      { title: "Detect — SignSpeak" },
      { name: "description", content: "Real-time ASL hand sign detection with voice output." },
    ],
  }),
});

function DetectPage() {
  return <DetectionScreen />;
}
