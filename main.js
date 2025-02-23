import * as THREE from 'three';

// Global variables
let scene, camera, renderer;
let roadSegments = [];
let buildings = [];
let car;
let carSpeed = 0.50;
let acceleration = 0.0000; // acceleration per frame
const roadSegmentLength = 50;
const numInitialSegments = 10;
let carZ = roadSegmentLength / 2; // start in the middle of the first segment
let npcs = [];

// Global variables for controlling NPC spawn and street lamps
const NPC_SPAWN_PROBABILITY = 0.10; // chance to spawn an NPC at each spot on sidewalk
let streetLampGroups = [];
let clock; // for animations

// Define lanes for car movement
const lanes = [-1.25, 1.25];  // lane 0 (left) and lane 1 (right)
let currentLane = 0; // start in lane one (left)
let targetX = lanes[currentLane];

function init() {
  // Create the scene and add some fog for depth
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.002);

  // Set background color to pure black for night sky
  scene.background = new THREE.Color(0x000000);

  // Add stars to the sky
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 500;
  const positions = new Float32Array(starsCount * 3);
  
  for (let i = 0; i < starsCount * 3; i += 3) {
    // Create stars in a dome shape above the scene
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // Only in top hemisphere
    const radius = 500 + Math.random() * 500; // Random distance between 500 and 1000
    
    positions[i] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = radius * Math.cos(phi) + 200; // Lift stars up
    positions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xFFFFFF,
    size: 10,
    sizeAttenuation: true
  });
  
  const starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);

  // Add a floor that extends far in all directions
  const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
  const floorMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333333, // Lighter grey for better visibility
    shininess: 0
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.1; // Slightly below the road level
  scene.add(floor);

  // Set up the camera – positioned above and behind the car
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(targetX, 2, carZ);
  camera.lookAt(new THREE.Vector3(targetX, 2, carZ + 10));

  // Create the WebGL renderer and attach it to the document
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lighting: ambient and directional for shadows and depth
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 50, 50);
  scene.add(directionalLight);

  // Create the initial road segments
  for (let i = 0; i < numInitialSegments; i++) {
    createRoadSegment(i * roadSegmentLength);
  }

  // Create a simple car as a red box, starting at the current lane (targetX)
  const carGeometry = new THREE.BoxGeometry(2, 1, 4);
  const carMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  car = new THREE.Mesh(carGeometry, carMaterial);
  car.position.set(targetX, 0.5, carZ);
  scene.add(car);

  // Initialize clock for animations
  clock = new THREE.Clock();

  // Listen for key presses to change lanes.
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "d") {
      // Move to lane one (left)
      currentLane = 0;
      targetX = lanes[currentLane];
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      // Move to lane two (right)
      currentLane = 1;
      targetX = lanes[currentLane];
    }
  });

  // Set an interval to spawn sidewalk decorations every 5 seconds.
  setInterval(spawnSidewalkDecorations, 5000);

  window.addEventListener("resize", onWindowResize, false);
  animate();
}

function spawnSidewalkDecorations() {
  // Choose a z position ahead of the car (e.g., 100 units ahead)
  const zPos = carZ + 100;
  // Create a decoration for the left sidewalk (x = -5) and right sidewalk (x = 5)
  const leftDecor = createSidewalkDecoration(-5, zPos);
  scene.add(leftDecor);

  const rightDecor = createSidewalkDecoration(5, zPos);
  scene.add(rightDecor);
}

