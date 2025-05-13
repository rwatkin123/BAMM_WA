// /public/main.js
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';



// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a001a); // Deep purple background
scene.fog = new THREE.Fog(0x0a001a, 10, 100); // Add atmospheric fog
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('model-viewer').appendChild(renderer.domElement);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 2;
controls.enableZoom = true;
controls.enablePan = true;
controls.enableRotate = true; 




// Camera rotation variables
let cameraAngle = Math.PI / 12; 
let cameraRadius = 15; 
let cameraHeight = 8; 
// const minCameraHeight = 1;
// const maxCameraHeight = 20;

// user interaction
let isUserInteracting = false;
let lastLookAt = new THREE.Vector3(0, 0, 0);
let lastCameraHeight = cameraHeight;

// user interaction events
controls.addEventListener('start', () => { isUserInteracting = true; });
controls.addEventListener('end', () => {
    isUserInteracting = false;
    cameraAngle = Math.atan2(camera.position.z, camera.position.x);
    cameraRadius = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
    lastLookAt.copy(controls.target);
    lastCameraHeight = camera.position.y;
});



// Camera entrance animation
let cameraIntroAnimating = true;
let cameraIntroStartRadius = 200;
let cameraIntroTargetRadius = cameraRadius;
let cameraIntroDuration = 6; // seconds
let cameraIntroElapsed = 0;

// Set initial camera position for intro
cameraRadius = cameraIntroStartRadius;
camera.position.x = cameraRadius * Math.cos(cameraAngle) +15 ;
camera.position.z = cameraRadius * Math.sin(cameraAngle) + 15 ;
camera.position.y = cameraHeight;
camera.lookAt(0, 5, 0);

// Create a plane (ground)
const planeGeometry = new THREE.PlaneGeometry(50, 50);
const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x111111, // Darker color
    side: THREE.DoubleSide,
    roughness: 0.2, // More glossy
    metalness: 0.7, // More reflective
    emissive: 0x000000
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -0.1;
plane.receiveShadow = true;
scene.add(plane);

// Load king character model
const loader = new GLTFLoader();
let kingModel;
let mixer;
let currentModel;
let animationQueue = [];
let isPlayingSequence = false;

const ANIMATIONS = {
    SKILL: 'pl_king_face01_skill_b',
    COMBO_A: 'pl_king_face01_combo_a',
    COMBO_B: 'pl_king_face01_combo_b',
    COMBO_C: 'pl_king_face01_combo_c'
};

function findAnimation(animations, name) {
    return animations.find(clip => clip.name === name);
}

function playNextAnimation() {
    if (animationQueue.length > 0) {
        const nextAnim = animationQueue.shift();
        if (currentAnimation) {
            // Fade out current animation
            currentAnimation.fadeOut(0.5);
        }
        
        // Fade in next animation
        currentAnimation = nextAnim;
        currentAnimation.reset();
        currentAnimation.fadeIn(0.5);
        currentAnimation.play();
        
        // When this animation finishes, play the next one
        const duration = currentAnimation.getClip().duration;
        setTimeout(() => {
            playNextAnimation();
        }, duration * 1000);
    } else {
        isPlayingSequence = false;
        // Restart the sequence
        startAnimationSequence();
    }
}

function startAnimationSequence() {
    if (!isPlayingSequence && mixer) {
        isPlayingSequence = true;
        
        // Get all animations from the mixer
        const animations = mixer._actions.map(action => action.getClip());
        
        // Create animation actions in sequence
        animationQueue = [
            mixer.clipAction(findAnimation(animations, ANIMATIONS.SKILL)),
            mixer.clipAction(findAnimation(animations, ANIMATIONS.COMBO_A)),
            mixer.clipAction(findAnimation(animations, ANIMATIONS.COMBO_B)),
            mixer.clipAction(findAnimation(animations, ANIMATIONS.COMBO_C))
        ];
        
        // Start the sequence
        playNextAnimation();
    }
}

// Character definitions
const CHARACTERS = [
    {
        name: 'King',
        modelPath: '/assets/king.glb',
        scale: 2.8,
        position: { x: 0, y: 0, z: 0 }, 
        animation: 'pl_king_face01_skill_b'
    },
    {
        name: 'Venom',
        modelPath: '/assets/venom.glb',
        scale: 2,
        position: { x: 0, y: 0, z: 0 }, 
        animation: '103541_Shackle'
    },
    {
        name: 'Torch',
        modelPath: '/assets/human_torch.glb',
        scale: 3.2,
        position: { x: 0, y: 0, z: 0 }, 
        animation: 'HoverToFull'
    },
    {
        name: 'Batman',
        modelPath: '/assets/batman.glb',
        scale: 2.5,
        position: { x: 0, y: 0, z: 0 }, 
        animation: 'Batman_Emote_CrossArms'
    }
];

