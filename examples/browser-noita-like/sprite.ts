// sprite.ts

// Define uma paleta RGBA básica (paleta indexada)
export const PALETTE: [number, number, number, number][] = [
    [0, 0, 0, 0],          // 0 - transparente
    [24, 20, 37, 255],     // 1 - contorno (preto)
    [78, 52, 146, 255],    // 2 - chapéu (roxo)
    [136, 84, 208, 255],   // 3 - roupa (roxo claro)
    [255, 226, 177, 255],  // 4 - rosto/mão (pele)
    [245, 190, 70, 255],   // 5 - detalhe dourado
    [255, 255, 255, 255],  // 6 - olhos/brilho
    [255, 0, 0, 255],      // 7 - dano (vermelho)
    [0, 255, 0, 255],      // 8 - item pickup (verde)
    [255, 255, 0, 255],    // 9 - partícula (amarelo)
];

// Particle system
export type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    colorIndex: number;
};

export const particles: Particle[] = [];

export function spawnParticle(x: number, y: number, colorIndex: number = 9, speed = 1, life = 20) {
    particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        life,
        maxLife: life,
        colorIndex,
    });
}

export function updateParticles() {
    // eslint-disable-next-line prefer-const
    for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravidade
        p.life--;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

export function renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        const [r, g, b] = PALETTE[p.colorIndex];
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
        ctx.fillRect(p.x, p.y, 1, 1);
    }
}

// Sprite flash system
export let spriteFlashTicks = 0;
export function triggerSpriteFlash(duration = 6) {
    spriteFlashTicks = duration;
}

// Sprite animado 16x16, com poses extras
export const WIZARD_SPRITE_FRAMES: Record<'idle' | 'walk' | 'fly' | 'jump' | 'hurt' | 'dead' | 'pickup', Record<'right', Uint8Array[]>> = {
    idle: {
        right: [
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,6,0,0,6,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    },
    walk: {
        right: [
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,6,0,0,6,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ]),
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,6,0,0,6,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    },
    fly: {
        right: [
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,6,0,0,6,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    },
     jump: {
        right: [
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,0,6,6,0,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    },
    hurt: {
        right: [
            new Uint8Array(Array(256).fill(7)) // quadrado vermelho
        ]
    },
    dead: {
        right: [
            new Uint8Array([
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
                0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,
                0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0,
                0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0,
                0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    },
    pickup: {
        right: [
            new Uint8Array([
                0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,
                0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,
                0,0,0,0,1,4,8,0,0,8,4,1,0,0,0,0,
                0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,5,5,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,
                0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
                0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            ])
        ]
    }
};

// Desenha um frame do sprite animado
export function drawSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    sprite: Uint8Array,
    palette: [number, number, number, number][] = PALETTE,
    flipHorizontally = false
) {
    const size = 16;
    const imageData = ctx.createImageData(size, size);
    const useFlash = spriteFlashTicks > 0;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            // Se flip, lemos da coluna invertida
            const srcCol = flipHorizontally ? (size - 1 - col) : col;
            const srcIdx = row * size + srcCol;
            const dstIdx = row * size + col;
            
            const colorIndex = useFlash ? 6 : sprite[srcIdx];
            const [r, g, b, a] = palette[colorIndex];
            imageData.data[dstIdx * 4 + 0] = r;
            imageData.data[dstIdx * 4 + 1] = g;
            imageData.data[dstIdx * 4 + 2] = b;
            imageData.data[dstIdx * 4 + 3] = a;
        }
    }

    ctx.putImageData(imageData, Math.round(x), Math.round(y));

    if (spriteFlashTicks > 0) spriteFlashTicks--;
}

// Renderiza com animação (loop de N frames baseado em tick e direção)
export function drawAnimatedSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    frames: Uint8Array[],
    tick: number,
    palette: [number, number, number, number][] = PALETTE,
    flip = false
) {
    const frame = frames[Math.floor(tick / 10) % frames.length];
    drawSprite(ctx, x, y, frame, palette, flip);
}