let video;
let handPose;
let bodyPose;
let faceMesh;
let hands;
let bodies;
let faces;
let debugMode = false;

// Global metrics definition with score calculation functions
const metricsDefinition = {
  leftHandPinch: {
    title: "Left Hand Pinch",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // range is about 1 - 15
      // < 4 is score 1, > 10 is score 0, and in between is linear
      if (metric.threeD <= 5) {
        return 1;
      } else if (metric.threeD > 10) {
        return 0;
      } else {
        return 1 - (metric.threeD - 5) / 5;
      }
    },
  },
  rightHandPinch: {
    title: "Right Hand Pinch",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // range is about 1 - 15
      // < 4 is score 1, > 10 is score 0, and in between is linear
      if (metric.threeD <= 5) {
        return 1;
      } else if (metric.threeD > 10) {
        return 0;
      } else {
        return 1 - (metric.threeD - 5) / 5;
      }
    },
  },
  leftHandFist: {
    title: "Left Hand Fist",
    calculateScore: function (metric) {
      if (!metric.calced) return null;
      
      // Average finger-to-palm distance is small when fist is closed
      // Range is roughly 9-15 (smaller = fist)
      // < 9 is score 1 (fist), > 15 is score 0 (open hand), linear in between
      if (metric.avgDistance <= 9) {
        return 1;
      } else if (metric.avgDistance >= 15) {
        return 0;
      } else {
        return 1 - (metric.avgDistance - 9) / 6;
      }
    },
  },
  rightHandFist: {
    title: "Right Hand Fist",
    calculateScore: function (metric) {
      if (!metric.calced) return null;
      
      // Same calculation as left hand
      if (metric.avgDistance <= 9) {
        return 1;
      } else if (metric.avgDistance >= 15) {
        return 0;
      } else {
        return 1 - (metric.avgDistance - 9) / 6;
      }
    },
  },
  wrists: {
    title: "Wrists",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // wrists are 25 - 60
      // < 25 is score 1, > 60 is score 1 and in between is linear
      return Math.min(1, Math.max(0, 1 - (metric.threeD - 25) / 35));
    },
  },
  mouthOpen: {
    title: "Mouth Open",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // mouth open is around 20 - 120
      // < 30 is score 0, > 100 is score 1, and in between is linear
      return Math.min(1, Math.max(0, (metric.ratio - 30) / 70));
    },
  },
  eyebrowRaised: {
    title: "Eyebrow Raised",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // Not currently used in levels, placeholder for future use
      return 0;
    },
  },
  leftHandOverHead: {
    title: "Left Hand Over Head",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // Height difference between head and hand, approx range -200 to 200
      // < -100 is score 0, > 100 is score 1, and in between is linear.
      return Math.min(1, Math.max(0, (metric.twoD + 100) / 200));
    },
  },
  rightHandOverHead: {
    title: "Right Hand Over Head",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // Height difference between head and hand, approx range -200 to 200
      // < -100 is score 0, > 100 is score 1, and in between is linear.
      return Math.min(1, Math.max(0, (metric.twoD + 100) / 200));
    },
  },
  // handsOverHead: {
  //   title: "Hands Over Head",
  //   calculateScore: function(metric) {
  //     if (!metric.calced) return null;

  //     // this would go from about -200 to 200, if head in center (and screen is 400 tall),
  //     // < -100 is score 0, > 100 is score 1, and in between is linear.
  //     return Math.min(1, Math.max(0, (metric.twoD + 100) / 200));
  //   }
  // },
  leftHandBack: {
    title: "Left Hand Back",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // Map orientation range -0.8 to 0.8 to score 0 to 1
      return Math.min(1, Math.max(0, (metric.orientation + 0.8) / 1.6));
    },
  },
  rightHandBack: {
    title: "Right Hand Back",
    calculateScore: function (metric) {
      if (!metric.calced) return null;

      // Map orientation range -0.8 to 0.8 to score 0 to 1
      return Math.min(1, Math.max(0, (metric.orientation + 0.8) / 1.6));
    },
  },
  leftHandOverMouth: {
    title: "Left Hand Over Mouth",
    calculateScore: function (metric) {
      if (!metric.calced) return null;
      
      // Using 2D distance between hand center and mouth
      // Range is about 0-250 pixels
      // < 50 is score 1 (covering mouth), > 250 is score 0 (far from mouth)
      // Making it much more forgiving with wider range
      if (metric.distance <= 50) {
        return 1;
      } else if (metric.distance >= 250) {
        return 0;
      } else {
        return 1 - (metric.distance - 50) / 200;
      }
    },
  },
  rightHandOverMouth: {
    title: "Right Hand Over Mouth",
    calculateScore: function (metric) {
      if (!metric.calced) return null;
      
      // Same calculation as left hand
      if (metric.distance <= 50) {
        return 1;
      } else if (metric.distance >= 250) {
        return 0;
      } else {
        return 1 - (metric.distance - 50) / 200;
      }
    },
  },
};

let gameState = {
  started: false,
  playing: false,
  level: 1,
  ended: false,
  countdown: false,
  countdownStartTime: 0,
  levelStartTime: 0,
  scores: {},
  totalScore: 0,
  progressHistory: [], // Array to store recent progress values
  progressHistorySize: 15, // Number of frames to average - increased for smoother movement
  mode: null, // 'standard' or 'endless'
  menuScreen: true, // Show mode selection menu
  endlessLevels: [], // All possible combinations for endless mode
  usedEndlessLevelIndices: [], // Track which levels have been used
  showHint: false, // Whether to show a hint
  hintShown: false, // Track if hint has been shown for current level
  currentHint: null, // Store the current hint to keep it consistent
  lockingIn: false, // Whether we're currently locking in a pose
  lockInStartTime: 0, // When we started locking in
  lockInDuration: 1500, // How long to hold pose (milliseconds)
};

// Utility function to create a level from metric IDs
function createLevel(metricIds) {
  if (metricIds.length === 1) {
    // Single metric level
    return {
      metricIds: metricIds,
      progressFunction: (metrics) => {
        return metrics[metricIds[0]].score;
      },
    };
  } else {
    // Multi-metric level
    return {
      metricIds: metricIds,
      progressFunction: (metrics) => {
        // Check if any required metric is missing
        for (const id of metricIds) {
          if (metrics[id].score == null) {
            return null;
          }
        }

        // Calculate product of all scores
        let product = 1;
        for (const id of metricIds) {
          product *= metrics[id].score;
        }

        // Take nth root to maintain 0-1 range
        return Math.pow(product, 1 / metricIds.length);
      },
    };
  }
}

// Standard mode levels - predefined progression
let levels = [
  createLevel(["leftHandFist"]),
  createLevel(["rightHandOverMouth"]),
  createLevel(["leftHandOverHead"]),
  createLevel(["mouthOpen", "wrists"]),
  createLevel(["leftHandBack", "rightHandBack"]),
  createLevel(["rightHandOverMouth", "leftHandFist"]),
  createLevel(["leftHandOverHead", "mouthOpen", "wrists"]),
];

// Available metrics for endless mode with hints
const availableMetrics = [
  // {
  //   id: 'handsOverHead',
  //   title: 'Raise both hands above head',
  //   hint: 'Look up'
  // },
  {
    id: "leftHandOverHead",
    title: "Raise left hand above head",
    hint: "Try your left side",
  },
  {
    id: "rightHandOverHead",
    title: "Raise right hand above head",
    hint: "Try your right side",
  },
  {
    id: "leftHandPinch",
    title: "Pinch left thumb and index finger",
    hint: "Use your fingers",
  },
  {
    id: "rightHandPinch",
    title: "Pinch right thumb and index finger",
    hint: "Use your fingers",
  },
  {
    id: "mouthOpen",
    title: "Open mouth",
    hint: "Face expressions",
  },
  {
    id: "wrists",
    title: "Bring wrists together",
    hint: "Move two parts of your body closer to each other",
  },
  {
    id: "leftHandBack",
    title: "Show back of left hand",
    hint: "Experiment with your left hand",
  },
  {
    id: "rightHandBack",
    title: "Show back of right hand",
    hint: "Experiment with your right hand",
  },
  {
    id: "leftHandFist",
    title: "Make a fist with left hand",
    hint: "Try closing your hand",
  },
  {
    id: "rightHandFist",
    title: "Make a fist with right hand",
    hint: "Try closing your hand",
  },
  {
    id: "leftHandOverMouth",
    title: "Cover your mouth with left hand",
    hint: "Try bringing your hand to your face",
  },
  {
    id: "rightHandOverMouth",
    title: "Cover your mouth with right hand",
    hint: "Try bringing your hand to your face",
  },
];