function createSidewalkDecoration(x, z) {
  const decorGroup = new THREE.Group();

  // Randomly choose decoration type:
  // 0: Tree, 1: Bush, 2: Bench, 3: Street Lamp, 4: Bus Stop
  const decorationType = Math.floor(Math.random() * 5);

  if (decorationType === 0) {
    // Create a tree
    const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 16);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4A2F21 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.6;
    decorGroup.add(trunk);

    // Tree foliage: three layers with smooth shading and random rotation
    const foliageColors = [0x2E7D32, 0x388E3C, 0x43A047];
    for (let i = 0; i < 3; i++) {
      const radius = 0.6 - (i * 0.1);
      const height = 1;
      const radialSegments = 16;
      const foliageGeometry = new THREE.ConeGeometry(radius, height, radialSegments);
      const foliageMaterial = new THREE.MeshPhongMaterial({ 
        color: foliageColors[i],
        flatShading: false
      });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 1.2 + (i * 0.4);
      foliage.rotation.y = Math.random() * Math.PI * 2;
      decorGroup.add(foliage);
    }
  } else if (decorationType === 1) {
    // Create a bush
    const bush = createBush();
    bush.position.y = 0.0;
    decorGroup.add(bush);
  } else if (decorationType === 2) {
    // Create a bench and rotate it to face the proper direction
    const bench = createBench();
    bench.rotation.y = Math.PI / 2;
    bench.position.y = 0.0;
    decorGroup.add(bench);
  }
  // Additional decoration types (Street Lamp, Bus Stop) can be added here.

  // Position the entire decoration at the given (x, z) location
  decorGroup.position.set(x, 0, z);
  return decorGroup;
}

// Helper function to create a simple bench
function createBench() {
  const benchGroup = new THREE.Group();
  
  // Bench seat
  const seatGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.3);
  const seatMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
  const seat = new THREE.Mesh(seatGeometry, seatMaterial);
  seat.position.y = 0.5;
  benchGroup.add(seat);
  
  // Bench legs
  const legGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
  const legMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 });
  const legPositions = [
    [-0.35, 0.3, -0.1],
    [0.35, 0.3, -0.1],
    [-0.35, 0.3, 0.1],
    [0.35, 0.3, 0.1]
  ];
  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(pos[0], pos[1], pos[2]);
    benchGroup.add(leg);
  });
  
  return benchGroup;
}

// Helper function to create a bush from a few clustered spheres
function createBush() {
  const bushGroup = new THREE.Group();
  const bushMaterial = new THREE.MeshPhongMaterial({ color: 0x2E7D32 });
  
  // Main bush sphere
  const mainSphereGeometry = new THREE.SphereGeometry(0.3, 12, 12);
  const mainSphere = new THREE.Mesh(mainSphereGeometry, bushMaterial);
  mainSphere.position.set(0, 0.3, 0);
  bushGroup.add(mainSphere);
  
  // Add extra smaller spheres for a fuller, natural look
  for (let i = 0; i < 3; i++) {
    const sphereGeometry = new THREE.SphereGeometry(0.2, 12, 12);
    const sphere = new THREE.Mesh(sphereGeometry, bushMaterial);
    sphere.position.set(
      (Math.random() - 0.5) * 0.4,
      0.25 + Math.random() * 0.1,
      (Math.random() - 0.5) * 0.4
    );
    bushGroup.add(sphere);
  }
  
  return bushGroup;
}

