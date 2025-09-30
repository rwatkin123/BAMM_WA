"use client"
import { useEffect, useRef, useState } from "react"
import Canvas from "@/components/Canvas"
import axios from "axios"
import createAndSaveGLB from "@/lib/createMesh"
import create_glb from "@/components/create_glb"
import { CharacterControlsProvider } from "@/contexts/CharacterControlsContext"
import InspectorPanel from "@/components/workspace/InspectorPanel"
import TimelinePanel from "@/components/workspace/TimelinePanel"
import WorkspaceHeader from "@/components/workspace/WorkspaceHeader"
import { Loader2 } from "lucide-react"
import type { Measurements } from "@/components/MeasurementControls"

export default function Home() {
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  // 🆕 NEW: Multi-character state management
  const [multiCharacterMode, setMultiCharacterMode] = useState(false)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
  
  // 🆕 NEW: Play controls state (copied from Canvas)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [_trimRange, setTrimRange] = useState([0, 0])
  const [exportHandlers, setExportHandlers] = useState<{ exportSelectedToGLB: () => Promise<void>; exportCurrentBVH: () => Promise<void> } | null>(null)
  const [playbackHandlers, setPlaybackHandlers] = useState<{ play: () => void; pause: () => void; seek: (time: number) => void; toggle: () => void } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const importedObjectUrlsRef = useRef<string[]>([])

  const [measurements, setMeasurements] = useState<Measurements>({
    height: 175,
    inseam: 80,
    chest: 100,
    waist: 85,
    hips: 95,
  })

  function handleAvatarUpdate() {
    console.log("[DEBUG] handleAvatarUpdate called, toggling trigger");
    setTrigger((prev) => !prev)
  }

  const handleFileReceived = (filename: string) => {
    setBvhFile(filename)
    setLoading(false)
  }

  const handleSend = () => {
    setBvhFile(null)
    setLoading(true)
  }

  const handleMeasurementsChange = async (newMeasurements: Measurements) => {
    await setMeasurements(newMeasurements)
    const response = await axios.post('http://localhost:8080/calculate-anthrobetas/', newMeasurements)
    const glbResult = await createAndSaveGLB(response.data)
    if (glbResult === true) {
      console.log("[DEBUG] handleMeasurementsChange: GLB created, toggling trigger");
      setTrigger((prev) => !prev)
      console.log("GLB file created successfully, BVH file updated.")
    } else {
      console.error("GLB file creation failed, skipping BVH file update.")
    }
  }

  // 🔄 UPDATED: Handle single character selection (for backward compatibility)
  const handleAvatarSelect = async (folderName: string) => {
    try {
      // Handle clearing selection
      if (!folderName || folderName === '') {
        setSelectedAvatars([])
        console.log("[DEBUG] handleAvatarSelect: Selection cleared");
        setTrigger((prev) => !prev)
        return
      }

      // If a Mixamo FBX path is selected, use selectedAvatars to drive Canvas
      if (folderName.toLowerCase().endsWith('.fbx') || folderName.includes('/assets/mixamo/')) {
        setSelectedAvatars([folderName])
        setTrigger((prev) => !prev)
        return
      }

      setSelectedAvatars([folderName])
      const result = await create_glb(folderName)
      if (!result) {
        console.error("Failed to build GLB for", folderName)
      }
      setTrigger((prev) => !prev)
    } catch (err) {
      console.error("Failed to load avatar:", err)
    }
  }

  // 🆕 NEW: Handle multi-character selection
  const handleAvatarsSelect = (avatarFilenames: string[]) => {
    setSelectedAvatars(avatarFilenames)
    console.log("Selected avatars:", avatarFilenames)
    if (avatarFilenames.length !== selectedAvatars.length || 
        JSON.stringify(avatarFilenames) !== JSON.stringify(selectedAvatars)) {
      console.log("[DEBUG] handleAvatarsSelect: Avatars changed, toggling trigger");
      setTrigger((prev) => !prev)
    }
  }

  const handleImportModel = (file: File, objectUrl: string) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !["glb", "fbx"].includes(extension)) {
      console.warn("Unsupported import type", file.name)
      return
    }

    importedObjectUrlsRef.current.push(objectUrl)
    const entry = `${objectUrl}#${file.name}`

    if (multiCharacterMode) {
      setSelectedAvatars((prev) => {
        const next = [...prev, entry].slice(0, 4)
        return next
      })
    } else {
      setSelectedAvatars([entry])
    }

    setTrigger((prev) => !prev)
  }

  useEffect(() => {
    return () => {
      importedObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      importedObjectUrlsRef.current = []
    }
  }, [])

  // 🆕 NEW: Toggle between single and multi-character mode
  const toggleCharacterMode = () => {
    setMultiCharacterMode(!multiCharacterMode)
    setSelectedAvatars([])
    console.log("[DEBUG] toggleCharacterMode: Mode toggled, toggling trigger");
    setTrigger((prev) => !prev)
  }

  // Debug log for Canvas props
  console.log('[DEBUG] Canvas props:', {bvhFile, trigger, selectedCharacters: multiCharacterMode ? selectedAvatars : [], isPlaying: false, multiCharacterMode});

  return (
    <CharacterControlsProvider>
      <div className="flex h-screen overflow-hidden bg-slate-200">
        <div className="flex flex-1 min-h-0 flex-col bg-slate-100">
          <WorkspaceHeader
            characterCount={selectedAvatars.length}
            onExportGLB={exportHandlers?.exportSelectedToGLB}
            onExportBVH={exportHandlers?.exportCurrentBVH}
          />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <InspectorPanel
              multiCharacterMode={multiCharacterMode}
              onToggleCharacterMode={toggleCharacterMode}
              selectedAvatars={selectedAvatars}
              onSelectAvatar={handleAvatarSelect}
              onSelectAvatars={handleAvatarsSelect}
              onImportFile={handleImportModel}
              measurements={measurements}
              onMeasurementsChange={handleMeasurementsChange}
              onFileReceived={handleFileReceived}
              onSend={handleSend}
              onAvatarUpdate={handleAvatarUpdate}
              exportHandlers={exportHandlers}
            />
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-900">
                {loading && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <p className="ml-2 text-sm font-medium text-white">Generating motion...</p>
                  </div>
                )}
                <Canvas 
                  bvhFile={bvhFile} 
                  trigger={trigger}
                  selectedCharacters={selectedAvatars}
                  onProgressChange={setProgress}
                  onDurationChange={setDuration}
                  onTrimRangeChange={setTrimRange}
                  multiCharacterMode={multiCharacterMode}
                  onMultiCharacterModeChange={setMultiCharacterMode}
                  onFileReceived={handleFileReceived}
                  onSend={handleSend}
                  onAvatarUpdate={handleAvatarUpdate}
              onExportHandlersReady={setExportHandlers}
                  onPlaybackHandlersReady={setPlaybackHandlers}
                  onPlayStateChange={setIsPlaying}
                />
              </div>
              <TimelinePanel
                progress={progress}
                duration={duration}
                isPlaying={isPlaying}
                onTogglePlay={() => playbackHandlers?.toggle()}
                onSeek={(time) => {
                  if (playbackHandlers) {
                    playbackHandlers.seek(time)
                  } else {
                    setProgress(time)
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </CharacterControlsProvider>
  )
}