// Define which metrics are incompatible with each other
const metricIncompatibilities = {
  // Left hand conflicts
  "leftHandFist": ["leftHandPinch", "leftHandBack"],
  "leftHandPinch": ["leftHandFist", "leftHandOverMouth"],
  "leftHandOverHead": ["leftHandOverMouth"],
  "leftHandOverMouth": ["leftHandPinch", "leftHandOverHead", "mouthOpen", "rightHandOverMouth"],
  "leftHandBack": ["leftHandFist", "leftHandPinch", "leftHandOverMouth"],
  
  // Right hand conflicts
  "rightHandFist": ["rightHandPinch", "rightHandOverMouth"],
  "rightHandPinch": ["rightHandFist", "rightHandOverMouth"],
  "rightHandOverHead": ["rightHandOverMouth"],
  "rightHandOverMouth": ["rightHandPinch", "rightHandOverHead", "mouthOpen", "leftHandOverMouth"],
  "rightHandBack": ["rightHandFist", "rightHandPinch", "rightHandOverMouth"],
  
  // Mouth conflicts
  "mouthOpen": ["leftHandOverMouth", "rightHandOverMouth"],
};

// Function to check if two metrics are compatible
function areMetricsCompatible(metricA, metricB) {
  // Check if either metric conflicts with the other
  if (metricIncompatibilities[metricA] && metricIncompatibilities[metricA].includes(metricB)) {
    return false;
  }
  if (metricIncompatibilities[metricB] && metricIncompatibilities[metricB].includes(metricA)) {
    return false;
  }
  return true;
}

// Function to check if a set of metrics is compatible
function isCompatibleMetricSet(metricIds) {
  for (let i = 0; i < metricIds.length; i++) {
    for (let j = i + 1; j < metricIds.length; j++) {
      if (!areMetricsCompatible(metricIds[i], metricIds[j])) {
        return false;
      }
    }
  }
  return true;
}

// Function to generate a set of compatible metrics
function generateCompatibleMetricSet(count, availableMetricsList) {
  const selectedMetrics = [];
  const availableIds = availableMetricsList.map(m => m.id);
  
  // Start with a random metric
  const firstMetricIndex = Math.floor(Math.random() * availableIds.length);
  selectedMetrics.push(availableIds[firstMetricIndex]);
  
  // Try to add more metrics that are compatible with all existing ones
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  while (selectedMetrics.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Select a random metric from available ones
    const randomIndex = Math.floor(Math.random() * availableIds.length);
    const candidateMetricId = availableIds[randomIndex];
    
    // Skip if already selected
    if (selectedMetrics.includes(candidateMetricId)) continue;
    
    // Check compatibility with all current selections
    let isCompatible = true;
    for (const selectedMetric of selectedMetrics) {
      if (!areMetricsCompatible(selectedMetric, candidateMetricId)) {
        isCompatible = false;
        break;
      }
    }
    
    if (isCompatible) {
      selectedMetrics.push(candidateMetricId);
    }
  }
  
  return selectedMetrics;
}

// Generate all possible compatible metric combinations for endless mode
function generateAllEndlessLevels() {
  const allLevels = [];

  // First, add all single-metric levels
  for (let i = 0; i < availableMetrics.length; i++) {
    const metric = availableMetrics[i];
    allLevels.push(createLevel([metric.id]));
  }

  // Then, add compatible combinations of two metrics
  for (let i = 0; i < availableMetrics.length; i++) {
    for (let j = i + 1; j < availableMetrics.length; j++) {
      const metric1 = availableMetrics[i];
      const metric2 = availableMetrics[j];
      
      // Only add if metrics are compatible
      if (areMetricsCompatible(metric1.id, metric2.id)) {
        allLevels.push(createLevel([metric1.id, metric2.id]));
      }
    }
  }
  
  // Optionally, add compatible combinations of three metrics
  // This is more intensive, so we can be selective
  const threeMetricCombos = [];
  
  for (let i = 0; i < availableMetrics.length; i++) {
    for (let j = i + 1; j < availableMetrics.length; j++) {
      for (let k = j + 1; k < availableMetrics.length; k++) {
        const metricIds = [
          availableMetrics[i].id,
          availableMetrics[j].id,
          availableMetrics[k].id
        ];
        
        // Check if this set of three metrics is compatible
        if (isCompatibleMetricSet(metricIds)) {
          threeMetricCombos.push(createLevel(metricIds));
          
          // Limit to a reasonable number of combinations
          if (threeMetricCombos.length >= 15) break;
        }
      }
      if (threeMetricCombos.length >= 15) break;
    }
    if (threeMetricCombos.length >= 15) break;
  }
  
  // Add a selection of three-metric combinations
  allLevels.push(...threeMetricCombos);

  console.log(`Generated ${allLevels.length} possible levels (${allLevels.filter(l => l.metricIds.length === 1).length} single, ${allLevels.filter(l => l.metricIds.length === 2).length} double, ${allLevels.filter(l => l.metricIds.length === 3).length} triple)`);
  
  return allLevels;
}

// Get next endless level based on game state
function getNextEndlessLevel() {
  // Choose level complexity based on current level
  let metricCount = 1;
  if (gameState.level > 3 && gameState.level <= 6) {
    metricCount = 2;
  } else if (gameState.level > 6) {
    metricCount = Math.min(3, 1 + Math.floor(Math.random() * 2)); // 2 or 3 metrics
  }
  
  // Generate compatible metrics
  const metricIds = generateCompatibleMetricSet(metricCount, availableMetrics);
  
  // If we couldn't generate enough compatible metrics, reduce complexity
  if (metricIds.length < metricCount) {
    console.log(`Couldn't generate level with ${metricCount} metrics, got ${metricIds.length} compatible metrics instead.`);
  }
  
  // If no metrics were found, something went wrong - default to a simple level
  if (metricIds.length === 0) {
    return createLevel(["leftHandOverHead"]);
  }
  
  // Create level with these metrics
  const level = createLevel(metricIds);
  
  // For debugging
  console.log(`Generated level with metrics: ${metricIds.join(", ")}`);
  
  return level;
}

function preload() {
  // TODO at least faceMesh has a maxFaces option, which would be nice to use
  // (and show error message around??)
  handPose = ml5.handPose({ flipped: true });
  bodyPose = ml5.bodyPose("BlazePose", { flipped: true });
  faceMesh = ml5.faceMesh({ flipped: true, refineLandmarks: true });
}

// Flag to track camera permission status
let cameraPermissionGranted = false;

function setup() {
  // Just create the canvas at the original fixed size - this is safer
  const canvas = createCanvas(640, 480);
  canvas.parent("canvas-container");

  // Set text to bold by default
  textStyle(BOLD);
  
  // Add window resize listener to update canvas size
  window.addEventListener('resize', windowResized);

  // Check for camera permissions
  checkCameraPermission();
}

// Function to check if camera permission is granted
async function checkCameraPermission() {
  try {
    // Try to access the camera
    video = createCapture(VIDEO, { flipped: true });
    video.size(640, 480);
    video.hide();
    
    // Start the detection models
    handPose.detectStart(video, gotHands);
    bodyPose.detectStart(video, gotBodies);
    faceMesh.detectStart(video, gotFaces);
    
    cameraPermissionGranted = true;
    resetGame();
  } catch (error) {
    console.error("Camera permission denied:", error);
    cameraPermissionGranted = false;
    initializeDOMElements(); // Make sure DOM elements are initialized
    
    // Show error overlay with camera error content after a slight delay to ensure DOM is ready
    setTimeout(() => {
      if (domElements.trackingError) domElements.trackingError.style.display = "none";
      if (domElements.cameraError) domElements.cameraError.style.display = "block";
      showOverlay("errorOverlay");
      hideOverlay("modeSelectionOverlay");
    }, 100);
  }
}

