import { useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploadProps {
  onFileReceived: (bvhPath: string, audioPath: string) => void;
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
      const formData = new FormData();
      formData.append("wav", file);

      // 🎯 Upload to FastAPI backend
      const response = await axios.post("https://audio-motion.ngrok.app/generate-motion/", formData);

      const { bvh_url, audio_url } = response.data;

      // 💾 Save audio URL for playback
      localStorage.setItem("audio", audio_url);

      // 🔁 Trigger canvas with new BVH
      onFileReceived(bvh_url, audio_url);
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
