import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface WorkspaceHeaderProps {
  onExportGLB?: () => void;
  onExportBVH?: () => void;
  characterCount: number;
}

export default function WorkspaceHeader({ onExportGLB, onExportBVH, characterCount }: WorkspaceHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-3 backdrop-blur">
      <div>
        <h1 className="text-sm font-semibold text-slate-800">BAMM Workspace</h1>
        <p className="text-xs text-slate-400">{characterCount} character{characterCount === 1 ? '' : 's'} in scene</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExportBVH} disabled={!onExportBVH}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export BVH
        </Button>
        <Button size="sm" onClick={onExportGLB} disabled={!onExportGLB}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export GLB
        </Button>
      </div>
    </header>
  );
}
