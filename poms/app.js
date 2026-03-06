// =======================================================
// CONFIGURATION & SETUP
// =======================================================
const MOVE_ANGLE_DEG = 50;
const SPREAD_STRENGTH = -40;
const BASE_SPEED = 4;
const MAX_SPEED_FACTOR = 3.0;
const SPAWN_RANDOMNESS = 1.0;

const SHOCKWAVE_KEY = 'shockwave';
const SHOCKWAVE_SPEED_MULT = 0.3;

const SHAKE_DURATION = 8;
const SHAKE_MAX_Y = 10;
const SHAKE_MAX_X = 2;
const SHAKE_MAX_ROT = 0.5;

const SPAWN_LINE_START = { x: 0.05, y: 0.2 };
const SPAWN_LINE_END = { x: 0.7, y: 0.0 };

const CODE_MAP = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

const DRAG_SPAWN_RATE = 4; // Spawns every N ticks while dragging (smaller = faster)

const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 800;

const spritePool = [];
const activeSprites = [];
let assetNames = Array.from({ length: 10 }, (_, i) => `char_${(i + 1).toString().padStart(2, '0')}`);

let tickCount = 0;
let shakeTimer = 0;
let hasPressedKey = false;
let isPointerDown = false;
let pointerX = 0;
let lastSpawnTick = -999;
let instructionText;
let loadingAnim; // Global ref for the loading sprite

// =======================================================
// CORE PIXI INITIALIZATION
// =======================================================
const app = new PIXI.Application();
const camera = new PIXI.Container();

async function init() {
    await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        roundPixels: true,
    });

    app.ticker.maxFPS = 60;
    document.body.appendChild(app.canvas || app.view);

    app.stage.addChild(camera);
    camera.sortableChildren = true;

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    camera.pivot.set(centerX, centerY);
    camera.x = centerX;
    camera.y = centerY;

    instructionText = new PIXI.Text({
        text: 'Starting...',
        style: {
            fontFamily: 'Roboto, sans-serif',
            fontSize: 20,
            fill: 0xffffff,
            align: 'center',
        }
    });
    instructionText.anchor.set(0.5);
    instructionText.x = centerX;
    instructionText.y = centerY + 80; // Pushed down to make room for anim
    app.stage.addChild(instructionText);

    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        app.stage.hitArea = app.screen;
        const nx = app.screen.width / 2;
        const ny = app.screen.height / 2;
        camera.pivot.set(nx, ny);
        camera.x = nx;
        camera.y = ny;
        if (instructionText) {
            instructionText.x = nx;
            instructionText.y = ny + 80;
        }
        if (loadingAnim) {
            loadingAnim.x = nx;
            loadingAnim.y = ny;
        }
    });

    await loadAssets();
    setupInteraction();
}

async function loadAssets() {
    // 1. Load the Loading Animation FIRST
    await PIXI.Assets.load('assets/loading.json');
    const loadSheet = PIXI.Assets.get('assets/loading.json');
    const loadAnimKeys = Object.keys(loadSheet.animations);

    loadingAnim = new PIXI.AnimatedSprite(loadSheet.animations[loadAnimKeys[0]]);
    loadingAnim.anchor.set(0.5);
    loadingAnim.x = app.screen.width / 2;
    loadingAnim.y = app.screen.height / 2;
    loadingAnim.animationSpeed = 1; // 60fps
    loadingAnim.play();
    app.stage.addChild(loadingAnim);

    // 2. Load the main assets
    const assetFolder = (window.innerWidth < 800) ? 'mobile' : 'desktop';
    const totalAssets = assetNames.length + 1;
    let loadedCount = 0;

    const updateProgress = () => {
        loadedCount++;
        instructionText.text = `Loading ${loadedCount}/${totalAssets}`;
    };

    const assetManifest = assetNames.map(name => ({
        alias: name,
        src: `assets/${assetFolder}/${name}_${assetFolder}.json`,
    }));
    assetManifest.push({
        alias: SHOCKWAVE_KEY,
        src: `assets/${assetFolder}/${SHOCKWAVE_KEY}_${assetFolder}.json`
    });

    for (const asset of assetManifest) {
        await PIXI.Assets.load(asset);
        updateProgress();
    }

    // 3. Clean up loading animation
    app.stage.removeChild(loadingAnim);
    loadingAnim.destroy();
    loadingAnim = null;

    instructionText.text = isMobile
        ? "Tap the screen to spawn Poms"
        : "Press QWERTYUIOP to spawn Poms";
    instructionText.y = app.screen.height / 2; // Center text now that anim is gone

    app.ticker.add(gameLoop);
}

function setupInteraction() {
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const keyIndex = CODE_MAP.indexOf(e.code);
        if (keyIndex !== -1) {
            hasPressedKey = true;
            const t = keyIndex / (CODE_MAP.length - 1);
            const textureKey = assetNames[Math.floor(Math.random() * assetNames.length)];
            spawnPair(t, textureKey);
            shakeTimer = SHAKE_DURATION;
        }
    });

    app.stage.on('pointerdown', (e) => {
        isPointerDown = true;
        pointerX = e.global.x;
        hasPressedKey = true;
        spawnAtPointer();
    });

    app.stage.on('pointermove', (e) => {
        pointerX = e.global.x;
    });

    app.stage.on('pointerup', () => { isPointerDown = false; });
    app.stage.on('pointerupoutside', () => { isPointerDown = false; });
}

