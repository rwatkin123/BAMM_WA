import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Slider } from "./ui/slider";

interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
}

export default function Canvas({ bvhFile, trigger }: CanvasProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState([0, 0]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const trimRangeRef = useRef(trimRange);
  trimRangeRef.current = trimRange;

  useEffect(() => {
    if (duration > 0) {
      setTrimRange([0, duration]);
    }
  }, [duration]);

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
    camera.position.set(1, 2, 3);

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

    let mixer: THREE.AnimationMixer | null = null;

    async function setupModels() {
      const loader = new GLTFLoader();
      const targetModel: any = await new Promise((resolve, reject) => {
        loader.load('/mesh/mesh.glb', resolve, undefined, reject);
      });

      scene.add(targetModel.scene);

      targetModel.scene.traverse((child: any) => {
        if (child.isSkinnedMesh) {
          child.skeleton.pose();
          child.updateMatrixWorld(true);
        }
      });

      const box = new THREE.Box3().setFromObject(targetModel.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      targetModel.scene.position.y -= box.min.y;
      targetModel.scene.position.x -= size.x * 0.5;

      const modelHeight = size.y;
      const distance = modelHeight * 2.2;
      camera.position.set(center.x - modelHeight * 0.5, modelHeight * 1.1, center.z + distance);
      controls.target.set(center.x, modelHeight * 0.55, center.z);
      controls.update();

      if (bvhFile) {
        const sourceModel: any = await new Promise((resolve, reject) => {
          new BVHLoader().load(bvhFile, resolve, undefined, reject);
        });

        const source = getSource(sourceModel);
        mixer = retargetModel(source, targetModel);
        mixerRef.current = mixer;
        setDuration(source.clip.duration);

        const audioPath = localStorage.getItem("audio");
        const audioEnabled = localStorage.getItem("audio_enabled") === "true";

        if (audioEnabled && audioPath) {
          audioRef.current = new Audio(audioPath);
          audioRef.current.load();
        }
      }

      function animate() {
        const delta = clock.getDelta();
        if (mixer && isPlayingRef.current) {
          if (mixer.time >= trimRangeRef.current[1]) {
            mixer.setTime(trimRangeRef.current[1]);
            if (audioRef.current)
              audioRef.current.currentTime = trimRangeRef.current[1];
            setIsPlaying(false);
            mixer.timeScale = 0;
            if (audioRef.current) audioRef.current.pause();
          } else {
            mixer.update(delta);
            setProgress(mixer.time);
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
    };
  }, [bvhFile, trigger]);

  const handlePlayPause = () => {
    if (mixerRef.current) {
      if (isPlaying) {
        mixerRef.current.timeScale = 0;
      } else {
        if (
          mixerRef.current.time < trimRange[0] ||
          mixerRef.current.time >= trimRange[1]
        ) {
          mixerRef.current.setTime(trimRange[0]);
          setProgress(trimRange[0]);
        }
        mixerRef.current.timeScale = 1;
      }
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (
          audioRef.current.currentTime < trimRange[0] ||
          audioRef.current.currentTime >= trimRange[1]
        ) {
          audioRef.current.currentTime = trimRange[0];
        }
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (newTime: number) => {
    const clampedTime = Math.max(trimRange[0], Math.min(newTime, trimRange[1]));
    if (mixerRef.current) {
      mixerRef.current.setTime(clampedTime);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
    setProgress(clampedTime);
  };

  const handleTrimRangeChange = (newRange: number[]) => {
    setTrimRange(newRange);
    let currentProgress = progress;
    if (currentProgress < newRange[0]) {
      currentProgress = newRange[0];
    }
    if (currentProgress > newRange[1]) {
      currentProgress = newRange[1];
    }
    if (mixerRef.current) {
      mixerRef.current.setTime(currentProgress);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = currentProgress;
    }
    setProgress(currentProgress);
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div ref={sceneRef} className="h-full bg-gray-100" />
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: 20 }}>
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
          }}
        >
          <button
            onClick={handlePlayPause}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <span className="text-sm">
            {progress.toFixed(2)}s / {duration.toFixed(2)}s | Trim:{" "}
            {trimRange[0].toFixed(2)}s - {trimRange[1].toFixed(2)}s
          </span>
        </div>
      </div>
    </div>
  );
}

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
