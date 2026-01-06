/**
 * PIXIJS PRODUCTION BUILD
 * Logic: 30 FPS Master Clock, Continuous Drag Spawning, 
 * Depth-Weighted Camera Shake, and Safety-Zoom Rotation.
 */

// --- CONFIGURATION ---
const DEVICE_TYPE = 'desktop';
const ASSET_FOLDER = `assets/${DEVICE_TYPE}/`;
const VIDEO_SRC = 'assets/landscape_loop.mp4';

const COW_COUNT = 15;
const TARGET_FPS = 30;
const BASE_COW_SCALE = 1.0;
const BASE_CAR_SCALE = 0.8;
const SHOW_ANCHORS = false;
const SHOW_DEBUG_BOUNDS = false; // Toggle this to show hitboxes

// --- HITBOX DEFINITIONS (Half-Width, Top-Offset, Bottom-Offset) ---
const HITBOXES = {
    cow: { w: 180, t: 50, b: 40 },
    car: { w: 250, t: 50, b: 20 }
};

const SETTINGS = {
    topY: 610,
    bottomY: 750,
    topSpeed: -2,
    bottomSpeed: -23,
    minDepthBlur: 1,
    maxDepthBlur: 0,
    motionBlurStrength: 0.2,
    spawnVariation: 50,
    spawnRate: 3,
    loaderCowWidth: 150 // Adjust this pixel value to change loading cow size
};

// --- CAMERA SHAKE SETTINGS ---
const SHAKE_SETTINGS = {
    triggerFrame: 9,      // Frame index 9 (10th frame)
    duration: 5,          // Shake length in frames
    xIntensity: 2,
    yIntensity: 5,
    rotationIntensity: 0.1 * (Math.PI / 180),
    zoomIntensity: 0.015, // Scale multiplier to hide edges during rotation
    minDistanceMultiplier: 0.25 // Farthest cars get this fraction of the shake
};

// --- AMBIENT SHAKE SETTINGS (Handheld Feel) ---
const AMBIENT_SHAKE_SETTINGS = {
    overlayMult: 2.0,
    wiggle: {
        freq: 2,     // Hz (cycles per second)
        x: 1,        // Max X displacement
        y: 3,        // Max Y displacement
        rot: 0.0     // Max rotation in degrees
    },
    vibration: {
        freq: 3,    // Hz
        y: .25         // Max Y displacement
    }
};

const VIDEO_NATIVE_WIDTH = 1920;
const VIDEO_NATIVE_HEIGHT = 1080;

// --- INITIALIZE APP ---
const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x000000,
});
document.body.appendChild(app.view);
app.ticker.maxFPS = 60;

const worldContainer = new PIXI.Container();
const videoLayer = new PIXI.Container();
const spriteLayer = new PIXI.Container();

// Pivot at video center for rotation
worldContainer.pivot.set(VIDEO_NATIVE_WIDTH / 2, VIDEO_NATIVE_HEIGHT / 2);

worldContainer.addChild(videoLayer, spriteLayer);
app.stage.addChild(worldContainer);

let logicTickCounter = 0;
let spawnTickCounter = 0;
const ticksPerFrame = 2;

let isPointerDown = false;
let lastPointerPos = { x: 0, y: 0 };
let activeShakes = [];
let baseWorldPos = { x: 0, y: 0 };
let baseOverlayPos = { x: 0, y: 0 };
let baseWorldScale = 1.0;
let baseOverlayScale = 1.0;
let lastCrashIndex = -1;
let ambientTime = 0;

