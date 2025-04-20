// components/LazyImage.tsx
"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  filename: string
}

export default function LazyImage({ filename }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [])

  return inView ? (
    <img
      ref={imgRef}
      src={`/mesh_json/${encodeURIComponent(filename)}/mesh.png`}
      alt={filename}
      className="w-full h-full object-cover"
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.onerror = null
        target.src = `/mesh_json/${encodeURIComponent(filename)}/mesh_albedo.png`
      }}
    />
  ) : (
    <div
      ref={imgRef}
      className="w-full h-full bg-gray-200 animate-pulse"
    />
  )
}
