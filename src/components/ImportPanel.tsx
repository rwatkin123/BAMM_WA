// components/ImportPanel.tsx
import { useRef, useState } from "react";
import { UploadCloud, Loader2, Info } from "lucide-react";

interface ImportPanelProps {
  onImportFile?: (file: File, objectUrl: string) => void;
  className?: string;
  variant?: "default" | "compact";
}

export default function ImportPanel({ onImportFile, className = "", variant = "default" }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !["glb", "fbx"].includes(extension)) {
      setStatusMessage("Unsupported file type. Please upload a .glb or .fbx file.");
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage(null);
      const objectUrl = URL.createObjectURL(file);
      if (onImportFile) {
        onImportFile(file, objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
      setStatusMessage(`${file.name} ready for preview.`);
    } catch (error) {
      console.error("Failed to process file", error);
      setStatusMessage("Failed to load file. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const containerClasses =
    variant === "compact"
      ? `flex flex-col rounded-xl border border-slate-200 bg-white/70 p-3 space-y-2 ${className}`
      : `flex flex-col justify-start w-80 p-6 h-full bg-white border-r border-gray-200 ${className}`;

  const tipText = `Ensure GLB files include mesh & textures. FBX should use humanoid rigs.
Avoid spaces or special characters in filenames.`;

  return (
    <div className={containerClasses}>
      <h2 className={`text-gray-800 ${variant === 'compact' ? 'text-sm font-semibold mb-2' : 'text-xl font-semibold mb-4'}`}>Import File</h2>
      <p className={`text-sm text-gray-600 ${variant === 'compact' ? 'mb-2' : 'mb-4'}`}>
        Upload a <strong>.glb</strong> or <strong>.fbx</strong> file to visualize motion or models.
      </p>

      <div
        className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl ${variant === 'compact' ? 'p-3' : 'p-6'} text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="w-8 h-8 text-blue-500 mb-2 animate-spin" />
        ) : (
          <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
        )}
        <span className="text-sm text-gray-700">
          {isUploading ? "Processing..." : "Click to upload"}
        </span>
        <span className="text-xs text-gray-400 mt-1">Max size: 50MB</span>
      </div>

      <input
        type="file"
        accept=".glb,.fbx"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Supports GLB & FBX</span>
        <span className="flex items-center gap-1 text-gray-400">
          <Info className="h-4 w-4" title={tipText} />
        </span>
      </div>
      {statusMessage && (
        <p className="mt-2 text-xs text-blue-600">{statusMessage}</p>
      )}
    </div>
  );
}