function createStreetLamp() {
  const lampGroup = new THREE.Group();
  
  // Lamp post
  const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
  const postMaterial = new THREE.MeshPhongMaterial({ color: 0xAAAAAA });
  const post = new THREE.Mesh(postGeometry, postMaterial);
  post.position.y = 0.75;
  lampGroup.add(post);
  
  // Lamp head
  const headGeometry = new THREE.SphereGeometry(0.15, 8, 8);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFE0 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.55;
  lampGroup.add(head);
  
  // Create a point light at the lamp head position
  const lampLight = new THREE.PointLight(0xFFFFE0, 1, 5);
  lampLight.position.copy(head.position);
  lampGroup.add(lampLight);
  
  // Add light pool (animated light effect on ground)
  const poolGeometry = new THREE.CircleGeometry(0.5, 32);
  const poolMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFE0, opacity: 0.5, transparent: true });
  const lightPool = new THREE.Mesh(poolGeometry, poolMaterial);
  lightPool.rotation.x = -Math.PI / 2;
  lightPool.position.set(head.position.x, 0.05, head.position.z);
  lampGroup.add(lightPool);
  lampGroup.userData.lightPool = lightPool;
  
  // Determine light mode randomly:
  // 0: blinking, 1: always on, 2: always off.
  const mode = Math.floor(Math.random() * 3);
  if (mode === 1) {
    lampLight.intensity = 1;
  } else if (mode === 2) {
    lampLight.intensity = 0;
  } else if (mode === 0) {
    // For blinking mode, start with intensity 0; it will be updated in the animation loop.
    lampLight.intensity = 0;
    lampGroup.userData.blinkFrequency = 3; // adjust frequency as needed
  }
  
  // Store the mode and light reference for updates
  lampGroup.userData.lightMode = mode;
  lampGroup.userData.lampLight = lampLight;
  
  // Update function: handles blinking (if applicable) and animates the light pool
  lampGroup.userData.update = function(elapsedTime) {
    const frequency = lampGroup.userData.blinkFrequency || 1;
    if (lampGroup.userData.lightMode === 0) {
      // Blink: toggle intensity between 0 and 1 based on a sine wave
      const intensity = (Math.sin(elapsedTime * frequency) > 0) ? 1 : 0;
      lampGroup.userData.lampLight.intensity = intensity;
    }
    // Animate the light pool with a pulsating effect
    const pulse = 0.1 * Math.sin(elapsedTime * frequency * 2);
    lampGroup.userData.lightPool.scale.set(1 + pulse, 1 + pulse, 1 + pulse);
    lampGroup.userData.lightPool.material.opacity = 0.5 + pulse;
  };
  
  // Add this lamp to our global array so we can update it each frame
  streetLampGroups.push(lampGroup);
  
  return lampGroup;
}

function createSidewalkNPC(zPosition, side) {
  const npcGroup = new THREE.Group();
  
  // Body (capsule-like shape)
  const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: Math.random() > 0.5 ? 0x2196F3 : 0xF44336 // Random blue or red clothing
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.6;
  npcGroup.add(body);
  
  // Head
  const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0xFFE0B2 }); // Skin tone
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.4;
  npcGroup.add(head);
  
  // Position on sidewalk
  npcGroup.position.set(
    side * 4, // Position on left (-4) or right (4) sidewalk
    0,
    zPosition
  );
  
  // Add to scene and NPCs array
  scene.add(npcGroup);
  npcs.push({
    mesh: npcGroup,
    type: 'sidewalk',
    side: side,
    speed: 0.05 + Math.random() * 0.03, // Walking speed
    direction: Math.random() > 0.5 ? 1 : -1 // Walking forward or backward
  });
}