// model switching code
let currentCharacterIndex = 0;
const MODEL_SWITCH_INTERVAL = 12000; 
let isTransitioning = false;
let transitionProgress = 0;
const TRANSITION_DURATION = 1.5;

function startFadeTransition(model) {
    if (!model) return;
    
    isTransitioning = true;
    transitionProgress = 0;
    model.traverse((node) => {
        if (node.isMesh && node.material) {
            node.material.transparent = true;
            node.material.opacity = 1;
        }
    });
}

function updateFadeTransition(deltaTime) {
    if (!isTransitioning || !currentModel) return;
    
    transitionProgress += deltaTime;
    const progress = Math.min(transitionProgress / TRANSITION_DURATION, 1);
    currentModel.traverse((node) => {
        if (node.isMesh && node.material) {
            node.material.opacity = 1 - progress;
        }
    });
    
    if (progress >= 1) {
        isTransitioning = false;
    }
}

// Update model info display
function updateModelInfo(character) {
    const modelName = document.querySelector('.model-name');
    const modelDescription = document.querySelector('.model-description');
    
    if (modelName && modelDescription) {
        modelName.textContent = character.name;
        modelDescription.textContent = `Experience the ${character.name} model with stunning animations`;
    }
}

// Modify loadModel function
function loadModel(character, onLoad) {
    loader.load(
        character.modelPath,
        (gltf) => {
            const model = gltf.scene;
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    // Ensure materials are properly configured
                    if (node.material) {
                        node.material.transparent = true;
                        node.material.opacity = 1; // Start fully visible
                        node.material.needsUpdate = true;
                        // Ensure proper material properties
                        node.material.roughness = 0.5;
                        node.material.metalness = 0.5;
                    }
                }
            });
            
            // Apply character-specific settings
            model.position.set(
                character.position.x,
                character.position.y,
                character.position.z
            );
            model.scale.set(character.scale, character.scale, character.scale);
            
            // Remove current model if it exists
            if (currentModel) {
                scene.remove(currentModel);
                if (mixer) {
                    mixer.stopAllAction();
                    mixer.uncacheRoot(currentModel);
                }
            }
            
            scene.add(model);
            currentModel = model;
            
            // Set up animation
            mixer = new THREE.AnimationMixer(model);
            const animations = gltf.animations;
            
            if (animations && animations.length) {
                const skillAnim = mixer.clipAction(animations.find(clip => clip.name === character.animation));
                if (skillAnim) {
                    skillAnim.setLoop(THREE.LoopRepeat);
                    skillAnim.timeScale = 0.5;
                    skillAnim.play();
                }
            }
            
            // Update model info
            updateModelInfo(character);
            
            if (onLoad) onLoad(model);
        },
        (xhr) => {
            console.log(character.name + ': ' + (xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('Error loading model:', error);
        }
    );
}

function loadNextCharacter() {
    if (isTransitioning) return;
    
    if (currentModel) {
        startFadeTransition(currentModel);
        setTimeout(() => {
            currentCharacterIndex = (currentCharacterIndex + 1) % CHARACTERS.length;
            const nextCharacter = CHARACTERS[currentCharacterIndex];
            console.log('Switching to character:', nextCharacter.name);
            loadModel(nextCharacter);
        }, TRANSITION_DURATION * 1000);
    } else {
        currentCharacterIndex = (currentCharacterIndex + 1) % CHARACTERS.length;
        const nextCharacter = CHARACTERS[currentCharacterIndex];
        console.log('Switching to character:', nextCharacter.name);
        loadModel(nextCharacter);
    }
}

// Load initial character
loadModel(CHARACTERS[0]);

// Set up character rotation
setInterval(loadNextCharacter, MODEL_SWITCH_INTERVAL);

// Load neon stage model
loader.load(
    '/assets/neon_stage.glb',
    (gltf) => {
        const model = gltf.scene;
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material.polygonOffset = true;
                    node.material.polygonOffsetFactor = 1;
                    node.material.polygonOffsetUnits = 1;
                    // Ensure consistent material properties
                    node.material.roughness = 0.5;
                    node.material.metalness = 0.5;
                }
            }
        });
        model.position.set(0, 0.01, 0);
        model.scale.set(5, 5, 5);
        scene.add(model);
    },
    (xhr) => {
        console.log('Neon stage: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading neon stage model:', error);
    }
);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Increased ambient light
scene.add(ambientLight);

// Main directional light (very subtle)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // Increased directional light
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Add colored directional lights for crystal highlights
const dirLightMagenta = new THREE.DirectionalLight(0xff00ff, 0.5);
dirLightMagenta.position.set(10, 10, 0);
dirLightMagenta.target.position.set(0, 0, 0);
scene.add(dirLightMagenta);
scene.add(dirLightMagenta.target);

