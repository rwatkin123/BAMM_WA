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
import { Loader2 } from "lucide-react"

export default function Home() {
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  const [activePanel, setActivePanel] = useState("avatars")
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

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow flex overflow-hidden">
        <SidebarNav onSelect={setActivePanel} />

        {activePanel === "avatars" && (
          <AvatarGrid onSelectAvatar={handleAvatarSelect} className="w-[32rem]" />
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

            <Canvas bvhFile={bvhFile} trigger={trigger} />

            {/* Float Chatbot only over the canvas */}
            <div className="absolute bottom-0 left-0 w-full px-6 pb-6 pointer-events-none">
              <div className="pointer-events-auto">
                <Chatbot
                  onFileReceived={handleFileReceived}
                  onSend={handleSend}
                  onAvatarUpdate={handleAvatarUpdate}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