const keyMap = {
    '`': { x: 0.02, y: 0 }, '1': { x: 0.08, y: 0 }, '2': { x: 0.15, y: 0 }, '3': { x: 0.22, y: 0 }, '4': { x: 0.29, y: 0 }, '5': { x: 0.36, y: 0 }, '6': { x: 0.43, y: 0 }, '7': { x: 0.50, y: 0 }, '8': { x: 0.57, y: 0 }, '9': { x: 0.64, y: 0 }, '0': { x: 0.71, y: 0 }, '-': { x: 0.78, y: 0 }, '=': { x: 0.85, y: 0 },
    'q': { x: 0.05, y: 0.2 }, 'w': { x: 0.15, y: 0.2 }, 'e': { x: 0.25, y: 0.2 }, 'r': { x: 0.35, y: 0.2 }, 't': { x: 0.45, y: 0.2 }, 'y': { x: 0.55, y: 0.2 }, 'u': { x: 0.65, y: 0.2 }, 'i': { x: 0.75, y: 0.2 }, 'o': { x: 0.85, y: 0.2 }, 'p': { x: 0.95, y: 0.2 }, '[': { x: 0.97, y: 0.2 }, ']': { x: 0.99, y: 0.2 }, '\\': { x: 1.0, y: 0.2 },
    'a': { x: 0.08, y: 0.5 }, 's': { x: 0.18, y: 0.5 }, 'd': { x: 0.28, y: 0.5 }, 'f': { x: 0.38, y: 0.5 }, 'g': { x: 0.48, y: 0.5 }, 'h': { x: 0.58, y: 0.5 }, 'j': { x: 0.68, y: 0.5 }, 'k': { x: 0.78, y: 0.5 }, 'l': { x: 0.88, y: 0.5 }, ';': { x: 0.92, y: 0.5 }, "'": { x: 0.95, y: 0.5 }, 'enter': { x: 0.98, y: 0.5 },
    'z': { x: 0.12, y: 0.8 }, 'x': { x: 0.22, y: 0.8 }, 'c': { x: 0.32, y: 0.8 }, 'v': { x: 0.42, y: 0.8 }, 'b': { x: 0.52, y: 0.8 }, 'n': { x: 0.62, y: 0.8 }, 'm': { x: 0.72, y: 0.8 }, ',': { x: 0.78, y: 0.8 }, '.': { x: 0.84, y: 0.8 }, '/': { x: 0.90, y: 0.8 },
    ' ': { x: 0.5, y: 1.0 }
};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
let instructionText = null;
let carSpawned = false;
let windowOverlay = null;

