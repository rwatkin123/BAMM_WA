import { useRef, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploadProps {
  onFileReceived: (filename: string) => void;
}

export default function FileUploadButton({ onFileReceived }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true); // Show loading

    try {
      console.log("⏳ Saving audio locally...");
      const audioFilename = `audio_${Date.now()}.wav`;
      const arrayBuffer = await file.arrayBuffer();

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

      onFileReceived(`/${bvhFilename}`);
      localStorage.setItem("audio", `/${audioFilename}`);
    } catch (err) {
      console.error("❌ Upload error:", err);
    } finally {
      setIsLoading(false); // Hide loading
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

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80 backdrop-blur">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 text-lg font-medium">Generating motion... Please wait</p>
          </div>
        </div>
      )}
    </>
  );
}
