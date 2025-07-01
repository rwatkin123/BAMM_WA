import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CharacterControls {
  characterScale: number;
  setCharacterScale: (scale: number) => void;
  characterRotation: number;
  setCharacterRotation: (rotation: number) => void;
  wireframe: boolean;
  setWireframe: (wireframe: boolean) => void;
  showSkeleton: boolean;
  setShowSkeleton: (show: boolean) => void;
}

const CharacterControlsContext = createContext<CharacterControls | undefined>(undefined);

export function CharacterControlsProvider({ children }: { children: ReactNode }) {
  const [characterScale, setCharacterScale] = useState(1.0);
  const [characterRotation, setCharacterRotation] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const value: CharacterControls = {
    characterScale,
    setCharacterScale,
    characterRotation,
    setCharacterRotation,
    wireframe,
    setWireframe,
    showSkeleton,
    setShowSkeleton,
  };

  return (
    <CharacterControlsContext.Provider value={value}>
      {children}
    </CharacterControlsContext.Provider>
  );
}

export function useCharacterControls(): CharacterControls {
  const context = useContext(CharacterControlsContext);
  if (context === undefined) {
    throw new Error('useCharacterControls must be used within a CharacterControlsProvider');
  }
  return context;
} 