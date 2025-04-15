"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

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
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="body">Body</TabsTrigger>
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
      </Tabs>
    </Card>
  )
}