// Function to request camera permission
async function requestCameraPermission() {
  try {
    // First stop any existing detection to clean up
    if (handPose) handPose.detectStop();
    if (bodyPose) bodyPose.detectStop();
    if (faceMesh) faceMesh.detectStop();
    
    // Remove old video if it exists
    if (video) {
      video.remove();
    }
    
    // Create new video capture
    video = createCapture(VIDEO, { flipped: true });
    video.size(640, 480);
    video.hide();
    
    // Wait a brief moment for video to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create new detection models
    handPose = ml5.handPose({ flipped: true });
    bodyPose = ml5.bodyPose("BlazePose", { flipped: true });
    faceMesh = ml5.faceMesh({ flipped: true, refineLandmarks: true });
    
    // Start the detection models
    handPose.detectStart(video, gotHands);
    bodyPose.detectStart(video, gotBodies);
    faceMesh.detectStart(video, gotFaces);
    
    // If we get here, we're successful
    cameraPermissionGranted = true;
    
    // Hide the error overlay
    if (domElements.errorOverlay) domElements.errorOverlay.style.opacity = "0";
  } catch (error) {
    console.error("Camera permission denied again:", error);
    cameraPermissionGranted = false;
    // The draw loop will continue to show the error message
  }
}

// Handle window resize events - but keep fixed dimensions
function windowResized() {
  resizeCanvas(640, 480);
}

function gotHands(results) {
  hands = results;
}

function gotBodies(results) {
  bodies = results;
}

function gotFaces(results) {
  faces = results;
}

function computeMetrics() {
  // Create metrics instance, initializing with titles and calced=false
  const metrics = {};
  for (const key in metricsDefinition) {
    metrics[key] = {
      title: metricsDefinition[key].title,
      calced: false,
    };
  }

  if (hands) {
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i];
      const thumbTip = hand?.thumb_tip;
      const indexTip = hand?.index_finger_tip;
      const middleTip = hand?.middle_finger_tip;
      const ringTip = hand?.ring_finger_tip;
      const pinkyTip = hand?.pinky_finger_tip;

      // We need these points for hand orientation calculation
      const wrist = hand?.wrist;
      const middleBase = hand?.middle_finger_mcp; // Middle finger metacarpophalangeal joint (base)
      const indexBase = hand?.index_finger_mcp; // Index finger base
      const pinkyBase = hand?.pinky_finger_mcp; // Pinky finger base

      if (hand.confidence > 0.9 && thumbTip && indexTip) {
        if (hand.handedness === "Left") {
          metrics.leftHandPinch.calced = true;
          metrics.leftHandPinch.twoD = calculate2DDistance(thumbTip, indexTip);
          metrics.leftHandPinch.threeD = calculateHand3DDistance(
            thumbTip,
            indexTip
          );
        } else if (hand.handedness === "Right") {
          metrics.rightHandPinch.calced = true;
          metrics.rightHandPinch.twoD = calculate2DDistance(thumbTip, indexTip);
          metrics.rightHandPinch.threeD = calculateHand3DDistance(
            thumbTip,
            indexTip
          );
        }
      }
      
      // Calculate fist metric - average distance from fingertips to palm center
      if (hand.confidence > 0.9 && wrist) {
        // Get all fingertips
        const fingertips = [
          thumbTip,
          indexTip,
          middleTip,
          ringTip,
          pinkyTip
        ];
        
        // Calculate average distance from fingertips to wrist
        let totalDistance = 0;
        let validFingers = 0;
        
        for (const fingertip of fingertips) {
          if (fingertip) {
            totalDistance += calculateHand3DDistance(fingertip, wrist);
            validFingers++;
          }
        }
        
        const avgDistance = validFingers > 0 ? totalDistance / validFingers : null;
        
        if (avgDistance !== null) {
          if (hand.handedness === "Left") {
            metrics.leftHandFist.calced = true;
            metrics.leftHandFist.avgDistance = avgDistance;
          } else if (hand.handedness === "Right") {
            metrics.rightHandFist.calced = true;
            metrics.rightHandFist.avgDistance = avgDistance;
          }
        }
      }

      // Calculate hand back metrics when all required points are available
      if (
        hand.confidence > 0.9 &&
        wrist &&
        middleBase &&
        indexBase &&
        pinkyBase
      ) {
        // Calculate a vector normal to the palm plane using cross product
        // First we create vectors along the palm
        const v1 = {
          x: indexBase.x3D - wrist.x3D,
          y: indexBase.y3D - wrist.y3D,
          z: indexBase.z3D - wrist.z3D,
        };

        const v2 = {
          x: pinkyBase.x3D - wrist.x3D,
          y: pinkyBase.y3D - wrist.y3D,
          z: pinkyBase.z3D - wrist.z3D,
        };

        // Cross product gives normal vector to palm
        const normal = {
          x: v1.y * v2.z - v1.z * v2.y,
          y: v1.z * v2.x - v1.x * v2.z,
          z: v1.x * v2.y - v1.y * v2.x,
        };

        // Normalize the vector (z component is what we care about)
        const length = Math.sqrt(
          normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
        );
        normal.z = normal.z / length;

        // The normal.z value indicates palm orientation:
        // Positive: palm facing camera
        // Negative: back of hand facing camera
        // Range is roughly -1 to 1

        if (hand.handedness === "Left") {
          metrics.leftHandBack.calced = true;
          metrics.leftHandBack.orientation = normal.z;
        } else if (hand.handedness === "Right") {
          metrics.rightHandBack.calced = true;
          // Invert so positive means back of hand to camera
          metrics.rightHandBack.orientation = -normal.z;
        }
      }
    }
  }

  if (bodies && bodies.length > 0) {
    const body = bodies[0];
    const leftWrist = body?.left_wrist;
    const rightWrist = body?.right_wrist;

    if (
      leftWrist &&
      leftWrist.confidence > 0.5 &&
      rightWrist &&
      rightWrist.confidence > 0.5
    ) {
      metrics.wrists.calced = true;
      metrics.wrists.twoD = calculate2DDistance(leftWrist, rightWrist);
      metrics.wrists.threeD = calculateBody3DDistance(leftWrist, rightWrist);
    }

    const nose = body?.nose;

    if (nose && nose.confidence > 0.9) {
      // Individual hands over head
      if (leftWrist && leftWrist.confidence > 0.9) {
        metrics.leftHandOverHead.calced = true;
        metrics.leftHandOverHead.twoD = nose.y - leftWrist.y;
      }

      if (rightWrist && rightWrist.confidence > 0.9) {
        metrics.rightHandOverHead.calced = true;
        metrics.rightHandOverHead.twoD = nose.y - rightWrist.y;
      }

      // // Both hands over head (average height)
      // if ((leftWrist && leftWrist.confidence > 0.9) && (rightWrist && rightWrist.confidence > 0.9)) {
      //   metrics.handsOverHead.calced = true;
      //   const averageWristHeight = (leftWrist.y + rightWrist.y) / 2;
      //   metrics.handsOverHead.twoD = nose.y - averageWristHeight;
      // }
    }
  }

  if (faces && faces.length > 0) {
    const face = faces[0];
    // if (Math.random() < 0.1) {
    //   console.log(face);
    // }
    // console.log(face);

    // it's a little tricky to get a 3d distance for the face,
    // because the points are always given x/y/z which I'm not really sure how to make sense of.
    // but the effect is that using the 3d distance seems to scale when I approach camera,
    // which is not what I want. instead, I'll use the ratio of height of lips to width of lips
    // to get a sense of open/closed.
    if (face.lips) {
      metrics.mouthOpen.calced = true;
      metrics.mouthOpen.ratio = (face.lips?.height / face.lips?.width) * 100;
      
      // Calculate hand over mouth metrics
      // For simplicity, using 2D distance between hand center and mouth center
      const mouthCenter = { 
        x: face.lips.centerX, 
        y: face.lips.centerY 
      };
      
      // Check if hands are detected and calculate distances to mouth
      if (hands) {
        for (let i = 0; i < hands.length; i++) {
          const hand = hands[i];
          
          if (hand.confidence > 0.8) {
            // Use the middle finger base (knuckle) as hand center reference point
            const middleKnuckle = hand?.middle_finger_mcp;
            
            if (middleKnuckle) {
              const handPoint = { 
                x: middleKnuckle.x, 
                y: middleKnuckle.y 
              };
              
              // Calculate 2D distance between hand center and mouth
              const distance = calculate2DDistance(handPoint, mouthCenter);
              
              if (hand.handedness === "Left") {
                metrics.leftHandOverMouth.calced = true;
                metrics.leftHandOverMouth.distance = distance;
              } else if (hand.handedness === "Right") {
                metrics.rightHandOverMouth.calced = true;
                metrics.rightHandOverMouth.distance = distance;
              }
            }
          }
        }
      }
    }

    // TODO note this doesn't really work yet. rotating the head screws it up dramatically,
    // which I think is because x / y are projections onto the screen (how we're seeing them...)
    // I think I need to read more about how to project them into space.
    // mouth seems to have this issue to a much lesser degree.
    if (face.leftEye && face.rightEye) {
      // yipes. these are using indexes from: https://github.com/lschmelzeisen/understanding-mediapipe-facemesh-output/tree/main
      const rightEyeInsideCorner = face.keypoints[133];
      const rightEyeOutsideCorner = face.keypoints[33];
      const rightEye = calculateFaceAveragePoint(
        rightEyeInsideCorner,
        rightEyeOutsideCorner
      );
      const rightEyebrowMidInside = face.keypoints[65];
      const rightEyebrowMidOutside = face.keypoints[52];
      const rightEyebrow = calculateFaceAveragePoint(
        rightEyebrowMidInside,
        rightEyebrowMidOutside
      );
      const rightEyebrowDist = calculateFace3DDistance(
        rightEyebrowMidInside,
        rightEyebrowMidOutside
      );

      const leftEyeInsideCorner = face.keypoints[362];
      const leftEyeOutsideCorner = face.keypoints[263];
      const leftEye = calculateFaceAveragePoint(
        leftEyeInsideCorner,
        leftEyeOutsideCorner
      );
      const leftEyebrowMidInside = face.keypoints[295];
      const leftEyebrowMidOutside = face.keypoints[282];
      const leftEyebrow = calculateFaceAveragePoint(
        leftEyebrowMidInside,
        leftEyebrowMidOutside
      );
      const leftEyebrowDist = calculateFace3DDistance(
        leftEyebrowMidInside,
        leftEyebrowMidOutside
      );

      // console.log({rightEyebrowDist, leftEyebrowDist});

      metrics.eyebrowRaised.ratio = (leftEyebrowDist / rightEyebrowDist) * 100;
      metrics.eyebrowRaised.calced = true;
    }
  }

  // Calculate scores for all metrics
  for (const key in metrics) {
    if (metrics[key].calced) {
      metrics[key].score = metricsDefinition[key].calculateScore(metrics[key]);
    } else {
      metrics[key].score = null;
    }
  }

  return metrics;
}

