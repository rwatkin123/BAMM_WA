"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  filename: string
}

export default function LazyImage({ filename }: Props) {
  const imgRef = useRef<HTMLDivElement>(null)
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

  return (
    <div
      ref={imgRef}
      className="w-full h-full bg-gray-300"
      style={
        inView
          ? {
              backgroundImage: `url(/vis/${encodeURIComponent(filename)}.png)`,
              backgroundSize: "400% 200%", // 4x2 sprite
              backgroundPosition: "0% 100%", // bottom-left tile
              backgroundRepeat: "no-repeat",
              backgroundColor: "#ccc",
              backgroundClip: "content-box",
            }
          : undefined
      }
    />
  )
}
