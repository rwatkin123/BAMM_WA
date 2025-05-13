"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default function ThreeCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a001a);
    scene.fog = new THREE.Fog(0x0a001a, 10, 100);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableRotate = true;

    let cameraAngle = Math.PI / 12;
    let cameraRadius = 15;
    let cameraHeight = 8;
    let isUserInteracting = false;
    let lastLookAt = new THREE.Vector3(0, 0, 0);
    let lastCameraHeight = cameraHeight;

    controls.addEventListener("start", () => (isUserInteracting = true));
    controls.addEventListener("end", () => {
      isUserInteracting = false;
      cameraAngle = Math.atan2(camera.position.z, camera.position.x);
      cameraRadius = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
      lastLookAt.copy(controls.target);
      lastCameraHeight = camera.position.y;
    });

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        side: THREE.DoubleSide,
        roughness: 0.2,
        metalness: 0.7,
        emissive: 0x000000,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.1;
    plane.receiveShadow = true;
    scene.add(plane);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.set(0, 15, 0);
    spotlight.castShadow = true;
    scene.add(spotlight);

    const spotlightTarget = new THREE.Object3D();
    spotlightTarget.position.set(0, 0, 0);
    scene.add(spotlightTarget);
    spotlight.target = spotlightTarget;

    const loader = new GLTFLoader();
    const CHARACTERS = [
      { name: "King", modelPath: "/assets/king.glb", scale: 2.8, animation: "pl_king_face01_skill_b" },
      { name: "Venom", modelPath: "/assets/venom.glb", scale: 2.0, animation: "103541_Shackle" },
      { name: "Torch", modelPath: "/assets/human_torch.glb", scale: 3.2, animation: "HoverToFull" },
      //{ name: "Batman", modelPath: "/assets/batman.glb", scale: 2.5, animation: "Batman_Emote_CrossArms" }
    ];

    let currentModel: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let currentIndex = 0;

    const loadModel = (character: typeof CHARACTERS[0]) => {
      loader.load(
        character.modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(character.scale, character.scale, character.scale);
          model.position.set(0, 0, 0);
          model.traverse((node: any) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              node.material.roughness = 0.5;
              node.material.metalness = 0.5;
            }
          });

          if (currentModel) scene.remove(currentModel);
          currentModel = model;
          scene.add(model);

          spotlightTarget.position.copy(model.position);

          mixer = new THREE.AnimationMixer(model);
          const anim = gltf.animations.find(a => a.name === character.animation);
          if (anim) {
            const action = mixer.clipAction(anim);
            action.reset().fadeIn(0.5).play();
          }
        },
        undefined,
        (err) => console.error("Error loading model:", err)
      );
    };

    loadModel(CHARACTERS[currentIndex]);
    setInterval(() => {
      currentIndex = (currentIndex + 1) % CHARACTERS.length;
      loadModel(CHARACTERS[currentIndex]);
    }, 12000);

    loader.load("/assets/neon_stage.glb", (gltf) => {
      const stage = gltf.scene;
      stage.scale.set(5, 5, 5);
      stage.position.set(0, 0.01, 0);
      stage.traverse((node: any) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(stage);
    });

    const clock = new THREE.Clock();
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 0, 0);

    const animate = () => {
      requestAnimationFrame(animate);
      if (!isUserInteracting) {
        cameraAngle += 0.005;
        camera.position.x = cameraRadius * Math.cos(cameraAngle);
        camera.position.z = cameraRadius * Math.sin(cameraAngle);
        camera.position.y = lastCameraHeight;
        camera.lookAt(lastLookAt);
      }
      controls.update();
      if (mixer) mixer.update(clock.getDelta());
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      canvasRef.current?.removeChild(renderer.domElement);
    };

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", handleResize);
  }, []);

  return <div ref={canvasRef} id="model-viewer" />;
}
