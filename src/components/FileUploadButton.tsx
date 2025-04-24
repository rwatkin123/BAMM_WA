import { useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploadProps {
  onFileReceived: (filename: string) => void;
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
      console.log("⏳ Saving audio locally...");
      const audioFilename = `audio_${Date.now()}.wav`;
      const arrayBuffer = await file.arrayBuffer();
  
      // Save the audio file locally to public folder (Next.js API route)
      await fetch("/api/save-bvh", {
        method: "POST",
        body: arrayBuffer,
        headers: {
          "Content-Type": "audio/wav",
          "X-Filename": audioFilename,
        },
      });
  
      console.log("🎧 Audio saved, now sending to backend...");
  
      const formData = new FormData();
      formData.append("wav", file);
  
      const response = await axios.post("https://audio-motion.ngrok.app/generate-motion/", formData, {
        responseType: "blob",
      });
  
      const bvhBlob = response.data;
      const bvhFilename = `motion_${Date.now()}.bvh`;
  
      await fetch("/api/save-bvh", {
        method: "POST",
        body: await bvhBlob.arrayBuffer(),
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": bvhFilename,
        },
      });
  
      // ✅ Notify parent to trigger canvas + audio
      onFileReceived(`/${bvhFilename}`);
      localStorage.setItem("audio", `/${audioFilename}`); // store for Canvas to pick up
    } catch (err) {
      console.error("❌ Upload error:", err);
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

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="rounded-full"
        onClick={handleAttachClick}
      >
        <Paperclip className="h-4 w-4" />
        <span className="sr-only">Attach file</span>
      </Button>
    </>
  );
}