async function setup() {
    // --- INITIAL LOADING SCREEN ---
    const loadingContainer = new PIXI.Container();
    app.stage.addChild(loadingContainer);

    // 1. Load Loader Asset first
    const loaderSheet = await PIXI.Assets.load(`assets/mobile/cow2_mobile.json`);
    const loaderFrames = loaderSheet.animations["walk"] || Object.values(loaderSheet.textures);
    const loaderCow = new PIXI.AnimatedSprite(loaderFrames);
    loaderCow.anchor.set(0.5);
    loaderCow.stop();
    let loadingTick = 0;
    const loaderTicker = () => {
        loadingTick++;
        if (loadingTick >= ticksPerFrame) {
            const nextFrame = (loaderCow.currentFrame + 1) % loaderCow.totalFrames;
            loaderCow.gotoAndStop(nextFrame);
            loadingTick = 0;
        }
    };
    app.ticker.add(loaderTicker);
    loaderCow.width = SETTINGS.loaderCowWidth;
    loaderCow.scale.y = Math.abs(loaderCow.scale.x); // Maintain aspect ratio
    loadingContainer.addChild(loaderCow);

    const progressText = new PIXI.Text('Loading 0/0 assets', {
        fontFamily: 'Roboto',
        fontSize: 20,
        fill: 0xffffff,
        align: 'center'
    });
    progressText.anchor.set(0.5);
    loadingContainer.addChild(progressText);

    const updateLoadingLayout = () => {
        loaderCow.x = window.innerWidth / 2;
        loaderCow.y = window.innerHeight / 2 - 40;
        progressText.x = window.innerWidth / 2;
        progressText.y = window.innerHeight / 2 + 40;
    };
    updateLoadingLayout();
    window.addEventListener('resize', updateLoadingLayout);

    // 2. Prepare rest of assets
    const assetsToLoad = [
        { alias: 'cow1', src: `${ASSET_FOLDER}cow1_${DEVICE_TYPE}.json` },
        { alias: 'cow2', src: `${ASSET_FOLDER}cow2_${DEVICE_TYPE}.json` }
    ];
    for (let i = 1; i <= 7; i++) {
        assetsToLoad.push({ alias: `car${i}`, src: `${ASSET_FOLDER}car${i}_${DEVICE_TYPE}.json` });
    }
    const soundNames = [];
    for (let i = 1; i <= 7; i++) {
        const alias = `crash${i}`;
        soundNames.push(alias);
        assetsToLoad.push({ alias: alias, src: `assets/sounds/${alias}.mp3` });
    }
    assetsToLoad.push({ alias: 'window', src: 'assets/window.webp' });
    assetsToLoad.push({ alias: 'bg', src: 'assets/sounds/bg.mp3' });
    // bg sound attribution: 20101026Cows.wav by daveincamas (https://freesound.org/s/107577/) + Highway Driving by officialfourge (https://freesound.org/s/366250/) -- License: Attribution 4.0

    const totalAssets = assetsToLoad.length;
    let loadedCount = 0;

    progressText.text = `Loading 0/${totalAssets} assets`;

    // 3. Load them one by one to show progress
    for (const asset of assetsToLoad) {
        PIXI.Assets.add(asset);
        await PIXI.Assets.load(asset.alias);
        loadedCount++;
        progressText.text = `Loading ${loadedCount}/${totalAssets} assets`;
    }

    // Done loading
    app.ticker.remove(loaderTicker);
    app.stage.removeChild(loadingContainer);
    window.removeEventListener('resize', updateLoadingLayout);

    const sheet1 = PIXI.Assets.get('cow1');
    const sheet2 = PIXI.Assets.get('cow2');
    const carSheets = [];
    for (let i = 1; i <= 7; i++) {
        carSheets.push(PIXI.Assets.get(`car${i}`));
    }

    // --- WINDOW OVERLAY ---
    windowOverlay = new PIXI.Sprite(PIXI.Assets.get('window'));
    windowOverlay.anchor.set(0.5);
    app.stage.addChild(windowOverlay);

    const cowSheets = [sheet1, sheet2];
    const videoElement = document.createElement('video');
    videoElement.src = VIDEO_SRC;
    videoElement.muted = true;
    videoElement.preload = 'auto';
    videoElement.playsInline = true;
    videoElement.loop = true;
    videoElement.play().catch(e => console.warn("Autoplay blocked, waiting for interaction."));

    // --- START BG AUDIO ---
    if (typeof PIXI !== 'undefined' && PIXI.sound) {
        PIXI.sound.play('bg', {
            loop: true,
            volume: 0.5
        });
    }

    const videoTexture = PIXI.Texture.from(videoElement);
    const videoSprite = new PIXI.Sprite(videoTexture);
    videoLayer.addChild(videoSprite);

    // --- INSTRUCTION TEXT ---
    const desktopMsg = "Click and drag to drop some cars";
    const mobileMsg = "Tap and drag to drop some cars";
    instructionText = new PIXI.Text(isMobile ? mobileMsg : desktopMsg, {
        fontFamily: 'Roboto',
        fontSize: 24,
        fill: 0x000000,
        fontWeight: '300',
        align: 'center'
    });
    instructionText.anchor.set(0.5, 0.5);
    app.stage.addChild(instructionText);

    const updateInstructionPos = () => {
        instructionText.x = window.innerWidth * 0.35;
        instructionText.y = window.innerHeight * 0.28;
    };
    updateInstructionPos();
    window.addEventListener('resize', updateInstructionPos);

    // --- OVERLAY SPECS ---
    const OVERLAY_NATIVE_HEIGHT = 2864;
    const NARROW_CUTOUT_RATIO = 0.70;
    const NARROW_CUTOUT_OFFSET = -429.6; // 70% height, top-aligned center is 15% above middle
    const WIDE_CUTOUT_RATIO = 0.55;
    const WIDE_CUTOUT_OFFSET = -250;     // Original spec

    const cows = [];
    const cars = [];

    function applyPerspectiveEffects(container, t, vx) {
        const currentDepthBlur = SETTINGS.minDepthBlur + t * (SETTINGS.maxDepthBlur - SETTINGS.minDepthBlur);
        const currentMotionBlur = Math.abs(vx) * SETTINGS.motionBlurStrength;
        const sprite = container.getChildAt(0);
        if (sprite && sprite.blurRef) {
            sprite.blurRef.blurY = currentDepthBlur;
            sprite.blurRef.blurX = currentDepthBlur + currentMotionBlur;
        }
    }

    // --- COW LOGIC ---
    for (let i = 0; i < COW_COUNT; i++) {
        const selectedSheet = cowSheets[Math.floor(Math.random() * cowSheets.length)];
        const animFrames = selectedSheet.animations["walk"] || Object.values(selectedSheet.textures);
        const cowContainer = new PIXI.Container();
        const cow = new PIXI.AnimatedSprite(animFrames);
        cow.anchor.set(0.5, 0.75);
        cow.stop();
        const blurFilter = new PIXI.filters.BlurFilter();
        cow.filters = [blurFilter];
        cow.blurRef = blurFilter;
        cowContainer.addChild(cow);
        spriteLayer.addChild(cowContainer);
        cows.push(cowContainer);
        cowContainer.anim = cow;

        // --- ADD DEBUG BOUNDS ---
        if (SHOW_DEBUG_BOUNDS) {
            const debugObj = new PIXI.Graphics();
            cowContainer.addChild(debugObj);
            cowContainer.debug = debugObj;
        }

        resetCow(cowContainer);
    }

    function drawDebugBox(container, width, top, bottom, color) {
        if (!container.debug) return;
        const g = container.debug;
        g.clear();
        g.beginFill(color, 0.3);
        g.lineStyle(2, color, 1);
        // Draw relative to container center
        // Width is half-width, top/bottom are distances from center
        g.drawRect(-width, -top, width * 2, top + bottom);
        g.endFill();
    }

    function resetCow(container) {
        let attempts = 0;
        let foundSpot = false;
        let candidateX, candidateY, candidateVX, candidateT;

        // Loop until a non-overlapping spot is found (limit to 100 for safety)
        while (!foundSpot && attempts < 100) {
            candidateY = SETTINGS.topY + Math.random() * (SETTINGS.bottomY - SETTINGS.topY);
            candidateT = (candidateY - SETTINGS.topY) / (SETTINGS.bottomY - SETTINGS.topY || 1);
            candidateVX = SETTINGS.topSpeed + candidateT * (SETTINGS.bottomSpeed - SETTINGS.topSpeed);

            // Increase offscreen range to 2000 to better stagger cow entry
            if (candidateVX > 0) candidateX = -200 - (Math.random() * 2000);
            else candidateX = VIDEO_NATIVE_WIDTH + 200 + (Math.random() * 2000);

            // Check for overlap with other cows
            let overlapping = false;
            const COW_WIDTH = 200; // Increased buffer
            const COW_HEIGHT = 50;  // Vertical buffer

            for (const other of cows) {
                if (other === container) continue;

                const dx = Math.abs(candidateX - other.x);
                const dy = Math.abs(candidateY - other.y);

                // Scaled collision thresholds
                const currentScale = (0.2 + candidateT * 0.8) * BASE_COW_SCALE;
                const otherT = (other.y - SETTINGS.topY) / (SETTINGS.bottomY - SETTINGS.topY || 1);
                const otherScale = (0.2 + otherT * 0.8) * BASE_COW_SCALE;

                // Use combined scale for collision boundary
                const combinedWidth = COW_WIDTH * ((currentScale + otherScale) / 2);
                const combinedHeight = COW_HEIGHT * ((currentScale + otherScale) / 2);

                if (dx < combinedWidth && dy < combinedHeight) {
                    overlapping = true;
                    break;
                }
            }

            if (!overlapping) {
                foundSpot = true;
            }
            attempts++;
        }

        // Apply the chosen values
        container.y = candidateY;
        container.x = candidateX;
        container.vx = candidateVX;

        const t = candidateT;
        const finalScale = (0.2 + t * 0.8) * BASE_COW_SCALE;
        const flip = Math.random() > 0.5 ? 1 : -1;
        container.scale.set(finalScale * flip, finalScale);

        const randomFrame = Math.floor(Math.random() * container.anim.totalFrames);
        container.anim.gotoAndStop(randomFrame);

        // Apply perspective and motion blur
        applyPerspectiveEffects(container, t, container.vx);

        if (SHOW_DEBUG_BOUNDS) {
            drawDebugBox(container, HITBOXES.cow.w, HITBOXES.cow.t, HITBOXES.cow.b, 0xFF0000);
        }
    }

    // --- CAR LOGIC ---
    function spawnCar(worldX, worldY) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * SETTINGS.spawnVariation;
        let spawnX = worldX + Math.cos(angle) * dist;
        let spawnY = worldY + Math.sin(angle) * dist;

        // --- FIX: Clamp Y BEFORE collision detection ---
        spawnY = Math.max(SETTINGS.topY, Math.min(SETTINGS.bottomY, spawnY));

        // Candidate car scale (calculated after clamp)
        const candidateT = (spawnY - SETTINGS.topY) / (SETTINGS.bottomY - SETTINGS.topY || 1);
        const candidateScale = (0.2 + candidateT * 0.8) * BASE_CAR_SCALE;

        // --- COW AVOIDANCE LOGIC (Box-to-Box) ---
        let foundValidSpot = false;

        // Phase 1: Try pushing away from cows near the intended target
        for (let attempt = 0; attempt < 20; attempt++) {
            let collisionFound = false;
            for (const cow of cows) {
                const cowScale = Math.abs(cow.scale.y);
                const carW = HITBOXES.car.w * candidateScale;
                const carT = HITBOXES.car.t * candidateScale;
                const carB = HITBOXES.car.b * candidateScale;
                const cowW = HITBOXES.cow.w * cowScale;
                const cowT = HITBOXES.cow.t * cowScale;
                const cowB = HITBOXES.cow.b * cowScale;

                const hOverlap = Math.abs(spawnX - cow.x) < (carW + cowW);
                const vOverlap = (spawnY - carT < cow.y + cowB) && (spawnY + carB > cow.y - cowT);

                if (hOverlap && vOverlap) {
                    const totalWidth = carW + cowW;
                    const pushGap = 25 * candidateScale;
                    if (spawnX < cow.x) spawnX = cow.x - (totalWidth + pushGap);
                    else spawnX = cow.x + (totalWidth + pushGap);
                    collisionFound = true;
                    break;
                }
            }
            if (!collisionFound) {
                foundValidSpot = true;
                break;
            }
        }

        // Phase 2: FALLBACK - If target area is too crowded, hunt for ANY random free spot
        if (!foundValidSpot) {
            for (let attempt = 0; attempt < 50; attempt++) {
                const testX = Math.random() * VIDEO_NATIVE_WIDTH;
                const testY = SETTINGS.topY + Math.random() * (SETTINGS.bottomY - SETTINGS.topY);
                const testT = (testY - SETTINGS.topY) / (SETTINGS.bottomY - SETTINGS.topY || 1);
                const testScale = (0.2 + testT * 0.8) * BASE_CAR_SCALE;

                let overlap = false;
                for (const cow of cows) {
                    const cowScale = Math.abs(cow.scale.y);
                    const carW = HITBOXES.car.w * testScale;
                    const carT = HITBOXES.car.t * testScale;
                    const carB = HITBOXES.car.b * testScale;
                    const cowW = HITBOXES.cow.w * cowScale;
                    const cowT = HITBOXES.cow.t * cowScale;
                    const cowB = HITBOXES.cow.b * cowScale;

                    if (Math.abs(testX - cow.x) < (carW + cowW) &&
                        (testY - carT < cow.y + cowB) && (testY + carB > cow.y - cowT)) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    spawnX = testX;
                    spawnY = testY;
                    foundValidSpot = true;
                    break;
                }
            }
        }

        // Final Safety: If NO spot was found on the entire field, skip this spawn
        if (!foundValidSpot) return;

        const randomSheet = carSheets[Math.floor(Math.random() * carSheets.length)];
        const carAnimFrames = randomSheet.animations["drive"] || Object.values(randomSheet.textures);

        const carContainer = new PIXI.Container();
        const car = new PIXI.AnimatedSprite(carAnimFrames);
        car.anchor.set(0.5, 0.93);
        car.loop = false;
        car.stop();

        const blurFilter = new PIXI.filters.BlurFilter();
        car.filters = [blurFilter];
        car.blurRef = blurFilter;
        carContainer.addChild(car);

        const t = (spawnY - SETTINGS.topY) / (SETTINGS.bottomY - SETTINGS.topY || 1);
        const finalScale = (0.2 + t * 0.8) * BASE_CAR_SCALE;
        const flip = Math.random() > 0.5 ? 1 : -1;
        carContainer.scale.set(finalScale * flip, finalScale);

        carContainer.vx = SETTINGS.topSpeed + t * (SETTINGS.bottomSpeed - SETTINGS.topSpeed);
        carContainer.x = spawnX;
        carContainer.y = spawnY;

        applyPerspectiveEffects(carContainer, t, carContainer.vx);

        spriteLayer.addChild(carContainer);
        cars.push(carContainer);
        carContainer.anim = car;
        carContainer.isFinished = false;
        carContainer.shakeTriggered = false;
        // Pre-calculate shake intensity based on depth (t)
        carContainer.shakeMult = SHAKE_SETTINGS.minDistanceMultiplier + (t * (1.0 - SHAKE_SETTINGS.minDistanceMultiplier));

        if (SHOW_DEBUG_BOUNDS) {
            const debugObj = new PIXI.Graphics();
            carContainer.addChild(debugObj);
            carContainer.debug = debugObj;
            drawDebugBox(carContainer, HITBOXES.car.w, HITBOXES.car.t, HITBOXES.car.b, 0x0000FF);
        }

        spriteLayer.children.sort((a, b) => a.y - b.y);
    }

    // --- INPUTS ---
    const resumeAudio = () => {
        if (typeof PIXI === 'undefined' || !PIXI.sound) return;

        try {
            if (PIXI.sound.context.paused) {
                PIXI.sound.context.paused = false;
            }
            if (PIXI.sound.context.audioContext.state === 'suspended') {
                PIXI.sound.context.audioContext.resume();
            }
            // Ensure background loop is playing
            if (!PIXI.sound.find('bg').isPlaying) {
                PIXI.sound.play('bg', { loop: true, volume: 0.5 });
            }
            // Also ensure video starts if blocked
            if (videoElement.paused) videoElement.play().catch(() => { });
        } catch (e) {
            console.warn("Audio resume failed:", e);
        }
    };

    window.addEventListener('pointerdown', (e) => {
        resumeAudio();
        isPointerDown = true;
        const localPos = worldContainer.toLocal(new PIXI.Point(e.clientX, e.clientY));
        lastPointerPos = localPos;
        if (localPos.x >= 0 && localPos.x <= VIDEO_NATIVE_WIDTH) {
            spawnCar(localPos.x, localPos.y);
            carSpawned = true;
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (isPointerDown) {
            lastPointerPos = worldContainer.toLocal(new PIXI.Point(e.clientX, e.clientY));
        }
    });

    window.addEventListener('pointerup', () => isPointerDown = false);
    window.addEventListener('pointercancel', () => isPointerDown = false);

    window.addEventListener('keydown', (e) => {
        resumeAudio();
        const key = e.key.toLowerCase();
        if (keyMap[key]) {
            const coords = keyMap[key];
            const screenX = coords.x * window.innerWidth;
            const localPos = worldContainer.toLocal(new PIXI.Point(screenX, 0));
            const targetX = localPos.x;
            const targetY = SETTINGS.topY + (coords.y * (SETTINGS.bottomY - SETTINGS.topY));
            spawnCar(targetX, targetY);
            carSpawned = true;
        }
    });

    function resize() {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        if (!windowOverlay || !windowOverlay.texture || !windowOverlay.texture.baseTexture.valid) {
            baseWorldScale = Math.max(screenW / VIDEO_NATIVE_WIDTH, screenH / VIDEO_NATIVE_HEIGHT);
            baseWorldPos.x = screenW / 2;
            baseWorldPos.y = screenH / 2;
            baseOverlayPos.x = screenW / 2;
            baseOverlayPos.y = screenH / 2;
        } else {
            const texW = windowOverlay.texture.width;
            const texH = windowOverlay.texture.height;
            const texAR = texW / texH;
            const screenAR = screenW / screenH;

            // 1. Calculate Overlay Scale (Maintains aspect ratio)
            let overlayScale = (screenAR > texAR) ? (screenW / texW) : (screenH / texH);
            overlayScale *= 1.02;
            const scaledOverlayHeight = texH * overlayScale;

            // 2. Calculate Transition Factor (0 = Narrow, 1 = Wide)
            const lerpFactor = Math.max(0, Math.min(1, (screenAR - texAR) / 0.5));

            // 3. Define the "Target Center" for the Window Cutout
            // Narrow: Cutout center is top-aligned (35% of overlay height)
            const targetCenterY_Narrow = (NARROW_CUTOUT_RATIO / 2) * scaledOverlayHeight;
            // Wide: Cutout center is screen-centered
            const targetCenterY_Wide = screenH / 2;

            let currentTargetY = targetCenterY_Narrow + lerpFactor * (targetCenterY_Wide - targetCenterY_Narrow);

            // 4. Calculate Specs
            const cutoutOffset = NARROW_CUTOUT_OFFSET + lerpFactor * (WIDE_CUTOUT_OFFSET - NARROW_CUTOUT_OFFSET);

            // 5. Calculate Stage Scaling (70% height in narrow vs 100% cover in wide)
            const scaleNarrow = (NARROW_CUTOUT_RATIO * scaledOverlayHeight) / VIDEO_NATIVE_HEIGHT;
            const scaleWide = Math.max(screenW / VIDEO_NATIVE_WIDTH, screenH / VIDEO_NATIVE_HEIGHT);
            baseWorldScale = scaleNarrow + (scaleWide - scaleNarrow) * lerpFactor;

            // 6. Horizontal anchoring (66.6% focal point)
            const focalXContent = VIDEO_NATIVE_WIDTH * 0.666;
            const pivotXContent = VIDEO_NATIVE_WIDTH * 0.5;
            const targetX = (screenW / 2) - (focalXContent - pivotXContent) * baseWorldScale;
            const scaledHalfW = (VIDEO_NATIVE_WIDTH / 2) * baseWorldScale;
            baseWorldPos.x = Math.max(Math.min(targetX, scaledHalfW), screenW - scaledHalfW);

            // 7. Apply Positions
            let worldY = currentTargetY;
            let overlayY = currentTargetY - (cutoutOffset * overlayScale);

            // 8. CLAMP: Ensure overlay top doesn't leave the top of the browser window
            const overlayTop = overlayY - (scaledOverlayHeight / 2);
            if (overlayTop > 0) {
                const shift = overlayTop;
                overlayY -= shift;
                worldY -= shift;
            }

            baseWorldPos.y = worldY;
            baseOverlayPos.x = screenW / 2;
            baseOverlayPos.y = overlayY;

            baseOverlayScale = overlayScale;
            windowOverlay.scale.set(overlayScale);
        }

        worldContainer.scale.set(baseWorldScale);
        worldContainer.x = baseWorldPos.x;
        worldContainer.y = baseWorldPos.y;

        if (windowOverlay) {
            windowOverlay.x = baseOverlayPos.x;
            windowOverlay.y = baseOverlayPos.y;
        }
    }
    window.addEventListener('resize', resize);
    resize();

    // --- MASTER TICKER (30 FPS) ---
    app.ticker.add(() => {
        logicTickCounter++;
        if (logicTickCounter >= ticksPerFrame) {
            if (videoElement.readyState >= 2) {
                videoTexture.update();
            }

            if (isPointerDown) {
                spawnTickCounter++;
                if (spawnTickCounter >= SETTINGS.spawnRate) {
                    if (lastPointerPos.x >= 0 && lastPointerPos.x <= VIDEO_NATIVE_WIDTH) {
                        spawnCar(lastPointerPos.x, lastPointerPos.y);
                    }
                    spawnTickCounter = 0;
                }
            } else {
                spawnTickCounter = 0;
            }

            // --- CAMERA SHAKE CALCULATION ---
            let totalShakeX = 0;
            let totalShakeY = 0;
            let totalShakeRot = 0;

            for (let i = activeShakes.length - 1; i >= 0; i--) {
                const s = activeShakes[i];
                const factor = s.remaining / SHAKE_SETTINGS.duration;
                const sign = s.remaining % 2 === 0 ? 1 : -1;

                totalShakeX += SHAKE_SETTINGS.xIntensity * factor * sign * s.mult;
                totalShakeY += SHAKE_SETTINGS.yIntensity * factor * sign * s.mult;
                totalShakeRot += SHAKE_SETTINGS.rotationIntensity * factor * sign * s.mult;

                s.remaining--;
                if (s.remaining <= 0) activeShakes.splice(i, 1);
            }

            // --- AMBIENT SHAKE (Handheld Camera Noise) ---
            ambientTime += (1 / TARGET_FPS);
            const w = AMBIENT_SHAKE_SETTINGS.wiggle;
            const v = AMBIENT_SHAKE_SETTINGS.vibration;

            // X-Axis Noise (Sum of 3 octaves)
            totalShakeX += (
                Math.sin(ambientTime * w.freq * 1.0) * 0.5 +
                Math.sin(ambientTime * w.freq * 2.17) * 0.3 +
                Math.sin(ambientTime * w.freq * 0.73 + 2.0) * 0.2
            ) * w.x;

            // Y-Axis Noise
            totalShakeY += (
                Math.sin(ambientTime * w.freq * 1.1 + 1.5) * 0.5 +
                Math.sin(ambientTime * w.freq * 2.33 + 0.5) * 0.3 +
                Math.sin(ambientTime * w.freq * 0.61 + 3.1) * 0.2
            ) * w.y;

            // Rotation Noise
            totalShakeRot += (
                Math.sin(ambientTime * w.freq * 0.9 + 4.0) * 0.5 +
                Math.sin(ambientTime * w.freq * 2.51 + 1.1) * 0.3 +
                Math.sin(ambientTime * w.freq * 0.67 + 0.2) * 0.2
            ) * (w.rot * Math.PI / 180);

            // Vibration (Keep simple for high-freq detail)
            totalShakeY += Math.sin(ambientTime * v.freq * Math.PI * 2) * v.y;

            // Apply Shake & Safety Zoom
            const constantZoom = 1 + SHAKE_SETTINGS.zoomIntensity;
            worldContainer.x = baseWorldPos.x + totalShakeX;
            worldContainer.y = baseWorldPos.y + totalShakeY;
            worldContainer.rotation = totalShakeRot;
            worldContainer.scale.set(baseWorldScale * constantZoom);

            if (windowOverlay) {
                windowOverlay.x = baseOverlayPos.x + totalShakeX * AMBIENT_SHAKE_SETTINGS.overlayMult;
                windowOverlay.y = baseOverlayPos.y + totalShakeY * AMBIENT_SHAKE_SETTINGS.overlayMult;
                windowOverlay.scale.set(baseOverlayScale * constantZoom);
            }

            // Cows
            cows.forEach(container => {
                container.x += container.vx;
                const nextFrame = (container.anim.currentFrame + 1) % container.anim.totalFrames;
                container.anim.gotoAndStop(nextFrame);
                if (container.vx > 0 && container.x > VIDEO_NATIVE_WIDTH + 300) resetCow(container);
                if (container.vx < 0 && container.x < -300) resetCow(container);
            });

            // Cars
            for (let i = cars.length - 1; i >= 0; i--) {
                const carCont = cars[i];
                carCont.x += carCont.vx;

                if (!carCont.isFinished) {
                    const nextFrame = carCont.anim.currentFrame + 1;

                    if (nextFrame === SHAKE_SETTINGS.triggerFrame && !carCont.shakeTriggered) {
                        // Pass the distance multiplier to the shake instance
                        activeShakes.push({ remaining: SHAKE_SETTINGS.duration, mult: carCont.shakeMult });
                        carCont.shakeTriggered = true;

                        // --- PLAY RANDOM CRASH SOUND ---
                        if (typeof PIXI !== 'undefined' && PIXI.sound) {
                            let rand;
                            do {
                                rand = Math.floor(Math.random() * 7) + 1;
                            } while (rand === lastCrashIndex);
                            lastCrashIndex = rand;

                            PIXI.sound.play(`crash${rand}`, {
                                volume: carCont.shakeMult * 0.5
                            });
                        }
                    }

                    if (nextFrame < carCont.anim.totalFrames) {
                        carCont.anim.gotoAndStop(nextFrame);
                    } else {
                        carCont.isFinished = true;
                    }
                }

                if (carCont.x < -1000 || carCont.x > VIDEO_NATIVE_WIDTH + 1000) {
                    spriteLayer.removeChild(carCont);
                    cars.splice(i, 1);
                }
            }

            spriteLayer.children.sort((a, b) => a.y - b.y);

            // Handle Instruction Text Fade
            if (carSpawned && instructionText && instructionText.alpha > 0) {
                instructionText.alpha -= 1 / (TARGET_FPS * 1); // Fade over 1 second
                if (instructionText.alpha <= 0) {
                    app.stage.removeChild(instructionText);
                    instructionText = null;
                }
            }

            logicTickCounter = 0;
        }
    });
}
setup();