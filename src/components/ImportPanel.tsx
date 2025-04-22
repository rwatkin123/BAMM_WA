// components/ImportPanel.tsx
import { useRef } from "react";
import { UploadCloud } from "lucide-react";

export default function ImportPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("Uploading:", file.name);
      // TODO: Handle file upload
    }
  };

  return (
    <div className="w-80 p-6 h-full bg-white border-r border-gray-200 flex flex-col justify-start">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Import File</h2>
      <p className="text-sm text-gray-600 mb-4">
        Upload a <strong>.glb</strong> or <strong>.bvh</strong> file to visualize motion or models.
      </p>

      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
        <span className="text-sm text-gray-700">Click to upload</span>
        <span className="text-xs text-gray-400 mt-1">Max size: 50MB</span>
      </div>

      <input
        type="file"
        accept=".glb,.bvh"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <p className="text-xs text-gray-400 mt-4">
        Supported formats: GLB (avatar), BVH (motion capture)
      </p>
      <div className="mt-auto pt-4 border-t text-xs text-gray-500">
  <p className="font-semibold mb-1">Import Tips</p>
  <ul className="list-disc pl-4 space-y-1 text-gray-400">
    <li>Ensure .glb files include mesh & texture.</li>
    <li>.bvh files should be trimmed to a single loop or cycle.</li>
    <li>Use filenames without spaces or special characters.</li>
  </ul>
</div>

    </div>

    
  );
}
