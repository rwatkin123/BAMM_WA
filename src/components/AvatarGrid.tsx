"use client"

import { useEffect, useState } from "react"
import LazyImage from "./LazyImage"

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
    <div className="w-80 bg-white border-r h-full overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {files.map((filename) => (
          <div
            key={filename}
            className={`rounded-xl bg-blue-50 shadow-sm border transition-all ${
              selected === filename
                ? "border-blue-500 ring-2 ring-blue-300"
                : "border-gray-200 hover:shadow-md hover:border-gray-300"
            }`}
            onClick={() => handleSelect(filename)}
          >
            <div className="aspect-[3/4] relative rounded-t-xl overflow-hidden">
              <LazyImage filename={filename} />
            </div>
            <div className="text-xs text-center px-2 py-2 font-medium text-gray-700 truncate">
              {filename}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-gray-400">Scroll for more</div>
    </div>
  )
}
