"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Plus, Trash2 } from "lucide-react";
import axios from 'axios';
import FileUploadButton from "./FileUploadButton";

interface ChatbotProps {
  onFileReceived: (filename: string) => void;
  onSend: () => void;
  onAvatarUpdate: () => void;
  selectedModel?: string;
}

// API endpoints for different models
const MODEL_ENDPOINTS = {
  bamm: "https://relaxing-guiding-sailfish.ngrok-free.app",
  maskcontrol: "", // TODO: Add endpoint when available
  dancemosaic: "", // TODO: Add endpoint when available
};

type EditOperation = 'prefix' | 'in-between' | 'suffix';

export default function Chatbot({ onFileReceived, onSend, onAvatarUpdate, selectedModel = 'bamm' }: ChatbotProps) {
  const port = MODEL_ENDPOINTS[selectedModel as keyof typeof MODEL_ENDPOINTS] || MODEL_ENDPOINTS.bamm;
  const [textFields, setTextFields] = useState<string[]>([""]);
  const [submittedData, setSubmittedData] = useState<string[] | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editOperation, setEditOperation] = useState<EditOperation>('in-between');
  
  const [fileName, setFileName] = useState<string | null>(null);

  // State for new editing inputs
  const [prefixPrompt, setPrefixPrompt] = useState("");
  const [prefixDuration, setPrefixDuration] = useState(2);
  const [suffixPrompt, setSuffixPrompt] = useState("");
  const [suffixDuration, setSuffixDuration] = useState(2);
  const [inBetweenPrompt, setInBetweenPrompt] = useState("");
  const [inBetweenTime, setInBetweenTime] = useState(0);
  const [inBetweenEndTime, setInBetweenEndTime] = useState(2);


  const addTextField = (index: number) => {
    const newFields = [...textFields];
    newFields.splice(index + 1, 0, "");
    setTextFields(newFields);
  };

  const removeTextField = (index: number) => {
    if (textFields.length <= 1) return;
    const newFields = [...textFields];
    newFields.splice(index, 1);
    setTextFields(newFields);
  };

  const updateTextField = (index: number, value: string) => {
    const newFields = [...textFields];
    newFields[index] = value;
    setTextFields(newFields);
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFields.some(field => field.trim() !== '')) return;

    onSend();
    const dataArray = textFields.filter(field => field.trim() !== '');
    setSubmittedData(dataArray);

    try {
      const formData = {
        text_prompt: dataArray,
        motion_length: -1,
        repeat_times: 1,
        gpu_id: 0,
        seed: 1,
        ext: "generation_fast"
      };

      const response = await axios.post(
        port + '/generate-motion',
        formData,
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );

      if (response.status !== 200) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = response.data;

      if (data.filenames) {
        setFileName(data.filenames);
        localStorage.removeItem("audio_enabled"); // 🚫 prevent audio from playing
        localStorage.removeItem("audio");   
        onFileReceived(`${port}/mesh/public/${data.filenames}`);
        setIsEditing(true);
      } else {
        console.error("No BVH files returned from backend.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onSend();

    let url = '';
    let payload: any = {};

    switch(editOperation) {
      case 'prefix':
        url = port + '/add-motion-prefix';
        payload = {
          text_prompt: [prefixPrompt],
          filename: fileName,
          motion_length: prefixDuration,
        };
        break;
      case 'in-between':
        url = port + '/add-motion-inbetween';
        payload = {
          text_prompt: [inBetweenPrompt],
          filename: fileName,
          start_time: inBetweenTime,
          end_time: inBetweenEndTime,
        };
        break;
      case 'suffix':
        url = port + '/add-motion-suffix';
        payload = {
          text_prompt: [suffixPrompt],
          filename: fileName,
          motion_length: suffixDuration,
        };
        break;
    }
    
    // Common motion generation parameters
    payload = {
      ...payload,
      repeat_times: 1,
      gpu_id: 0,
      seed: 1,
      ext: "generation_fast",
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (response.status !== 200) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = response.data;

      if (data.filenames) {
        setFileName(data.filenames);
        localStorage.removeItem("audio_enabled"); // 🚫 prevent audio from playing
        localStorage.removeItem("audio");
        onFileReceived(`${port}/mesh/public/${data.filenames}`);
        onAvatarUpdate();
        
        // Reset input fields after successful submission
        setPrefixPrompt("");
        setInBetweenPrompt("");
        setSuffixPrompt("");

      } else {
        console.error("No BVH files returned from backend.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <form
      onSubmit={isEditing ? handleEditSubmit : handleInitialSubmit}
      className="w-full h-full bg-transparent flex flex-col gap-3 p-3 justify-between"
      style={{ minHeight: 340, maxWidth: 340 }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <span className="font-bold text-lg text-gray-800">{isEditing ? "Edit Motion" : "Motion Chatbot"}</span>
        </div>
        <span className="text-xs text-gray-500">
          {isEditing 
            ? "Add new motions to the animation using the tabs below."
            : "Describe the motion you want to generate. Add multiple prompts for batch generation."}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {isEditing ? (
          <div className="flex flex-col gap-3">
            {/* TABS */}
            <div className="flex w-full bg-gray-100 rounded-lg p-1">
              <button type="button" onClick={() => setEditOperation('prefix')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${editOperation === 'prefix' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
                Prefix
              </button>
              <button type="button" onClick={() => setEditOperation('in-between')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${editOperation === 'in-between' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
                In-between
              </button>
              <button type="button" onClick={() => setEditOperation('suffix')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${editOperation === 'suffix' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
                Suffix
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {editOperation === 'prefix' && (
                <>
                  <Input value={prefixPrompt} onChange={e => setPrefixPrompt(e.target.value)} placeholder="Describe prefix motion" className="bg-white/90" />
                  <Input type="number" value={prefixDuration} onChange={e => setPrefixDuration(parseFloat(e.target.value) || 0)} placeholder="Duration (s)" min={0.1} step={0.1} className="bg-white/90" />
                </>
              )}
              {editOperation === 'in-between' && (
                <>
                  <Input value={inBetweenPrompt} onChange={e => setInBetweenPrompt(e.target.value)} placeholder="Describe in-between motion" className="bg-white/90"/>
                  <div className="flex gap-2">
                    <Input type="number" value={inBetweenTime} onChange={e => setInBetweenTime(parseFloat(e.target.value) || 0)} placeholder="Start time (s)" min={0} step={0.1} className="bg-white/90" />
                    <Input type="number" value={inBetweenEndTime} onChange={e => setInBetweenEndTime(parseFloat(e.target.value) || 0)} placeholder="End time (s)" min={0.1} step={0.1} className="bg-white/90" />
                  </div>
                </>
              )}
              {editOperation === 'suffix' && (
                <>
                  <Input value={suffixPrompt} onChange={e => setSuffixPrompt(e.target.value)} placeholder="Describe suffix motion" className="bg-white/90"/>
                  <Input type="number" value={suffixDuration} onChange={e => setSuffixDuration(parseFloat(e.target.value) || 0)} placeholder="Duration (s)" min={0.1} step={0.1} className="bg-white/90" />
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {textFields.map((text, index) => (
              <div key={index} className="flex items-center gap-2 bg-white/90 border border-gray-100 rounded-lg px-3 py-2 shadow-sm relative">
                <Input
                  value={text}
                  onChange={(e) => updateTextField(index, e.target.value)}
                  placeholder={`Describe motion #${index + 1}`}
                  className="flex-grow border-none bg-transparent focus:ring-0 text-sm px-0"
                />
                {textFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTextField(index)}
                    className="ml-2 text-gray-300 hover:text-red-500 transition"
                    aria-label="Remove prompt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isEditing && (
        <button
          type="button"
          onClick={() => addTextField(textFields.length - 1)}
          className="flex items-center gap-1 self-start text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded transition"
        >
          <Plus className="w-4 h-4" /> Add prompt
        </button>
      )}

      <div className="flex gap-2 pt-2">
        <FileUploadButton onFileReceived={onFileReceived} />
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 shadow-md transition text-base font-semibold border-none"
        >
          <Send className="h-5 w-5" />
          {isEditing ? "Add Motion" : "Generate"}
        </Button>
      </div>
    </form>
  );
}