"use client"
import { useEffect, useState } from "react"
import Canvas from "@/components/Canvas"
import Chatbot from "@/components/Chatbot"
import MeasurementControls, { type Measurements } from "@/components/MeasurementControls"
import AvatarGrid from "@/components/AvatarGrid"
import SidebarNav from "@/components/SidebarNav"
import axios from "axios"
import createAndSaveGLB from "@/lib/createMesh"
import create_glb from "@/components/create_glb"
import ImportPanel from "@/components/ImportPanel"
import ExportPanel from "@/components/ExportPanel"
import { Loader2, Users, User, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { CharacterControlsProvider } from "@/contexts/CharacterControlsContext"

export default function Home() {
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  const [activePanel, setActivePanel] = useState("avatars")
  
  // 🆕 NEW: Multi-character state management
  const [multiCharacterMode, setMultiCharacterMode] = useState(false)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
  
  // 🆕 NEW: Play controls state (copied from Canvas)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [trimRange, setTrimRange] = useState([0, 0])
  

  
  // 🆕 NEW: Avatar panel minimize state
  // const [avatarPanelMinimized, setAvatarPanelMinimized] = useState(false)
  
  // // 🆕 NEW: Chatbot minimize state
  // const [chatbotMinimized, setChatbotMinimized] = useState(false)
  const [measurements, setMeasurements] = useState<Measurements>({
    height: 175,
    inseam: 80,
    chest: 100,
    waist: 85,
    hips: 95,
  })

  function handleAvatarUpdate() {
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
      setTrigger((prev) => !prev)
      console.log("GLB file created successfully, BVH file updated.")
    } else {
      console.error("GLB file creation failed, skipping BVH file update.")
    }
  }

  // 🔄 UPDATED: Handle single character selection (for backward compatibility)
  const handleAvatarSelect = async (folderName: string) => {
    try {
      const result = await create_glb(folderName)
      if (result) {
        console.log("Avatar loaded successfully.")
        setTrigger((prev) => !prev)
      }
    } catch (err) {
      console.error("Failed to load avatar:", err)
    }
  }

  // 🆕 NEW: Handle multi-character selection
  const handleAvatarsSelect = (avatarFilenames: string[]) => {
    setSelectedAvatars(avatarFilenames)
    console.log("Selected avatars:", avatarFilenames)
    
    // Trigger update when characters change
    if (avatarFilenames.length !== selectedAvatars.length || 
        JSON.stringify(avatarFilenames) !== JSON.stringify(selectedAvatars)) {
      setTrigger((prev) => !prev)
    }
  }

  // 🆕 NEW: Toggle between single and multi-character mode
  const toggleCharacterMode = () => {
    setMultiCharacterMode(!multiCharacterMode)
    // Clear selections when switching modes
    setSelectedAvatars([])
    setTrigger((prev) => !prev)
  }

  // 🆕 NEW: Play controls handlers (copied from Canvas)
  const handlePlayPause = () => {
    console.log("Play button clicked, mixers:", "isPlaying:", isPlaying)
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (newTime: number) => {
    setProgress(newTime)
  }

  const handleTrimRangeChange = (newRange: number[]) => {
    setTrimRange(newRange)
  }





  return (
    <CharacterControlsProvider>
      <div className="flex flex-col h-screen">
        <div className="flex-grow flex overflow-hidden">
          <SidebarNav onSelect={setActivePanel} />
          
          {activePanel === "avatars" && (
            <div className={`w-80 relative transition-all duration-300`}>
              {/* 🔄 UPDATED: AvatarGrid with smaller width */}
              <AvatarGrid 
                onSelectAvatar={!multiCharacterMode ? handleAvatarSelect : undefined}
                onSelectAvatars={multiCharacterMode ? handleAvatarsSelect : undefined}
                selectedAvatars={selectedAvatars}
                multiCharacterMode={multiCharacterMode}
                maxCharacters={4}
                className="w-80" 
              />
            </div>
          )}
          
          {activePanel === "adjust" && (
            <div className="w-80 p-4 bg-white overflow-y-auto border-r">
              <MeasurementControls
                initialMeasurements={measurements}
                onChange={handleMeasurementsChange}
              />
            </div>
          )}
          
          {activePanel === "import" && <ImportPanel />}
          {activePanel === "export" && <ExportPanel />}
          
          <div className="flex-grow flex flex-col overflow-hidden relative">
            <div className="flex-grow overflow-hidden relative">
              {/* ⏳ Loading overlay scoped to canvas area */}
              {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-40">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-800" />
                  <p className="ml-2 text-lg text-gray-800 font-medium">Generating motion...</p>
                </div>
              )}
              
              {/* 🔄 UPDATED: Canvas with integrated character selection */}
                          <Canvas 
                bvhFile={bvhFile} 
                trigger={trigger}
                selectedCharacters={multiCharacterMode ? selectedAvatars : []}
                isPlaying={isPlaying}
                onPlayStateChange={setIsPlaying}
                onProgressChange={setProgress}
                onDurationChange={setDuration}
                onTrimRangeChange={setTrimRange}
                multiCharacterMode={multiCharacterMode}
                onMultiCharacterModeChange={setMultiCharacterMode}
                onFileReceived={handleFileReceived}
                onSend={handleSend}
                onAvatarUpdate={handleAvatarUpdate}
              />
              
            </div>

          {/* 🎨 MINIMALISTIC: Play Controls Card - Bottom Left */}
          <div className="absolute bottom-6 left-6 w-80 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-4 z-50">
            {/* Compact Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 5v10l8-5-8-5z"/>
                </svg>
                Motion
              </h3>
              <div className="text-xs text-gray-500 font-mono">
                {progress.toFixed(1)}s / {duration.toFixed(1)}s
              </div>
            </div>
            
            {/* Compact Controls Row */}
            <div className="flex items-center gap-3">
              {/* Circular Play/Pause Button */}
              <button
                onClick={handlePlayPause}
                disabled={loading}
                className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md
                  ${loading 
                    ? 'bg-gray-200 cursor-not-allowed' 
                    : isPlaying
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 4h4v12H6V4zm4 0h4v12h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 5v10l8-5-8-5z"/>
                  </svg>
                )}
              </button>

              {/* Progress Bar */}
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
                ></div>
              </div>

              {/* Character Count */}
              {selectedAvatars.length > 1 && (
                <div className="text-xs text-blue-600 font-medium">
                  {selectedAvatars.length} chars
                </div>
              )}
            </div>
          </div>






        </div>
      </div>
    </div>
    </CharacterControlsProvider>
  )
}