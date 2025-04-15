"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Paperclip } from "lucide-react"
import { Minus, Plus } from "lucide-react"
import axios from 'axios';
import create_glb from '@components/create_glb'
import FileUploadButton from "./FileUploadButton";

import FilenameList from "./FilenameList";

interface ChatbotProps {
  onFileReceived: (filename: string) => void;  // Callback function to send filename to parent
  onSend: () => void; // Callback function to trigger loading state
  onAvatarUpdate: () => void;

}



export default function Chatbot({ onFileReceived, onSend,onAvatarUpdate }: ChatbotProps) {
  const [textFields, setTextFields] = useState<string[]>([""])
  const [submittedData, setSubmittedData] = useState<string[] | null>(null)
  const [avatarname,setAvatarname]=useState(null);
  const addTextField = (index: number) => {
    const newFields = [...textFields]
    // Insert a new empty field after the current index
    newFields.splice(index + 1, 0, "")
    setTextFields(newFields)
  }

  const removeTextField = (index: number) => {
    // Don't allow removing the last remaining field
    if (textFields.length <= 1) return

    const newFields = [...textFields]
    newFields.splice(index, 1)
    setTextFields(newFields)
  }

  const handleAvatarUpdate=async (filename:any)=>{
    setAvatarname(filename);
    console.log(filename)
    let val=await create_glb(filename);
    console.log(val);
    onAvatarUpdate();

  }

  const updateTextField = (index: number, value: string) => {
    const newFields = [...textFields]
    newFields[index] = value
    setTextFields(newFields)
  }
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (textFields) {
      onSend(); // Trigger loading screen before making request
      setTextFields([""]);

      const dataArray = [...textFields]

    // Set the submitted data
      setSubmittedData(dataArray)

      try {
        const formData = { "text_prompt": dataArray };

        const response = await axios.post('https://f311-152-15-112-165.ngrok-free.app/generate', formData);

        if (response.status !== 200) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.data;
        onFileReceived(data.filename); // Send filename to parent component

      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex items-center px-2 space-x-2">
      <div className="flex flex-col flex-1">
      {textFields.map((text, index) => (
            <div key={index} className="flex items-center m-1 space-x-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeTextField(index)}
                disabled={textFields.length === 1}
                aria-label="Remove this field"
              >
                <Minus className="h-4 w-4" />
              </Button>

              <Input
                value={text}
                onChange={(e) => updateTextField(index, e.target.value)}
                placeholder={`Field ${index + 1}`}
                className="flex-grow"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addTextField(index)}
                aria-label="Add field below"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
      {/* <Input
        placeholder="Please Enter your character description here"
        className="flex-1"
      /> */}
      <div className="flex-1">
      < FilenameList onSelectFile={handleAvatarUpdate} />
      </div>
      
      <FileUploadButton onFileReceived={onFileReceived} />
      <Button type="submit" size="icon">
        <Send className="h-4 w-4" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}