dirLightMagenta.castShadow = true;
dirLightMagenta.shadow.mapSize.width = 2048;
dirLightMagenta.shadow.mapSize.height = 2048;

const dirLightCyan = new THREE.DirectionalLight(0x00ffff, 0.3);
dirLightCyan.position.set(-10, 8, 8);
dirLightCyan.target.position.set(0, 0, 0);
scene.add(dirLightCyan);
scene.add(dirLightCyan.target);

dirLightCyan.castShadow = true;
dirLightCyan.shadow.mapSize.width = 2048;
dirLightCyan.shadow.mapSize.height = 2048;

const dirLightBlue = new THREE.DirectionalLight(0x0000ff, 0.2);
dirLightBlue.position.set(0, 12, -10);
dirLightBlue.target.position.set(0, 0, 0);
scene.add(dirLightBlue);
scene.add(dirLightBlue.target);

dirLightBlue.castShadow = true;
dirLightBlue.shadow.mapSize.width = 2048;
dirLightBlue.shadow.mapSize.height = 2048;

// Add spotlight for the king
const kingSpotLight = new THREE.SpotLight(0xffffff,100);
kingSpotLight.position.set(0, 15, 0);
kingSpotLight.angle = Math.PI / 4; // 45 degrees
kingSpotLight.penumbra = 0.3;
kingSpotLight.decay = 1;
kingSpotLight.distance = 50;
kingSpotLight.castShadow = true;
kingSpotLight.shadow.mapSize.width = 2048;
kingSpotLight.shadow.mapSize.height = 2048;
kingSpotLight.shadow.camera.near = 0.5;
kingSpotLight.shadow.camera.far = 50;
scene.add(kingSpotLight);

// Add side spotlights
const leftSpotLight = new THREE.SpotLight(0xff00ff, 20); // Magenta
leftSpotLight.position.set(-15, 8, 0);
leftSpotLight.angle = - Math.PI / 6; // 30 degrees
leftSpotLight.penumbra = 0.3;
leftSpotLight.decay = 1;
leftSpotLight.distance = 50;
leftSpotLight.castShadow = true;
leftSpotLight.shadow.mapSize.width = 2048;
leftSpotLight.shadow.mapSize.height = 2048;
scene.add(leftSpotLight);

const rightSpotLight = new THREE.SpotLight(0x00ffff, 20); // Cyan
rightSpotLight.position.set(15, 8, 0);
rightSpotLight.angle = Math.PI / 6; // 30 degrees
rightSpotLight.penumbra = 0.3;
rightSpotLight.decay = 1;
rightSpotLight.distance = 50;
rightSpotLight.castShadow = true;
rightSpotLight.shadow.mapSize.width = 2048;
rightSpotLight.shadow.mapSize.height = 2048;
scene.add(rightSpotLight);

// Center targets for all spotlights
const spotLightTarget = new THREE.Object3D();
spotLightTarget.position.set(0, 0, 0);
scene.add(spotLightTarget);
kingSpotLight.target = spotLightTarget;
leftSpotLight.target = spotLightTarget;
rightSpotLight.target = spotLightTarget;

// Position camera
camera.position.set(15, 10, 15);
camera.lookAt(0, 0, 0);

// Update window resize handler
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

// Animation loop
function animate(time) {
    requestAnimationFrame(animate);
    time = time ? time / 1000 : 0;
    
    const deltaTime = 1/60; 

    if (mixer) {
        mixer.update(deltaTime);
    }
    
    // Update fade transition
    updateFadeTransition(deltaTime);
    
    if (currentModel) {
        spotLightTarget.position.copy(currentModel.position);
    }
    
    // Camera intro animation
    if (cameraIntroAnimating) {
        cameraIntroElapsed += 1 / 60; // Approximate frame time
        let t = Math.min(cameraIntroElapsed / cameraIntroDuration, 1);
        // Ease out (smooth)
        t = 1 - Math.pow(1 - t, 3);
        cameraAngle += 0.005; // Rotate during intro
        cameraRadius = cameraIntroStartRadius + (cameraIntroTargetRadius - cameraIntroStartRadius) * t;
        camera.position.x = cameraRadius * Math.cos(cameraAngle);
        camera.position.z = cameraRadius * Math.sin(cameraAngle);
        camera.position.y = cameraHeight;
        camera.lookAt(0, 0, 0);
        if (t >= 1) {
            cameraIntroAnimating = false;
        }
    } else if (!isUserInteracting) {
        cameraAngle += 0.005;
        camera.position.x = cameraRadius * Math.cos(cameraAngle);
        camera.position.z = cameraRadius * Math.sin(cameraAngle);
        camera.position.y = lastCameraHeight;
        camera.lookAt(lastLookAt);
    }
    controls.update();
    renderer.render(scene, camera);
}

animate();