function drawAllPoints() {
  if (hands) {
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i];
      // drawKeypoints(hand);
      drawHandSkeleton(hand);
    }
  }
  if (bodies) {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      drawKeypoints(body);
    }
  }
  if (faces) {
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      // drawKeypoints(face.lips);
      // drawKeypoints(face.leftEye);
      // drawKeypoints(face.leftEyebrow);
    }
  }
}

function drawAllMetrics(metrics) {
  const metricStrs = [];
  for (const key in metrics) {
    const metric = metrics[key];
    if (metric.calced) {
      metricStr = "";
      if (metric.twoD != null) {
        metricStr += "2D: " + Math.round(metric.twoD) + "; ";
      }
      if (metric.threeD != null) {
        metricStr += "3D: " + Math.round(metric.threeD) + "; ";
      }
      if (metric.ratio != null) {
        metricStr += "Ratio: " + Math.round(metric.ratio) + "; ";
      }
      if (metric.orientation != null) {
        metricStr += "Orient: " + metric.orientation.toFixed(2) + "; ";
      }
      if (metric.avgDistance != null) {
        metricStr += "Avg Dist: " + metric.avgDistance.toFixed(2) + "; ";
      }
      if (metric.score != null) {
        metricStr += "Score: " + metric.score.toFixed(2);
      }
      metricStrs.push(metric.title + ": " + metricStr);
    } else {
      metricStrs.push(metric.title + ": Not available");
    }
  }

  drawDistanceBox(metricStrs);
}

// Helper function to get hints for the current level
function getHintForCurrentLevel() {
  // If we already have a hint for this level, return it
  if (gameState.currentHint) {
    return gameState.currentHint;
  }

  let currentMetricIds = [];

  if (gameState.mode === "standard") {
    const levelIndex = gameState.level - 1;
    currentMetricIds = levels[levelIndex].metricIds;
  } else if (gameState.mode === "endless" && currentEndlessLevel) {
    currentMetricIds = currentEndlessLevel.metricIds;
  }

  let hint = null;

  // If there's only one metric, return its hint
  if (currentMetricIds.length === 1) {
    const metricId = currentMetricIds[0];
    const metricInfo = availableMetrics.find((m) => m.id === metricId);
    hint = metricInfo ? metricInfo.hint : "Try something different";
  }
  // For multiple metrics, return a more generic hint or randomly select one of the metrics' hints
  else if (currentMetricIds.length > 1) {
    // Randomly select one of the metrics to hint about (but do it only once per level)
    const randomMetricId =
      currentMetricIds[Math.floor(Math.random() * currentMetricIds.length)];
    const metricInfo = availableMetrics.find((m) => m.id === randomMetricId);
    hint = metricInfo ? metricInfo.hint : "Try combining movements";
  }

  // Store the hint so it remains consistent for this level
  gameState.currentHint = hint;
  return hint;
}

// DOM element references
let domElements = {
  // Overlays
  loadingScreen: null,
  modeSelectionOverlay: null,
  errorOverlay: null,
  hintOverlay: null,
  countdownOverlay: null,
  completeOverlay: null,
  instructionsOverlay: null,

  // UI Elements
  timer: null,
  levelIndicator: null,
  levelText: null,
  progressBar: null,
  lockingProgress: null,
  securingBox: null,
  progressContainer: null,

  // Mode Selection
  standardModeBtn: null,
  endlessModeBtn: null,
  instructionsBtn: null,

  // In-game Help
  inGameInstructionsBtn: null,
  
  // Camera Permission
  requestPermissionBtn: null,
  
  // Error Display
  errorBox: null,
  trackingError: null,
  cameraError: null,
  errorMessage: null,
  cameraErrorMessage: null,
  
  // Instructions
  closeInstructionsBtn: null,

  // Countdown
  levelCountdown: null,
  countdownNumber: null,

  // Complete Screen
  scoresBody: null,
  totalScore: null,
  restartButton: null,

  // Other
  hintText: null,
};