function createRoadSegment(zStart) {
  // Create a plane for the road segment
  const roadGeometry = new THREE.PlaneGeometry(6, roadSegmentLength);
  const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.z = zStart + roadSegmentLength / 2;
  scene.add(road);
  roadSegments.push({ mesh: road, start: zStart, end: zStart + roadSegmentLength });

  // Add sidewalks on both sides
  const sidewalkWidth = 2;
  const sidewalkGeometry = new THREE.PlaneGeometry(sidewalkWidth, roadSegmentLength);
  const sidewalkMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x999999,
  });

  // Left sidewalk
  const leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
  leftSidewalk.rotation.x = -Math.PI / 2;
  leftSidewalk.position.set(
    -4, // Road width/2 + sidewalk width/2
    0.05, // Slightly above road
    zStart + roadSegmentLength / 2
  );
  scene.add(leftSidewalk);

  // Right sidewalk
  const rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
  rightSidewalk.rotation.x = -Math.PI / 2;
  rightSidewalk.position.set(
    4, // Road width/2 + sidewalk width/2
    0.05, // Slightly above road
    zStart + roadSegmentLength / 2
  );
  scene.add(rightSidewalk);

  // Add curbs (small vertical planes)
  const curbHeight = 0.15;
  const curbGeometry = new THREE.PlaneGeometry(roadSegmentLength, curbHeight);
  const curbMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });

  // Left curb
  const leftCurb = new THREE.Mesh(curbGeometry, curbMaterial);
  leftCurb.rotation.x = -Math.PI / 2;
  leftCurb.rotation.z = Math.PI / 2;
  leftCurb.position.set(
    -3, // Road width/2
    curbHeight / 2,
    zStart + roadSegmentLength / 2
  );
  scene.add(leftCurb);

  // Right curb
  const rightCurb = new THREE.Mesh(curbGeometry, curbMaterial);
  rightCurb.rotation.x = -Math.PI / 2;
  rightCurb.rotation.z = Math.PI / 2;
  rightCurb.position.set(
    3, // Road width/2
    curbHeight / 2,
    zStart + roadSegmentLength / 2
  );
  scene.add(rightCurb);

  // Use the same material for all lines
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // ----- Dashed Center Line -----
  const numCenterDashes = 10;        // Number of dash segments for the center line
  const centerDashLength = 2;        // Length of each dash segment
  const centerDashGap = (roadSegmentLength - (numCenterDashes * centerDashLength)) / (numCenterDashes + 1);

  for (let i = 0; i < numCenterDashes; i++) {
    const dashGeometry = new THREE.PlaneGeometry(0.2, centerDashLength);
    const dash = new THREE.Mesh(dashGeometry, lineMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(
      0, 
      0.01, 
      zStart + centerDashGap + (i * (centerDashLength + centerDashGap)) + (centerDashLength / 2)
    );
    scene.add(dash);
  }

  // ----- Filled Side Lines -----
  // Left side line
  const sideLineGeometry = new THREE.PlaneGeometry(0.2, roadSegmentLength);
  const leftLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
  leftLine.rotation.x = -Math.PI / 2;
  leftLine.position.set(-2.5, 0.01, zStart + roadSegmentLength / 2);
  scene.add(leftLine);

  // Right side line
  const rightLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
  rightLine.rotation.x = -Math.PI / 2;
  rightLine.position.set(2.5, 0.01, zStart + roadSegmentLength / 2);
  scene.add(rightLine);

  // Randomly add crosswalk (20% chance)
  if (Math.random() < 0.2) {
    const crosswalkPosition = zStart + roadSegmentLength / 2;
    createCrosswalk(crosswalkPosition);
  }

  // Add buildings
  createBuildings(zStart);

  // Add decorative elements (trees and flowers) along sidewalks
  const decorationSpacing = 10; // Space between decorations
  const numDecorations = Math.floor(roadSegmentLength / decorationSpacing);
  
  for (let i = 0; i < numDecorations; i++) {
    // Only add decoration with 70% chance
    if (Math.random() < 0.7) {
      // Left sidewalk decorations
      const leftDecor = createSidewalkDecoration(
        -5, // Outside the left sidewalk
        zStart + (i * decorationSpacing) + (Math.random() * 2)
      );
      scene.add(leftDecor);

      // Right sidewalk decorations
      const rightDecor = createSidewalkDecoration(
        5, // Outside the right sidewalk
        zStart + (i * decorationSpacing) + (Math.random() * 2)
      );
      scene.add(rightDecor);
    }
  }

  // Add random NPCs to the sidewalks
  const npcSpacing = 5; // Space between potential NPC spawns
  const numNPCSpots = Math.floor(roadSegmentLength / npcSpacing);
  
  for (let i = 0; i < numNPCSpots; i++) {
    if (Math.random() < NPC_SPAWN_PROBABILITY) {
      // Randomly choose left or right sidewalk
      const side = Math.random() > 0.5 ? -1 : 1;
      createSidewalkNPC(
        zStart + (i * npcSpacing) + (Math.random() * 5),
        side
      );
    }
  }
}

