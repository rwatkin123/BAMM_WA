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

  useEffect(() => {
    if (!sceneRef.current || !bvhFile) return;

    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 3, 25);

    // Lighting setup
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    const keyLight = new THREE.DirectionalLight(0xfff9ea, 4);
    keyLight.position.set(300, 500, 300);
    scene.add(keyLight);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(1, 2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.target.set(0, 1, 0);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.27;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const grid = new THREE.GridHelper(200, 200, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // **Replace existing canvas if it exists**
    if (sceneRef.current.firstChild) {
      sceneRef.current.removeChild(sceneRef.current.firstChild);
    }
    sceneRef.current.appendChild(renderer.domElement);
    THREE.Cache.enabled = false;

    async function setupModels() {
      const [sourceModel, targetModel]:any[] = await Promise.all([
        new Promise((resolve, reject) => {
          new BVHLoader().load(bvhFile, resolve, undefined, reject);
        }),
        new Promise((resolve, reject) => {
          new GLTFLoader().load('/mesh/mesh.glb', resolve, undefined, reject);
        })
      ]);

      const skeletonHelper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
      scene.add(sourceModel.skeleton.bones[0]);
      scene.add(skeletonHelper);
      scene.add(targetModel.scene);

      const source = getSource(sourceModel);
      const mixer = retargetModel(source, targetModel);

      function animate() {
        const delta = clock.getDelta();
        source.mixer.update(delta);
        mixer.update(delta);
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
  }, [bvhFile,trigger]); // Reload the effect whenever `bvhFile` changes

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
  mixer.clipAction(retargetedClip).play();
  return mixer;
}
