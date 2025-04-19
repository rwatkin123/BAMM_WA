import { Settings, Sliders, Download, Upload, User } from 'lucide-react'

export default function SidebarNav() {
  return (
<div className="w-24 bg-gray-800 text-white flex flex-col items-center py-4 h-full">
<div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full overflow-hidden mb-2 bg-gray-700">
          <img src="/placeholder.svg?height=48&width=48&query=cartoon avatar" alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <div className="text-xs">Avatars</div>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-2">
          <Sliders className="w-6 h-6" />
        </div>
        <div className="text-xs">Adjust</div>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-2">
          <Download className="w-6 h-6" />
        </div>
        <div className="text-xs">Import</div>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-2">
          <Upload className="w-6 h-6" />
        </div>
        <div className="text-xs">Export</div>
      </div>

      <div className="mt-auto flex flex-col items-center mb-2">
        <div className="w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-2">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-2">
          <User className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}