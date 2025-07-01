"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useCharacterControls } from "@/contexts/CharacterControlsContext"

export type Measurements = {
  height: number
  inseam: number
  chest: number
  waist: number
  hips: number
}



type MeasurementControlsProps = {
  initialMeasurements?: Measurements
  onChange?: (measurements: Measurements) => void
}

export default function MeasurementControls({
  initialMeasurements = {
    height: 178, // cm
    inseam: 81, // cm
    chest: 106, // cm
    waist: 94, // cm
    hips: 104, // cm
  },
  onChange,
}: MeasurementControlsProps) {
  const [measurements, setMeasurements] = useState<Measurements>(initialMeasurements)
  const characterControls = useCharacterControls()
  const [tempMeasurements, setTempMeasurements] = useState<Measurements>(initialMeasurements)

  const handleTempChange = (key: keyof Measurements, value: number[]) => {
    setTempMeasurements((prev) => ({
      ...prev,
      [key]: value[0],
    }))
  }

  const handleCommit = (key: keyof Measurements, value: number[]) => {
    const newMeasurements = {
      ...measurements,
      [key]: value[0],
    }
    setMeasurements(newMeasurements)
    onChange?.(newMeasurements)
  }



  return (
    <Card className="w-full h-full">
      <Tabs defaultValue="body" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="adjust">Adjust</TabsTrigger>
        </TabsList>
        <TabsContent value="body" className="space-y-4 p-4">
          <div className="space-y-4">
            {Object.entries(measurements).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <span className="text-sm text-muted-foreground">{tempMeasurements[key as keyof Measurements]} cm</span>
                </div>
                <Slider
                  id={key}
                  min={50}
                  max={200}
                  step={1}
                  value={[tempMeasurements[key as keyof Measurements]]}
                  onValueChange={(value) => handleTempChange(key as keyof Measurements, value)}
                  onValueCommit={(value) => handleCommit(key as keyof Measurements, value)}
                />
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="adjust" className="space-y-4 p-4">
          <div className="space-y-6">
            {characterControls ? (
              /* Character Controls - Clean styling for sidebar */
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎭</span>
                  <h3 className="font-semibold text-gray-800">Character Controls</h3>
                </div>

                {/* Wireframe and Skeleton toggles */}
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={characterControls.wireframe}
                        onChange={e => characterControls.setWireframe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Wireframe</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={characterControls.showSkeleton}
                        onChange={e => characterControls.setShowSkeleton(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Skeleton</span>
                    </label>
                  </div>
                </div>

                {/* Character Size */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm font-medium">Size</Label>
                    <span className="text-sm text-muted-foreground">{characterControls.characterScale.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[characterControls.characterScale]}
                    min={0.5}
                    max={3.0}
                    step={0.01}
                    onValueChange={([v]) => characterControls.setCharacterScale(v)}
                    className="w-full"
                  />
                </div>

                {/* Character Rotation */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm font-medium">Rotation</Label>
                    <span className="text-sm text-muted-foreground">{characterControls.characterRotation}°</span>
                  </div>
                  <Slider
                    value={[characterControls.characterRotation]}
                    min={0}
                    max={360}
                    step={1}
                    onValueChange={([v]) => characterControls.setCharacterRotation(v)}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">
                Character controls are available on the Canvas.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
