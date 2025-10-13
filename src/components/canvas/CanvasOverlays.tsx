import React from "react";
import Chatbot from "@/components/Chatbot";

interface CanvasOverlaysProps {
  loadingCharacters: boolean;
  selectedCharacters: string[];
  onFileReceived?: (filename: string) => void;
  onSend?: () => void;
  onAvatarUpdate?: () => void;
}

export function CanvasOverlays({
  loadingCharacters,
  selectedCharacters,
  onFileReceived,
  onSend,
  onAvatarUpdate
}: CanvasOverlaysProps) {
  return (
    <>
      <div className="absolute top-6 left-6 z-50 flex max-w-xs flex-col gap-3">
        {loadingCharacters && (
          <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span>Loading {selectedCharacters.length} character{selectedCharacters.length !== 1 ? 's' : ''}...</span>
            </div>
          </div>
        )}

        {selectedCharacters.length > 0 && !loadingCharacters && (
          <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Characters</div>
            <div className="mt-1 text-sm font-medium text-slate-700">
              {selectedCharacters.length} {selectedCharacters.length === 1 ? 'character' : 'characters'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedCharacters.map(char => char.split(' ')[0]).join(', ')}
            </div>
          </div>
        )}
      </div>

      <div className="absolute top-6 right-6 bottom-6 z-50 flex flex-col gap-4">
        <div className="w-72 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                🪙
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Credits</h3>
                <p className="text-xs text-slate-500">Token management</p>
              </div>
            </div>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              type="button"
            >
              Refill
            </button>
          </div>

          <div className="space-y-4 text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Available tokens</span>
                <span className="text-base font-semibold text-slate-800">1,247</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Ready for motion generation</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-slate-500">Motion generations</span>
                <span className="text-base font-semibold text-slate-800">~24 remaining</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Based on current usage</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Usage progress</span>
                <span className="font-medium text-slate-700">78%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: '78%' }}></div>
              </div>
            </div>

            <div className="flex justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <span>Used: 342 tokens</span>
              <span>Total: 1,589 tokens</span>
            </div>
          </div>
        </div>

        <div className="w-72 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-lg backdrop-blur">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                🤖
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Motion AI</h3>
                <p className="text-xs text-slate-500">Generate animations</p>
              </div>
            </div>
          </div>
          {onFileReceived && onSend && onAvatarUpdate && (
            <div className="px-4 py-4">
              <Chatbot
                onFileReceived={onFileReceived}
                onSend={onSend}
                onAvatarUpdate={onAvatarUpdate}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}