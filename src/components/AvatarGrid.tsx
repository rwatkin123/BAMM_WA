"use client";

import { useEffect, useState } from "react";
import LazyImage from "./LazyImage";
import { CheckCircle2, Plus, Minus, Users } from "lucide-react";

interface AvatarGridProps {
  onSelectAvatar?: (filename: string) => void; // Keep for backward compatibility
  onSelectAvatars?: (filenames: string[]) => void; // NEW: Multi-character handler
  selectedAvatars?: string[]; // NEW: Track selected characters
  multiCharacterMode?: boolean; // NEW: Toggle between single/multi selection
  maxCharacters?: number; // NEW: Character limit
  className?: string;
  fullHeight?: boolean;
  scrollable?: boolean;
}

export default function AvatarGrid({ 
  onSelectAvatar,
  onSelectAvatars,
  selectedAvatars = [], 
  multiCharacterMode = false,
  maxCharacters = 4,
  className = "w-[32rem]",
  fullHeight = true,
  scrollable = true,
}: AvatarGridProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [source, setSource] = useState<'custom' | 'mixamo'>("custom");
  const [singleSelected, setSingleSelected] = useState<string | null>(null); // For single mode

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/listfile?source=${source}`);
        const data = await res.json();
        setFiles(data.files);
      } catch (err) {
        console.error("Failed to load file list", err);
      }
    };

    fetchFiles();
  }, [source]);

  // Handle single character selection (original behavior)
  const handleSingleSelect = (filename: string) => {
    setSingleSelected(filename);
    if (onSelectAvatar) {
      onSelectAvatar(filename);
    }
  };

  // Handle multi-character selection (new behavior)
  const handleMultiSelect = (filename: string) => {
    const isSelected = selectedAvatars.includes(filename);
    
    if (isSelected) {
      // Remove character
      const newSelection = selectedAvatars.filter(f => f !== filename);
      if (onSelectAvatars) {
        onSelectAvatars(newSelection);
      }
    } else {
      // Add character (if under limit)
      if (selectedAvatars.length < maxCharacters) {
        const newSelection = [...selectedAvatars, filename];
        if (onSelectAvatars) {
          onSelectAvatars(newSelection);
        }
      }
    }
  };

  // Handle source switching and clear selections
  const handleSourceChange = (newSource: 'custom' | 'mixamo') => {
    if (newSource !== source) {
      console.log(`[DEBUG] Switching from ${source} to ${newSource}, clearing selections`);
      setSource(newSource);
      // Clear all selections when switching between custom and mixamo
      setSingleSelected(null);
      if (onSelectAvatars) {
        onSelectAvatars([]);
      }
      if (onSelectAvatar) {
        onSelectAvatar(''); // Clear single selection
      }
    }
  };

  const clearAllMulti = () => {
    if (onSelectAvatars) {
      onSelectAvatars([]);
    }
  };

  const isSelected = (filename: string) => {
    if (multiCharacterMode) {
      return selectedAvatars.includes(filename);
    } else {
      return singleSelected === filename;
    }
  };

  const isDisabled = (filename: string) => {
    if (!multiCharacterMode) return false;
    return !selectedAvatars.includes(filename) && selectedAvatars.length >= maxCharacters;
  };

  const handleSelection = (filename: string) => {
    if (isDisabled(filename)) return;
    
    if (multiCharacterMode) {
      handleMultiSelect(filename);
    } else {
      handleSingleSelect(filename);
    }
  };

  const heightClasses = fullHeight ? 'h-full' : '';
  const overflowClasses = scrollable ? 'overflow-y-auto' : '';

  return (
    <div className={`${className} bg-transparent ${heightClasses} ${overflowClasses} p-4 space-y-4`}>
      {/* Source toggle */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            className={`px-3 py-1.5 text-xs font-medium ${source === 'custom' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            onClick={() => handleSourceChange('custom')}
          >
            Custom
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${source === 'mixamo' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            onClick={() => handleSourceChange('mixamo')}
          >
            Mixamo
          </button>
        </div>
      </div>
      
      {/* Mode indicator and controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {multiCharacterMode ? (
            <>
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                Multi-Character Mode ({selectedAvatars.length}/{maxCharacters})
              </span>
            </>
          ) : (
            <>
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Single Character Mode
              </span>
            </>
          )}
        </div>
        
        {multiCharacterMode && selectedAvatars.length > 0 && (
          <button
            onClick={clearAllMulti}
            className="text-xs text-red-500 hover:text-red-700 transition"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Selected Characters Preview (Multi-mode only) */}
      {multiCharacterMode && selectedAvatars.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-medium text-blue-700 mb-2">
            Selected Characters ({selectedAvatars.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedAvatars.map((filename, index) => (
              <div key={filename} className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded text-xs">
                <span className="text-blue-800 font-bold">#{index + 1}</span>
                <span className="text-blue-600 truncate max-w-24" title={filename}>
                  {filename.length > 15 ? filename.substring(0, 15) + "..." : filename}
                </span>
                <button
                  onClick={() => handleMultiSelect(filename)}
                  className="text-blue-500 hover:text-red-500 transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instruction text */}
      <div className="text-center text-xs text-gray-500 mb-4">
        {multiCharacterMode 
          ? `Select up to ${maxCharacters} characters for synchronized animation`
          : "Select one character for animation"
        }
      </div>

      {/* Character Grid */}
      <div className="grid grid-cols-2 gap-6">
        {files.map((filename) => (
          <div
            key={filename}
            className={`relative rounded-xl bg-white shadow-sm border-[3px] transition-all cursor-pointer duration-200
              ${isSelected(filename) 
                ? multiCharacterMode 
                  ? "ring-2 ring-blue-400 border-[3px] border-blue-300 bg-blue-50" 
                  : "ring-2 ring-blue-400 border-[3px] border-blue-300"
                : isDisabled(filename)
                ? "border-[3px] border-gray-200 opacity-50 cursor-not-allowed"
                : "border-[3px] border-gray-200 hover:shadow-lg hover:scale-[1.025] hover:border-[3px] hover:border-gray-300"
              }
            `}
            onClick={() => handleSelection(filename)}
          >
            {/* Selection Indicator */}
            <div className="absolute top-2 right-2 z-10">
              {isSelected(filename) ? (
                <CheckCircle2 className="w-6 h-6 text-blue-500 drop-shadow" />
              ) : multiCharacterMode && isDisabled(filename) ? (
                <div className="w-6 h-6 rounded-full bg-gray-300 opacity-50" />
              ) : multiCharacterMode ? (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white hover:border-blue-300 transition" />
              ) : null}
            </div>

            {/* Character Number Badge (Multi-mode only) */}
            {multiCharacterMode && isSelected(filename) && (
              <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {selectedAvatars.indexOf(filename) + 1}
              </div>
            )}

            <div className="aspect-[3/4] relative rounded-t-xl overflow-hidden flex items-center justify-center">
              {source === 'custom' ? (
                <LazyImage filename={filename} />
              ) : (
                <img src="/file.svg" alt="FBX" className="w-10 h-10 opacity-70" />
              )}
            </div>
            <div className={`text-xs text-center px-2 py-2 font-medium truncate
              ${isSelected(filename) 
                ? multiCharacterMode ? "text-blue-700" : "text-blue-600"
                : "text-gray-500"}
            `}>
              {source === 'custom' ? filename : filename.split('/').pop()}
            </div>
          </div>
        ))}
      </div>
      
      {/* Character limit warning */}
      {multiCharacterMode && selectedAvatars.length >= maxCharacters && (
        <div className="text-center text-xs text-amber-600 bg-amber-50 py-2 px-3 rounded border border-amber-200">
          Maximum {maxCharacters} characters selected
        </div>
      )}
      
      <div className="my-2 border-t border-dashed border-gray-200" />
      <div className="text-center text-xs text-gray-400">Scroll for more characters</div>
    </div>
  );
}
