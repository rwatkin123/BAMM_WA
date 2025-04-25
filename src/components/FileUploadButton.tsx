import { useRef, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2 } from "lucide-react";

interface FileUploadProps {
  onFileReceived: (bvhPath: string, audioPath: string) => void;
}

export default function FileUploadButton({ onFileReceived }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("wav", file);
  
      const response = await axios.post("https://audio-motion.ngrok.app/generate-motion/", formData);
      const { bvh_url } = response.data;
      const localAudioURL = URL.createObjectURL(file); // 🎯 create a local reference to uploaded file
      localStorage.setItem("audio", localAudioURL);

      localStorage.setItem("audio_enabled", "true"); // 🟢 Mark it as audio-triggered

  
      onFileReceived(bvh_url, localAudioURL); // use this instead of backend's audio_url
    } catch (err) {
      console.error("❌ Upload failed:", err);
    } finally {
      setLoading(false);
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
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        <span className="sr-only">Attach file</span>
      </Button>

      {/* Optional fullscreen overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-800" />
          <p className="ml-2 text-lg text-gray-800 font-medium">Processing...</p>
        </div>
      )}
    </>
  );
}
