import { getDisplayNameFromReference } from "@/lib/assetReference";
import { Layers, Trash2 } from "lucide-react";

interface LayerPanelProps {
  layers: string[];
  onRemoveLayer?: (index: number) => void;
  className?: string;
}

export default function LayerPanel({ layers, onRemoveLayer, className = "" }: LayerPanelProps) {
  return (
    <aside className={`flex h-full w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/70 backdrop-blur ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Layers className="w-4 h-4" />
          Layers
        </div>
        <span className="text-xs text-slate-400">{layers.length}</span>
      </div>
      <div className="h-full overflow-y-auto">
        {layers.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-400">
            No characters yet. Add from the library to start animating.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {layers.map((layer, index) => {
              const displayName = getDisplayNameFromReference(layer);
              const extension = displayName.split('.').pop()?.toLowerCase();
              const isFBX = extension === 'fbx';

              return (
                <li key={`${layer}-${index}`} className="group flex items-center gap-2 px-4 py-3 text-sm">
                  <div className="flex-1 truncate">
                    <div className="font-medium text-slate-700 truncate" title={displayName}>
                      {displayName || `Character ${index + 1}`}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      {isFBX ? 'FBX' : 'GLB'} Layer
                    </div>
                  </div>
                  <button
                    type="button"
                    className="relative hidden items-center justify-center rounded-full border border-slate-200 p-1 text-slate-400 transition group-hover:flex hover:bg-slate-100"
                    onClick={() => onRemoveLayer?.(index)}
                    aria-label={`Remove ${displayName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