// Get references to DOM elements
function initializeDOMElements() {
  // Overlays
  domElements.loadingScreen = document.getElementById("loading-screen");
  domElements.modeSelectionOverlay = document.getElementById(
    "mode-selection-overlay"
  );
  domElements.errorOverlay = document.getElementById("error-overlay");
  domElements.hintOverlay = document.getElementById("hint-overlay");
  domElements.countdownOverlay = document.getElementById("countdown-overlay");
  domElements.completeOverlay = document.getElementById("complete-overlay");
  domElements.instructionsOverlay = document.getElementById("instructions-overlay");

  // UI Elements
  domElements.timer = document.getElementById("timer");
  domElements.levelIndicator = document.getElementById("level-indicator");
  domElements.levelText = document.getElementById("level-text");
  domElements.progressContainer = document.getElementById("progress-container");
  domElements.progressBar = document.getElementById("progress-bar");
  domElements.lockingProgress = document.getElementById("locking-progress");
  domElements.securingBox = document.getElementById("securing-box");

  // Mode Selection
  domElements.standardModeBtn = document.getElementById("standard-mode-btn");
  domElements.endlessModeBtn = document.getElementById("endless-mode-btn");
  domElements.instructionsBtn = document.getElementById("instructions-btn");
  
  // In-game Help
  domElements.inGameInstructionsBtn = document.getElementById("in-game-instructions-btn");
  
  // Error Display
  domElements.errorBox = document.getElementById("error-box");
  domElements.trackingError = document.getElementById("tracking-error");
  domElements.cameraError = document.getElementById("camera-error");
  domElements.errorMessage = document.getElementById("error-message");
  domElements.cameraErrorMessage = document.getElementById("camera-error-message");
  
  // Camera Permission
  domElements.requestPermissionBtn = document.getElementById("request-permission-btn");
  
  // Instructions
  domElements.closeInstructionsBtn = document.getElementById("close-instructions-btn");

  // Countdown
  domElements.levelCountdown = document.getElementById("level-countdown");
  domElements.countdownNumber = document.getElementById("countdown-number");

  // Complete Screen
  domElements.scoresBody = document.getElementById("scores-body");
  domElements.totalScore = document.getElementById("total-score");
  domElements.restartButton = document.getElementById("restart-button");

  // Other
  domElements.hintText = document.getElementById("hint-text");

  // Initialize UI elements to be hidden by default
  if (domElements.levelIndicator) domElements.levelIndicator.style.display = "none";
  if (domElements.timer) domElements.timer.style.display = "none";
  if (domElements.progressContainer) domElements.progressContainer.style.display = "none";

  // Add event listeners
  domElements.standardModeBtn.addEventListener("click", () => {
    startGame("standard");
    startCountdown();
  });

  domElements.endlessModeBtn.addEventListener("click", () => {
    startGame("endless");
    startCountdown();
  });

  domElements.restartButton.addEventListener("click", () => {
    restartGame();
  });
  
  // Instructions buttons
  domElements.instructionsBtn.addEventListener("click", () => {
    showOverlay("instructionsOverlay");
  });
  
  domElements.inGameInstructionsBtn.addEventListener("click", () => {
    showOverlay("instructionsOverlay");
  });
  
  domElements.closeInstructionsBtn.addEventListener("click", () => {
    hideOverlay("instructionsOverlay");
  });
  
  // Camera permission button
  domElements.requestPermissionBtn.addEventListener("click", () => {
    requestCameraPermission();
  });

  // Add key press event listener to document
  document.addEventListener("keydown", keyPressed);
}

// Show/hide UI overlays
function showOverlay(overlay) {
  if (domElements[overlay]) {
    domElements[overlay].style.opacity = "1";
    
    // For error overlay, keep pointer-events as none to let buttons underneath work
    // Only the request-permission-btn inside it will have pointer-events: auto
    if (overlay !== "errorOverlay") {
      domElements[overlay].style.pointerEvents = "auto";
    }
  }
}

function hideOverlay(overlay) {
  if (domElements[overlay]) {
    domElements[overlay].style.opacity = "0";
    domElements[overlay].style.pointerEvents = "none";
  }
}

// Hide loading screen
function hideLoading() {
  if (domElements.loadingScreen) {
    domElements.loadingScreen.style.opacity = "0";
    setTimeout(() => {
      domElements.loadingScreen.style.display = "none";
    }, 500);
  }
}

// Update the progress bar
function updateProgressBar(progress) {
  if (domElements.progressBar) {
    domElements.progressBar.style.width = `${progress * 100}%`;
  }
}

// Update the locking progress animation
function updateLockingProgress(visible, progress = 0) {
  if (domElements.lockingProgress && domElements.securingBox) {
    // Handle the green progress bar
    domElements.lockingProgress.style.opacity = visible ? "1" : "0";
    
    if (!visible) {
      // When not visible, ensure width is reset to 0
      domElements.lockingProgress.style.width = "0%";
      domElements.securingBox.style.opacity = "0";
      return;
    }

    // Apply the easing function to the progress for smoother animation
    let easedProgress = progress;
    if (progress < 0.2) {
      // First 20% - accelerate quickly (quadratic ease-in)
      easedProgress = (progress / 0.2) * (progress / 0.2) * 0.3;
    } else {
      // Remaining 80% - decelerate more gradually (cubic ease-out)
      easedProgress = 0.3 + 0.7 * (1 - Math.pow(1 - (progress - 0.2) / 0.8, 3));
    }

    domElements.lockingProgress.style.width = `${easedProgress * 100}%`;

    // Handle the "SECURING..." text box
    if (progress > 0.15) {
      // Make the box visible but keep it centered
      domElements.securingBox.style.opacity = "1";
    } else {
      domElements.securingBox.style.opacity = "0";
    }
  }
}

// Update timer display - only updates once per second to improve performance
let lastUpdateTime = 0;
function updateTimer(time) {
  // Only update the DOM once per second
  const currentSecond = Math.floor(time);
  if (currentSecond !== lastUpdateTime) {
    lastUpdateTime = currentSecond;
    if (domElements.timer) {
      // Format time to avoid showing ".0" when it's a whole number
      const formattedTime = currentSecond === parseFloat(time) ? currentSecond : time;
      domElements.timer.textContent = `${formattedTime}s`;
    }
  }
}

// Update level indicator
function updateLevelIndicator(level, difficulty) {
  if (domElements.levelText) {
    domElements.levelText.textContent = `LEVEL ${level} • ${difficulty}`;
  }
}

// Update hint text
function updateHint(hint) {
  if (domElements.hintText) {
    domElements.hintText.textContent = `HINT: ${hint}`;
  }
}

// Update countdown display
function updateCountdown(level, seconds) {
  if (domElements.levelCountdown && domElements.countdownNumber) {
    domElements.levelCountdown.textContent = `LEVEL ${level}`;
    domElements.countdownNumber.textContent = seconds;
  }
}

// Update game completion screen
function updateCompletionScreen() {
  if (domElements.scoresBody && domElements.totalScore) {
    // Clear existing scores
    domElements.scoresBody.innerHTML = "";

    // Add each level's score
    for (let level in gameState.scores) {
      const row = document.createElement("tr");

      const levelCell = document.createElement("td");
      levelCell.textContent = level;

      const scoreCell = document.createElement("td");
      scoreCell.textContent = `${gameState.scores[level]} sec.`;

      row.appendChild(levelCell);
      row.appendChild(scoreCell);
      domElements.scoresBody.appendChild(row);
    }

    // Update total score
    domElements.totalScore.textContent = `${gameState.totalScore} sec.`;
  }
}

// Variable to track if we've already hidden the loading screen
let loadingHidden = false;

