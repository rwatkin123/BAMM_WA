"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  filename: string
  frameCount?: number
  columns?: number 
  rows?: number 
  frameRate?: number 
}

export default function LazyImage({
  filename,
  frameCount = 8,
  columns = 4,
  rows = 2,
  frameRate = 1,
}: Props) {
  const imgRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [frame, setFrame] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [frameOpacity, setFrameOpacity] = useState(1)

  // Intersection Observer for lazy loading
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

  // Sprite animation (only bottom row, on hover)
  useEffect(() => {
    if (!inView || !hovered) return
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % columns)
    }, 1000 / frameRate)
    return () => clearInterval(interval)
  }, [inView, hovered, columns, frameRate])

  // Reset frame when not hovered
  useEffect(() => {
    if (!hovered) setFrame(0)
  }, [hovered])

  // Fade in on frame change
  useEffect(() => {
    setFrameOpacity(0)
    const timeout = setTimeout(() => setFrameOpacity(1), 200)
    return () => clearTimeout(timeout)
  }, [frame])

  // Calculate background position for bottom row
  const col = frame % columns
  const row = rows - 1 // always bottom row
  const bgPos = `${(col * 100) / (columns - 1)}% ${(row * 100) / (rows - 1)}%`

  return (
    <div
      ref={imgRef}
      className="w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: hovered ? 1 : 0.7,
        transition: 'opacity 0.4s',
        ...(inView
          ? {
              backgroundImage: `url(/vis/${encodeURIComponent(filename)}.png)`,
              backgroundSize: `${columns * 100}% ${rows * 100}%`,
              backgroundPosition: bgPos,
              backgroundRepeat: "no-repeat",
              backgroundClip: "content-box",
              transitionProperty: 'opacity, background-position',
              transitionDuration: '0.4s, 0.1s',
              opacity: frameOpacity,
            }
          : {})
      }}
    />
  )
}
