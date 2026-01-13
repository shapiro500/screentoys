// --- Configuration & Constants ---
const RANDOM_OFFSET = 10; // Pixels
const DEBUG_HITBOXES = false; // Set to true to see hitboxes
const KING_WAVE_DELAY_PER_100PX = 1; // 1 frame per 100px
const SPAWN_INTERVAL = 4; // Frames between spawns when holding mouse
const CONTINUOUS_SPAWN_DELAY_MS = 200; // Delay before continuous spawning starts after first click (ms)

const BOARD_CORNERS = {
    topLeft: { x: 709, y: 668 },
    topRight: { x: 1516, y: 764 },
    bottomRight: { x: 1430, y: 1420 },
    bottomLeft: { x: 474, y: 1282 }
};

const SCALE_FACTOR = 0.0004; // How much pieces scale based on Y position
const PERSPECTIVE_REFERENCE_Y = 1003 - 1024; // Central Y coordinate in board space (centered at -21 local)

const PIECE_TYPES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

const PIECE_HITBOX_CONFIG = {
    pawn: { w: 60, h: 50 },
    knight: { w: 70, h: 50 },
    bishop: { w: 70, h: 50 },
    rook: { w: 80, h: 50 },
    queen: { w: 80, h: 50 },
    king: { w: 80, h: 50 }
};

const CAMERA_WIGGLE = {
    frequency: 0.03,  // Speed of movement
    amplitudeX: 1,  // Max X offset
    amplitudeY: 3,  // Max Y offset
    amplitudeRotation: 0.001 // Max rotation in radians
};

const CAMERA_OVERSCAN = 1.01; // Scale up the whole scene to hide edges (1.01 = 1%)

const PROMOTION_PAWN_CHANCE = 0.5; // 50% chance for a pawn during wave promotion
const INITIAL_SPAWN_INTERVAL = 2; // Ticks between spawns at game start
const INITIAL_SPAWN_DELAY = 0; // Ticks before board setup starts (1/6th second at 60fps)

// --- App Setup ---
const app = new PIXI.Application();