function draw() {
  // Initialize DOM elements on first frame
  if (!domElements.loadingScreen) {
    initializeDOMElements();

    // Show mode selection screen
    showOverlay("modeSelectionOverlay");
  }

  // Hide loading screen after a short delay
  if (!loadingHidden && millis() > 2000) {
    hideLoading();
    loadingHidden = true;
  }

  // Clear with dark background
  background(20, 30, 40);
  
  // Check camera permission status in the draw loop
  if (video && video.elt) {
    if (video.elt.readyState === 0 && !video.elt.srcObject) {
      // Camera not available or permission denied
      cameraPermissionGranted = false;
      
      // Show camera error, but don't block normal game flow
      if (gameState.playing || gameState.started) {
        if (domElements.trackingError) domElements.trackingError.style.display = "none";
        if (domElements.cameraError) domElements.cameraError.style.display = "block";
        // Just make error overlay visible without changing pointer-events
        if (domElements.errorOverlay) domElements.errorOverlay.style.opacity = "1";
      }
    } else {
      // Camera appears to be available
      cameraPermissionGranted = true;
    }
  }

  // Draw video with a slight processing effect if we have camera permission
  if (cameraPermissionGranted && video) {
    push();
    tint(200, 220, 255, 240); // Slightly blue tint
    
    // Draw the video to fill the entire canvas
    image(video, 0, 0, width, height);
    pop();
  }

  // Add sci-fi grid overlay
  drawScienceOverlay();

  const metrics = computeMetrics();

  // Only show debugging info if debug mode is enabled
  if (debugMode) {
    drawAllMetrics(metrics);
    drawAllPoints();
  }

  // Reset text style to bold for game UI after potential debug drawing
  textStyle(BOLD);

  // Add overlay for text readability when needed
  if (!gameState.playing) {
    // Simple semi-transparent dark overlay
    fill(0, 0, 0, 150);
    noStroke();
    rect(0, 0, width, height);
  }

  // Check if we should show a hint (30 seconds on a level)
  if (gameState.playing && !gameState.hintShown) {
    const levelTimeSeconds = (millis() - gameState.levelStartTime) / 1000;
    if (levelTimeSeconds > 15) {
      gameState.showHint = true;
      gameState.hintShown = true;
    }
  }

  // Handle game state with HTML overlays
  if (!gameState.started) {
    // Show mode selection screen
    if (gameState.menuScreen) {
      // Mode selection is now handled by the HTML overlay and event listeners
      showOverlay("modeSelectionOverlay");
      
      // Make sure UI elements are hidden during mode selection
      if (domElements.levelIndicator) domElements.levelIndicator.style.display = "none";
      if (domElements.timer) domElements.timer.style.display = "none";
      if (domElements.progressContainer) domElements.progressContainer.style.display = "none";
    } else {
      // This is the initial title screen, also using the mode selection overlay
      showOverlay("modeSelectionOverlay");
      
      // Make sure UI elements are hidden during initial screen
      if (domElements.levelIndicator) domElements.levelIndicator.style.display = "none";
      if (domElements.timer) domElements.timer.style.display = "none";
      if (domElements.progressContainer) domElements.progressContainer.style.display = "none";
    }
  } else if (gameState.ended) {
    // Game complete screen - use HTML overlay
    updateCompletionScreen();
    showOverlay("completeOverlay");
    hideOverlay("modeSelectionOverlay");

    // Hide other UI elements
    if (domElements.levelIndicator)
      domElements.levelIndicator.style.display = "none";
    if (domElements.timer) domElements.timer.style.display = "none";
    if (domElements.progressContainer)
      domElements.progressContainer.style.display = "none";
  } else if (gameState.countdown) {
    // Handle countdown with HTML overlay
    const elapsedTime = millis() - gameState.countdownStartTime;
    const countdownSeconds = 3 - Math.floor(elapsedTime / 1000);

    if (countdownSeconds <= 0) {
      // Countdown finished, start level
      gameState.countdown = false;
      hideOverlay("countdownOverlay");
      startLevel();
    } else {
      // Get current level difficulty
      let difficulty = "Easy";
      let currentMetricIds = [];

      if (gameState.mode === "standard") {
        const levelIndex = gameState.level - 1;
        currentMetricIds = levels[levelIndex].metricIds;
      } else if (gameState.mode === "endless" && currentEndlessLevel) {
        currentMetricIds = currentEndlessLevel.metricIds;
      }

      // Set difficulty based on number of metrics
      if (currentMetricIds.length === 2) {
        difficulty = "Medium";
      } else if (currentMetricIds.length >= 3) {
        difficulty = "Hard";
      }

      // Make sure we have a current endless level if needed
      if (
        gameState.mode === "endless" &&
        !currentEndlessLevel &&
        gameState.level === 1
      ) {
        currentEndlessLevel = getNextEndlessLevel();
      }

      // Update countdown display in HTML
      updateCountdown(gameState.level, countdownSeconds);
      showOverlay("countdownOverlay");
      hideOverlay("modeSelectionOverlay");
    }
  } else {
    // Get the current level and progress function based on mode
    let progressFunction;
    let rawProgress;
    let currentMetricIds = [];

    if (gameState.mode === "standard") {
      // Standard mode - get level from predefined array
      const levelIndex = gameState.level - 1;
      const level = levels[levelIndex];
      progressFunction = level.progressFunction;
      currentMetricIds = level.metricIds;
    } else if (gameState.mode === "endless") {
      // Endless mode - use current endless level
      progressFunction = currentEndlessLevel.progressFunction;
      currentMetricIds = currentEndlessLevel.metricIds;
    }

    // Calculate progress
    rawProgress = progressFunction(metrics);

    // Apply smoothing to progress value
    const smoothedProgress = smoothProgress(rawProgress);
    const progress = smoothedProgress;

    // Handle lock-in logic for pose holding
    if (progress === null) {
      // If progress becomes null (hand/body parts disappeared), cancel locking
      if (gameState.lockingIn) {
        gameState.lockingIn = false;
        updateLockingProgress(false, 0);
      }
    } else if (progress >= 1) {
      // If we hit 100% and aren't already locking in, start the lock-in
      if (!gameState.lockingIn) {
        gameState.lockingIn = true;
        gameState.lockInStartTime = millis();
      } else {
        // We're already in lock-in state, check if we've held long enough
        const currentTime = millis();
        const lockInElapsed = currentTime - gameState.lockInStartTime;

        // If we've held the pose long enough, complete the level
        if (lockInElapsed >= gameState.lockInDuration) {
          nextLevel();
          return;
        }
      }
    } else {
      // If progress drops below 100%, cancel the lock-in
      if (gameState.lockingIn) {
        gameState.lockingIn = false;
        updateLockingProgress(false, 0);
      }
    }

    // Calculate current time for display
    const currentTime = ((millis() - gameState.levelStartTime) / 1000).toFixed(
      1
    );

    // Update DOM elements for playing state

    // Get difficulty for level indicator
    let difficulty = "Easy";
    if (currentMetricIds.length === 2) {
      difficulty = "Medium";
    } else if (currentMetricIds.length >= 3) {
      difficulty = "Hard";
    }

    // Update level indicator and timer
    updateLevelIndicator(gameState.level, difficulty);
    updateTimer(currentTime);

    if (progress != null) {
      // Update progress bar
      updateProgressBar(progress);

      // Make sure UI elements are visible
      if (domElements.levelIndicator)
        domElements.levelIndicator.style.display = "block";
      if (domElements.timer) domElements.timer.style.display = "block";
      if (domElements.progressContainer)
        domElements.progressContainer.style.display = "block";

      // Hide error overlay or switch to tracking error content
      if (domElements.trackingError) domElements.trackingError.style.display = "block";
      if (domElements.cameraError) domElements.cameraError.style.display = "none";
      hideOverlay("errorOverlay");

      // Handle locking in animation
      if (gameState.lockingIn) {
        const lockInElapsed = millis() - gameState.lockInStartTime;
        const lockInProgress = Math.min(
          1,
          lockInElapsed / gameState.lockInDuration
        );
        updateLockingProgress(true, lockInProgress);
      } else {
        updateLockingProgress(false);
      }

      // Show hint if needed
      if (gameState.showHint) {
        updateHint(getHintForCurrentLevel());
        showOverlay("hintOverlay");
      } else {
        hideOverlay("hintOverlay");
      }
    } else {
      // Show appropriate error message
      if (cameraPermissionGranted) {
        // Only show tracking error if we have camera permission
        if (domElements.trackingError) domElements.trackingError.style.display = "block";
        if (domElements.cameraError) domElements.cameraError.style.display = "none";
      } else {
        // Show camera error if we don't have permission
        if (domElements.trackingError) domElements.trackingError.style.display = "none";
        if (domElements.cameraError) domElements.cameraError.style.display = "block";
      }
      showOverlay("errorOverlay");
    }

    // Hide other overlays
    hideOverlay("modeSelectionOverlay");
    hideOverlay("countdownOverlay");
    hideOverlay("completeOverlay");
  }
}

// Remove canvas drawing functions that have been replaced by HTML UI

