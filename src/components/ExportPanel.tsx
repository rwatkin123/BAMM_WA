import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface ExportPanelProps {
  onExportGLB?: () => Promise<void>;
  onExportBVH?: () => Promise<void>;
}

export default function ExportPanel({ onExportGLB, onExportBVH }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const formats = ["GLB", "USDZ", "FBX", "BVH"];

  const handleExport = async () => {
    if (!selectedFormat) return;

    const handler = selectedFormat === "GLB" ? onExportGLB
      : selectedFormat === "BVH" ? onExportBVH
      : undefined;

    if (!handler) {
      setStatusMessage(`Export to ${selectedFormat} is not available yet.`);
      setIsError(true);
      return;
    }

    try {
      setIsExporting(true);
      setStatusMessage(null);
      setIsError(false);
      await handler();
      setStatusMessage(`${selectedFormat} export complete – your download should begin shortly.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to export character."
      );
      setIsError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-80 p-6 h-full bg-white border-r border-gray-200 flex flex-col">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Export Avatar</h2>
      <p className="text-sm text-gray-600 mb-4">
        Select a format and export your avatar or motion data:
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {formats.map((format) => (
          <button
            key={format}
            onClick={() => setSelectedFormat(format)}
            className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all
              ${selectedFormat === format
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}
            `}
          >
            {format}
          </button>
        ))}
      </div>

      <button
        disabled={!selectedFormat || isExporting}
        onClick={handleExport}
        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition
          ${selectedFormat && !isExporting
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export {selectedFormat || ""}
      </button>

      {statusMessage && (
        <p className={`mt-3 text-xs ${isError ? "text-red-500" : "text-green-600"}`}>
          {statusMessage}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-400">
        <span className="font-medium">USDZ</span> is best for AR on iPhones.
      </p>
      <div className="mt-auto pt-4 border-t text-xs text-gray-500">
  <p className="font-semibold text-gray-600 mb-1">Help Us Improve</p>
  <p className="text-gray-400 mb-2">How helpful was this export tool?</p>
  <div className="flex gap-2 mb-2">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        className="w-7 h-7 text-sm rounded-full border border-gray-300 hover:bg-blue-50 text-gray-600"
        onClick={() => console.log(`Survey: Rated ${n}`)}
      >
        {n}
      </button>
    ))}
  </div>
  <p className="text-[11px] text-gray-400 italic">
    Part of the AI4Health initiative at UNC Charlotte.
  </p>
</div>

    </div>
  );
}
