import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils";

interface CanvasProps {
  bvhFile: string | null; // Received BVH filename
  trigger?: boolean;
}

export default function Canvas({ bvhFile,trigger }: CanvasProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);


  useEffect(() => {
    if (!sceneRef.current) return;
  
    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc"); // Tailwind's gray-50
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
    
    


  
    // Lights and camera...
    // (keep your existing light + grid + camera setup code)
  
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.set(1, 2, 3);
  
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.NoToneMapping; // ✅ This is supported
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
  
    // ⚠️ Clear old canvas if present
    if (sceneRef.current.firstChild) {
      sceneRef.current.removeChild(sceneRef.current.firstChild);
    }
    sceneRef.current.appendChild(renderer.domElement);
  
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.target.set(0, 1, 0);
  
    // 🟢 Load GLB always, and BVH optionally
    async function setupModels() {
      const loader = new GLTFLoader();
      const targetModel: any = await new Promise((resolve, reject) => {
        loader.load('/mesh/mesh.glb', resolve, undefined, reject);
      });

      const audioPath = localStorage.getItem("audio");
      if (audioPath) {
        const audio = new Audio(audioPath);
        audio.play().catch(err => console.warn("Audio playback failed:", err));
      }

  
      scene.add(targetModel.scene);

      targetModel.scene.traverse((child) => {
        if (child.isSkinnedMesh) {
          child.skeleton.pose(); // apply the bind pose manually
          child.updateMatrixWorld(true);
        }
      });

// Compute model bounding box
const box = new THREE.Box3().setFromObject(targetModel.scene);
const size = new THREE.Vector3();
box.getSize(size);
const center = new THREE.Vector3();
box.getCenter(center);

// Align feet with floor
targetModel.scene.position.y -= box.min.y;
targetModel.scene.position.x -= size.x * 0.5; // shift avatar left


// Adjust camera to fit full body
const modelHeight = size.y;
const distance = modelHeight * 2.2; // Zoom out based on height
camera.position.set(center.x - modelHeight * 0.5, modelHeight * 1.1, center.z + distance);

// Target around chest/hip height
controls.target.set(center.x, modelHeight * 0.55, center.z);
controls.update();



      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

  
      let mixer = null;
  
      // If we have BVH, animate
      if (bvhFile) {
        const sourceModel: any = await new Promise((resolve, reject) => {
          new BVHLoader().load(bvhFile, resolve, undefined, reject);
        });
  
        const source = getSource(sourceModel);
        mixer = retargetModel(source, targetModel);

        // 🔊 Play audio after BVH loads
// 🔊 Play audio after BVH loads
// 🔊 Play audio after BVH loads

if (!audioRef.current) {
  audioRef.current = new Audio('/068_294.wav');
  audioRef.current.loop = true;

  audioRef.current.addEventListener('canplaythrough', () => {
    audioRef.current?.play().catch((err) => {
      console.warn("Audio playback failed:", err);
    });
  });

  audioRef.current.load();
}




  
        //const skeletonHelper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
        // scene.add(sourceModel.skeleton.bones[0]);
        //scene.add(skeletonHelper);
      }
  
      function animate() {
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
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
  }, [bvhFile, trigger]);  // will re-run on prompt generation
  

  return <div ref={sceneRef} className="h-full bg-gray-100" />;
}

function getSource(sourceModel) {
  const clip = sourceModel.clip;
  const helper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
  const skeleton = new THREE.Skeleton(helper.bones);
  const mixer = new THREE.AnimationMixer(sourceModel.skeleton.bones[0]);
  mixer.clipAction(sourceModel.clip).play();
  return { clip, skeleton, mixer };
}

function retargetModel(source, targetModel) {
  const targetSkin = targetModel.scene.children[0];
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, {
    hip: 'Hips',
    // scale: 0.6,
    getBoneName: function (bone) {
      return bone.name;
    }
  });
  const mixer = new THREE.AnimationMixer(targetSkin);
  retargetedClip.tracks.forEach((track) => {
    if (track.name.includes('Hips') && track.name.endsWith('.position')) {
      const values = track.values.slice(); // Clone values
      const firstY = values[1]; // First keyframe Y
      for (let i = 1; i < values.length; i += 3) {
        values[i] -= firstY; // Dynamically center hips at y = 0
      }
      track.values = values;
    }
  });
  
  
  
  mixer.clipAction(retargetedClip).play();
  return mixer;
}
