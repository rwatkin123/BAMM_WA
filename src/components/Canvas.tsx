import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Slider } from "./ui/slider";
import create_glb from "./create_glb";

interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
  selectedCharacters: string[];
}

export default function Canvas({ 
  bvhFile, 
  trigger, 
  selectedCharacters = []
}: CanvasProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const clockRef = useRef(new THREE.Clock());

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState([0, 0]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const trimRangeRef = useRef(trimRange);
  trimRangeRef.current = trimRange;

  // --- Character transform controls ---
  const [characterScale, setCharacterScale] = useState(1.0); // 0.5 - 3.0
  const [characterRotation, setCharacterRotation] = useState(0); // degrees, 0-360

  // --- Skinning options ---
  const [wireframe, setWireframe] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Store references to loaded models for transform updates
  const modelsRef = useRef<any[]>([]);
  // Store skeleton helpers
  const skeletonHelpersRef = useRef<any[]>([]);

  useEffect(() => {
    if (duration > 0) {
      setTrimRange([0, duration]);
    }
  }, [duration]);

  // Helper function to normalize character scale
  const normalizeCharacterScale = (model: any, targetHeight: number = 2.0) => {
    const box = new THREE.Box3().setFromObject(model.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Calculate scale factor to make all characters the same height
    const currentHeight = size.y;
    const scaleFactor = targetHeight / currentHeight;
    
    console.log(`Character height: ${currentHeight.toFixed(2)} → Scaling by: ${scaleFactor.toFixed(3)}`);
    
    // Apply uniform scaling
    model.scene.scale.setScalar(scaleFactor);
    
    // Recalculate bounding box after scaling
    const newBox = new THREE.Box3().setFromObject(model.scene);
    
    // Position on ground
    model.scene.position.y = -newBox.min.y;
    
    return { scaleFactor, newBox };
  };

  // Helper function to calculate character positions
  const getCharacterPosition = (index: number, totalCharacters: number): [number, number, number] => {
    if (totalCharacters === 1) return [0, 0, 0];
    
    const spacing = 3; // Units between characters
    const startOffset = -(totalCharacters - 1) * spacing / 2;
    return [startOffset + index * spacing, 0, 0];
  };

  // Helper function to adjust camera for multiple characters
  const updateCameraForMultipleCharacters = (camera: THREE.PerspectiveCamera, controls: OrbitControls, characterCount: number) => {
    const baseDistance = 3;
    const distance = baseDistance + (characterCount - 1) * 1.2;
    const height = 2 + (characterCount - 1) * 0.3;
    
    camera.position.set(0, height, distance);
    controls.target.set(0, 1, 0);
    controls.update();
  };

  useEffect(() => {
    if (!sceneRef.current) return;

    const clock = clockRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    scene.fog = new THREE.Fog("#f8fafc", 3, 25);

    const textureLoader = new THREE.TextureLoader();
    const gridTexture = textureLoader.load('/textures/grid.png');
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(1000, 1000);

    const groundMat = new THREE.MeshBasicMaterial({ map: gridTexture });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    scene.add(plane);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (sceneRef.current.firstChild) {
      sceneRef.current.removeChild(sceneRef.current.firstChild);
    }
    sceneRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.target.set(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    let mixers: THREE.AnimationMixer[] = [];
    modelsRef.current = [];
    // Remove old skeleton helpers
    skeletonHelpersRef.current.forEach(helper => scene.remove(helper));
    skeletonHelpersRef.current = [];
    async function setupModels() {
      const loader = new GLTFLoader();
      const targetModels: any[] = [];
      
      // Clear previous mixers
      mixers = [];
      mixersRef.current = [];

      if (selectedCharacters.length === 0) {
        // NO CHARACTERS SELECTED: Show default mesh.glb
        try {
          const targetModel: any = await new Promise((resolve, reject) => {
            loader.load('/mesh/mesh.glb', resolve, undefined, reject);
          });

          scene.add(targetModel.scene);
          modelsRef.current = [targetModel.scene];

          targetModel.scene.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              child.skeleton.pose();
              child.updateMatrixWorld(true);
            }
          });

          // 🔧 NEW: Normalize default character scale
          normalizeCharacterScale(targetModel);

          // Center the single character
          const box = new THREE.Box3().setFromObject(targetModel.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          targetModel.scene.position.x -= size.x * 0.5;

          const modelHeight = size.y;
          const distance = modelHeight * 2.2;
          camera.position.set(center.x - modelHeight * 0.5, modelHeight * 1.1, center.z + distance);
          controls.target.set(center.x, modelHeight * 0.55, center.z);
          controls.update();

          targetModels.push(targetModel);

          // Add skeleton helper if enabled
          if (showSkeleton) {
            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                const helper = new THREE.SkeletonHelper(child);
                scene.add(helper);
                skeletonHelpersRef.current.push(helper);
              }
            });
          }
        } catch (error) {
          console.error("Failed to load default mesh.glb:", error);
        }
      } else {
        // MULTIPLE CHARACTERS SELECTED: Generate each character
        setLoadingCharacters(true);
        
        for (let i = 0; i < selectedCharacters.length; i++) {
          const characterName = selectedCharacters[i];
          const position = getCharacterPosition(i, selectedCharacters.length);

          try {
            console.log(`Loading character ${i + 1}/${selectedCharacters.length}: ${characterName}`);
            
            // Generate character GLB
            await create_glb(characterName);
            // Small delay to ensure file is written
            await new Promise(resolve => setTimeout(resolve, 500));

            // Load the generated character
            const targetModel: any = await new Promise((resolve, reject) => {
              loader.load(`/mesh/mesh.glb?t=${Date.now()}&char=${i}`, resolve, undefined, reject);
            });

            scene.add(targetModel.scene);
            modelsRef.current.push(targetModel.scene);

            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                child.skeleton.pose();
                child.updateMatrixWorld(true);
              }
            });

            // 🔧 NEW: Normalize character scale BEFORE positioning
            const { scaleFactor } = normalizeCharacterScale(targetModel, 2.0);
            console.log(`Character ${i + 1} (${characterName}) scaled by: ${scaleFactor.toFixed(3)}`);

            // NOW position the normalized character
            targetModel.scene.position.x += position[0];
            targetModel.scene.position.z += position[2];
            // Y position is already set by normalizeCharacterScale

            targetModels.push(targetModel);
            
            // Add skeleton helper if enabled
            if (showSkeleton) {
              targetModel.scene.traverse((child: any) => {
                if (child.isSkinnedMesh) {
                  const helper = new THREE.SkeletonHelper(child);
                  scene.add(helper);
                  skeletonHelpersRef.current.push(helper);
                }
              });
            }
          } catch (error) {
            console.error(`Failed to load character ${characterName}:`, error);
          }
        }

        // Update camera for multiple characters
        updateCameraForMultipleCharacters(camera, controls, selectedCharacters.length);
        setLoadingCharacters(false);
      }

      // Apply BVH motion to all characters
      if (bvhFile && targetModels.length > 0) {
        try {
          const sourceModel: any = await new Promise((resolve, reject) => {
            new BVHLoader().load(bvhFile, resolve, undefined, reject);
          });

          const source = getSource(sourceModel);
          
          // Create mixer for each character
          mixers = targetModels.map((targetModel, index) => {
            console.log(`Applying motion to character ${index + 1}`);
            const mixer = retargetModel(source, targetModel);
            return mixer;
          });

          mixersRef.current = mixers;
          setDuration(source.clip.duration);

          // Audio setup
          const audioPath = localStorage.getItem("audio");
          const audioEnabled = localStorage.getItem("audio_enabled") === "true";

          if (audioEnabled && audioPath) {
            audioRef.current = new Audio(audioPath);
            audioRef.current.load();
          }
        } catch (error) {
          console.error("Failed to load BVH file:", error);
        }
      }

      function animate() {
        const delta = clock.getDelta();
        
        // Update all mixers
        if (mixers.length > 0 && isPlayingRef.current) {
          const currentTime = mixers[0]?.time || 0;
          
          if (currentTime >= trimRangeRef.current[1]) {
            mixers.forEach(mixer => mixer.setTime(trimRangeRef.current[1]));
            if (audioRef.current) audioRef.current.currentTime = trimRangeRef.current[1];
            setIsPlaying(false);
            mixers.forEach(mixer => mixer.timeScale = 0);
            if (audioRef.current) audioRef.current.pause();
          } else {
            mixers.forEach(mixer => mixer.update(delta));
            setProgress(currentTime);
          }
        }
        
        controls.update();
        renderer.render(scene, camera);
      }

      renderer.setAnimationLoop(animate);
    }

    setupModels();

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("resize", onWindowResize);
      renderer.dispose();
      mixers.forEach(mixer => mixer.stopAllAction());
    };
  }, [selectedCharacters, bvhFile, trigger, showSkeleton]);

  // Update scale, rotation, and skinning options when controls change
  useEffect(() => {
    modelsRef.current.forEach(model => {
      if (model) {
        model.scale.setScalar(characterScale);
        model.rotation.y = (characterRotation * Math.PI) / 180;
        // Update skinning options for all SkinnedMesh children
        model.traverse((child: any) => {
          if (child.isSkinnedMesh && child.material) {
            child.material.wireframe = wireframe;
            child.material.needsUpdate = true;
          }
        });
      }
    });
  }, [characterScale, characterRotation, wireframe]);

  // 🔧 FIXED Play/Pause Handler with Debug Logging
  const handlePlayPause = () => {
    const mixers = mixersRef.current;
    
    console.log("Play button clicked, mixers:", mixers.length, "isPlaying:", isPlaying);
    
    if (mixers.length > 0) {
      if (isPlaying) {
        // PAUSE: Stop all mixers
        console.log("Pausing mixers");
        mixers.forEach((mixer, index) => {
          mixer.timeScale = 0;
          console.log(`Mixer ${index} paused, current time:`, mixer.time);
        });
      } else {
        // PLAY: Start all mixers
        console.log("Starting mixers from time:", mixers[0]?.time || 0);
        
        mixers.forEach((mixer, index) => {
          // If mixer is outside trim range, reset to start
          if (mixer.time < trimRange[0] || mixer.time >= trimRange[1]) {
            mixer.setTime(trimRange[0]);
            console.log(`Mixer ${index} reset to:`, trimRange[0]);
          }
          
          // Set time scale to 1 to play
          mixer.timeScale = 1;
          console.log(`Mixer ${index} started, timeScale:`, mixer.timeScale, "time:", mixer.time);
        });
        
        // Update progress to current position
        if (mixers[0]) {
          setProgress(mixers[0].time);
        }
      }
    } else {
      console.error("No mixers available!");
    }

    // Handle audio
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.currentTime < trimRange[0] || audioRef.current.currentTime >= trimRange[1]) {
          audioRef.current.currentTime = trimRange[0];
        }
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    }
    
    // Toggle play state
    setIsPlaying(!isPlaying);
    console.log("Play state changed to:", !isPlaying);
  };

  const handleSeek = (newTime: number) => {
    const clampedTime = Math.max(trimRange[0], Math.min(newTime, trimRange[1]));
    const mixers = mixersRef.current;
    
    mixers.forEach(mixer => mixer.setTime(clampedTime));
    if (audioRef.current) audioRef.current.currentTime = clampedTime;
    setProgress(clampedTime);
  };

  const handleTrimRangeChange = (newRange: number[]) => {
    setTrimRange(newRange);
    let currentProgress = progress;
    
    if (currentProgress < newRange[0]) currentProgress = newRange[0];
    if (currentProgress > newRange[1]) currentProgress = newRange[1];
    
    const mixers = mixersRef.current;
    mixers.forEach(mixer => mixer.setTime(currentProgress));
    if (audioRef.current) audioRef.current.currentTime = currentProgress;
    setProgress(currentProgress);
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div ref={sceneRef} className="h-full bg-gray-100" />
      
      {/* Character loading indicator */}
      {loadingCharacters && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm animate-pulse">
          Loading {selectedCharacters.length} Characters...
        </div>
      )}
      
      {/* Character count indicator */}
      {selectedCharacters.length > 0 && !loadingCharacters && (
        <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
          {selectedCharacters.length} Character{selectedCharacters.length > 1 ? 's' : ''}: {selectedCharacters.map(char => char.split(' ')[0]).join(', ')}
        </div>
      )}
      
      {/* 🔧 FIXED Controls Section */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 1000, // High z-index to ensure it's on top
          pointerEvents: "none", // Disable pointer events on container
        }}
      >
        {/* Slider container */}
        <div 
          style={{ 
            position: "relative", 
            width: "100%", 
            height: 20,
            pointerEvents: "auto" // Enable pointer events on slider
          }}
        >
          <Slider
            value={trimRange}
            max={duration}
            step={0.01}
            onValueChange={handleTrimRangeChange}
            className="w-full absolute"
          />
          <Slider
            value={[progress]}
            min={trimRange[0]}
            max={trimRange[1]}
            step={0.01}
            onValueChange={(value) => handleSeek(value[0])}
            className="w-full absolute"
            trackClassName="bg-transparent"
          />
        </div>
        
        {/* Controls container */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            pointerEvents: "auto", // Enable pointer events on controls
            zIndex: 1001, // Even higher z-index
          }}
        >
          {/* 🔧 FIXED Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={loadingCharacters}
            style={{
              padding: "8px 16px",
              backgroundColor: loadingCharacters ? "#94a3b8" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loadingCharacters ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              minWidth: "80px", // Minimum width
              minHeight: "36px", // Minimum height
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1002, // Highest z-index
              pointerEvents: "auto", // Explicitly enable clicks
              boxSizing: "border-box", // Ensure proper sizing
            }}
            onMouseEnter={(e) => {
              if (!loadingCharacters) {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingCharacters) {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }
            }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <span 
            className="text-sm"
            style={{ 
              pointerEvents: "none", // Text doesn't interfere
              userSelect: "none" 
            }}
          >
            {progress.toFixed(2)}s / {duration.toFixed(2)}s | Trim:{" "}
            {trimRange[0].toFixed(2)}s - {trimRange[1].toFixed(2)}s
          </span>
          
          {selectedCharacters.length > 1 && !loadingCharacters && (
            <span 
              className="text-sm text-green-600"
              style={{ 
                pointerEvents: "none", // Text doesn't interfere
                userSelect: "none" 
              }}
            >
              • {selectedCharacters.length} synchronized characters
            </span>
          )}
        </div>
      </div>

      {/* --- Character Transform & Skinning Controls --- */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 1100,
          background: "rgba(255,255,255,0.95)",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          padding: 16,
          minWidth: 220,
          pointerEvents: "auto",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 500 }}>Character Size</label>
          <Slider
            value={[characterScale]}
            min={0.5}
            max={3.0}
            step={0.01}
            onValueChange={([v]) => setCharacterScale(v)}
            className="w-full"
          />
          <span style={{ fontSize: 12 }}>{characterScale.toFixed(2)}x</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 500 }}>Character Rotation</label>
          <Slider
            value={[characterRotation]}
            min={0}
            max={360}
            step={1}
            onValueChange={([v]) => setCharacterRotation(v)}
            className="w-full"
          />
          <span style={{ fontSize: 12 }}>{characterRotation}&deg;</span>
        </div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={wireframe}
            onChange={e => setWireframe(e.target.checked)}
            id="wireframeToggle"
          />
          <label htmlFor="wireframeToggle" style={{ fontWeight: 500, cursor: "pointer" }}>
            Wireframe
          </label>
        </div>
        <div style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={e => setShowSkeleton(e.target.checked)}
            id="skeletonToggle"
          />
          <label htmlFor="skeletonToggle" style={{ fontWeight: 500, cursor: "pointer" }}>
            Show Skeleton
          </label>
        </div>
      </div>
    </div>
  );
}

// Helper functions remain the same
function getSource(sourceModel: any) {
  const clip = sourceModel.clip;
  const helper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
  const skeleton = new THREE.Skeleton(helper.bones);
  const mixer = new THREE.AnimationMixer(sourceModel.skeleton.bones[0]);
  mixer.clipAction(sourceModel.clip).play();
  return { clip, skeleton, mixer };
}

function retargetModel(source: any, targetModel: any) {
  const targetSkin = targetModel.scene.children[0];
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, {
    hip: 'Hips',
    getBoneName: function (bone: any) {
      return bone.name;
    }
  });
  const mixer = new THREE.AnimationMixer(targetSkin);
  retargetedClip.tracks.forEach((track: any) => {
    if (track.name.includes('Hips') && track.name.endsWith('.position')) {
      const values = track.values.slice();
      const firstY = values[1];
      for (let i = 1; i < values.length; i += 3) {
        values[i] -= firstY;
      }
      track.values = values;
    }
  });
  mixer.clipAction(retargetedClip).play();
  return mixer;
}