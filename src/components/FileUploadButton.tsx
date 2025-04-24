import { useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploadProps {
  onFileReceived: (bvhPath: string) => void;
}

export default function FileUploadButton({ onFileReceived }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const audioFilename = `audio_${Date.now()}.wav`;
      const arrayBuffer = await file.arrayBuffer();

      // ✅ Save audio to public folder
      await fetch("/api/save-audio", {
        method: "POST",
        body: arrayBuffer,
        headers: {
          "Content-Type": "audio/wav",
          "X-Filename": audioFilename,
        },
      });

      // 📌 Save path to localStorage so Canvas can play it
      localStorage.setItem("audio", `/${audioFilename}`);

      // 🎯 Send to FastAPI backend
      const formData = new FormData();
      formData.append("wav", file);

      const response = await axios.post(
        "https://audio-motion.ngrok.app/generate-motion/",
        formData,
        { responseType: "blob" }
      );

      const bvhBlob = response.data;
      const bvhFilename = `motion_${Date.now()}.bvh`;

      // ✅ Save BVH to public folder
      await fetch("/api/save-bvh", {
        method: "POST",
        body: await bvhBlob.arrayBuffer(),
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": bvhFilename,
        },
      });

      // 🎬 Trigger canvas update
      onFileReceived(`/${bvhFilename}`);
    } catch (err) {
      console.error("❌ Upload failed:", err);
    }
  };

  return (
    <>
      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={handleAttachClick}>
        <Paperclip className="h-4 w-4" />
        <span className="sr-only">Attach file</span>
      </Button>
    </>
  );
}
