"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Minus, Plus } from "lucide-react";
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
    setTextFields([""]);
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
      className="w-full max-w-4xl mx-auto bg-white/90 shadow-2xl backdrop-blur-md 
                 border border-gray-200 rounded-2xl px-5 py-4 flex flex-col gap-4"
    >
      <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <span className="text-lg">🎬</span> Generate Motion Prompt
      </div>

      {textFields.map((text, index) => (
        <div key={index} className="flex items-center gap-2 w-full">
          {/* +/- buttons */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeTextField(index)}
              disabled={textFields.length <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => addTextField(index)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Text input */}
          <Input
            value={text}
            onChange={(e) => updateTextField(index, e.target.value)}
            placeholder={`Describe motion #${index + 1}`}
            className="flex-grow rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
          />

          {/* Only show upload + generate on first row */}
          {index === 0 && (
            <>
              <FileUploadButton onFileReceived={onFileReceived} />
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
                           text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-md transition"
              >
                <Send className="h-4 w-4" />
                Generate
              </Button>
            </>
          )}
        </div>
      ))}
    </form>
  );
}