// Draw a sci-fi grid overlay
function drawScienceOverlay() {
  push();

  // Draw subtle grid
  stroke(0, 204, 255, 30);
  strokeWeight(1);

  // Horizontal grid lines
  for (let y = 0; y < height; y += 40) {
    line(0, y, width, y);
  }

  // Vertical grid lines
  for (let x = 0; x < width; x += 40) {
    line(x, 0, x, height);
  }

  // Draw corner brackets
  stroke(0, 204, 255, 100);
  strokeWeight(2);

  // Top-left corner
  line(10, 10, 30, 10);
  line(10, 10, 10, 30);

  // Top-right corner
  line(width - 30, 10, width - 10, 10);
  line(width - 10, 10, width - 10, 30);

  // Bottom-left corner
  line(10, height - 10, 30, height - 10);
  line(10, height - 30, 10, height - 10);

  // Bottom-right corner
  line(width - 30, height - 10, width - 10, height - 10);
  line(width - 10, height - 30, width - 10, height - 10);

  // Cleaner interface - removed measurement labels

  pop();
}

function drawProgressBar(progress) {
  const barWidth = 300;
  const barHeight = 16; // Made thicker (was 8)
  const barX = (width - barWidth) / 2;
  const barY = height - 40;

  push();

  // Tech border around progress bar
  stroke(0, 204, 255, 100);
  strokeWeight(1);
  noFill();
  rect(barX - 5, barY - 5, barWidth + 10, barHeight + 10, 6);

  // Add some tech lines
  line(barX - 20, barY + barHeight / 2, barX - 10, barY + barHeight / 2);
  line(
    barX + barWidth + 10,
    barY + barHeight / 2,
    barX + barWidth + 20,
    barY + barHeight / 2
  );

  // Draw background
  noStroke();
  fill(0, 60, 80, 160);
  rect(barX, barY, barWidth, barHeight, 4);

  // Draw the progress bar with sci-fi glow
  fill(0, 204, 255, 200);
  rect(barX, barY, barWidth * progress, barHeight, 4);

  // Add scan lines effect to the progress bar
  for (let y = barY + 2; y < barY + barHeight; y += 4) {
    fill(255, 255, 255, 30);
    rect(barX, y, barWidth * progress, 1);
  }

  // Draw lock-in animation if actively locking in
  if (gameState.lockingIn) {
    const currentTime = millis();
    let lockInProgress =
      (currentTime - gameState.lockInStartTime) / gameState.lockInDuration;

    // Quick ease-in at the beginning, longer ease-out at the end
    // Using a custom easing function to achieve the desired effect
    if (lockInProgress < 0.2) {
      // First 20% - accelerate quickly (quadratic ease-in)
      lockInProgress = (lockInProgress / 0.2) * (lockInProgress / 0.2) * 0.3;
    } else {
      // Remaining 80% - decelerate more gradually (cubic ease-out)
      lockInProgress =
        0.3 + 0.7 * (1 - Math.pow(1 - (lockInProgress - 0.2) / 0.8, 3));
    }

    // Calculate the width of the sliding green bar
    const greenBarWidth = barWidth * lockInProgress;

    // Draw the sliding green bar on top of the progress bar
    noStroke();
    fill(0, 255, 200, 220); // Cyan-green glow color
    rect(barX, barY, greenBarWidth, barHeight, 4);

    // Add glow effect
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = "rgba(0, 255, 200, 0.5)";
    rect(barX, barY, greenBarWidth, barHeight, 4);
    drawingContext.shadowBlur = 0;

    // Add tech lines to lock-in bar
    stroke(255, 255, 255, 100);
    strokeWeight(1);
    for (let x = barX + 10; x < barX + greenBarWidth; x += 20) {
      line(x, barY, x, barY + barHeight);
    }

    // Add "SECURING" text with proper positioning and style
    if (lockInProgress > 0.15) {
      // Draw a small tech box around the text
      noFill();
      stroke(0, 204, 255, 150);
      strokeWeight(1);
      const textBoxX = barX + greenBarWidth + 8;
      const textBoxY = barY - 2;
      const textBoxWidth = 85;
      const textBoxHeight = barHeight + 4;
      rect(textBoxX, textBoxY, textBoxWidth, textBoxHeight, 3);

      // Add small tech lines
      const lineLength = 5;
      line(
        textBoxX - lineLength,
        textBoxY + textBoxHeight / 2,
        textBoxX,
        textBoxY + textBoxHeight / 2
      );

      // Add text
      noStroke();
      fill(255, 255, 255, 230);
      textSize(12);
      textFont("Recursive");
      textAlign(CENTER, CENTER);
      text(
        "SECURING...",
        textBoxX + textBoxWidth / 2,
        textBoxY + textBoxHeight / 2
      );
    }
  }

  pop();
}

function drawKeypoints(obj) {
  for (let j = 0; j < obj.keypoints.length; j++) {
    let keypoint = obj.keypoints[j];
    if (keypoint.confidence < 0.9) {
      continue;
    }
    fill(0, 255, 0);
    noStroke();
    circle(keypoint.x, keypoint.y, 10);
  }
}
function calculate2DDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateHand3DDistance(point1, point2) {
  const dx = point1.x3D - point2.x3D;
  const dy = point1.y3D - point2.y3D;
  const dz = point1.z3D - point2.z3D;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 100;
}

function calculateBody3DDistance(point1, point2) {
  const dx = point1.keypoint3D.x - point2.keypoint3D.x;
  const dy = point1.keypoint3D.y - point2.keypoint3D.y;
  const dz = point1.keypoint3D.z - point2.keypoint3D.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 100;
}

function calculateFace3DDistance(point1, point2) {
  // I think this is a little funny, or at least maybe should only be used for ratios.
  // not sure how to interpret z.
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const dz = point1.z - point2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 100;
}

function calculateFaceAveragePoint(point1, point2) {
  const x = (point1.x + point2.x) / 2;
  const y = (point1.y + point2.y) / 2;
  const z = (point1.z + point2.z) / 2;
  return { x, y, z };
}

// function calculateFace3DDistance(point1, point2) {
//   const dx = point1.x - point2.x;
//   const dy = point1.y - point2.y;
//   const dz = point1.z - point2.z;
//   return Math.sqrt(dx * dx + dy * dy + dz * dz) * 100.;
// }

function drawDistanceBox(distanceStrs) {
  // Box parameters
  const padding = 10;
  const lineHeight = 16; // Smaller line height for smaller text
  const boxWidth = 300;
  const boxHeight = padding * 2 + lineHeight * distanceStrs.length;
  const boxX = 20;
  const boxY = 20;

  // Draw box with semi-transparent background
  push();
  fill(0, 0, 0, 230); // More opaque background
  stroke(255, 255, 0); // Yellow border
  strokeWeight(3); // Thicker border
  rect(boxX, boxY, boxWidth, boxHeight, 10); // Rounded corners

  // Draw text - not bold and smaller
  fill(255); // White text
  noStroke();
  textStyle(NORMAL); // Non-bold text for metrics
  textSize(14); // Smaller text size
  textAlign(LEFT, TOP);

  // Show each distance string
  for (let i = 0; i < distanceStrs.length; i++) {
    text(distanceStrs[i], boxX + padding, boxY + padding + i * lineHeight);
  }
  pop();
}

function drawHandSkeleton(hand) {
  // Define finger connections
  const fingerConnections = [
    // Thumb [connections]
    [0, 1, 2, 3, 4],
    // Index finger
    [0, 5, 6, 7, 8],
    // Middle finger
    [0, 9, 10, 11, 12],
    // Ring finger
    [0, 13, 14, 15, 16],
    // Pinky
    [0, 17, 18, 19, 20],
  ];

  // Define colors for each finger
  const colors = [
    [255, 0, 0], // thumb (red)
    [0, 255, 0], // index (green)
    [0, 0, 255], // middle (blue)
    [255, 255, 0], // ring (yellow)
    [255, 0, 255], // pinky (magenta)
  ];

  // Draw each finger
  for (let i = 0; i < fingerConnections.length; i++) {
    const points = fingerConnections[i];
    const color = colors[i];

    stroke(color[0], color[1], color[2]);
    strokeWeight(2);

    // Draw lines connecting each point in the finger
    for (let j = 0; j < points.length - 1; j++) {
      const keypoint1 = hand.keypoints[points[j]];
      const keypoint2 = hand.keypoints[points[j + 1]];

      if (keypoint1 && keypoint2) {
        line(keypoint1.x, keypoint1.y, keypoint2.x, keypoint2.y);
      }
    }
  }
}