function createCrosswalk(zPosition) {
  const stripeWidth = 0.4;
  const stripeLength = 6; // Full road width
  const numStripes = 6;
  const spacing = 0.4;
  const totalWidth = numStripes * (stripeWidth + spacing) - spacing;
  
  // Create a group to hold all stripes
  const crosswalkGroup = new THREE.Group();
  
  for (let i = 0; i < numStripes; i++) {
    const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, stripeLength);
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(
      -(totalWidth / 2) + (i * (stripeWidth + spacing)),
      0.02,
      0
    );
    
    crosswalkGroup.add(stripe);
  }
  
  crosswalkGroup.position.z = zPosition;
  scene.add(crosswalkGroup);

  
  return crosswalkGroup;
}

function createNPC(crosswalkPosition) {
  // Create a simple humanoid figure
  const npcGroup = new THREE.Group();
  
  // Body (capsule-like shape)
  const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: Math.random() > 0.5 ? 0x2196F3 : 0xF44336 // Random blue or red clothing
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.6;
  npcGroup.add(body);
  
  // Head
  const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0xFFE0B2 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.4;
  npcGroup.add(head);
  
  // Random starting position on either side of the road
  const side = Math.random() > 0.5 ? 1 : -1;
  npcGroup.position.set(
    side * 3.5,
    0,
    crosswalkPosition
  );
  
  // Add to scene and NPCs array
  scene.add(npcGroup);
  npcs.push({
    mesh: npcGroup,
    direction: -side, // Walk in opposite direction of starting side
    speed: 0.03 + Math.random() * 0.02, // Walking speed
    crosswalkZ: crosswalkPosition,
    waiting: false
  });
}

function createBuildings(zStart) {
  // Instead of just "2-4 buildings per side," use "3-5 buildings per row"
  const buildingsPerRow = Math.floor(Math.random() * 3) + 3;
  // Define 2 or 3 rows per side
  const numRows = 2 + Math.floor(Math.random() * 2);

  // Building colors and window colors
  const buildingColors = [
    0x607D8B,
    0x455A64,
    0x37474F,
    0x263238
  ];

  const windowColors = [
    0xFFFDE7,
    0xE8F5E9,
    0x90A4AE,
    0x000000
  ];

  // For each side, create multiple rows
  for (let side of [-1, 1]) {
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      // Each row's base offset from the road edge
      const baseOffset = 6 + rowIndex * 3;
      // Calculate even spacing along the road for the buildings in this row
      const spacing = roadSegmentLength / buildingsPerRow;
      
      for (let i = 0; i < buildingsPerRow; i++) {
        const buildingWidth = Math.random() * 3 + 2;
        const buildingHeight = Math.random() * 15 + 8;
        const buildingDepth = Math.random() * 4 + 3;
        
        // Create building group
        const buildingGroup = new THREE.Group();
        
        // Main building structure
        const buildingGeometry = new THREE.BoxGeometry(
          buildingWidth, 
          buildingHeight, 
          buildingDepth
        );
        
        const buildingMaterial = new THREE.MeshPhongMaterial({ 
          color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
          flatShading: true
        });
        
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingGroup.add(building);
        
        // Add windows
        const windowSize = 0.3;
        const windowSpacingX = 0.8;
        const windowSpacingY = 1;
        
        const windowsPerRow = Math.floor(buildingWidth / windowSpacingX) - 1;
        const windowRows = Math.floor(buildingHeight / windowSpacingY) - 1;
        
        const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
        
        for (let row = 0; row < windowRows; row++) {
          for (let col = 0; col < windowsPerRow; col++) {
            const isLit = Math.random() < 0.7;
            const windowColor = isLit 
              ? windowColors[Math.floor(Math.random() * (windowColors.length - 1))]
              : 0x000000;
            
            const windowMaterial = new THREE.MeshPhongMaterial({ 
              color: windowColor,
              emissive: windowColor,
              emissiveIntensity: isLit ? 0.5 : 0
            });

            // Front window
            const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            frontWindow.position.set(
              (col * windowSpacingX) - (buildingWidth/2) + windowSpacingX,
              (row * windowSpacingY) - (buildingHeight/2) + windowSpacingY,
              buildingDepth/2 + 0.01
            );
            buildingGroup.add(frontWindow);

            // Back window
            const isBackLit = Math.random() < 0.7;
            const backWindowColor = isBackLit
              ? windowColors[Math.floor(Math.random() * (windowColors.length - 1))]
              : 0x000000;
            
            const backWindowMaterial = new THREE.MeshPhongMaterial({ 
              color: backWindowColor,
              emissive: backWindowColor,
              emissiveIntensity: isBackLit ? 0.5 : 0
            });

            const backWindow = new THREE.Mesh(windowGeometry, backWindowMaterial);
            backWindow.position.set(
              (col * windowSpacingX) - (buildingWidth/2) + windowSpacingX,
              (row * windowSpacingY) - (buildingHeight/2) + windowSpacingY,
              -buildingDepth/2 - 0.01
            );
            backWindow.rotation.y = Math.PI;
            buildingGroup.add(backWindow);
          }
        }
        
        // Set z position with a small random offset so buildings don't overlap
        const randomZOffset = (Math.random() - 0.5) * (spacing / 2);
        const zPos = zStart + spacing * (i + 0.5) + randomZOffset;
        
        buildingGroup.position.set(
          side * (baseOffset + 2 + Math.random() * 2),
          buildingHeight / 2,
          zPos
        );
        
        scene.add(buildingGroup);
        buildings.push(buildingGroup);
      }
    }
  }
}

