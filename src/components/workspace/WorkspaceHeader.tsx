import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface WorkspaceHeaderProps {
  characterCount: number;
  projectName?: string | null;
  onBackToProjects?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export default function WorkspaceHeader({
  characterCount,
  projectName,
  onBackToProjects,
  onSave,
  isSaving,
}: WorkspaceHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {onBackToProjects && (
          <Button variant="ghost" size="sm" onClick={onBackToProjects}>
            Projects
          </Button>
        )}
        <div>
          <h1 className="text-sm font-semibold text-slate-800">
            {projectName || "BAMM Workspace"}
          </h1>
          <p className="text-xs text-slate-400">
            {characterCount} character{characterCount === 1 ? "" : "s"} in scene
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onSave} disabled={!onSave || isSaving}>
        <Save className="mr-2 h-3.5 w-3.5" />
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </header>
  );
}
