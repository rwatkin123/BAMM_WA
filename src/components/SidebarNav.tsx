import { Settings, Sliders, Download, Upload, User } from 'lucide-react';

interface SidebarNavProps {
  onSelect: (panel: string) => void;
  activePanel?: string;
}

export default function SidebarNav({ onSelect, activePanel }: SidebarNavProps) {
  const navItems = [
    { key: 'avatars', icon: <img src="/avatar.png" alt="Avatar" className="w-full h-full object-cover" />, label: 'Avatars', avatar: true },
    { key: 'adjust', icon: <Sliders className="w-6 h-6" />, label: 'Adjust' },
    { key: 'import', icon: <Download className="w-6 h-6" />, label: 'Import' },
    { key: 'export', icon: <Upload className="w-6 h-6" />, label: 'Export' },
  ];
  const bottomItems = [
    { key: 'settings', icon: <Settings className="w-6 h-6" />, label: 'Settings' },
    { key: 'profile', icon: <User className="w-6 h-6" />, label: 'Profile' },
  ];

  return (
    <div className="w-20 bg-[rgba(0,40,120,0.9)] backdrop-blur-md text-white flex flex-col items-center py-4 h-full shadow-xl border-r border-[rgba(255, 255, 255, 0.08)]">
      {navItems.map(({ key, icon, label, avatar }) => (
        <div
          key={key}
          className={`flex flex-col items-center mb-4 cursor-pointer group transition-all ${activePanel === key ? 'drop-shadow-lg' : ''}`}
          onClick={() => onSelect(key)}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-all
              ${avatar ? 'overflow-hidden bg-gray-700' : 'bg-white text-gray-800'}
              ${activePanel === key ? 'ring-2 ring-blue-400 ring-offset-2' : 'hover:ring-2 hover:ring-blue-400 hover:ring-offset-2'}`}
          >
            {icon}
          </div>
          <div className="text-[11px] text-gray-200 group-hover:text-blue-300 transition-all font-medium tracking-wide">
            {label}
          </div>
        </div>
      ))}
      {/* Divider above bottom section */}
      <div className="flex-grow w-full flex items-end">
        <div className="w-10 mx-auto border-t border-dashed border-gray-500 opacity-30 my-4" />
      </div>
      {bottomItems.map(({ key, icon, label }) => (
        <div
          key={key}
          className={`flex flex-col items-center mb-3 cursor-pointer group transition-all ${activePanel === key ? 'drop-shadow-lg' : ''}`}
          onClick={() => onSelect(key)}
        >
          <div
            className={`w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center mb-1 transition-all
              ${activePanel === key ? 'ring-2 ring-blue-400 ring-offset-2' : 'hover:ring-2 hover:ring-blue-400 hover:ring-offset-2'}`}
          >
            {icon}
          </div>
          <div className="text-[11px] text-gray-200 group-hover:text-blue-300 transition-all font-medium tracking-wide">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
