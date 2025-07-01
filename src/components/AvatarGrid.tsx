"use client";

import { useEffect, useState } from "react";
import LazyImage from "./LazyImage";
import { CheckCircle2 } from "lucide-react";

interface AvatarGridProps {
  onSelectAvatar: (filename: string) => void;
  className?: string;
}

export default function AvatarGrid({ onSelectAvatar, className = "w-[32rem]" }: AvatarGridProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/listfile");
        const data = await res.json();
        setFiles(data.files);
      } catch (err) {
        console.error("Failed to load file list", err);
      }
    };

    fetchFiles();
  }, []);

  const handleSelect = (filename: string) => {
    setSelected(filename);
    onSelectAvatar(filename);
  };

  return (
    <div className={`${className} bg-transparent h-full overflow-y-auto p-6 space-y-4`}>
      <div className="grid grid-cols-2 gap-6">
        {files.map((filename) => (
          <div
            key={filename}
            className={`relative rounded-xl bg-white shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-lg hover:scale-[1.025] active:scale-100 duration-200
              ${selected === filename ? "ring-2 ring-blue-400 border-blue-400" : "hover:border-gray-300"}
            `}
            onClick={() => handleSelect(filename)}
          >
            {selected === filename && (
              <div className="absolute top-2 right-2 z-10">
                <CheckCircle2 className="w-6 h-6 text-blue-500 drop-shadow" />
              </div>
            )}
            <div className="aspect-[3/4] relative rounded-t-xl overflow-hidden">
              <LazyImage filename={filename} />
            </div>
            <div className="text-xs text-center px-2 py-2 font-medium text-gray-500 truncate">
              {filename}
            </div>
          </div>
        ))}
      </div>
      <div className="my-2 border-t border-dashed border-gray-200" />
      <div className="text-center text-xs text-gray-400">Scroll for more</div>
    </div>
  );
}