function spawnAtPointer() {
    const t = pointerX / app.screen.width;
    const textureKey = assetNames[Math.floor(Math.random() * assetNames.length)];
    spawnPair(t, textureKey);
    shakeTimer = SHAKE_DURATION;
    lastSpawnTick = tickCount;
}

function spawnPair(t, charKey) {
    const randomOffset = (Math.random() - 0.5) * (1 / 9) * SPAWN_RANDOMNESS;
    const finalT = Math.max(0, Math.min(1, t + randomOffset));

    const startX = app.screen.width * SPAWN_LINE_START.x;
    const startY = app.screen.height * SPAWN_LINE_START.y;
    const endX = app.screen.width * SPAWN_LINE_END.x;
    const endY = app.screen.height * SPAWN_LINE_END.y;

    const posX = startX + finalT * (endX - startX);
    const posY = startY + finalT * (endY - startY);

    const angleOffset = (finalT - 0.5) * SPREAD_STRENGTH;
    const radians = (MOVE_ANGLE_DEG + angleOffset) * (Math.PI / 180);

    [false, true].forEach(isShockwave => {
        const key = isShockwave ? SHOCKWAVE_KEY : charKey;
        const sprite = getSpriteFromPool(key, isShockwave);
        if (sprite) {
            sprite.x = posX;
            sprite.y = posY;
            sprite.scale.set(MIN_SCALE);
            const speed = isShockwave ? (BASE_SPEED * SHOCKWAVE_SPEED_MULT) : BASE_SPEED;
            sprite.vx_base = Math.cos(radians) * speed;
            sprite.vy_base = Math.sin(radians) * speed;
            sprite.gotoAndStop(0);
            sprite.visible = true;
            if (!activeSprites.includes(sprite)) activeSprites.push(sprite);
        }
    });
}

function getSpriteFromPool(textureKey, isShockwave = false) {
    let sprite = spritePool.find(s => s.textureKey === textureKey && !s.visible && !activeSprites.includes(s));
    if (!sprite) {
        const sheet = PIXI.Assets.get(textureKey);
        const animKeys = Object.keys(sheet.animations);
        if (animKeys.length === 0) return null;

        sprite = new PIXI.AnimatedSprite(sheet.animations[animKeys[0]]);
        sprite.autoUpdate = false;
        sprite.loop = false;
        sprite.anchor.set(0.5, 0.70);
        sprite.visible = false;
        sprite.textureKey = textureKey;
        sprite.isShockwave = isShockwave;

        if (isShockwave) {
            sprite.blendMode = 'screen';
            sprite.anchor.set(0.45, 0.25);
        }

        camera.addChild(sprite);
        spritePool.push(sprite);
    }
    return sprite;
}

function gameLoop() {
    tickCount++;

    if (hasPressedKey && instructionText && instructionText.alpha > 0) {
        instructionText.alpha -= 0.034;
        if (instructionText.alpha <= 0) {
            app.stage.removeChild(instructionText);
            instructionText.destroy();
            instructionText = null;
        }
    }

    if (tickCount % 2 === 0) {
        if (isPointerDown && (tickCount - lastSpawnTick >= DRAG_SPAWN_RATE)) {
            spawnAtPointer();
        }

        const centerX = app.screen.width / 2;
        const centerY = app.screen.height / 2;

        if (shakeTimer > 0) {
            const intensity = shakeTimer / SHAKE_DURATION;
            camera.x = centerX + (Math.random() * 2 - 1) * SHAKE_MAX_X * intensity;
            camera.y = centerY + (Math.random() * 2 - 1) * SHAKE_MAX_Y * intensity;
            camera.rotation = (Math.random() * 2 - 1) * (SHAKE_MAX_ROT * Math.PI / 180) * intensity;
            shakeTimer--;
        } else {
            camera.x = centerX; camera.y = centerY; camera.rotation = 0;
        }

        for (let i = activeSprites.length - 1; i >= 0; i--) {
            const sprite = activeSprites[i];
            if (!sprite.visible) { activeSprites.splice(i, 1); continue; }

            const depthFactor = Math.max(0, sprite.y / app.screen.height);
            const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * depthFactor;
            const speedMultiplier = 1 + (MAX_SPEED_FACTOR - 1) * depthFactor;

            sprite.scale.set(scale);
            sprite.zIndex = sprite.isShockwave ? (scale - 10) : scale;
            sprite.x += sprite.vx_base * speedMultiplier * 2;
            sprite.y += sprite.vy_base * speedMultiplier * 2;

            if (sprite.currentFrame < sprite.totalFrames - 1) {
                sprite.gotoAndStop(sprite.currentFrame + 1);
            } else {
                sprite.visible = false;
                sprite.stop();
            }

            if (sprite.x > app.screen.width + 800 || sprite.x < -800 ||
                sprite.y > app.screen.height + 800 || sprite.y < -800) {
                sprite.visible = false;
            }
        }
        camera.sortChildren();
    }
}

init();