function smoothProgress(rawProgress) {
  // Handle null value
  if (rawProgress === null) {
    gameState.progressHistory = []; // Clear history when detection is lost
    updateProgressBar(0); // Reset progress bar to 0
    return null;
  }

  // Add current value to history
  gameState.progressHistory.push(rawProgress);

  // Limit history size
  if (gameState.progressHistory.length > gameState.progressHistorySize) {
    gameState.progressHistory.shift(); // Remove oldest value
  }

  // Calculate simple weighted average - newer values have more weight
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < gameState.progressHistory.length; i++) {
    // Simple linear weighting - newer values count more
    const weight = i + 1;
    weightedSum += gameState.progressHistory[i] * weight;
    totalWeight += weight;
  }

  return weightedSum / totalWeight;
}

// Current endless mode level (for reference)
let currentEndlessLevel = null;

function resetGame() {
  gameState.started = false;
  gameState.level = 1;
  gameState.ended = false;
  gameState.countdown = false;
  gameState.playing = false;
  gameState.scores = {};
  gameState.totalScore = 0;
  gameState.progressHistory = [];
  gameState.menuScreen = true;
  gameState.mode = null;
  gameState.endlessLevels = [];
  gameState.usedEndlessLevelIndices = [];
  gameState.showHint = false;
  gameState.hintShown = false;
  gameState.currentHint = null;
  gameState.lockingIn = false;
  gameState.lockInStartTime = 0;
  currentEndlessLevel = null;

  // Update UI - hide game elements
  if (domElements.levelIndicator)
    domElements.levelIndicator.style.display = "none";
  if (domElements.timer) domElements.timer.style.display = "none";
  if (domElements.progressContainer)
    domElements.progressContainer.style.display = "none";
    
  // Hide all buttons
  if (domElements.inGameInstructionsBtn)
    domElements.inGameInstructionsBtn.style.display = "none";
    
  // Reset progress bar
  updateProgressBar(0);

  // Show mode selection if we have camera permission, otherwise show camera error
  hideOverlay("countdownOverlay");
  hideOverlay("hintOverlay");
  hideOverlay("completeOverlay");
  
  // Always show mode selection - camera error will be shown by draw loop if needed
  showOverlay("modeSelectionOverlay");
}

function startGame(mode) {
  gameState.started = true;
  gameState.menuScreen = false;
  gameState.mode = mode;

  // For endless mode, generate all levels if not already done
  if (mode === "endless" && gameState.endlessLevels.length === 0) {
    gameState.endlessLevels = generateAllEndlessLevels();
  }

  // Hide mode selection
  hideOverlay("modeSelectionOverlay");
}

function endGame() {
  // Calculate score for final level
  const levelTime = (millis() - gameState.levelStartTime) / 1000;
  gameState.scores[gameState.level] = levelTime.toFixed(2);
  gameState.totalScore += parseFloat(levelTime);
  gameState.totalScore = gameState.totalScore.toFixed(2); // Format total to 2 decimal places

  gameState.playing = false; // Make sure playing is set to false
  gameState.ended = true;

  // Update completion screen
  updateCompletionScreen();
  showOverlay("completeOverlay");

  // Hide game UI
  if (domElements.levelIndicator)
    domElements.levelIndicator.style.display = "none";
  if (domElements.timer) domElements.timer.style.display = "none";
  if (domElements.progressContainer)
    domElements.progressContainer.style.display = "none";
    
  // Hide all buttons
  if (domElements.inGameInstructionsBtn)
    domElements.inGameInstructionsBtn.style.display = "none";
  
  // Hide error overlay
  hideOverlay("errorOverlay");
}

function startLevel() {
  gameState.playing = true;
  gameState.levelStartTime = millis();
  gameState.progressHistory = []; // Reset progress history for new level
  gameState.showHint = false;
  gameState.hintShown = false;
  gameState.currentHint = null; // Reset hint for new level
  gameState.lockingIn = false; // Reset lock-in state
  gameState.lockInStartTime = 0;

  // Show game UI
  if (domElements.levelIndicator)
    domElements.levelIndicator.style.display = "block";
  if (domElements.timer) domElements.timer.style.display = "block";
  if (domElements.progressContainer)
    domElements.progressContainer.style.display = "block";
    
  // Show help button during gameplay
  if (domElements.inGameInstructionsBtn)
    domElements.inGameInstructionsBtn.style.display = "flex";

  // Reset progress indicators
  updateProgressBar(0);
  updateLockingProgress(false);

  // Hide overlays
  hideOverlay("countdownOverlay");
  hideOverlay("hintOverlay");
  
  // We'll let the draw loop handle showing errors for camera permissions
}

function startCountdown() {
  // Always start countdown, even without camera permission
  // We'll show the error overlay but not block game flow
  
  gameState.countdown = true;
  gameState.countdownStartTime = millis();

  // Hide other overlays and show countdown
  showOverlay("countdownOverlay");
  hideOverlay("modeSelectionOverlay");
  hideOverlay("errorOverlay");
  hideOverlay("hintOverlay");
  hideOverlay("completeOverlay");
  
  // Hide game UI during countdown
  if (domElements.levelIndicator) domElements.levelIndicator.style.display = "none";
  if (domElements.timer) domElements.timer.style.display = "none";
  if (domElements.progressContainer) domElements.progressContainer.style.display = "none";
  
  // Hide all buttons during countdown
  if (domElements.inGameInstructionsBtn)
    domElements.inGameInstructionsBtn.style.display = "none";

  // Get difficulty for level display
  let difficulty = "Easy";
  let currentMetricIds = [];

  if (gameState.mode === "standard") {
    const levelIndex = gameState.level - 1;
    currentMetricIds = levels[levelIndex].metricIds;
  } else if (gameState.mode === "endless" && currentEndlessLevel) {
    currentMetricIds = currentEndlessLevel.metricIds;
  }

  // Set difficulty based on number of metrics
  if (currentMetricIds.length === 2) {
    difficulty = "Medium";
  } else if (currentMetricIds.length >= 3) {
    difficulty = "Hard";
  }

  // Update countdown display
  updateCountdown(gameState.level, 3);
}

function nextLevel() {
  // Calculate and store score for the completed level
  const levelTime = (millis() - gameState.levelStartTime) / 1000; // Convert to seconds
  gameState.scores[gameState.level] = levelTime.toFixed(2);
  gameState.totalScore += parseFloat(levelTime);

  // Move to next level
  gameState.level++;
  gameState.playing = false;

  if (gameState.mode === "endless") {
    // Get the next endless level
    currentEndlessLevel = getNextEndlessLevel();

    // If there are no more levels, end the game
    if (currentEndlessLevel === null) {
      endGame();
      return;
    }
  } else if (gameState.mode === "standard") {
    // End the game if we've completed all standard levels
    if (gameState.level > levels.length) {
      endGame();
      return;
    }
  }

  startCountdown();
}

function restartGame() {
  resetGame();
  // Just go back to the menu screen, camera status handled in draw loop
}

function keyPressed() {
  // Toggle debug mode with 'd' key regardless of game state
  if (key === "d" || key === "D") {
    debugMode = !debugMode;
    return;
  }

  // Handle restart after game over
  if (gameState.ended) {
    restartGame();
    return;
  }

  // Don't proceed if already playing or counting down
  if (gameState.playing || gameState.countdown) {
    return;
  }

  // Starting a new game or level
  if (!gameState.started && !gameState.menuScreen) {
    // Only start with key press if we're not on the menu screen
    startGame(gameState.mode || "standard");
    startCountdown();
  } else if (gameState.started) {
    startCountdown();
  }
  // Note: on menu screen, clicks handle mode selection, not key presses
}
