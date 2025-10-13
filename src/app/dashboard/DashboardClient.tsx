"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Canvas from "@/components/canvas/Canvas"
import SidebarNav from "@/components/SidebarNav"
import AvatarGrid from "@/components/AvatarGrid"
import ImportPanel from "@/components/ImportPanel"
import ExportPanel from "@/components/ExportPanel"
import Chatbot from "@/components/Chatbot"
import MeasurementControls, { type Measurements } from "@/components/MeasurementControls"
import { CharacterControlsProvider } from "@/contexts/CharacterControlsContext"
import axios from "axios"
import createAndSaveGLB from "@/lib/createMesh"
import create_glb from "@/components/create_glb"
import { Loader2 } from "lucide-react"
import type { ProjectRow } from "@/types/projects"

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  // 🆕 NEW: Multi-character state management
  const [multiCharacterMode, setMultiCharacterMode] = useState(false)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
  const [activePanel, setActivePanel] = useState("avatars")
  
  // 🆕 NEW: Play controls state (copied from Canvas)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [_trimRange, setTrimRange] = useState([0, 0])
  const [exportHandlers, setExportHandlers] = useState<{ exportSelectedToGLB: () => Promise<void>; exportCurrentBVH: () => Promise<void> } | null>(null)
  const [playbackHandlers, setPlaybackHandlers] = useState<{ play: () => void; pause: () => void; seek: (time: number) => void; toggle: () => void } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const importedObjectUrlsRef = useRef<string[]>([])
  const [projectName, setProjectName] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)

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

  useEffect(() => {
    let cancelled = false

    const fetchProject = async () => {
      if (!projectId) {
        setProjectName(null)
        return
      }

      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error('Failed to load project')
        }

        const payload = await response.json()
        if (cancelled) return

        const project = payload?.project as ProjectRow | undefined

        setProjectName(project?.name ?? null)

        if (project?.selected_model) {
          setSelectedAvatars((prev) => {
            if (prev.length === 1 && prev[0] === project.selected_model) {
              return prev
            }
            return [project.selected_model as string]
          })
          setMultiCharacterMode(false)
        } else {
          setSelectedAvatars((prev) => (prev.length === 0 ? prev : []))
        }

        if (project?.bvh_path) {
          const bvhResponse = await fetch(`/api/projects/${projectId}/bvh`, {
            cache: 'no-store'
          })

          if (cancelled) {
            return
          }

          if (bvhResponse.ok) {
            const bvhPayload = await bvhResponse.json()
            const url = bvhPayload?.url as string | undefined

            if (url) {
              setBvhFile((prev) => {
                if (prev === url) {
                  return prev
                }
                setTrigger((toggle) => !toggle)
                return url
              })
            }
          } else {
            setBvhFile((prev) => {
              if (prev === null) {
                return prev
              }
              setTrigger((toggle) => !toggle)
              return null
            })
          }
        } else {
          setBvhFile((prev) => {
            if (prev === null) {
              return prev
            }
            setTrigger((toggle) => !toggle)
            return null
          })
        }
      } catch (error) {
        console.error('Failed to fetch project', error)
      }
    }

    fetchProject()

    return () => {
      cancelled = true
    }
  }, [projectId])

  // 🆕 NEW: Toggle between single and multi-character mode
  const toggleCharacterMode = () => {
    setMultiCharacterMode(!multiCharacterMode)
    setSelectedAvatars([])
    console.log("[DEBUG] toggleCharacterMode: Mode toggled, toggling trigger");
    setTrigger((prev) => !prev)
  }

  // Debug log for Canvas props
  console.log('[DEBUG] Canvas props:', {bvhFile, trigger, selectedCharacters: multiCharacterMode ? selectedAvatars : [], isPlaying: false, multiCharacterMode});

  const handleBackToProjects = () => {
    router.push("/projects")
  }

  const handleSaveProject = async () => {
    if (!projectId || isSavingProject) {
      return
    }

    setIsSavingProject(true)

    try {
      const formData = new FormData()
      let hasPayload = false

      const primaryAvatar = selectedAvatars[0] ?? null
      if (primaryAvatar) {
        const normalized = primaryAvatar.includes('#')
          ? primaryAvatar.split('#').pop() ?? primaryAvatar
          : primaryAvatar
        formData.append('selectedModel', normalized)
        hasPayload = true
      }

      if (bvhFile) {
        const response = await fetch(bvhFile, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to download BVH (status ${response.status})`)
        }

        const blob = await response.blob()
        const inferredName = bvhFile.split('?')[0]?.split('/').pop() || 'animation.bvh'
        const safeName = /\.bvh$/i.test(inferredName)
          ? inferredName
          : `${inferredName.replace(/\.[^/.]+$/, '') || 'animation'}.bvh`

        const file = new File([blob], safeName, {
          type: blob.type || 'application/octet-stream',
        })

        formData.append('file', file)
        hasPayload = true
      }

      if (!hasPayload) {
        const response = await fetch(`/api/projects?id=${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'touch' }),
        })

        if (!response.ok) {
          throw new Error('Failed to update project timestamp')
        }

        return
      }

      const saveResponse = await fetch(`/api/projects/${projectId}/save`, {
        method: 'POST',
        body: formData,
      })

      const payload = await saveResponse.json().catch(() => ({}))

      if (!saveResponse.ok) {
        throw new Error(payload?.message ?? 'Failed to save project')
      }

      if (payload?.project?.name && payload.project.name !== projectName) {
        setProjectName(payload.project.name)
      }
    } catch (error) {
      console.error('Failed to save project', error)
    } finally {
      setIsSavingProject(false)
    }
  }

  const renderSidebarPanel = () => {
    switch (activePanel) {
      case "avatars":
        return (
          <div className="flex h-full flex-col gap-4 bg-white/80 p-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600">
              <span>Character Mode</span>
              <button
                type="button"
                onClick={toggleCharacterMode}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  multiCharacterMode ? "bg-blue-600 text-white shadow-sm" : "bg-slate-200 text-slate-700"
                }`}
              >
                {multiCharacterMode ? "Multi" : "Single"}
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white/70">
              <AvatarGrid
                onSelectAvatar={!multiCharacterMode ? handleAvatarSelect : undefined}
                onSelectAvatars={multiCharacterMode ? handleAvatarsSelect : undefined}
                selectedAvatars={selectedAvatars}
                multiCharacterMode={multiCharacterMode}
                maxCharacters={4}
                className="w-full h-full"
                fullHeight={true}
                scrollable={true}
              />
            </div>
          </div>
        )
      case "adjust":
        return (
          <div className="h-full overflow-y-auto bg-white/80 p-4">
            <MeasurementControls
              initialMeasurements={measurements}
              onChange={handleMeasurementsChange}
            />
          </div>
        )
      case "import":
        return (
          <div className="h-full overflow-y-auto bg-white/80 p-4">
            <ImportPanel onImportFile={handleImportModel} />
          </div>
        )
      case "export":
        return (
          <div className="h-full overflow-y-auto bg-white/80 p-4">
            <ExportPanel
              onExportGLB={exportHandlers?.exportSelectedToGLB}
              onExportBVH={exportHandlers?.exportCurrentBVH}
            />
          </div>
        )
      case "settings":
      case "profile":
        return (
          <div className="flex h-full flex-col items-center justify-center bg-white/80 p-6 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">
              {activePanel === "settings" ? "Workspace settings coming soon." : "Profile tools coming soon."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Core animation features remain available while we restore the classic dashboard look.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <CharacterControlsProvider>
      <div className="flex h-screen bg-slate-100 text-slate-900">
        <SidebarNav activePanel={activePanel} onSelect={setActivePanel} />
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-80 flex-shrink-0 border-r border-slate-200 bg-slate-50/80 backdrop-blur">
            {renderSidebarPanel()}
          </aside>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden bg-slate-100/40">
              <div className="relative flex-1 bg-slate-950">
                {loading && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/60 backdrop-blur-sm">
                    <Loader2 className="h-9 w-9 animate-spin text-white" />
                    <p className="text-sm font-medium text-slate-100">Generating motion…</p>
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
                {/* <div className="pointer-events-auto absolute right-6 top-6 z-30 max-w-xs">
                  <Chatbot
                    onFileReceived={handleFileReceived}
                    onSend={handleSend}
                    onAvatarUpdate={handleAvatarUpdate}
                  />
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CharacterControlsProvider>
  )
}
