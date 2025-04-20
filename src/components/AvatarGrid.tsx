"use client"

import { useEffect, useState } from "react"
import LazyImage from "./LazyImage" // ✅ import your lazy loader component

interface AvatarGridProps {
  onSelectAvatar: (filename: string) => void
}

export default function AvatarGrid({ onSelectAvatar }: AvatarGridProps) {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/listfile")
        const data = await res.json()
        setFiles(data.files)
      } catch (err) {
        console.error("Failed to load file list", err)
      }
    }

    fetchFiles()
  }, [])

  const handleSelect = (filename: string) => {
    setSelected(filename)
    onSelectAvatar(filename)
  }

  return (
    <div className="w-80 bg-white border-r h-full overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-3">
        {files.map((filename) => (
          <div
            key={filename}
            className={`rounded-lg border-2 p-[2px] cursor-pointer transition-all ${
              selected === filename
                ? "border-blue-500"
                : "border-transparent hover:border-gray-300"
            }`}
            onClick={() => handleSelect(filename)}
          >
            <div className="h-40 rounded-md overflow-hidden bg-gray-100 relative flex items-center justify-center">
              
              {/* ✅ LazyImage replaces <img> */}
              <LazyImage filename={filename} />

              <span className="absolute bottom-1 left-1 right-1 text-[10px] text-center text-white bg-black/40 px-1 rounded">
                {filename}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center text-xs text-gray-500">
        Scroll For More
      </div>
    </div>
  )
}
