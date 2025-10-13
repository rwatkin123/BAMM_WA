import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { saveAs } from "file-saver";
import create_glb from "@/components/create_glb";
import { useCharacterControls } from "@/contexts/CharacterControlsContext";
import { parseAssetReference } from "@/lib/assetReference";
import { CanvasProps, RetargetResult, ModelMetadata } from "@/types/three";
import { remapClipBoneBindings } from "@/lib/three/retargeting/retargetHelpers";
import { normalizeCharacterScale } from "@/lib/three/utils/scaleNormalization";
import { getCharacterPosition, updateCameraForMultipleCharacters } from "@/lib/three/utils/characterPositioning";
import { getSource } from "@/lib/three/loaders/bvhLoader";
import { retargetModel } from "@/lib/three/retargeting";
import { setupSkyAndClouds, setupGround, setupLighting } from "@/lib/three/scene/setupScene";
import { CanvasOverlays } from "./CanvasOverlays";

const CanvasComponent = ({ 
  bvhFile, 
  trigger, 
  selectedCharacters = [],
  onProgressChange,
  onDurationChange,
  onTrimRangeChange,
  onFileReceived,
  onSend,
  onAvatarUpdate,
  onExportHandlersReady,
  onPlaybackHandlersReady,
  onPlayStateChange,
}: CanvasProps) => {

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const clockRef = useRef(new THREE.Clock());

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const trimRangeRef = useRef<[number, number]>([0, 0]);
  useEffect(() => { trimRangeRef.current = trimRange; }, [trimRange]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);

  const modelsRef = useRef<THREE.Object3D[]>([]);
  const modelMetadataRef = useRef<ModelMetadata[]>([]);
  const skeletonHelpersRef = useRef<THREE.Object3D[]>([]);
  const sceneRef_three = useRef<THREE.Scene | null>(null);
  const animationClipsRef = useRef<THREE.AnimationClip[]>([]);
  const lastSourceRef = useRef<{ clip: THREE.AnimationClip; skeleton: THREE.Skeleton } | null>(null);
  const bvhUrlRef = useRef<string | null>(null);

  const {
    characterScale,
    setCharacterScale,
    characterRotation,
    setCharacterRotation,
    wireframe,
    setWireframe,
    showSkeleton,
    setShowSkeleton
  } = useCharacterControls();

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const exportSelectedToGLB = useCallback(async () => {
    const models = modelsRef.current;
    if (!models || models.length === 0) {
      throw new Error("No characters available to export.");
    }

    const source = lastSourceRef.current;
    if (!source) {
      throw new Error("No animation available. Generate or load motion before exporting.");
    }

    const exporter = new GLTFExporter();
    const exportGroup = new THREE.Group();
    const exportClips: THREE.AnimationClip[] = [];

    models.forEach((model, index) => {
      const clone = SkeletonUtils.clone(model);
      clone.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          const isStandard = (mat as any).isMeshStandardMaterial;
          const isBasic = (mat as any).isMeshBasicMaterial;
          if (!isStandard && !isBasic) {
            const color = (mat.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(0xffffff);
            const skinning = Boolean(mat.skinning);
            child.material = new THREE.MeshStandardMaterial({ color, skinning, metalness: 0.1, roughness: 0.9 });
          }
        }
      });
      exportGroup.add(clone);

      const metadata = modelMetadataRef.current[index] || {
        displayName: selectedCharacters[index] || `character_${index + 1}`,
        isMixamo: false,
        source: selectedCharacters[index] || `character_${index + 1}`,
      };

      const targetWrapper = { scene: clone };
      let exportResult: RetargetResult | null;

      if (metadata.isMixamo) {
        exportResult = retargetModel(source, targetWrapper, true, metadata.source);
        normalizeCharacterScale(targetWrapper, 0.0011);
      } else {
        exportResult = retargetModel(source, targetWrapper, false, metadata.source);
      }

      if (exportResult) {
        const clip = exportResult.clip.clone();
        remapClipBoneBindings(clip, clone);
        if (!clip.name) {
          clip.name = `Animation_${exportClips.length + 1}`;
        }
        exportClips.push(clip);
        exportResult.mixer.stopAllAction();
        exportResult.mixer.uncacheRoot(clone);
      }
    });

    if (exportClips.length === 0) {
      throw new Error("Failed to retarget animation for export.");
    }

    exportGroup.updateMatrixWorld(true);

    const arrayBuffer = await exporter.parseAsync(exportGroup, {
      binary: true,
      animations: exportClips,
      onlyVisible: true,
      truncateDrawRange: true,
    });

    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Exporter returned invalid data.");
    }

    const fileHint = selectedCharacters[0] || "avatar";
    const baseName = fileHint.split("/").pop()?.replace(/\.[^/.]+$/, "") || "avatar";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${baseName}-${stamp}.glb`;

    const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
    saveAs(blob, filename);
  }, [selectedCharacters]);

  const exportCurrentBVH = useCallback(async () => {
    const bvhUrl = bvhUrlRef.current;
    if (!bvhUrl) {
      throw new Error("No BVH animation available to export.");
    }

    const response = await fetch(bvhUrl, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download BVH (status ${response.status}).`);
    }

    const blob = await response.blob();
    let filename = bvhUrl.split('/').pop() || 'animation.bvh';
    if (!/\.bvh$/i.test(filename)) {
      const metaName = modelMetadataRef.current[0]?.displayName || 'animation';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `${metaName}-${stamp}.bvh`;
    }

    saveAs(blob, filename);
  }, []);

  useEffect(() => {
    if (onExportHandlersReady) {
      onExportHandlersReady({ exportSelectedToGLB, exportCurrentBVH });
    }
  }, [onExportHandlersReady, exportSelectedToGLB, exportCurrentBVH]);

  useEffect(() => {
    bvhUrlRef.current = bvhFile;
  }, [bvhFile]);

  useEffect(() => {
    console.log('[DEBUG] Canvas useEffect triggered', {
      selectedCharacters,
      bvhFile,
      trigger,
      showSkeleton
    });
    if (duration > 0) {
      setTrimRange([0, duration] as [number, number]);
      if (onDurationChange) {
        onDurationChange(duration);
      }
    }
  }, [duration, onDurationChange]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const clock = clockRef.current;
    const scene = new THREE.Scene();
    sceneRef_three.current = scene;
    
    setupSkyAndClouds(scene);
    setupGround(scene);

    const container = sceneRef.current;
    const { clientWidth, clientHeight } = container;

    const viewportWidth = clientWidth > 0 ? clientWidth : window.innerWidth;
    const viewportHeight = clientHeight > 0 ? clientHeight : window.innerHeight;

    const camera = new THREE.PerspectiveCamera(
      45,
      viewportWidth / viewportHeight,
      1,
      2000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(viewportWidth, viewportHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    if (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 1, 0);

    setupLighting(scene);

    let mixers: THREE.AnimationMixer[] = [];
    modelsRef.current = [];
    skeletonHelpersRef.current.forEach(helper => scene.remove(helper));
    skeletonHelpersRef.current = [];

    async function setupModels() {
      const loader = new GLTFLoader();
      const fbxLoader = new FBXLoader();
      const targetModels: any[] = [];
      
      mixers = [];
      mixersRef.current = [];
      animationClipsRef.current = [];
      modelMetadataRef.current = [];

      if (selectedCharacters.length === 0) {
        try {
          const targetModel: any = await new Promise((resolve, reject) => {
            loader.load('/mesh/mesh.glb', resolve, undefined, reject);
          });

          scene.add(targetModel.scene);
          targetModel.scene.userData = targetModel.scene.userData || {};
          targetModel.scene.userData.modelName = "default";
          modelsRef.current = [targetModel.scene];
          modelMetadataRef.current = [{ displayName: "default", isMixamo: false, source: '/mesh/mesh.glb' }];

          targetModel.scene.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              child.skeleton.pose();
              child.updateMatrixWorld(true);
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const { scaleFactor, groundOffset } = normalizeCharacterScale(targetModel);
          targetModel.scene.userData.characterScaleMultiplier = characterScale;
          targetModel.scene.scale.setScalar(scaleFactor * characterScale);
          targetModel.scene.position.y = groundOffset;

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
        setLoadingCharacters(true);
        
        for (let i = 0; i < selectedCharacters.length; i++) {
          const reference = selectedCharacters[i];
          const asset = parseAssetReference(reference);
          const label = asset.filename || reference;
          const extension = asset.extension;
          const isMixamoSource = Boolean(extension === 'fbx' || reference.includes('/mixamo/'));
          const position = getCharacterPosition(i, selectedCharacters.length);

          try {
            console.log(`Loading character ${i + 1}/${selectedCharacters.length}: ${label}`);
            let targetModel: any;

            if (isMixamoSource) {
              const fbx: any = await new Promise((resolve, reject) => {
                fbxLoader.load(asset.url, resolve, undefined, reject);
              });
              targetModel = { scene: fbx };
            } else if (extension === 'glb' || asset.url.startsWith('blob:')) {
              targetModel = await new Promise((resolve, reject) => {
                loader.load(asset.url, resolve, undefined, reject);
              });
            } else {
              await create_glb(reference);
              await new Promise(resolve => setTimeout(resolve, 500));
              targetModel = await new Promise((resolve, reject) => {
                loader.load(`/mesh/mesh.glb?t=${Date.now()}&char=${i}`, resolve, undefined, reject);
              });
            }

            scene.add(targetModel.scene);
            targetModel.scene.userData = targetModel.scene.userData || {};
            targetModel.scene.userData.modelName = label;
            modelsRef.current.push(targetModel.scene);
            modelMetadataRef.current.push({
              displayName: label,
              isMixamo: isMixamoSource,
              source: reference,
            });

            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                child.skeleton.pose();
                child.updateMatrixWorld(true);
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const { scaleFactor, groundOffset } = normalizeCharacterScale(targetModel, 2.0);
            targetModel.scene.userData.characterScaleMultiplier = characterScale;
            targetModel.scene.scale.setScalar(scaleFactor * characterScale);
            targetModel.scene.position.y = groundOffset;
            console.log(`Character ${i + 1} (${label}) scaled by: ${scaleFactor.toFixed(3)}`);

            targetModel.scene.position.x += position[0];
            targetModel.scene.position.z += position[2];

            targetModels.push(targetModel);

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
            console.error(`Failed to load character ${label}:`, error);
          }
        }

        updateCameraForMultipleCharacters(camera, controls, selectedCharacters.length);
        setLoadingCharacters(false);
      }

      if (bvhFile && targetModels.length > 0) {
        try {
          const sourceModel: any = await new Promise((resolve, reject) => {
            fetch(bvhFile, {
              headers: {
                'ngrok-skip-browser-warning': 'true'
              }
            })
              .then(res => res.arrayBuffer())
              .then(buffer => {
                const loader = new BVHLoader();
                const result = loader.parse(new TextDecoder().decode(buffer));
                resolve(result);
              });
          });

          const source = getSource(sourceModel);
          lastSourceRef.current = source;
          
          animationClipsRef.current = [];

          const retargetResults = targetModels.map((targetModel, index) => {
            const metadata = modelMetadataRef.current[index] || {
              displayName: selectedCharacters[index] || '',
              isMixamo: false,
              source: selectedCharacters[index] || '',
            };
            const { displayName, isMixamo, source: characterKey } = metadata;
            console.log(`Applying motion to character ${index + 1}: ${displayName}`);
            const retargetName = isMixamo ? characterKey : displayName;
            const result = retargetModel(source, targetModel, isMixamo, retargetName);
            return result;
          }).filter((result): result is RetargetResult => result !== null);

          mixers = retargetResults.map(result => result.mixer);
          animationClipsRef.current = retargetResults.map(result => result.clip);

          mixersRef.current = mixers;
          if (retargetResults.length > 0) {
            setDuration(retargetResults[0].clip.duration);
          } else {
            setDuration(0);
          }

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

      if (mixersRef.current.length > 0) {
        mixersRef.current.forEach(mixer => {
          mixer.setTime(trimRangeRef.current[0]);
          mixer.update(0);
        });
      }
    }

    setupModels().then(() => {
      if (mixersRef.current.length > 0) {
        mixersRef.current.forEach(mixer => {
          mixer.setTime(trimRangeRef.current[0]);
          mixer.update(0);
        });
      }
    });

    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();

      if (mixersRef.current.length && isPlayingRef.current) {
        const currentTime = mixersRef.current[0].time;

        if (currentTime >= trimRangeRef.current[1]) {
          mixersRef.current.forEach(m => m.setTime(trimRangeRef.current[1]));
          if (audioRef.current) audioRef.current.pause();
        } else {
          mixersRef.current.forEach(m => m.update(delta));
          setProgress(currentTime);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    });

    const onWindowResize = () => {
      if (!sceneRef.current) return;
      const { clientWidth: width, clientHeight: height } = sceneRef.current;
      if (height === 0 || width === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    window.addEventListener("resize", onWindowResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sceneRef.current) {
      resizeObserver = new ResizeObserver(() => {
        onWindowResize();
      });
      resizeObserver.observe(sceneRef.current);
    }
    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (resizeObserver && sceneRef.current) {
        resizeObserver.unobserve(sceneRef.current);
      }
      renderer.setAnimationLoop(null);
      renderer.dispose();
      mixers.forEach(mixer => mixer.stopAllAction());
    };
  }, [selectedCharacters, bvhFile, trigger, showSkeleton, characterScale]);

  useEffect(() => {
    modelsRef.current.forEach(model => {
      if (model) {
        const baseScale = (model as any)?.userData?.normalizedScale ?? 1;
        (model as any).userData = (model as any).userData || {};
        (model as any).userData.characterScaleMultiplier = characterScale;
        model.scale.setScalar(baseScale * characterScale);
        model.rotation.y = (characterRotation * Math.PI) / 180;
        model.traverse((child: any) => {
          if (child.isSkinnedMesh && child.material) {
            child.material.wireframe = wireframe;
            child.material.needsUpdate = true;
          }
        });
      }
    });
  }, [characterScale, characterRotation, wireframe]);

  useEffect(() => {
    const scene = sceneRef_three.current;
    if (!scene) return;

    skeletonHelpersRef.current.forEach(helper => {
      if (helper.parent) {
        helper.parent.remove(helper);
      }
    });
    skeletonHelpersRef.current = [];

    if (showSkeleton) {
      modelsRef.current.forEach(model => {
        if (model) {
          model.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              const helper = new THREE.SkeletonHelper(child);
              scene.add(helper);
              skeletonHelpersRef.current.push(helper);
            }
          });
        }
      });
    }
  }, [showSkeleton]);

  const handlePlayPause = useCallback(() => {
    const mixers = mixersRef.current;

    console.log("Play button clicked, mixers:", mixers.length);

    if (mixers.length > 0) {
      if (isPlaying) {
        console.log("Pausing mixers");
        mixers.forEach((mixer, index) => {
          mixer.timeScale = 0;
          console.log(`Mixer ${index} paused, current time:`, mixer.time);
        });
      } else {
        console.log("Starting mixers from time:", mixers[0]?.time || 0);
        
        mixers.forEach((mixer, index) => {
          if (mixer.time < trimRange[0] || mixer.time >= trimRange[1]) {
            mixer.setTime(trimRange[0]);
            console.log(`Mixer ${index} reset to:`, trimRange[0]);
          }
          
          mixer.timeScale = 1;
          console.log(`Mixer ${index} started, timeScale:`, mixer.timeScale, "time:", mixer.time);
        });
        
        if (mixers[0]) {
          setProgress(mixers[0].time);
        }
      }
    } else {
      console.error("No mixers available!");
    }

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
    
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    isPlayingRef.current = nextState;
    onPlayStateChange?.(nextState);
    console.log("Play state changed to:", nextState);
  }, [trimRange, onPlayStateChange, isPlaying]);

  const handleSeek = useCallback((newTime: number) => {
    const clampedTime = Math.max(trimRange[0], Math.min(newTime, trimRange[1]));
    const mixers = mixersRef.current;
    mixers.forEach(mixer => {
      mixer.setTime(clampedTime);
      mixer.update(0);
    });
    if (audioRef.current) audioRef.current.currentTime = clampedTime;
    setProgress(clampedTime);
    if (!isPlayingRef.current && rendererRef.current && sceneRef_three.current && cameraRef.current) {
      rendererRef.current.render(sceneRef_three.current, cameraRef.current);
    }
  }, [trimRange]);

  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(progress);
    }
  }, [progress, onProgressChange]);

  useEffect(() => {
    if (onPlaybackHandlersReady) {
      const handlers = {
        play: () => {
          if (!isPlayingRef.current) {
            handlePlayPause();
          }
        },
        pause: () => {
          if (isPlayingRef.current) {
            handlePlayPause();
          }
        },
        seek: (time: number) => {
          handleSeek(time);
        },
        toggle: () => {
          handlePlayPause();
        },
      };
      onPlaybackHandlersReady(handlers);
    }
  }, [onPlaybackHandlersReady, handlePlayPause, handleSeek]);

  return (
    <div style={{ position: "relative", height: "100%" }} className="bg-slate-50">
      <div ref={sceneRef} className="h-full" />
      
      <CanvasOverlays
        loadingCharacters={loadingCharacters}
        selectedCharacters={selectedCharacters}
        onFileReceived={onFileReceived}
        onSend={onSend}
        onAvatarUpdate={onAvatarUpdate}
      />
    </div>
  );
};

const Canvas = React.memo(CanvasComponent);

export default Canvas;