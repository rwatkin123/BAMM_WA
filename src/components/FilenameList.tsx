"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
interface Props {
    onSelectFile: (filename: string) => void;
  }
export default function FilenameList({onSelectFile}:Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const filelist = await axios.get('/api/listfile');
        setFiles(filelist.data.files);
      } catch (error) {
        console.error("Error fetching file list:", error);
      }
    };

    fetchFiles();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const filename = e.target.value;
    setSelected(filename);
    onSelectFile(filename);
    
  };

  return (
    <div className="p-2 w-full ">
      
      <div className="relative ">
        <select
          id="file-select"
          value={selected}
          onChange={handleChange}
          className="border px-3 py-2 rounded-md w-full truncate overflow-hidden text-ellipsis"
        >
          <option value="">-- Select a file --</option>
          {files.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
