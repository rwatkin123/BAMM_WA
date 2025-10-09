import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AvatarGrid from "@/components/AvatarGrid";
import ImportPanel from "@/components/ImportPanel";
import MeasurementControls, { type Measurements } from "@/components/MeasurementControls";
import ExportPanel from "@/components/ExportPanel";

interface InspectorPanelProps {
  multiCharacterMode: boolean;
  onToggleCharacterMode: () => void;
  selectedAvatars: string[];
  onSelectAvatar?: (filename: string) => void;
  onSelectAvatars?: (filenames: string[]) => void;
  onImportFile?: (file: File, objectUrl: string) => void;
  measurements: Measurements;
  onMeasurementsChange: (measurements: Measurements) => void;
  exportHandlers?: { exportSelectedToGLB?: () => Promise<void>; exportCurrentBVH?: () => Promise<void> } | null;
}

export default function InspectorPanel({
  multiCharacterMode,
  onToggleCharacterMode,
  selectedAvatars,
  onSelectAvatar,
  onSelectAvatars,
  onImportFile,
  measurements,
  onMeasurementsChange,
  exportHandlers,
}: InspectorPanelProps) {
  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/80 backdrop-blur">
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Character Mode</span>
            <button
              type="button"
              onClick={onToggleCharacterMode}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${multiCharacterMode ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
            >
              {multiCharacterMode ? 'Multi' : 'Single'}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white/60">
            <AvatarGrid
              onSelectAvatar={!multiCharacterMode ? onSelectAvatar : undefined}
              onSelectAvatars={multiCharacterMode ? onSelectAvatars : undefined}
              selectedAvatars={selectedAvatars}
              multiCharacterMode={multiCharacterMode}
              maxCharacters={4}
              className="w-full"
              fullHeight={false}
              scrollable={false}
            />
          </div>
          <ImportPanel onImportFile={onImportFile} variant="compact" />
        </TabsContent>
        <TabsContent value="properties" className="p-4 space-y-4">
          <MeasurementControls
            initialMeasurements={measurements}
            onChange={onMeasurementsChange}
          />
        </TabsContent>
        <TabsContent value="export" className="p-4">
          <ExportPanel
            onExportGLB={exportHandlers?.exportSelectedToGLB}
            onExportBVH={exportHandlers?.exportCurrentBVH}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
