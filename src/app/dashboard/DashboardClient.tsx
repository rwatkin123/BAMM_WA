"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import type { ProjectRow } from "@/lib/types/projects"

export default function DashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  const [bvhFile, setBvhFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(false)
  const [multiCharacterMode, setMultiCharacterMode] = useState(false)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
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

  const handleAvatarSelect = async (folderName: string) => {
    try {
      if (!folderName || folderName === '') {
        setSelectedAvatars([])
        console.log("[DEBUG] handleAvatarSelect: Selection cleared");
        setTrigger((prev) => !prev)
        return
      }

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

  const toggleCharacterMode = () => {
    setMultiCharacterMode(!multiCharacterMode)
    setSelectedAvatars([])
    console.log("[DEBUG] toggleCharacterMode: Mode toggled, toggling trigger");
    setTrigger((prev) => !prev)
  }

  console.log('[DEBUG] Canvas props:', {bvhFile, trigger, selectedCharacters: multiCharacterMode ? selectedAvatars : [], isPlaying: false, multiCharacterMode});

  const handleBackToProjects = () => {
    router.push("/projects")
  }

  const handleSaveProject = async () => {
    if (!projectId || isSavingProject) return

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
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })

        if (!response.ok) throw new Error(`Failed to download BVH (status ${response.status})`)

        const blob = await response.blob()
        const inferredName = bvhFile.split('?')[0]?.split('/').pop() || 'animation.bvh'
        const safeName = /\.bvh$/i.test(inferredName)
          ? inferredName
          : `${inferredName.replace(/\.[^/.]+$/, '') || 'animation'}.bvh`

        const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' })
        formData.append('file', file)
        hasPayload = true
      }

      if (!hasPayload) {
        const response = await fetch(`/api/projects?id=${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'touch' }),
        })
        if (!response.ok) throw new Error('Failed to update project timestamp')
        return
      }

      const saveResponse = await fetch(`/api/projects/${projectId}/save`, {
        method: 'POST',
        body: formData,
      })

      const payload = await saveResponse.json().catch(() => ({}))
      if (!saveResponse.ok) throw new Error(payload?.message ?? 'Failed to save project')

      if (payload?.project?.name && payload.project.name !== projectName) {
        setProjectName(payload.project.name)
      }
    } catch (error) {
      console.error('Failed to save project', error)
    } finally {
      setIsSavingProject(false)
    }
  }

  return (
    <CharacterControlsProvider>
      <div className="flex h-screen overflow-hidden bg-slate-200">
        <div className="flex flex-1 min-h-0 flex-col bg-slate-100">
          <WorkspaceHeader
            characterCount={selectedAvatars.length}
            projectName={projectName}
            onBackToProjects={handleBackToProjects}
            onSave={projectId ? handleSaveProject : undefined}
            isSaving={isSavingProject}
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
                  if (playbackHandlers) playbackHandlers.seek(time)
                  else setProgress(time)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </CharacterControlsProvider>
  )
}
