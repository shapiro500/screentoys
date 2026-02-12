// Splitshift v1.07
(async function () {
    // ===== CONSTANTS & CONFIGURATION =====
    const BG_WIDTH = 4096;
    const BG_HEIGHT = 2286;
    const TILE_WIDTH = 160;
    const TILE_HEIGHT = 120;
    const GRID_COLS = 4;
    const GRID_ROWS = 4;
    const GRID_WIDTH = TILE_WIDTH * GRID_COLS; // 640
    const GRID_HEIGHT = TILE_HEIGHT * GRID_ROWS; // 480

    // Screen corner positions for mesh mapping
    const MAIN_SCREEN_CORNERS = {
        topLeft: { x: 1855, y: 1020 },
        topRight: { x: 2358, y: 1010 },
        botRight: { x: 2355, y: 1405 },
        botLeft: { x: 1859, y: 1421 }
    };

    const BACK_SCREEN_CORNERS = {
        topLeft: { x: 1882, y: 228 },
        topRight: { x: 2326, y: 235 },
        botRight: { x: 2325, y: 565 },
        botLeft: { x: 1881, y: 562 }
    };

    // ===== CRT BULGE EFFECT CONFIGURATION =====
    // Adjust these values to control the bulge effect on the screens
    const BULGE_CONFIG = {
        // Main screen (front TV) bulge settings
        main: {
            enabled: true,
            subdivisions: 12,        // Grid resolution (12x12 = 144 vertices)
            strength: 0.1,          // Bulge amount (0 = flat, 0.5 = very bulged)
            centerOffsetX: -0.3,        // Offset bulge center horizontally (-1 to 1, 0 = center)
            centerOffsetY: -.1,        // Offset bulge center vertically (-1 to 1, 0 = center)
            radius: 2.5              // Bulge radius multiplier (1 = full screen, 0.5 = tighter)
        },
        // Back screen (goal TV) bulge settings
        back: {
            enabled: true,
            subdivisions: 10,        // Grid resolution
            strength: 0.08,          // Slightly less bulge for back screen
            centerOffsetX: -0.3,
            centerOffsetY: 0.1,
            radius: 2.0
        }
    };

    // ===== CRT FLICKER EFFECT CONFIGURATION =====
    const FLICKER_CONFIG = {
        enabled: true,
        rate: 1 / 15,           // Flicker cycle duration in seconds (1/30 = ~33ms)
        minOpacity: 0.94         // Minimum opacity during flicker
    };

    // ===== RETRO FRAMERATE CONFIGURATION =====
    // Throttles the main screen render updates for an authentic retro game look
    // Also improves mobile performance by reducing render calls
    const RETRO_FPS = 30;        // Target FPS for the main TV screen (0 = disabled, use full framerate)

    // Button hit areas (in original 4096x2286 coordinates)
    const BUTTON_HIT_AREAS = {
        sideTop: [
            { x: 1597, y: 925 },
            { x: 1729, y: 923 },
            { x: 1730, y: 1229 },
            { x: 1589, y: 1230 }
        ],
        sideBot: [
            { x: 1594, y: 1238 },
            { x: 1735, y: 1235 },
            { x: 1741, y: 1538 },
            { x: 1613, y: 1540 }
        ],
        botLeft: [
            { x: 1786, y: 1560 },
            { x: 2113, y: 1548 },
            { x: 2112, y: 1677 },
            { x: 1790, y: 1690 }
        ],
        botRight: [
            { x: 2123, y: 1550 },
            { x: 2422, y: 1527 },
            { x: 2425, y: 1657 },
            { x: 2125, y: 1677 }
        ],
        giveUp: [
            { x: 1924, y: 1916 },
            { x: 2185, y: 1906 },
            { x: 2185, y: 2019 },
            { x: 1924, y: 2030 }
        ],
        newPuzzle: [
            { x: 2222, y: 1904 },
            { x: 2503, y: 1889 },
            { x: 2505, y: 2005 },
            { x: 2227, y: 2016 }
        ]
    };

    // ===== DEBUG FLAGS =====
    const DEBUG_SHOW_TILES_DIRECTLY = false; // Set to false to use corner pin/perspective
    const DEBUG_SKIP_LOGO = false; // Set to true to skip logo for faster testing

    // ===== GAME STATE =====
    let gridState = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    let targetState = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    let moves = 0;
    let isGameActive = false;
    let isShuffling = false;
    let isSolving = false;
    let isAnimating = false; // Prevents input during tile flip animations
    let gameStarted = false;
    let isBackScreenLocked = false; // Performance optimization: skip rendering back screen when locked

    // ===== ANIMATION CONFLICT MANAGEMENT =====
    // Track active animations to allow cancellation when conflicting inputs occur
    // Row animations conflict with column animations (and vice versa)
    // Two row animations or two column animations can run simultaneously
    let activeRowAnimation = null;  // { cancelled: false, finalize: () => void }
    let activeColAnimation = null;  // { cancelled: false, finalize: () => void }

    // ===== PIXI APPLICATION =====
    const app = new PIXI.Application();

    await app.init({
        canvas: document.getElementById('game-canvas'),
        backgroundColor: 0x000000,
        resizeTo: window,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });

    console.log('PIXI App initialized');

    // ===== DETECT MOBILE =====
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768);
    const spriteSheetPath = isMobile ? 'assets/graphics_mobile.json' : 'assets/graphics_desktop.json';

    console.log('Loading spritesheet:', spriteSheetPath);

    // ===== LOADING SCREEN (PIXI Canvas-based) =====
    // Total assets: spritesheets + 10 sounds
    const totalAssets = isMobile ? 11 : 12;
    let loadedAssets = 0;

    // Create loading text on the PIXI canvas
    const loadingText = new PIXI.Text({
        text: `Loading 0/${totalAssets} assets`,
        style: {
            fontFamily: 'Roboto, sans-serif',
            fontSize: 14,
            fill: 0x68e990,
            fontWeight: '400'
        }
    });
    loadingText.anchor.set(0.5);
    loadingText.x = app.screen.width / 2;
    loadingText.y = app.screen.height / 2;
    app.stage.addChild(loadingText);

    // Update loading text position on resize
    const updateLoadingTextPosition = () => {
        loadingText.x = app.screen.width / 2;
        loadingText.y = app.screen.height / 2;
    };
    window.addEventListener('resize', updateLoadingTextPosition);

    // Helper to yield to browser render loop so loading text actually paints
    function waitForFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    async function updateLoadingText() {
        loadingText.text = `Loading ${loadedAssets}/${totalAssets} assets`;
        await waitForFrame();
    }

    // ===== LOAD ASSETS =====
    // Load spritesheets with progress tracking
    await PIXI.Assets.load(spriteSheetPath);
    loadedAssets++;
    await updateLoadingText();

    const spriteSheet = PIXI.Assets.get(spriteSheetPath);
    const textures = { ...spriteSheet.textures }; // Create a mutable copy

    // On desktop, also load mobile assets for screen-related textures to avoid moiré patterns
    // The mobile textures are lower resolution which naturally smooths out the interference
    if (!isMobile) {
        const mobileSheetPath = 'assets/graphics_mobile.json';
        await PIXI.Assets.load(mobileSheetPath);
        loadedAssets++;
        await updateLoadingText();

        const mobileSheet = PIXI.Assets.get(mobileSheetPath);

        // Override specific textures with mobile versions
        const mobileOverrides = ['mainScr_green', 'backTv_green', 'tile_on', 'tile_off'];
        mobileOverrides.forEach(name => {
            if (mobileSheet.textures[name]) {
                textures[name] = mobileSheet.textures[name];
                //console.log(`Using mobile texture for: ${name}`);
            }
        });
    }

    console.log('Spritesheet loaded, textures:', Object.keys(textures));

    // Check tile textures
    //console.log('tile_on texture:', textures['tile_on']);
    //console.log('tile_off texture:', textures['tile_off']);

    // ===== LOAD SOUNDS =====
    // Helper to load a sound and update progress
    //
    // Sound attribution:
    // Single Typewriter Hits.wav by soundslikewillem -- https://freesound.org/s/193972/
    // Power button on old computer by pfranzen -- https://freesound.org/s/328852/
    // Mac IIfx with Lid on by SieuAmThanh -- https://freesound.org/s/611755/

    async function loadSound(url, options) {
        const sound = await PIXI.sound.Sound.from({ url, preload: true, ...options });
        loadedAssets++;
        await updateLoadingText();
        return sound;
    }

    const sounds = {
        press: await loadSound('assets/press.mp3', { volume: 1.0 }),
        release: await loadSound('assets/release.mp3', { volume: 0.5 }),
        start: await loadSound('assets/start.mp3', { volume: 1.0 }),
        bgloop: await loadSound('assets/bgloop.mp3', { volume: 1.0, loop: true }),
        move1: await loadSound('assets/1.mp3', { volume: .6 }),
        move2: await loadSound('assets/2.mp3', { volume: .6 }),
        move3: await loadSound('assets/3.mp3', { volume: .6 }),
        move4: await loadSound('assets/4.mp3', { volume: .6 }),
        win: await loadSound('assets/win.mp3', { volume: .6 }),
        flip: await loadSound('assets/flip.mp3', { volume: 1.0 })
    };
    console.log('Sounds loaded');

    // Remove loading text and cleanup
    window.removeEventListener('resize', updateLoadingTextPosition);
    app.stage.removeChild(loadingText);
    loadingText.destroy();

    // Helper functions for playing sounds
    function playPressSound() {
        sounds.press.play();
    }
    function playReleaseSound() {
        sounds.release.play();
    }
    function playMoveSound(move) {
        // move 0 = sideTop = 1.mp3, move 1 = sideBot = 2.mp3, move 2 = botLeft = 3.mp3, move 3 = botRight = 4.mp3
        const moveSounds = [sounds.move1, sounds.move2, sounds.move3, sounds.move4];
        if (move >= 0 && move < moveSounds.length) {
            moveSounds[move].play();
        }
    }
    function playFlipSound() {
        sounds.flip.play();
    }
    function playWinSound() {
        sounds.win.play();
    }

    // ===== MUTE TOGGLE =====
    const muteToggle = document.getElementById('mute-toggle');
    let isMuted = false;

    if (muteToggle) {
        muteToggle.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                PIXI.sound.muteAll();
                muteToggle.classList.add('muted');
            } else {
                PIXI.sound.unmuteAll();
                muteToggle.classList.remove('muted');
            }
        });
    }

    // Track which buttons are currently pressed (for sound purposes)
    // Only play release sound if the button was actually pressed
    const pressedButtons = new Set();

    // ===== MAIN CONTAINER =====
    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);

    // ===== BACKGROUND LAYER =====
    const bgSprite = new PIXI.Sprite(textures['baseBG_allOff']);
    bgSprite.anchor.set(0.5);
    bgSprite.x = BG_WIDTH / 2;
    bgSprite.y = BG_HEIGHT / 2;
    mainContainer.addChild(bgSprite);

    console.log('Background added');

    // ===== BUTTON SPRITES (layered on top of background) =====
    const buttonSprites = {};
    const arrowButtons = ['sideTop', 'sideBot', 'botLeft', 'botRight'];
    const utilButtons = ['giveUp', 'newPuzzle'];

    arrowButtons.forEach(name => {
        const onSprite = new PIXI.Sprite(textures[`${name}On`]);
        onSprite.anchor.set(0.5);
        onSprite.x = BG_WIDTH / 2;
        onSprite.y = BG_HEIGHT / 2;
        onSprite.visible = false;
        mainContainer.addChild(onSprite);

        const pushedSprite = new PIXI.Sprite(textures[`${name}Pushed`]);
        pushedSprite.anchor.set(0.5);
        pushedSprite.x = BG_WIDTH / 2;
        pushedSprite.y = BG_HEIGHT / 2;
        pushedSprite.visible = false;
        mainContainer.addChild(pushedSprite);

        buttonSprites[name] = {
            on: onSprite,
            pushed: pushedSprite,
            isOn: false,
            isPushed: false
        };
    });

    utilButtons.forEach(name => {
        const pushedSprite = new PIXI.Sprite(textures[`${name}Pushed`]);
        pushedSprite.anchor.set(0.5);
        pushedSprite.x = BG_WIDTH / 2;
        pushedSprite.y = BG_HEIGHT / 2;
        pushedSprite.visible = false;
        mainContainer.addChild(pushedSprite);

        buttonSprites[name] = {
            pushed: pushedSprite,
            isPushed: false
        };
    });

    // ===== NUMBER COUNTER SPRITES =====
    const numberSprites = {
        left: null,
        middle: null,
        right: null,
        error: null
    };

    numberSprites.error = new PIXI.Sprite(textures['num_err']);
    numberSprites.error.anchor.set(0.5);
    numberSprites.error.x = BG_WIDTH / 2;
    numberSprites.error.y = BG_HEIGHT / 2;
    numberSprites.error.visible = false;
    mainContainer.addChild(numberSprites.error);

    ['left', 'middle', 'right'].forEach(pos => {
        const suffix = pos === 'left' ? 'l' : pos === 'middle' ? 'm' : 'r';
        const sprite = new PIXI.Sprite(textures[`num_0${suffix}`]);
        sprite.anchor.set(0.5);
        sprite.x = BG_WIDTH / 2;
        sprite.y = BG_HEIGHT / 2;
        sprite.visible = false;
        mainContainer.addChild(sprite);
        numberSprites[pos] = sprite;
    });

    // ===== TILE GRID CONTAINER =====
    // Single set of tiles used for both screens
    const mainGridContainer = new PIXI.Container();
    const mainTiles = [];

    // Create tiles
    for (let r = 0; r < GRID_ROWS; r++) {
        mainTiles[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            const tile = new PIXI.Sprite(textures['tile_off']);
            tile.anchor.set(0.5);
            tile.x = c * TILE_WIDTH + TILE_WIDTH / 2;
            tile.y = r * TILE_HEIGHT + TILE_HEIGHT / 2;
            mainGridContainer.addChild(tile);
            mainTiles[r][c] = tile;
        }
    }

    console.log('Tiles created. Grid has', mainGridContainer.children.length, 'children');

    // ===== RENDER TEXTURES AND CORNER PIN MESHES =====
    // Create render textures for the grids
    const mainGridTexture = PIXI.RenderTexture.create({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        resolution: 1
    });

    const backGridTexture = PIXI.RenderTexture.create({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        resolution: 1
    });

    // Function to render grid to textures
    // Renders mainGridContainer to mainGridTexture always
    // Renders to backGridTexture only when not locked (they share the same source)
    let renderGrids = function () {
        // Always render to main screen texture
        app.renderer.render({
            container: mainGridContainer,
            target: mainGridTexture,
            clear: true
        });
        // Render to back screen texture only if not locked
        // When locked, the back screen keeps its snapshot of the goal pattern
        if (!isBackScreenLocked) {
            app.renderer.render({
                container: mainGridContainer,
                target: backGridTexture,
                clear: true
            });
        }
    };

    // Screen sprite references (populated in production mode, used for fade effects)
    let mainScreenGreenSprite = null;
    let backScreenGreenSprite = null;

    // Array to hold sprites that should flicker (populated in production mode)
    const flickerSprites = [];

    if (DEBUG_SHOW_TILES_DIRECTLY) {
        // DEBUG MODE: Position grid container directly without corner pin
        // Note: In debug mode, we only show the main grid (no back screen preview)
        const mainScreenCenterX = (MAIN_SCREEN_CORNERS.topLeft.x + MAIN_SCREEN_CORNERS.topRight.x) / 2;
        const mainScreenCenterY = (MAIN_SCREEN_CORNERS.topLeft.y + MAIN_SCREEN_CORNERS.botLeft.y) / 2;

        mainGridContainer.x = mainScreenCenterX - GRID_WIDTH / 2;
        mainGridContainer.y = mainScreenCenterY - GRID_HEIGHT / 2;
        mainContainer.addChild(mainGridContainer);

        console.log('DEBUG: Tiles displayed directly without corner pin (back screen not shown in debug mode)');
    } else {
        // PRODUCTION MODE: Use corner-pinned meshes with bulge effect

        /**
         * Creates a subdivided mesh with corner-pin perspective and barrel distortion bulge
         * @param {PIXI.Texture} texture - The texture to apply
         * @param {Object} corners - Corner positions {topLeft, topRight, botRight, botLeft}
         * @param {Object} bulgeConfig - Bulge settings {enabled, subdivisions, strength, centerOffsetX, centerOffsetY, radius}
         */
        function createBulgedCornerPinMesh(texture, corners, bulgeConfig) {
            const { subdivisions, strength, centerOffsetX, centerOffsetY, radius, enabled } = bulgeConfig;
            const cols = subdivisions;
            const rows = subdivisions;

            const positions = [];
            const uvs = [];
            const indices = [];

            // Generate vertices in a grid
            for (let row = 0; row <= rows; row++) {
                for (let col = 0; col <= cols; col++) {
                    // Normalized coordinates (0 to 1)
                    const u = col / cols;
                    const v = row / rows;

                    // Bilinear interpolation for corner-pin perspective
                    // Top edge interpolation
                    const topX = corners.topLeft.x + (corners.topRight.x - corners.topLeft.x) * u;
                    const topY = corners.topLeft.y + (corners.topRight.y - corners.topLeft.y) * u;
                    // Bottom edge interpolation
                    const botX = corners.botLeft.x + (corners.botRight.x - corners.botLeft.x) * u;
                    const botY = corners.botLeft.y + (corners.botRight.y - corners.botLeft.y) * u;
                    // Final position (vertical interpolation)
                    let x = topX + (botX - topX) * v;
                    let y = topY + (botY - topY) * v;

                    // Apply barrel distortion (bulge effect)
                    if (enabled && strength > 0) {
                        // Calculate center of the quad
                        const centerX = (corners.topLeft.x + corners.topRight.x + corners.botLeft.x + corners.botRight.x) / 4;
                        const centerY = (corners.topLeft.y + corners.topRight.y + corners.botLeft.y + corners.botRight.y) / 4;

                        // Apply center offset (in screen-relative coordinates)
                        const quadWidth = Math.max(
                            corners.topRight.x - corners.topLeft.x,
                            corners.botRight.x - corners.botLeft.x
                        );
                        const quadHeight = Math.max(
                            corners.botLeft.y - corners.topLeft.y,
                            corners.botRight.y - corners.topRight.y
                        );
                        const bulgeCenterX = centerX + centerOffsetX * (quadWidth / 2);
                        const bulgeCenterY = centerY + centerOffsetY * (quadHeight / 2);

                        // Distance from bulge center (normalized)
                        const dx = (x - bulgeCenterX) / (quadWidth / 2);
                        const dy = (y - bulgeCenterY) / (quadHeight / 2);
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Apply bulge - quadratic falloff within radius
                        const normalizedDist = distance / radius;
                        if (normalizedDist < 1) {
                            // Barrel distortion formula: push outward based on distance squared
                            const distortion = 1 + strength * (1 - normalizedDist * normalizedDist);
                            x = bulgeCenterX + (x - bulgeCenterX) * distortion;
                            y = bulgeCenterY + (y - bulgeCenterY) * distortion;
                        }
                    }

                    positions.push(x, y);
                    uvs.push(u, v);
                }
            }

            // Generate triangle indices
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const topLeft = row * (cols + 1) + col;
                    const topRight = topLeft + 1;
                    const botLeft = topLeft + (cols + 1);
                    const botRight = botLeft + 1;

                    // Two triangles per quad
                    indices.push(topLeft, topRight, botRight);
                    indices.push(topLeft, botRight, botLeft);
                }
            }

            const geometry = new PIXI.MeshGeometry({
                positions: new Float32Array(positions),
                uvs: new Float32Array(uvs),
                indices: new Uint32Array(indices)
            });

            return new PIXI.Mesh({ geometry, texture });
        }

        // Create meshes for rendering to mask textures (bulge effect applied)
        const mainMaskMesh = createBulgedCornerPinMesh(mainGridTexture, MAIN_SCREEN_CORNERS, BULGE_CONFIG.main);
        const backMaskMesh = createBulgedCornerPinMesh(backGridTexture, BACK_SCREEN_CORNERS, BULGE_CONFIG.back);
        backMaskMesh.filters = [new PIXI.BlurFilter({ strength: 3, quality: 2 })];

        // Create green screen sprites (CRT scanline overlay)
        // Store references for the flicker effect and fade transitions
        const mainScreenGreen = new PIXI.Sprite(textures['mainScr_green']);
        mainScreenGreen.anchor.set(0.5);
        mainScreenGreen.x = BG_WIDTH / 2;
        mainScreenGreen.y = BG_HEIGHT / 2;
        mainContainer.addChild(mainScreenGreen);
        flickerSprites.push(mainScreenGreen);
        mainScreenGreenSprite = mainScreenGreen; // Store reference for fade effects

        const backScreenGreen = new PIXI.Sprite(textures['backTv_green']);
        backScreenGreen.anchor.set(0.5);
        backScreenGreen.x = BG_WIDTH / 2;
        backScreenGreen.y = BG_HEIGHT / 2;
        mainContainer.addChild(backScreenGreen);
        flickerSprites.push(backScreenGreen);
        backScreenGreenSprite = backScreenGreen; // Store reference for fade effects

        // Create mask render textures (full background size to match coordinates)
        const mainMaskTexture = PIXI.RenderTexture.create({
            width: BG_WIDTH,
            height: BG_HEIGHT,
            resolution: 1
        });
        const backMaskTexture = PIXI.RenderTexture.create({
            width: BG_WIDTH,
            height: BG_HEIGHT,
            resolution: 1
        });

        // Create mask sprites from render textures
        // In PixiJS, mask sprites need to be added to display list to work
        const mainMaskSprite = new PIXI.Sprite(mainMaskTexture);
        mainMaskSprite.x = 0;
        mainMaskSprite.y = 0;
        mainContainer.addChild(mainMaskSprite);
        mainMaskSprite.renderable = false; // Don't render, only use for masking

        const backMaskSprite = new PIXI.Sprite(backMaskTexture);
        backMaskSprite.x = 0;
        backMaskSprite.y = 0;
        mainContainer.addChild(backMaskSprite);
        backMaskSprite.renderable = false; // Don't render, only use for masking

        // Apply masks - the green sprites will show through where the tiles are
        mainScreenGreen.mask = mainMaskSprite;
        backScreenGreen.mask = backMaskSprite;

        // Function to update masks (must be called each frame when tiles change)
        function updateMasks() {
            // Always update main mask
            app.renderer.render({
                container: mainMaskMesh,
                target: mainMaskTexture,
                clear: true
            });
            // Only update back mask if not locked (performance optimization)
            if (!isBackScreenLocked) {
                app.renderer.render({
                    container: backMaskMesh,
                    target: backMaskTexture,
                    clear: true
                });
            }
        }

        // Add updateMasks to renderGrids
        const originalRenderGrids = renderGrids;
        renderGrids = function () {
            originalRenderGrids();
            updateMasks();
        };

        // Initial mask render
        updateMasks();

        //console.log('PRODUCTION: Corner-pinned meshes with bulge effect and green screen masks created');
    }

    // ===== RETRO FRAMERATE THROTTLING =====
    // Wraps renderGrids to limit how often the main TV screen updates
    // forceRenderGrids bypasses the throttle for critical updates (end of animations, state changes)
    let forceRenderGrids = renderGrids; // Default: same as renderGrids

    if (RETRO_FPS > 0) {
        let lastRenderTime = 0;
        const minRenderInterval = 1000 / RETRO_FPS;
        const unthrottledRenderGrids = renderGrids;

        renderGrids = function () {
            const now = performance.now();
            if (now - lastRenderTime >= minRenderInterval) {
                lastRenderTime = now;
                unthrottledRenderGrids();
            }
        };

        // Force render bypasses throttle but updates lastRenderTime to prevent double renders
        forceRenderGrids = function () {
            lastRenderTime = performance.now();
            unthrottledRenderGrids();
        };

        //console.log(`Retro framerate enabled: ${RETRO_FPS} FPS`);
    }

    // ===== LOGO OVERLAY =====
    const logoSprite = new PIXI.Sprite(textures['logo']);
    logoSprite.anchor.set(0.5);
    logoSprite.x = BG_WIDTH / 2;
    logoSprite.y = BG_HEIGHT / 2;
    if (!DEBUG_SKIP_LOGO) {
        mainContainer.addChild(logoSprite);
    }
    flickerSprites.push(logoSprite); // Add logo to flicker effect

    // Flag to prevent flicker from overwriting fade animation
    let screenFadeActive = false;

    // ===== CRT FLICKER EFFECT =====
    if (FLICKER_CONFIG.enabled && flickerSprites.length > 0) {
        let flickerTime = 0;
        app.ticker.add((ticker) => {
            flickerTime += ticker.deltaMS / 1000; // Convert to seconds

            // Calculate flicker phase (0 to 1)
            const cyclePosition = (flickerTime % FLICKER_CONFIG.rate) / FLICKER_CONFIG.rate;

            // Sine wave from 1 to minOpacity and back
            const opacity = 1 - (1 - FLICKER_CONFIG.minOpacity) * Math.sin(cyclePosition * Math.PI);

            // Apply to all flicker sprites (skip screen sprites and logo during fade)
            for (const sprite of flickerSprites) {
                // Skip screen sprites and logo if fade is active
                if (screenFadeActive && (sprite === mainScreenGreenSprite || sprite === backScreenGreenSprite || sprite === logoSprite)) {
                    continue;
                }
                sprite.alpha = opacity;
            }
        });
        //console.log('CRT flicker effect enabled for', flickerSprites.length, 'sprites');
    }

    // ===== BUTTON HIT AREAS =====
    const buttonHitAreas = {};

    Object.keys(BUTTON_HIT_AREAS).forEach(buttonName => {
        const points = BUTTON_HIT_AREAS[buttonName];
        const hitArea = new PIXI.Graphics();
        hitArea.poly(points.flatMap(p => [p.x, p.y]));
        hitArea.fill({ color: 0xff0000, alpha: 0 });
        hitArea.eventMode = 'static';
        hitArea.cursor = 'default'; // Will be updated dynamically based on clickability
        mainContainer.addChild(hitArea);
        buttonHitAreas[buttonName] = hitArea;
    });

    // ===== DYNAMIC CURSOR MANAGEMENT =====
    // Updates button cursors based on current game state
    // Cursor should only be 'pointer' when the button is actually clickable
    function updateButtonCursors() {
        const arrowButtonNames = ['sideTop', 'sideBot', 'botLeft', 'botRight'];

        // Arrow buttons are clickable when game is active and not shuffling/solving
        const arrowsClickable = isGameActive && !isShuffling && !isSolving;
        arrowButtonNames.forEach(name => {
            if (buttonHitAreas[name]) {
                buttonHitAreas[name].cursor = arrowsClickable ? 'pointer' : 'default';
            }
        });

        // Give Up button is clickable when game is active and not solving
        if (buttonHitAreas.giveUp) {
            const giveUpClickable = isGameActive && !isSolving;
            buttonHitAreas.giveUp.cursor = giveUpClickable ? 'pointer' : 'default';
        }

        // New Puzzle button is clickable when not shuffling, solving, or animating
        if (buttonHitAreas.newPuzzle) {
            const newPuzzleClickable = !isShuffling && !isSolving && !isAnimating;
            buttonHitAreas.newPuzzle.cursor = newPuzzleClickable ? 'pointer' : 'default';
        }
    }

    // ===== RESIZE HANDLER =====
    function resize() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const scale = windowHeight / BG_HEIGHT;
        mainContainer.scale.set(scale);
        const scaledWidth = BG_WIDTH * scale;
        mainContainer.x = (windowWidth - scaledWidth) / 2;
        mainContainer.y = 0;
    }

    window.addEventListener('resize', resize);
    resize();

    // ===== UPDATE FUNCTIONS =====
    function updateMoveCounter() {
        numberSprites.left.visible = false;
        numberSprites.middle.visible = false;
        numberSprites.right.visible = false;
        numberSprites.error.visible = false;

        if (moves > 999) {
            numberSprites.error.visible = true;
            return;
        }

        const moveStr = moves.toString();

        if (moves === 0) {
            numberSprites.right.texture = textures['num_0r'];
            numberSprites.right.visible = true;
        } else if (moves < 10) {
            numberSprites.right.texture = textures[`num_${moveStr}r`];
            numberSprites.right.visible = true;
        } else if (moves < 100) {
            numberSprites.middle.texture = textures[`num_${moveStr[0]}m`];
            numberSprites.middle.visible = true;
            numberSprites.right.texture = textures[`num_${moveStr[1]}r`];
            numberSprites.right.visible = true;
        } else {
            numberSprites.left.texture = textures[`num_${moveStr[0]}l`];
            numberSprites.left.visible = true;
            numberSprites.middle.texture = textures[`num_${moveStr[1]}m`];
            numberSprites.middle.visible = true;
            numberSprites.right.texture = textures[`num_${moveStr[2]}r`];
            numberSprites.right.visible = true;
        }
    }

    function updateTileSprites(tiles, state) {
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                tiles[r][c].texture = state[r][c] === 1 ? textures['tile_on'] : textures['tile_off'];
            }
        }
        // Force render to ensure state changes are immediately visible
        if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();
    }

    function updateButtonState(buttonName, isOn, isPushed) {
        const button = buttonSprites[buttonName];
        if (!button) return;

        if (button.on) {
            button.on.visible = isOn;
            button.isOn = isOn;
        }
        if (button.pushed) {
            button.pushed.visible = isPushed;
            button.isPushed = isPushed;
        }
    }

    // ===== GAME LOGIC =====
    function generateTargetState() {
        targetState = Array(4).fill().map(() => Array(4).fill(0));
        const positions = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                positions.push({ r, c });
            }
        }
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        for (let i = 0; i < 8; i++) {
            const { r, c } = positions[i];
            targetState[r][c] = 1;
        }
    }

    function applyMoveToState(state, move) {
        const newState = JSON.parse(JSON.stringify(state));
        if (move < 2) {
            const row1 = move * 2;
            const row2 = move * 2 + 1;
            const last1 = newState[row1].pop();
            newState[row1].unshift(last1);
            const last2 = newState[row2].pop();
            newState[row2].unshift(last2);
        } else {
            const colPair = move - 2;
            const col1 = colPair * 2;
            const col2 = colPair * 2 + 1;

            const first1 = newState[0][col1];
            newState[0][col1] = newState[1][col1];
            newState[1][col1] = newState[2][col1];
            newState[2][col1] = newState[3][col1];
            newState[3][col1] = first1;

            const first2 = newState[0][col2];
            newState[0][col2] = newState[1][col2];
            newState[1][col2] = newState[2][col2];
            newState[2][col2] = newState[3][col2];
            newState[3][col2] = first2;
        }
        return newState;
    }

    function applyMove(move) {
        gridState = applyMoveToState(gridState, move);
    }

    function getMoveButtonName(move) {
        // move 0 = row pair 0 (rows 0-1) = sideTop button
        // move 1 = row pair 1 (rows 2-3) = sideBot button
        // move 2 = col pair 0 (cols 0-1) = botLeft button
        // move 3 = col pair 1 (cols 2-3) = botRight button
        if (move === 0) return 'sideTop';
        if (move === 1) return 'sideBot';
        if (move === 2) return 'botLeft';
        if (move === 3) return 'botRight';
        return null;
    }

    function checkWin() {
        return gridState.every((row, r) =>
            row.every((val, c) => val === targetState[r][c])
        );
    }

    // ===== ANIMATIONS =====
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Fade both screens to black (alpha → 0)
    // Respects RETRO_FPS for steppy retro effect
    async function fadeScreensOut(duration = 300) {
        if (!mainScreenGreenSprite || !backScreenGreenSprite) return;

        screenFadeActive = true; // Prevent flicker from overwriting alpha

        const startTime = performance.now();
        const startAlphaMain = mainScreenGreenSprite.alpha;
        const startAlphaBack = backScreenGreenSprite.alpha;
        const frameInterval = RETRO_FPS > 0 ? 1000 / RETRO_FPS : 0;
        let lastFrameTime = startTime;

        return new Promise(resolve => {
            function animate() {
                const now = performance.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Only update alpha at retro framerate intervals
                if (RETRO_FPS <= 0 || now - lastFrameTime >= frameInterval) {
                    lastFrameTime = now;
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    mainScreenGreenSprite.alpha = startAlphaMain * (1 - easeProgress);
                    backScreenGreenSprite.alpha = startAlphaBack * (1 - easeProgress);
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    mainScreenGreenSprite.alpha = 0;
                    backScreenGreenSprite.alpha = 0;
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    // Fade both screens back in (alpha → 1)
    // Respects RETRO_FPS for steppy retro effect
    async function fadeScreensIn(duration = 300) {
        if (!mainScreenGreenSprite || !backScreenGreenSprite) return;

        const startTime = performance.now();
        const frameInterval = RETRO_FPS > 0 ? 1000 / RETRO_FPS : 0;
        let lastFrameTime = startTime;

        return new Promise(resolve => {
            function animate() {
                const now = performance.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Only update alpha at retro framerate intervals
                if (RETRO_FPS <= 0 || now - lastFrameTime >= frameInterval) {
                    lastFrameTime = now;
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    mainScreenGreenSprite.alpha = easeProgress;
                    backScreenGreenSprite.alpha = easeProgress;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    mainScreenGreenSprite.alpha = 1;
                    backScreenGreenSprite.alpha = 1;
                    screenFadeActive = false; // Re-enable flicker
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    async function showTilesActivating() {
        // Reset all tiles to off
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                mainTiles[r][c].texture = textures['tile_off'];
                mainTiles[r][c].scale.set(1, 1);
            }
        }
        if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();

        // Collect tiles that need to flip to "on"
        const onTiles = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (targetState[r][c] === 1) {
                    onTiles.push({ r, c });
                }
            }
        }

        // Shuffle the order for visual interest
        for (let i = onTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [onTiles[i], onTiles[j]] = [onTiles[j], onTiles[i]];
        }

        // Flip animation function for a single tile
        async function flipTile(tileCoord) {
            const tile = mainTiles[tileCoord.r][tileCoord.c];
            const flipDuration = 150; // ms for each half of the flip

            // Play flip sound with delay to sync with texture swap
            setTimeout(() => playFlipSound(), 150);

            // Phase 1: Scale X from 1 to 0 (shrink)
            const shrinkStart = performance.now();
            await new Promise(resolve => {
                function animateShrink() {
                    const elapsed = performance.now() - shrinkStart;
                    const progress = Math.min(elapsed / flipDuration, 1);
                    // Ease out for smooth deceleration
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    tile.scale.x = 1 - easeProgress;

                    if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                    if (progress < 1) {
                        requestAnimationFrame(animateShrink);
                    } else {
                        tile.scale.x = 0;
                        resolve();
                    }
                }
                requestAnimationFrame(animateShrink);
            });

            // Switch texture at the midpoint (when tile is invisible)
            tile.texture = textures['tile_on'];

            // Phase 2: Scale X from 0 to 1 (expand)
            const expandStart = performance.now();
            await new Promise(resolve => {
                function animateExpand() {
                    const elapsed = performance.now() - expandStart;
                    const progress = Math.min(elapsed / flipDuration, 1);
                    // Ease out for smooth deceleration
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    tile.scale.x = easeProgress;

                    if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                    if (progress < 1) {
                        requestAnimationFrame(animateExpand);
                    } else {
                        tile.scale.x = 1;
                        if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();
                        resolve();
                    }
                }
                requestAnimationFrame(animateExpand);
            });
        }

        // Flip each tile with staggered timing
        const delayPerTile = 100; // Delay between starting each tile's flip
        for (let i = 0; i < onTiles.length; i++) {
            // Start the flip (don't await - let them overlap slightly)
            flipTile(onTiles[i]);
            // Wait before starting the next tile
            if (i < onTiles.length - 1) {
                await delay(delayPerTile);
            }
        }

        // Wait for the last flip to complete
        await delay(300); // flipDuration * 2
    }

    // Flip "on" tiles back to "off" (reverse of showTilesActivating)
    async function showTilesDeactivating() {
        // Collect tiles that are currently "on"
        const onTiles = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (gridState[r][c] === 1) {
                    onTiles.push({ r, c });
                }
            }
        }

        // If no tiles are on, nothing to deactivate
        if (onTiles.length === 0) return;

        // Shuffle the order for visual interest
        for (let i = onTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [onTiles[i], onTiles[j]] = [onTiles[j], onTiles[i]];
        }

        // Flip animation function for a single tile (on → off)
        async function flipTileOff(tileCoord) {
            const tile = mainTiles[tileCoord.r][tileCoord.c];
            const flipDuration = 150; // ms for each half of the flip

            // Play flip sound with delay to sync with texture swap
            setTimeout(() => playFlipSound(), 150);

            // Phase 1: Scale X from 1 to 0 (shrink)
            const shrinkStart = performance.now();
            await new Promise(resolve => {
                function animateShrink() {
                    const elapsed = performance.now() - shrinkStart;
                    const progress = Math.min(elapsed / flipDuration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    tile.scale.x = 1 - easeProgress;

                    if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                    if (progress < 1) {
                        requestAnimationFrame(animateShrink);
                    } else {
                        tile.scale.x = 0;
                        resolve();
                    }
                }
                requestAnimationFrame(animateShrink);
            });

            // Switch texture at the midpoint (when tile is invisible)
            tile.texture = textures['tile_off'];

            // Phase 2: Scale X from 0 to 1 (expand)
            const expandStart = performance.now();
            await new Promise(resolve => {
                function animateExpand() {
                    const elapsed = performance.now() - expandStart;
                    const progress = Math.min(elapsed / flipDuration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 2);
                    tile.scale.x = easeProgress;

                    if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                    if (progress < 1) {
                        requestAnimationFrame(animateExpand);
                    } else {
                        tile.scale.x = 1;
                        if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();
                        resolve();
                    }
                }
                requestAnimationFrame(animateExpand);
            });
        }

        // Flip each tile with staggered timing
        const delayPerTile = 100;
        for (let i = 0; i < onTiles.length; i++) {
            flipTileOff(onTiles[i]);
            if (i < onTiles.length - 1) {
                await delay(delayPerTile);
            }
        }

        // Wait for the last flip to complete
        await delay(300);
    }

    async function animateRowShift(row1, row2, direction = 1) {
        const animDuration = 120;
        const startTime = performance.now();

        const originalPositions = [];
        for (let c = 0; c < GRID_COLS; c++) {
            originalPositions.push({
                tile1: mainTiles[row1][c],
                tile2: mainTiles[row2][c],
                x: c * TILE_WIDTH + TILE_WIDTH / 2
            });
        }

        // Track ghost tiles for wrap-around effect
        const ghostTiles = [];
        const wrappedTiles = new Set(); // Track which tiles have already spawned ghosts

        // Create animation context for cancellation support
        const context = {
            cancelled: false,
            finalize: () => {
                // Remove ghost tiles
                for (const ghostData of ghostTiles) {
                    if (ghostData.ghost.parent) {
                        mainGridContainer.removeChild(ghostData.ghost);
                    }
                    ghostData.ghost.destroy();
                }
                ghostTiles.length = 0;

                // Reset tile positions to final state
                for (let c = 0; c < GRID_COLS; c++) {
                    mainTiles[row1][c].x = c * TILE_WIDTH + TILE_WIDTH / 2;
                    mainTiles[row2][c].x = c * TILE_WIDTH + TILE_WIDTH / 2;
                }
                if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();
            }
        };

        // Register this animation (will be cleared when done)
        activeRowAnimation = context;

        return new Promise(resolve => {
            function animate() {
                // Check if cancelled - if so, finalize and exit
                if (context.cancelled) {
                    context.finalize();
                    activeRowAnimation = null;
                    resolve();
                    return;
                }

                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / animDuration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const offset = TILE_WIDTH * easeProgress * direction;

                for (let c = 0; c < GRID_COLS; c++) {
                    let newX = originalPositions[c].x + offset;
                    const needsWrap = (direction > 0 && newX > GRID_WIDTH - TILE_WIDTH / 2) ||
                        (direction < 0 && newX < TILE_WIDTH / 2);

                    // Create ghost tiles when a tile starts to wrap (only once per tile)
                    if (needsWrap && !wrappedTiles.has(c)) {
                        wrappedTiles.add(c);

                        // Create ghost for row1
                        const ghost1 = new PIXI.Sprite(originalPositions[c].tile1.texture);
                        ghost1.anchor.set(0.5);
                        ghost1.y = originalPositions[c].tile1.y;
                        mainGridContainer.addChild(ghost1);
                        ghostTiles.push({ ghost: ghost1, originalCol: c, row: 1 });

                        // Create ghost for row2
                        const ghost2 = new PIXI.Sprite(originalPositions[c].tile2.texture);
                        ghost2.anchor.set(0.5);
                        ghost2.y = originalPositions[c].tile2.y;
                        mainGridContainer.addChild(ghost2);
                        ghostTiles.push({ ghost: ghost2, originalCol: c, row: 2 });
                    }

                    // Update ghost positions (they continue off the edge)
                    for (const ghostData of ghostTiles) {
                        if (ghostData.originalCol === c) {
                            ghostData.ghost.x = newX;
                        }
                    }

                    // Wrap the original tile position
                    if (direction > 0 && newX > GRID_WIDTH - TILE_WIDTH / 2) {
                        newX -= GRID_WIDTH;
                    } else if (direction < 0 && newX < TILE_WIDTH / 2) {
                        newX += GRID_WIDTH;
                    }
                    originalPositions[c].tile1.x = newX;
                    originalPositions[c].tile2.x = newX;
                }

                // Render to texture for corner pin mode
                if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation completed normally
                    context.finalize();
                    activeRowAnimation = null;
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    async function animateColShift(col1, col2, direction = -1) {
        const animDuration = 120;
        const startTime = performance.now();

        const originalPositions = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            originalPositions.push({
                tile1: mainTiles[r][col1],
                tile2: mainTiles[r][col2],
                y: r * TILE_HEIGHT + TILE_HEIGHT / 2
            });
        }

        // Track ghost tiles for wrap-around effect
        const ghostTiles = [];
        const wrappedTiles = new Set(); // Track which tiles have already spawned ghosts

        // Create animation context for cancellation support
        const context = {
            cancelled: false,
            finalize: () => {
                // Remove ghost tiles
                for (const ghostData of ghostTiles) {
                    if (ghostData.ghost.parent) {
                        mainGridContainer.removeChild(ghostData.ghost);
                    }
                    ghostData.ghost.destroy();
                }
                ghostTiles.length = 0;

                // Reset tile positions to final state
                for (let r = 0; r < GRID_ROWS; r++) {
                    mainTiles[r][col1].y = r * TILE_HEIGHT + TILE_HEIGHT / 2;
                    mainTiles[r][col2].y = r * TILE_HEIGHT + TILE_HEIGHT / 2;
                }
                if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();
            }
        };

        // Register this animation (will be cleared when done)
        activeColAnimation = context;

        return new Promise(resolve => {
            function animate() {
                // Check if cancelled - if so, finalize and exit
                if (context.cancelled) {
                    context.finalize();
                    activeColAnimation = null;
                    resolve();
                    return;
                }

                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / animDuration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const offset = TILE_HEIGHT * easeProgress * direction;

                for (let r = 0; r < GRID_ROWS; r++) {
                    let newY = originalPositions[r].y + offset;
                    const needsWrap = (direction < 0 && newY < TILE_HEIGHT / 2) ||
                        (direction > 0 && newY > GRID_HEIGHT - TILE_HEIGHT / 2);

                    // Create ghost tiles when a tile starts to wrap (only once per tile)
                    if (needsWrap && !wrappedTiles.has(r)) {
                        wrappedTiles.add(r);

                        // Create ghost for col1
                        const ghost1 = new PIXI.Sprite(originalPositions[r].tile1.texture);
                        ghost1.anchor.set(0.5);
                        ghost1.x = originalPositions[r].tile1.x;
                        mainGridContainer.addChild(ghost1);
                        ghostTiles.push({ ghost: ghost1, originalRow: r, col: 1 });

                        // Create ghost for col2
                        const ghost2 = new PIXI.Sprite(originalPositions[r].tile2.texture);
                        ghost2.anchor.set(0.5);
                        ghost2.x = originalPositions[r].tile2.x;
                        mainGridContainer.addChild(ghost2);
                        ghostTiles.push({ ghost: ghost2, originalRow: r, col: 2 });
                    }

                    // Update ghost positions (they continue off the edge)
                    for (const ghostData of ghostTiles) {
                        if (ghostData.originalRow === r) {
                            ghostData.ghost.y = newY;
                        }
                    }

                    // Wrap the original tile position
                    if (direction < 0 && newY < TILE_HEIGHT / 2) {
                        newY += GRID_HEIGHT;
                    } else if (direction > 0 && newY > GRID_HEIGHT - TILE_HEIGHT / 2) {
                        newY -= GRID_HEIGHT;
                    }
                    originalPositions[r].tile1.y = newY;
                    originalPositions[r].tile2.y = newY;
                }

                // Render to texture for corner pin mode
                if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation completed normally
                    context.finalize();
                    activeColAnimation = null;
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    async function animateShift(move) {
        if (move < 2) {
            const row1 = move * 2;
            const row2 = move * 2 + 1;
            await animateRowShift(row1, row2, 1);
        } else {
            const colPair = move - 2;
            const col1 = colPair * 2;
            const col2 = colPair * 2 + 1;
            await animateColShift(col1, col2, -1);
        }
    }

    async function shuffleWithAnimation(shuffleMoves) {
        isShuffling = true;
        gridState = JSON.parse(JSON.stringify(targetState));
        updateTileSprites(mainTiles, gridState);

        const delayPerMove = Math.min(2000 / shuffleMoves.length, 150);

        for (const move of shuffleMoves) {
            const buttonName = getMoveButtonName(move);
            updateButtonState(buttonName, true, false);

            // Animate FIRST (before state change)
            await animateShift(move);

            // Play move sound and apply state
            playMoveSound(move);
            applyMove(move);
            updateTileSprites(mainTiles, gridState);

            updateButtonState(buttonName, false, false);
            await delay(delayPerMove * 0.2);
        }

        isShuffling = false;
    }

    async function triggerWinEffect() {
        // Unlock back screen for win animation
        isBackScreenLocked = false;

        // Play the win sound
        playWinSound();

        // Wave animation - all tiles animate with staggered delay based on position
        const waveDuration = 300;      // Duration of each tile's pulse
        const waveDelay = 100;          // Delay between each tile starting
        const maxScale = 0.8;         // Maximum scale during pulse
        const startTime = performance.now();

        // Calculate total animation time
        // Wave travels from top-left to bottom-right (diagonal distance)
        const maxDiagonal = (GRID_ROWS - 1) + (GRID_COLS - 1);
        const totalDuration = waveDuration + (maxDiagonal * waveDelay);

        return new Promise(resolve => {
            function animate() {
                const elapsed = performance.now() - startTime;
                let allDone = true;

                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < GRID_COLS; c++) {
                        const tile = mainTiles[r][c];

                        // Calculate delay based on diagonal position (wave from top-left)
                        const diagonalIndex = r + c;
                        const tileDelay = diagonalIndex * waveDelay;
                        const tileElapsed = elapsed - tileDelay;

                        if (tileElapsed < 0) {
                            // Not started yet
                            tile.scale.set(1);
                            allDone = false;
                        } else if (tileElapsed < waveDuration) {
                            // Animating
                            const progress = tileElapsed / waveDuration;
                            // Smooth pulse: scale up then down
                            const scale = 1 + (maxScale - 1) * Math.sin(progress * Math.PI);
                            tile.scale.set(scale);
                            allDone = false;
                        } else {
                            // Done
                            tile.scale.set(1);
                        }
                    }
                }

                // Render to texture for corner pin mode
                if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                if (!allDone || elapsed < totalDuration) {
                    requestAnimationFrame(animate);
                } else {
                    // Ensure all tiles are reset
                    for (let r = 0; r < GRID_ROWS; r++) {
                        for (let c = 0; c < GRID_COLS; c++) {
                            mainTiles[r][c].scale.set(1);
                        }
                    }
                    if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids();

                    // Re-lock back screen after win animation
                    isBackScreenLocked = true;
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    // ===== SOLVER (BFS) =====
    function solvePuzzle() {
        const startState = JSON.stringify(gridState);
        const goalState = JSON.stringify(targetState);

        if (startState === goalState) return [];

        const queue = [{ state: JSON.parse(JSON.stringify(gridState)), path: [] }];
        const visited = new Set([startState]);

        while (queue.length > 0) {
            const { state, path } = queue.shift();

            for (let move = 0; move < 4; move++) {
                const newState = applyMoveToState(state, move);
                const stateStr = JSON.stringify(newState);

                if (stateStr === goalState) return [...path, move];

                if (!visited.has(stateStr)) {
                    visited.add(stateStr);
                    queue.push({ state: newState, path: [...path, move] });
                }
            }
        }
        return null;
    }

    // ===== GAME FLOW =====
    async function startNewGame() {
        if (isAnimating) return; // Prevent multiple calls during animation
        isAnimating = true;

        moves = 0;
        isGameActive = false;
        isBackScreenLocked = false; // Unlock for initial pattern display
        updateMoveCounter();
        updateButtonCursors(); // Update cursors - game no longer active during setup

        arrowButtons.forEach(name => updateButtonState(name, false, false));

        // Check if the current puzzle was solved (gridState matches targetState)
        const puzzleWasSolved = gridState.every((row, r) =>
            row.every((val, c) => val === targetState[r][c])
        );

        if (puzzleWasSolved) {
            // Puzzle was solved - use the nice flip animation
            await showTilesDeactivating();
        } else {
            // Mid-game restart - fade to black, reset tiles, fade back in
            await fadeScreensOut(250);

            // Reset all tiles to off and update grid state
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    mainTiles[r][c].texture = textures['tile_off'];
                    mainTiles[r][c].scale.set(1, 1);
                    gridState[r][c] = 0;
                }
            }
            if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();

            await fadeScreensIn(250);
        }

        generateTargetState();
        await showTilesActivating();

        // Pause to let player see the goal pattern before shuffling
        await delay(500);

        // Lock back screen now - it keeps the goal pattern snapshot
        isBackScreenLocked = true;
        if (!DEBUG_SHOW_TILES_DIRECTLY) renderGrids(); // One final render before lock

        const shuffleMoves = [];
        const numShifts = 15 + Math.floor(Math.random() * 5);
        let tempState = JSON.parse(JSON.stringify(targetState));
        for (let i = 0; i < numShifts; i++) {
            const move = Math.floor(Math.random() * 4);
            shuffleMoves.push(move);
            tempState = applyMoveToState(tempState, move);
        }

        await shuffleWithAnimation(shuffleMoves);

        // Back screen already locked
        isBackScreenLocked = true;

        arrowButtons.forEach(name => updateButtonState(name, true, false));
        isGameActive = true;
        isAnimating = false; // Animation complete, allow input
        updateButtonCursors(); // Update cursors now that game is active
    }

    async function handleArrowPress(move) {
        if (!isGameActive || isShuffling || isSolving) return;

        const buttonName = getMoveButtonName(move);
        const isRowMove = move < 2;  // moves 0,1 are rows; moves 2,3 are columns

        // Cancel conflicting animation if present (row vs column conflict)
        // Row animations and column animations conflict because they move tiles on different axes
        // Two row animations or two column animations can run simultaneously (no conflict)
        if (isRowMove && activeColAnimation) {
            // Starting a row animation while a column animation is active - cancel the column animation
            activeColAnimation.cancelled = true;
        } else if (!isRowMove && activeRowAnimation) {
            // Starting a column animation while a row animation is active - cancel the row animation
            activeRowAnimation.cancelled = true;
        }

        // Animate FIRST (before state change)
        await animateShift(move);

        // Play move sound, apply state and update textures
        playMoveSound(move);
        applyMove(move);
        moves++;
        updateMoveCounter();
        updateTileSprites(mainTiles, gridState);

        if (checkWin()) {
            isGameActive = false;
            isAnimating = true; // Block New Puzzle button during win animation
            arrowButtons.forEach(name => updateButtonState(name, false, false));
            updateButtonCursors(); // Update cursors now that game ended
            await delay(250); // Let move sound finish before win sound
            await triggerWinEffect();
            isAnimating = false; // Win animation complete, allow New Puzzle
            updateButtonCursors();

            // Light up the New Puzzle button as invitation to start a new game
            // It will turn off when they press it (in handleNewPuzzle)
            updateButtonState('newPuzzle', false, true);
        }
    }

    async function handleGiveUp() {
        if (!isGameActive || isSolving) return;

        isSolving = true;
        isGameActive = false;
        updateButtonCursors(); // Update cursors - buttons no longer clickable during solve

        arrowButtons.forEach(name => updateButtonState(name, false, false));
        updateButtonState('giveUp', false, true);

        const solution = solvePuzzle();

        if (solution && solution.length > 0) {
            for (const move of solution) {
                const buttonName = getMoveButtonName(move);
                updateButtonState(buttonName, true, false);

                // Animate FIRST (before state change)
                await animateShift(move);

                // Play move sound, apply state and update textures
                playMoveSound(move);
                applyMove(move);
                moves++;
                updateMoveCounter();
                updateTileSprites(mainTiles, gridState);

                updateButtonState(buttonName, false, false);
                await delay(250);
            }
        }

        updateButtonState('giveUp', false, false);
        isSolving = false;
        isAnimating = true; // Block New Puzzle button during win animation
        updateButtonCursors(); // Update cursors now that solving is complete
        await triggerWinEffect();
        isAnimating = false; // Win animation complete, allow New Puzzle
        updateButtonCursors();

        // Light up the New Puzzle button as invitation to start a new game
        updateButtonState('newPuzzle', false, true);
    }

    async function handleNewPuzzle() {
        if (isShuffling || isSolving || isAnimating) return;
        updateButtonState('newPuzzle', false, true);
        await delay(100);
        updateButtonState('newPuzzle', false, false);
        await startNewGame();
    }

    // ===== INPUT HANDLING =====
    function setupInputHandlers() {
        // Button name to move mapping:
        // sideTop = move 0 = row pair 0 (rows 0-1)
        // sideBot = move 1 = row pair 1 (rows 2-3)
        // botLeft = move 2 = col pair 0 (cols 0-1)
        // botRight = move 3 = col pair 1 (cols 2-3)
        const buttonMoveMap = { sideTop: 0, sideBot: 1, botLeft: 2, botRight: 3 };

        Object.keys(buttonMoveMap).forEach(buttonName => {
            const hitArea = buttonHitAreas[buttonName];

            hitArea.on('pointerdown', () => {
                if (isGameActive && !isShuffling && !isSolving) {
                    pressedButtons.add(buttonName);
                    playPressSound();
                    // Show pressed state and trigger action immediately for responsiveness
                    updateButtonState(buttonName, true, true);
                    handleArrowPress(buttonMoveMap[buttonName]);
                }
            });

            hitArea.on('pointerup', () => {
                // Release pressed visual state when user lifts finger/mouse
                if (buttonSprites[buttonName]) {
                    if (pressedButtons.has(buttonName)) {
                        pressedButtons.delete(buttonName);
                        playReleaseSound();
                    }
                    updateButtonState(buttonName, buttonSprites[buttonName].isOn, false);
                }
            });

            hitArea.on('pointerupoutside', () => {
                // Release pressed visual state when user lifts finger/mouse outside button
                if (buttonSprites[buttonName]) {
                    if (pressedButtons.has(buttonName)) {
                        pressedButtons.delete(buttonName);
                        playReleaseSound();
                    }
                    updateButtonState(buttonName, buttonSprites[buttonName].isOn, false);
                }
            });
        });

        buttonHitAreas.giveUp.on('pointerdown', () => {
            if (isGameActive && !isSolving) {
                pressedButtons.add('giveUp');
                playPressSound();
                updateButtonState('giveUp', false, true);
            }
        });
        buttonHitAreas.giveUp.on('pointerup', () => {
            if (pressedButtons.has('giveUp')) {
                pressedButtons.delete('giveUp');
                playReleaseSound();
            }
            handleGiveUp();
        });
        buttonHitAreas.giveUp.on('pointerupoutside', () => {
            if (pressedButtons.has('giveUp')) {
                pressedButtons.delete('giveUp');
                playReleaseSound();
            }
            if (!isSolving) {
                updateButtonState('giveUp', false, false);
            }
        });

        buttonHitAreas.newPuzzle.on('pointerdown', () => {
            if (!isShuffling && !isSolving && !isAnimating) {
                pressedButtons.add('newPuzzle');
                playPressSound();
                updateButtonState('newPuzzle', false, true);
            }
        });
        buttonHitAreas.newPuzzle.on('pointerup', () => {
            if (pressedButtons.has('newPuzzle')) {
                pressedButtons.delete('newPuzzle');
                playReleaseSound();
            }
            handleNewPuzzle();
        });
        buttonHitAreas.newPuzzle.on('pointerupoutside', () => {
            if (pressedButtons.has('newPuzzle')) {
                pressedButtons.delete('newPuzzle');
                playReleaseSound();
            }
            updateButtonState('newPuzzle', false, false);
        });
    }

    // ===== INIT =====
    async function initGame() {
        updateMoveCounter();

        if (!DEBUG_SKIP_LOGO) {
            const startOverlay = new PIXI.Graphics();
            startOverlay.rect(0, 0, BG_WIDTH, BG_HEIGHT);
            startOverlay.fill({ color: 0x000000, alpha: 0 });
            startOverlay.eventMode = 'static';
            startOverlay.cursor = 'pointer';
            mainContainer.addChild(startOverlay);

            await new Promise(resolve => {
                startOverlay.on('pointerdown', () => resolve());
            });

            mainContainer.removeChild(startOverlay);
            startOverlay.destroy();

            // Play start sound and begin bgloop when it finishes
            sounds.start.play({
                complete: () => {
                    sounds.bgloop.play();
                }
            });

            // Fade screens out first (with retro framerate)
            await fadeScreensOut(250);

            // Fade logo out (also with retro framerate)
            const fadeDuration = 250;
            const startTime = performance.now();
            const frameInterval = RETRO_FPS > 0 ? 1000 / RETRO_FPS : 0;
            let lastFrameTime = startTime;

            await new Promise(resolve => {
                function animate() {
                    const now = performance.now();
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / fadeDuration, 1);

                    // Only update at retro framerate intervals
                    if (RETRO_FPS <= 0 || now - lastFrameTime >= frameInterval) {
                        lastFrameTime = now;
                        logoSprite.alpha = 1 - progress;
                    }

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        logoSprite.visible = false;
                        resolve();
                    }
                }
                requestAnimationFrame(animate);
            });

            // Reset all tiles to off state while screens are black
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    mainTiles[r][c].texture = textures['tile_off'];
                    mainTiles[r][c].scale.set(1, 1);
                    gridState[r][c] = 0;
                }
            }
            if (!DEBUG_SHOW_TILES_DIRECTLY) forceRenderGrids();

            // Fade screens back in
            await fadeScreensIn(250);
        }

        gameStarted = true;
        setupInputHandlers();

        if (!DEBUG_SHOW_TILES_DIRECTLY) {
            await startNewGame();
        } else {
            // In debug mode, we've already set some tiles visible
            // Enable buttons for testing
            arrowButtons.forEach(name => updateButtonState(name, true, false));
            isGameActive = true;

            // Also start the game properly
            await startNewGame();
        }
    }

    initGame();
    console.log('Game initialized');

})();
