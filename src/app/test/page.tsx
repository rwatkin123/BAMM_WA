'use client';
import React, { useEffect } from 'react';
import loadModel from '@/components/create_glb';

export default function TestPage() {
  useEffect(() => {
    const generateGLB = async () => {
      const glbBuffer = await loadModel("Batman");

      if (glbBuffer) {
        const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);

        // Automatically download the file
        const link = document.createElement('a');
        link.href = url;
        link.download = 'donald_trump_model.glb';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Or just log the URL
        console.log('Download URL:', url);
      }
    };

    generateGLB();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h2>Testing .glb Generation</h2>
      <p>Check the download or console for the exported model.</p>
    </main>
  );
}
