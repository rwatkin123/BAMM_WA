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

export default function Home() {
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  const [activePanel, setActivePanel] = useState("avatars")
  
  // 🆕 NEW: Multi-character state management
  const [multiCharacterMode, setMultiCharacterMode] = useState(false)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
  
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

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow flex overflow-hidden">
        <SidebarNav onSelect={setActivePanel} />
        
        {activePanel === "avatars" && (
          <div className={`w-[32rem] relative transition-all duration-300`}>
            {/* 🆕 NEW: Minimize/Maximize Button */}
            {/* <div className="absolute top-4 left-4 z-20">
              <button
                onClick={() => setAvatarPanelMinimized(!avatarPanelMinimized)}
                className="flex items-center justify-center w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-all"
                title={avatarPanelMinimized ? "Expand Avatar Panel" : "Minimize Avatar Panel"}
              >
                {avatarPanelMinimized ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <ChevronLeft className="w-5 h-5" />
                )}
              </button>
            </div> */}

            {(
              <>
                {/* 🆕 NEW: Character Mode Toggle */}
                <div className="absolute top-4 right-4 z-20">
                  <button
                    onClick={toggleCharacterMode}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-md transition-all text-sm font-medium
                      ${multiCharacterMode 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                      }`}
                  >
                    {multiCharacterMode ? (
                      <>
                        <Users className="w-4 h-4" />
                        Multi
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4" />
                        Single
                      </>
                    )}
                  </button>
                </div>

                {/* 🔄 UPDATED: AvatarGrid with mode switching */}
                <AvatarGrid 
                  onSelectAvatar={!multiCharacterMode ? handleAvatarSelect : undefined}
                  onSelectAvatars={multiCharacterMode ? handleAvatarsSelect : undefined}
                  selectedAvatars={selectedAvatars}
                  multiCharacterMode={multiCharacterMode}
                  maxCharacters={4}
                  className="w-[32rem]" 
                />
              </>
            )}

            {/* Minimized state indicator */}
            {(
              <div className="flex flex-col items-center justify-center h-full space-y-4 bg-gray-50 border-r">
                <Users className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-500 writing-mode-vertical transform rotate-180" style={{writingMode: 'vertical-lr'}}>
                  Avatars
                </span>
                {selectedAvatars.length > 0 && (
                  <div className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                    {selectedAvatars.length}
                  </div>
                )}
              </div>
            )}
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
        
        <div className="flex-grow flex flex-col overflow-hidden">
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
            />
            
            {/* Float Chatbot only over the canvas */}
            <div className="absolute bottom-0 left-0 w-full px-6 pb-6 pointer-events-none">
              <div className={`pointer-events-auto transition-all duration-300`}>
                <div className="flex justify-end mb-2">
                  {/* <button
                    onClick={() => setChatbotMinimized(!chatbotMinimized)}
                    className="flex items-center justify-center w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-t-lg shadow-lg transition-all z-50"
                    title={chatbotMinimized ? "Expand Motion Chatbot" : "Minimize Motion Chatbot"}
                  >
                    {chatbotMinimized ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div> */}

                {/* Chatbot - hidden when minimized */}
                {
                  <Chatbot
                    onFileReceived={handleFileReceived}
                    onSend={handleSend}
                    onAvatarUpdate={handleAvatarUpdate}
                  />
                }

                {/* Minimized chatbot indicator
                {chatbotMinimized && (
                  <div className="flex items-center justify-center bg-gray-800/90 text-white px-4 py-2 rounded-lg backdrop-blur-sm shadow-lg">
                    <span className="text-sm font-medium">Motion Chatbot</span>
                    {selectedAvatars.length > 0 && (
                      <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded">
                        {selectedAvatars.length} char{selectedAvatars.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}