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
      // 1. Upload audio file to FastAPI
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("http://localhost:5050/cretate-a-m", formData, {
        responseType: "blob", // Important to receive the .bvh as a file
      });

      const blob = response.data;
      const filename = `motion_${Date.now()}.bvh`;

      // 2. Upload to Next.js API route
      await axios.post("/api/save-bvh", blob, {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": filename,
        },
      });

      // 3. Notify parent with the new filename
      onFileReceived(`${filename}`);
    } catch (err) {
      console.error("File upload error:", err);
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
