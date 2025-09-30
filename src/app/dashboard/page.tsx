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
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [trimRange, setTrimRange] = useState([0, 0])
  const [exportHandlers, setExportHandlers] = useState<{ exportSelectedToGLB: () => Promise<void>; exportCurrentBVH: () => Promise<void> } | null>(null)
  

  
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

      // Otherwise treat as custom and build GLB
      const result = await create_glb(folderName)
      if (result) {
        console.log("[DEBUG] handleAvatarSelect: Avatar loaded, toggling trigger");
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
    if (avatarFilenames.length !== selectedAvatars.length || 
        JSON.stringify(avatarFilenames) !== JSON.stringify(selectedAvatars)) {
      console.log("[DEBUG] handleAvatarsSelect: Avatars changed, toggling trigger");
      setTrigger((prev) => !prev)
    }
  }

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
          {activePanel === "export" && (
            <ExportPanel
              onExportGLB={exportHandlers?.exportSelectedToGLB}
              onExportBVH={exportHandlers?.exportCurrentBVH}
            />
          )}
          
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
              />
            </div>
          </div>
        </div>
      </div>
    </CharacterControlsProvider>
  )
}