async function init() {
    await app.init({
        resizeTo: window,
        backgroundColor: 0x000000,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
    });
    document.getElementById('app-container').appendChild(app.canvas);

    app.ticker.maxFPS = 60;

    // --- Loading UI ---
    await PIXI.Assets.load('assets/loading.json');
    await document.fonts.ready;
    const loadingContainer = new PIXI.Container();
    app.stage.addChild(loadingContainer);

    const loadingSheet = PIXI.Assets.get('assets/loading.json');
    const loadingAnim = new PIXI.AnimatedSprite(loadingSheet.animations.loading);
    loadingAnim.anchor.set(0.5);
    loadingAnim.animationSpeed = 0.5; // 30fps at 60fps ticker
    loadingAnim.play();
    loadingContainer.addChild(loadingAnim);

    const loadingText = new PIXI.Text({
        text: 'Loading 0/10 assets',
        style: {
            fontFamily: 'Roboto',
            fontSize: 24,
            fill: 0xffffff,
            padding: 10
        }
    });
    loadingText.anchor.set(0.5);
    loadingText.y = 100;
    loadingContainer.addChild(loadingText);

    const positionLoadingUI = () => {
        loadingContainer.x = app.screen.width / 2;
        loadingContainer.y = app.screen.height / 2;
    };
    positionLoadingUI();
    window.addEventListener('resize', positionLoadingUI);

    // Prepare Assets
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const assetPath = isMobile ? 'assets/mobile/' : 'assets/desktop/';
    const assetSuffix = isMobile ? '_mobile' : '_desktop';

    const assetManifest = [
        { alias: 'pieces', src: `${assetPath}pieces${assetSuffix}.json` },
        { alias: 'board', src: 'assets/boardphoto.webp' },
        { alias: 'table', src: 'assets/table.webp' },
        { alias: 'logo', src: 'assets/logo.webp' },
    ];

    const soundFiles = [
        { name: 'capture', src: 'assets/sounds/capture.mp3' },
        { name: 'gameEnd', src: 'assets/sounds/game-end.mp3' },
        { name: 'promote', src: 'assets/sounds/promote.mp3' },
        { name: 'check', src: 'assets/sounds/move-check.mp3' },
        { name: 'moveSelf', src: 'assets/sounds/move-self.mp3' },
        { name: 'moveOpponent', src: 'assets/sounds/move-opponent.mp3' },
        { name: 'bg', src: 'assets/sounds/bg.mp3' }
    ];

    const totalAssets = assetManifest.length + soundFiles.length;
    let loadedAssets = 0;

    const updateProgress = () => {
        loadedAssets++;
        loadingText.text = `Loading ${loadedAssets}/${totalAssets} assets`;
    };

    // Load assets and sounds
    const assetsPromises = assetManifest.map(a => {
        PIXI.Assets.add(a);
        return PIXI.Assets.load(a.alias).then(res => {
            updateProgress();
            return [a.alias, res];
        });
    });

    const soundPromises = soundFiles.map(s => {
        return new Promise((resolve) => {
            PIXI.sound.add(s.name, {
                url: s.src,
                preload: true,
                loaded: (err, sound) => {
                    updateProgress();
                    if (err) {
                        console.error(`Error loading sound ${s.name}:`, err);
                    }
                    resolve([s.name, sound]);
                }
            });
        });
    });

    const [loadedGameAssetsArr] = await Promise.all([
        Promise.all(assetsPromises),
        Promise.all(soundPromises)
    ]);

    const assets = Object.fromEntries(loadedGameAssetsArr);

    // Hide loading screen
    window.removeEventListener('resize', positionLoadingUI);
    loadingContainer.visible = false;
    loadingContainer.destroy({ children: true });

    // Start background music
    if (PIXI.sound.exists('bg')) {
        PIXI.sound.play('bg', {
            loop: true,
            volume: 0.5
        });
    }


    const worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    const boardSprite = new PIXI.Sprite(assets.board);
    boardSprite.anchor.set(0.5);
    worldContainer.addChild(boardSprite);

    const shadowContainer = new PIXI.Container();
    const tableMask = new PIXI.Sprite(assets.table);
    tableMask.anchor.set(0.5);
    shadowContainer.mask = tableMask;

    const onTableContainer = new PIXI.Container();
    const thrownContainer = new PIXI.Container();
    const debugContainer = new PIXI.Container();

    onTableContainer.sortableChildren = true;
    thrownContainer.sortableChildren = true;
    shadowContainer.sortableChildren = true;

    worldContainer.addChild(shadowContainer);
    worldContainer.addChild(tableMask);
    worldContainer.addChild(onTableContainer);
    worldContainer.addChild(thrownContainer);
    worldContainer.addChild(debugContainer);

    const logoSprite = new PIXI.Sprite(assets.logo);
    logoSprite.anchor.set(0.5);
    worldContainer.addChild(logoSprite);

    let isWaitingForFirstTap = true;
    let isLogoFading = false;
    let logoFadeStartTime = 0;
    const LOGO_FADE_DURATION = 250;

    let needsTableSort = false;
    let needsShadowSort = false;

    function requestTableSort() {
        onTableContainer.sortDirty = true;
    }
    function requestShadowSort() {
        shadowContainer.sortDirty = true;
    }

    function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const boardSize = 2048;

        // "Cover" logic: ensure the board covers the entire screen
        const scale = Math.max(width / boardSize, height / boardSize) * CAMERA_OVERSCAN;

        worldContainer.scale.set(scale);
        worldContainer.centerPos = { x: width / 2, y: height / 2 };
        worldContainer.position.set(worldContainer.centerPos.x, worldContainer.centerPos.y);
    }

    window.addEventListener('resize', resize);
    resize();

    function isPointInQuad(p, quad) {
        const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const s1 = cross(quad.topLeft, quad.topRight, p) >= 0;
        const s2 = cross(quad.topRight, quad.bottomRight, p) >= 0;
        const s3 = cross(quad.bottomRight, quad.bottomLeft, p) >= 0;
        const s4 = cross(quad.bottomLeft, quad.topLeft, p) >= 0;
        return (s1 === s2 && s2 === s3 && s3 === s4);
    }

    function closestPointOnSegment(p, a, b) {
        const atob = { x: b.x - a.x, y: b.y - a.y };
        const atop = { x: p.x - a.x, y: p.y - a.y };
        const lenSq = atob.x * atob.x + atob.y * atob.y;
        let t = (atop.x * atob.x + atop.y * atob.y) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return { x: a.x + t * atob.x, y: a.y + t * atob.y };
    }

    function clampToQuad(p, quad) {
        if (isPointInQuad(p, quad)) return p;
        const edges = [[quad.topLeft, quad.topRight], [quad.topRight, quad.bottomRight], [quad.bottomRight, quad.bottomLeft], [quad.bottomLeft, quad.topLeft]];
        let minDrawDist = Infinity;
        let closestPoint = { x: p.x, y: p.y };
        for (const [a, b] of edges) {
            const pProjected = closestPointOnSegment(p, a, b);
            const dist = Math.hypot(p.x - pProjected.x, p.y - pProjected.y);
            if (dist < minDrawDist) {
                minDrawDist = dist;
                closestPoint = pProjected;
            }
        }
        return closestPoint;
    }

    function screenToBoardSpace(screenX, screenY) {
        const local = worldContainer.toLocal(new PIXI.Point(screenX, screenY));
        const texX = local.x + 1024;
        const texY = local.y + 1024;
        return clampToQuad({ x: texX, y: texY }, BOARD_CORNERS);
    }

    class Piece {
        constructor() {
            this.sprite = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY]);
            this.shadow = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY]);
            this.sprite.anchor.set(0.5);
            this.shadow.anchor.set(0.5);
            this.hitboxGraphic = new PIXI.Graphics();
            this.type = 'pawn';
            this.color = 'white';
            this.state = 'hidden';
            this.currentFrame = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.waveDelay = 0;
            this.pendingAction = null;
            this.targetType = 'pawn';
        }

        reset(type, color, x, y, targetType = 'pawn') {
            this.type = type;
            this.color = color;
            this.targetType = targetType;
            this.targetX = x - 1024;
            this.targetY = y - 1024;
            this.state = 'thrown';

            // Calculate starting frame based on aspect ratio
            // Square (1:1) -> frame 0, 16:9 (1.77) -> frame 6
            const aspectRatio = window.innerWidth / window.innerHeight;
            const t = Math.max(0, Math.min(1, (aspectRatio - 1) / (1.777 - 1)));
            this.currentFrame = Math.round(t * 6);

            this.waveDelay = 0;
            this.pendingAction = null;
            this.updateAnimations();
            this.sprite.gotoAndStop(this.currentFrame);
            this.shadow.gotoAndStop(this.currentFrame);
            this.sprite.position.set(this.targetX, this.targetY);
            this.shadow.position.set(this.targetX, this.targetY);

            // Calculate perspective scale
            const distFromRef = this.targetY - PERSPECTIVE_REFERENCE_Y;
            const currentScale = 1 + (distFromRef * SCALE_FACTOR);
            this.sprite.scale.set(currentScale);
            this.shadow.scale.set(currentScale);

            this.sprite.zIndex = this.targetY;
            thrownContainer.addChild(this.sprite);
            thrownContainer.sortDirty = true;

            this.shadow.zIndex = this.targetY;
            shadowContainer.addChild(this.shadow);
            shadowContainer.sortDirty = true;

            if (DEBUG_HITBOXES) debugContainer.addChild(this.hitboxGraphic);
            this.sprite.visible = true;
            this.shadow.visible = true;
            this.hitboxGraphic.visible = DEBUG_HITBOXES;
        }

        updateAnimations() {
            if (!assets.pieces || !assets.pieces.animations) return;
            const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
            const animName = `${this.color}${cap(this.type)}`;
            this.sprite.textures = assets.pieces.animations[animName] || [PIXI.Texture.EMPTY];
            this.shadow.textures = assets.pieces.animations[animName + '_Shdw'] || this.sprite.textures;
        }

        capture(isWave = false) {
            if (this.state === 'captured') return;
            this.state = 'captured';
            this.currentFrame = 0;
            const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
            if (assets.pieces && assets.pieces.animations) {
                this.sprite.textures = assets.pieces.animations[`capture${cap(this.type)}`] || [PIXI.Texture.EMPTY];
            }
            this.shadow.visible = false;
            if (this.type === 'king' && !isWave) {
                PIXI.sound.play('gameEnd');
                startKingWave(this, 'capture');
            } else if (!isWave) {
                PIXI.sound.play('capture');
            }
        }

        promote(isWave = false, targetType = null, isInitial = false) {
            if (this.state === 'thrown' || this.state === 'captured' || this.state === 'hidden') return; // Don't allow promotion for invalid states

            const wasKing = (this.type === 'king');

            if (targetType) {
                this.type = targetType;
            } else if (isWave) {
                // Promote to a random rank
                if (Math.random() < PROMOTION_PAWN_CHANCE) {
                    this.type = 'pawn';
                } else {
                    const nonPawnTypes = PIECE_TYPES.filter(t => t !== 'pawn');
                    this.type = nonPawnTypes[Math.floor(Math.random() * nonPawnTypes.length)];
                }
            } else {
                const index = PIECE_TYPES.indexOf(this.type);
                if (index < PIECE_TYPES.length - 1) {
                    this.type = PIECE_TYPES[index + 1];
                }
            }
            this.updateAnimations();

            // If we get promoted while still in the air (e.g. by a wave),
            // we should be moved to the onTableContainer immediately so we are sorted correctly.
            if (this.sprite.parent === thrownContainer) {
                onTableContainer.addChild(this.sprite);
                requestTableSort();
            }

            this.state = 'promoting';
            this.shadow.visible = true; // Ensure shadow is visible
            // If we promote to a pawn, skip the "thrown" part of the animation (frames 0-15)
            this.currentFrame = (this.type === 'pawn') ? 16 : 0;
            this.sprite.gotoAndStop(this.currentFrame);
            this.shadow.gotoAndStop(this.currentFrame);
            if (!isWave && !isInitial && this.type === 'king') {
                PIXI.sound.play('check');
                // ONLY trigger the universal promotion wave if we hit a piece that was ALREADY a King.
                if (wasKing) {
                    startKingWave(this, 'promote');
                }
            } else {
                // Play promotion sound unless it's initial and it's a king (to purely follow "no check sound" rule)
                // or maybe just play regular promote sound. 
                // Given the request, just skip the 'check' branch.
                PIXI.sound.play('promote');
            }
        }

        updateTick() {
            if (this.state === 'hidden') return;
            if (this.waveDelay > 0) {
                this.waveDelay--;
                if (this.waveDelay === 0 && this.pendingAction) {
                    if (this.pendingAction === 'capture') this.capture(true);
                    else if (this.pendingAction === 'promote') this.promote(true);
                    this.pendingAction = null;
                    requestTableSort();
                } else {
                    return;
                }
            }

            if (this.state === 'thrown') {
                const targetFrame = Math.min(this.currentFrame, this.sprite.totalFrames - 1);
                this.sprite.gotoAndStop(targetFrame);
                this.shadow.gotoAndStop(targetFrame);

                if (this.currentFrame === 16) {
                    this.land();
                }
                this.currentFrame++;
            } else if (this.state === 'captured') {
                this.sprite.gotoAndStop(Math.min(this.currentFrame, this.sprite.totalFrames - 1));
                if (this.currentFrame >= this.sprite.totalFrames) this.hide();
                this.currentFrame++;
            } else if (this.state === 'onTable' || this.state === 'promoting') {
                // Safeguard: Ensure pieces in board states are in the correct container
                if (this.sprite.parent === thrownContainer) {
                    onTableContainer.addChild(this.sprite);
                    requestTableSort();
                }

                // Continue playing animation from where it left off (thrown) or from 0 (promoting)
                const targetFrame = Math.min(this.currentFrame, this.sprite.totalFrames - 1);
                this.sprite.gotoAndStop(targetFrame);
                this.shadow.gotoAndStop(targetFrame);

                if (this.state === 'promoting' && this.currentFrame >= this.sprite.totalFrames) {
                    this.state = 'onTable'; // Animation finished, stay on last frame
                }

                this.currentFrame++;
            }
            if (DEBUG_HITBOXES) this.drawDebug();
        }

        land() {
            const collisions = checkCollisions(this);
            let consumedByPromotion = false;

            for (const other of collisions) {
                if (other.color === this.color) {
                    consumedByPromotion = true;
                    other.promote();
                } else {
                    other.capture();
                }
            }

            // Mark as onTable first so initial setup promotions work correctly
            this.state = 'onTable';

            // Initial board setup pieces promote to their final type upon landing
            const isInitialSetupPromotion = (this.targetType && this.targetType !== 'pawn');
            if (isInitialSetupPromotion) {
                this.promote(false, this.targetType, true);
            }

            if (consumedByPromotion) {
                this.hide();
            } else {
                // Piece remains on table
                if (this.sprite.parent !== onTableContainer) {
                    this.sprite.zIndex = this.targetY;
                    onTableContainer.addChild(this.sprite);
                    requestTableSort();
                }

                // Play sound if not part of silent initial setup
                if (!isInitialSetupPromotion) {
                    if (this.color === 'white') {
                        PIXI.sound.play('moveSelf');
                    } else {
                        PIXI.sound.play('moveOpponent');
                    }
                }
            }
        }

        hide() {
            this.state = 'hidden';
            this.sprite.visible = false;
            this.shadow.visible = false;
            this.hitboxGraphic.visible = false;
            if (this.sprite.parent) this.sprite.parent.removeChild(this.sprite);
            if (this.shadow.parent) this.shadow.parent.removeChild(this.shadow);
            if (this.hitboxGraphic.parent) this.hitboxGraphic.parent.removeChild(this.hitboxGraphic);
            piecePool.push(this);
        }

        getHitbox() {
            const config = PIECE_HITBOX_CONFIG[this.type];
            const scale = this.sprite.scale.x;
            return {
                x: this.sprite.x - (config.w * scale) / 2,
                y: this.sprite.y - (config.h * scale) / 2,
                w: config.w * scale,
                h: config.h * scale
            };
        }

        drawDebug() {
            if (!DEBUG_HITBOXES) {
                this.hitboxGraphic.visible = false;
                return;
            }
            this.hitboxGraphic.visible = true;
            const hb = this.getHitbox();

            // Color based on container to help debug "stuck" pieces
            let debugColor = 0xffffff; // Default white
            if (this.sprite.parent === onTableContainer) {
                debugColor = 0x0000ff; // Blue for pieces on the table
            } else if (this.sprite.parent === thrownContainer) {
                debugColor = 0xffff00; // Yellow for pieces in the air (thrown)
            }

            this.hitboxGraphic.clear()
                .rect(hb.x, hb.y, hb.w, hb.h)
                .stroke({
                    width: 2,
                    color: debugColor
                });
        }
    }

    const piecePool = [];
    const activePieces = [];

    function spawnPiece(x, y, color, targetType = 'pawn') {
        let rx = x + (Math.random() * 2 - 1) * RANDOM_OFFSET;
        let ry = y + (Math.random() * 2 - 1) * RANDOM_OFFSET;
        const clamped = clampToQuad({ x: rx, y: ry }, BOARD_CORNERS);
        let piece = piecePool.pop() || new Piece();
        piece.reset('pawn', color, clamped.x, clamped.y, targetType);
        activePieces.push(piece);
    }

    function checkCollisions(thrownPiece) {
        const hb = thrownPiece.getHitbox();
        const results = [];
        for (const other of activePieces) {
            // Include pieces that are on the table OR currently promoting
            if (other === thrownPiece || (other.state !== 'onTable' && other.state !== 'promoting')) continue;
            const ohb = other.getHitbox();
            if (hb.x < ohb.x + ohb.w && hb.x + hb.w > ohb.x && hb.y < ohb.y + ohb.h && hb.y + hb.h > ohb.y) results.push(other);
        }
        return results;
    }

    function startKingWave(king, action) {
        for (const p of activePieces) {
            // Exclude pieces that are currently in the air (thrown), captured, or already hidden.
            // This prevents pieces from being "resurrected" if they were just captured.
            if (p === king || p.color !== king.color || p.state === 'hidden' || p.state === 'thrown' || p.state === 'captured') continue;
            const dx = p.sprite.x - king.sprite.x;
            const dy = p.sprite.y - king.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            p.waveDelay = Math.floor(dist / 100) * KING_WAVE_DELAY_PER_100PX;
            if (p.waveDelay === 0) {
                if (action === 'capture') p.capture(true);
                else if (action === 'promote') p.promote(true);
            } else {
                p.pendingAction = action;
            }
        }
        requestTableSort();
    }

    let nextColor = 'white';
    let isMouseDown = false;
    let mouseDownTime = 0;
    let mousePos = { x: 0, y: 0 };
    let lastSpawnTick = 0;

    app.canvas.addEventListener('pointerdown', (e) => {
        // Start background music if it was blocked by autoplay
        if (PIXI.sound.exists('bg') && !PIXI.sound.find('bg').isPlaying) {
            PIXI.sound.play('bg', { loop: true, volume: 0.5 });
        }

        if (isWaitingForFirstTap) {
            isWaitingForFirstTap = false;
            isLogoFading = true;
            logoFadeStartTime = Date.now();
            return;
        }

        if (isLogoFading) return;

        isMouseDown = true;
        mouseDownTime = Date.now();
        mousePos = { x: e.clientX, y: e.clientY };

        // Spawn immediately on click
        const boardPos = screenToBoardSpace(mousePos.x, mousePos.y);
        spawnPiece(boardPos.x, boardPos.y, nextColor);
        nextColor = nextColor === 'white' ? 'black' : 'white';
        lastSpawnTick = masterTick;
        updateStatsUI();
    });

    window.addEventListener('pointermove', (e) => {
        mousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', () => isMouseDown = false);
    window.addEventListener('pointercancel', () => isMouseDown = false);
    window.addEventListener('pointerleave', () => isMouseDown = false);
    window.addEventListener('blur', () => isMouseDown = false);

    let masterTick = 0;

    // 1D Gradient Noise for organic handheld movement
    function getNoise(time, offset) {
        const t = time + offset;
        const i = Math.floor(t);
        const f = t - i;

        // Smoothstep interpolation curve
        const curve = f * f * (3 - 2 * f);

        // Pseudo-random gradient generator
        const hash = (x) => {
            const h = Math.sin(x) * 43758.5453123;
            return h - Math.floor(h);
        };

        const g0 = hash(i) * 2 - 1;
        const g1 = hash(i + 1) * 2 - 1;

        // Interpolate between the gradients
        return g0 * (1 - curve) + g1 * curve;
    }

    const statElements = {
        white: {},
        black: {}
    };

    function initStatsUI() {
        const pieceOrder = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
        const colors = ['white', 'black'];

        colors.forEach(color => {
            const rowTarget = document.getElementById(`${color}-stats`);
            if (!rowTarget) return;
            rowTarget.innerHTML = '';
            pieceOrder.forEach(type => {
                const item = document.createElement('div');
                item.className = 'stats-item';
                item.innerHTML = `
                    <img src="assets/icons/${color}${type}.png" class="stats-icon" alt="${type}">
                    <span id="${color}-${type}-count">0</span>
                `;
                rowTarget.appendChild(item);
                statElements[color][type] = item.querySelector('span');
            });
        });
    }

    function updateStatsUI() {
        const counts = {
            white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
            black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
        };

        for (const p of activePieces) {
            if (p.state !== 'captured' && p.state !== 'hidden') {
                counts[p.color][p.type]++;
            }
        }

        for (const color in counts) {
            for (const type in counts[color]) {
                const el = statElements[color][type];
                if (el) {
                    const val = counts[color][type];
                    if (el.textContent !== val.toString()) {
                        el.textContent = val;
                    }
                }
            }
        }
    }

    // Initial stats setup and update
    initStatsUI();
    updateStatsUI();

    const setupQueue = [];
    function setupInitialBoard() {
        const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

        function getBoardPos(file, rank) {
            const u = (file + 0.5) / 8;
            const v = (rank + 0.5) / 8;
            const A = BOARD_CORNERS.topLeft;
            const B = BOARD_CORNERS.topRight;
            const C = BOARD_CORNERS.bottomRight;
            const D = BOARD_CORNERS.bottomLeft;
            const x = (1 - u) * (1 - v) * A.x + u * (1 - v) * B.x + u * v * C.x + (1 - u) * v * D.x;
            const y = (1 - u) * (1 - v) * A.y + u * (1 - v) * B.y + u * v * C.y + (1 - u) * v * D.y;
            return { x, y };
        }

        // Black pieces (Ranks 0 and 1)
        for (let f = 0; f < 8; f++) {
            setupQueue.push({ pos: getBoardPos(f, 0), color: 'black', type: backRank[f] });
            setupQueue.push({ pos: getBoardPos(f, 1), color: 'black', type: 'pawn' });
        }
        // White pieces (Ranks 6 and 7)
        for (let f = 0; f < 8; f++) {
            setupQueue.push({ pos: getBoardPos(f, 6), color: 'white', type: 'pawn' });
            setupQueue.push({ pos: getBoardPos(f, 7), color: 'white', type: backRank[f] });
        }

        // Shuffle the queue for random spawn order
        for (let i = setupQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [setupQueue[i], setupQueue[j]] = [setupQueue[j], setupQueue[i]];
        }
    }

    setupInitialBoard();
    let nextSetupTick = masterTick + INITIAL_SPAWN_DELAY;

    let logicAccumulator = 0;
    const MS_PER_TICK = 1000 / 60;

    app.ticker.add((ticker) => {
        logicAccumulator += ticker.deltaMS;

        // Cap the accumulator to prevent "spiral of death" or massive jumps after backgrounding
        if (logicAccumulator > 100) logicAccumulator = 100;

        let pieceChangedThisFrame = false;

        while (logicAccumulator >= MS_PER_TICK) {
            logicAccumulator -= MS_PER_TICK;
            masterTick++;

            if (isLogoFading) {
                const elapsed = Date.now() - logoFadeStartTime;
                const progress = Math.min(1, elapsed / LOGO_FADE_DURATION);
                logoSprite.alpha = 1 - progress;
                if (progress >= 1) {
                    isLogoFading = false;
                    logoSprite.visible = false;
                    logoSprite.destroy();
                    // Reset masterTick or nextSetupTick to start spawning now
                    nextSetupTick = masterTick + INITIAL_SPAWN_DELAY;
                }
            }

            // Initial setup spawning
            if (!isWaitingForFirstTap && !isLogoFading && setupQueue.length > 0 && masterTick >= nextSetupTick) {
                const item = setupQueue.shift();
                spawnPiece(item.pos.x, item.pos.y, item.color, item.type);
                nextSetupTick = masterTick + INITIAL_SPAWN_INTERVAL;
            }

            const now = Date.now();
            const canContinuousSpawn = isMouseDown && (now - mouseDownTime) >= CONTINUOUS_SPAWN_DELAY_MS;

            if (canContinuousSpawn && (masterTick - lastSpawnTick) >= SPAWN_INTERVAL) {
                const boardPos = screenToBoardSpace(mousePos.x, mousePos.y);
                spawnPiece(boardPos.x, boardPos.y, nextColor);
                nextColor = nextColor === 'white' ? 'black' : 'white';
                lastSpawnTick = masterTick;
                pieceChangedThisFrame = true;
            }

            if (masterTick % 2 === 0) {
                // Handheld camera movement
                if (worldContainer.centerPos) {
                    const time = masterTick * CAMERA_WIGGLE.frequency;

                    const offsetX = getNoise(time, 0) * CAMERA_WIGGLE.amplitudeX;
                    const offsetY = getNoise(time, 100) * CAMERA_WIGGLE.amplitudeY;
                    const offsetRot = getNoise(time, 200) * CAMERA_WIGGLE.amplitudeRotation;

                    worldContainer.position.set(
                        worldContainer.centerPos.x + offsetX,
                        worldContainer.centerPos.y + offsetY
                    );
                    worldContainer.rotation = offsetRot;
                }

                for (let i = activePieces.length - 1; i >= 0; i--) {
                    const p = activePieces[i];
                    const prevState = p.state;
                    const prevType = p.type;
                    p.updateTick();
                    if (p.state === 'hidden') {
                        activePieces.splice(i, 1);
                        pieceChangedThisFrame = true;
                    } else if (prevState !== p.state || prevType !== p.type) {
                        pieceChangedThisFrame = true;
                    }
                }
            }
        }

        // Update UI at most once per frame
        if (pieceChangedThisFrame || masterTick % 60 === 0) {
            updateStatsUI();
        }
    });
}

init();