function updateEnvironment() {
  // Accelerate the car and update its position
  carSpeed += acceleration;
  carZ += carSpeed;
  car.position.z = carZ;

  // Smoothly interpolate the car's x position toward the target lane center.
  car.position.x += (targetX - car.position.x) * 0.1;

  // Update the camera to follow the car.
  camera.position.set(car.position.x, 2, carZ);
  camera.lookAt(new THREE.Vector3(car.position.x, 2, carZ + 10));

  // Generate new road segments ahead when needed
  const lastSegment = roadSegments[roadSegments.length - 1];
  if (lastSegment.end < carZ + 200) {
    createRoadSegment(lastSegment.end);
  }

  // Remove road segments that have fallen behind the car
  while (roadSegments.length && roadSegments[0].end < carZ - 50) {
    scene.remove(roadSegments[0].mesh);
    roadSegments.shift();
  }

  // Remove buildings that are far behind the car
  buildings = buildings.filter(building => {
    if (building.position.z < carZ - 10) {
      scene.remove(building);
      return false;
    }
    return true;
  });

  // Update and cleanup NPCs
  npcs = npcs.filter(npc => {
    if (npc.mesh.position.z < carZ - 50) {
      scene.remove(npc.mesh);
      return false;
    }
    
    if (npc.type === 'sidewalk') {
      npc.mesh.position.z += npc.speed * npc.direction;
      
      if (npc.mesh.position.z > carZ + 200) {
        npc.mesh.position.z = carZ - 40;
      } else if (npc.mesh.position.z < carZ - 40) {
        npc.mesh.position.z = carZ + 180;
      }
    } else {
      if (!npc.waiting) {
        const newX = npc.mesh.position.x + (npc.direction * npc.speed);
        npc.mesh.position.x = newX;
        
        if (Math.abs(newX) > 3.5) {
          scene.remove(npc.mesh);
          return false;
        }
      }
    }
    
    npc.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.1;
    
    return true;
  });
}

function animate() {
  requestAnimationFrame(animate);
  updateEnvironment();

  // Update any street lamp animations.
  const elapsedTime = clock.getElapsedTime();
  streetLampGroups.forEach(lampGroup => {
    lampGroup.userData.update(elapsedTime);
  });

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
