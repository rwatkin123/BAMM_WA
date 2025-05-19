"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Minus, Plus, Trash2 } from "lucide-react";
import axios from 'axios';
import create_glb from '@components/create_glb';
import FileUploadButton from "./FileUploadButton";

interface ChatbotProps {
  onFileReceived: (filename: string) => void;
  onSend: () => void;
  onAvatarUpdate: () => void;
}

export default function Chatbot({ onFileReceived, onSend, onAvatarUpdate }: ChatbotProps) {
  const [textFields, setTextFields] = useState<string[]>([""]);
  const [submittedData, setSubmittedData] = useState<string[] | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFields) return;

    onSend();
    const dataArray = [...textFields];
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
        'https://handy-lamb-enough.ngrok.app/generate-motion',
        formData,
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        }
      );

      if (response.status !== 200) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = response.data;

      if (data.filenames) {
        localStorage.removeItem("audio_enabled"); // 🚫 prevent audio from playing
        localStorage.removeItem("audio");   
        onFileReceived(`https://handy-lamb-enough.ngrok.app/mesh/public/${data.filenames}`);
      } else {
        console.error("No BVH files returned from backend.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg bg-white/80 shadow-2xl border border-gray-100 rounded-2xl px-8 py-7 flex flex-col gap-6 fixed bottom-8 right-8 z-50 backdrop-blur-lg"
      style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)'}}
    >
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <span className="font-bold text-lg text-gray-800">Motion Chatbot</span>
        </div>
        <span className="text-xs text-gray-500">Describe the motion you want to generate. Add multiple prompts for batch generation.</span>
      </div>
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

      <button
        type="button"
        onClick={() => addTextField(textFields.length - 1)}
        className="flex items-center gap-1 self-start text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded transition"
      >
        <Plus className="w-4 h-4" /> Add prompt
      </button>

      <div className="flex gap-2 mt-2">
        <FileUploadButton onFileReceived={onFileReceived} />
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 shadow-md transition text-base font-semibold border-none"
        >
          <Send className="h-5 w-5" />
          Generate
        </Button>
      </div>
    </form>
  );
}