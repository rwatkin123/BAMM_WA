import * as THREE from "three";

export function setupSkyAndClouds(scene: THREE.Scene) {
  const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x87CEEB) },
      bottomColor: { value: new THREE.Color(0xffffff) },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide
  });
  
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
  
  const cloudGeometry = new THREE.SphereGeometry(1, 8, 8);
  const cloudMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.8 
  });
  
  for (let i = 0; i < 15; i++) {
    const cloudCluster = new THREE.Group();
    const sphereCount = Math.floor(Math.random() * 5) + 3;
    
    for (let j = 0; j < sphereCount; j++) {
      const cloudSphere = new THREE.Mesh(cloudGeometry, cloudMaterial);
      cloudSphere.position.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 2
      );
      cloudSphere.scale.setScalar(Math.random() * 0.8 + 0.5);
      cloudCluster.add(cloudSphere);
    }
    
    cloudCluster.position.set(
      (Math.random() - 0.5) * 200,
      Math.random() * 50 + 30,
      (Math.random() - 0.5) * 200
    );
    cloudCluster.scale.setScalar(Math.random() * 2 + 1);
    scene.add(cloudCluster);
  }
}

export function setupGround(scene: THREE.Scene) {
  const textureLoader = new THREE.TextureLoader();
  const gridTexture = textureLoader.load('/textures/grid.png');
  gridTexture.wrapS = THREE.RepeatWrapping;
  gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.repeat.set(1000, 1000);

  const groundMat = new THREE.MeshBasicMaterial({ map: gridTexture });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  plane.receiveShadow = true;
  scene.add(plane);
}

export function setupLighting(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0xffffff, 0.6);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.7, 100);
  pointLight.position.set(-10, 5, 10);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 100);
  pointLight2.position.set(10, 5, -10);
  scene.add(pointLight2);

  const spotLight = new THREE.SpotLight(0xffffff, 1.2, 50, Math.PI / 6, 0.3, 1);
  spotLight.position.set(0, 15, 5);
  spotLight.target.position.set(0, 0, 0);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.camera.near = 0.5;
  spotLight.shadow.camera.far = 50;
  scene.add(spotLight);
  scene.add(spotLight.target);

  const overheadLight1 = new THREE.PointLight(0xffffff, 0.8, 30);
  overheadLight1.position.set(-5, 8, 0);
  scene.add(overheadLight1);

  const overheadLight2 = new THREE.PointLight(0xffffff, 0.8, 30);
  overheadLight2.position.set(5, 8, 0);
  scene.add(overheadLight2);

  const warmLight = new THREE.PointLight(0xffe4b5, 0.6, 40);
  warmLight.position.set(0, 6, -8);
  scene.add(warmLight);
}