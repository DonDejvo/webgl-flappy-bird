let gl;

const url = "https://raw.githubusercontent.com/DonDejvo/webgl-flappy-bird/main/";

const defaultVertex = `#version 300 es
layout (location=0) in vec2 aPos;
layout (location=1) in vec4 aColor;
layout (location=2) in vec2 aUv;
layout (location=3) in float aTexID;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

out vec4 vColor;
out vec2 vUv;
out float vTexID;

void main(void) {
    vColor = aColor;
    vUv = aUv;
    vTexID = aTexID;
    gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPos, 0.0, 1.0);
}`;

const defaultFragment = `#version 300 es
#define numTextures 8
precision mediump float;

in vec4 vColor;
in vec2 vUv;
in float vTexID;

uniform sampler2D uTexSlots[numTextures];

out vec4 color;

void main(void) {
    int idx = int(vTexID + 0.001);
    switch(idx) {
        case 1:
            color = vColor * texture(uTexSlots[1], vUv);
            break;
        case 2:
            color = vColor * texture(uTexSlots[2], vUv);
            break;
        case 3:
            color = vColor * texture(uTexSlots[3], vUv);
            break;
        case 4:
            color = vColor * texture(uTexSlots[4], vUv);
            break;
        case 5:
            color = vColor * texture(uTexSlots[5], vUv);
            break;
        case 6:
            color = vColor * texture(uTexSlots[6], vUv);
            break;
        case 7:
            color = vColor * texture(uTexSlots[7], vUv);
            break;
        default:
            color = vColor;
    }
}`;

class MathUtils {

    static lerp(x, a, b) {
        return (b - a) * x + a;
    }

    static rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    static randInt(min, max) {
        return Math.floor(this.rand(min, max + 1));
    }

    static clamp(x, a, b) {
        return Math.min(Math.max(x, a), b);
    }

    static sat(x) {
        return this.clamp(x, 0, 1);
    }

    static shuffle(arr) {
        for (let i = 0; i < arr.length; ++i) {
            const idx = this.randInt(0, arr.length - 1);
            [arr[i], arr[idx]] = [arr[idx], arr[i]];
        }
    }

    static choice(arr) {
        return arr[this.randInt(0, arr.length - 1)];
    }

    static isPowerOf2(x) {
        return (x & (x - 1)) == 0;
    }

    static max(arr) {
        return Math.max(...arr);
    }

    static min(arr) {
        return Math.min(...arr);
    }

    static avg(arr) {
        return arr.reduce((acc, a) => acc + a) / arr.length;
    }

    static step(edge1, edge2, x) {
        return (x - edge1) / (edge2 - edge1);
    }

    static radToDeg(rad) {
        return rad / Math.PI * 180;
    }

    static degToRad(deg) {
        return def / 180 * Math.PI;
    }

}

class Vec2 {

    static create() {
        return [0, 0];
    }

    static fromValues(x, y) {
        return [x, y];
    }

    static clone(v) {
        return [v[0], v[1]];
    }

    static set(v, x, y) {
        v[0] = x;
        v[1] = y;
    }

    static copy(v1, v2) {
        v1[0] = v2[0];
        v1[1] = v2[1];
        return v1;
    }

    static rot(v, a) {
        let s = Math.sin(a);
        let c = Math.cos(a);
        let x = v[0];
        let y = v[1];
        v[0] = c * x - s * y;
        v[1] = s * x + c * y;
        return v;
    }

    static add(v1, v2) {
        v1[0] += v2[0];
        v1[1] += v2[1];
        return v1;
    }

    static sub(v1, v2) {
        v1[0] -= v2[0];
        v1[1] -= v2[1];
        return v1;
    }

    static mul(v1, v2) {
        v1[0] *= v2[0];
        v1[1] *= v2[1];
        return v1;
    }

    static scale(v1, s) {
        v1[0] *= s;
        v1[1] *= s;
        return v1;
    }
}

class Mat4 {

    static create() {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    static ortho(m, left, right, bottom, top) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        m[0] = lr * -2;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 0;
        m[5] = bt * -2;
        m[6] = 0;
        m[7] = 0;
        m[8] = 0;
        m[9] = 0;
        m[10] = 0;
        m[11] = 0;
        m[12] = (left + right) * lr;
        m[13] = (top + bottom) * bt;
        m[14] = 0;
        m[15] = 1;
        return m;
    }

    static fromTranslation(x, y) {
        const m = this.create();
        m[12] = x;
        m[13] = y;
        return m;
    }
}

class Camera {

    position = [0, 0];
    vw;
    vh;

    needsUpdateProjection = true;
    projectionMatrix = Mat4.create();

    constructor(vw, vh) {
        this.setToOrtho(vw, vh);
    }

    setToOrtho(vw, vh) {
        this.vw = vw;
        this.vh = vh;
        this.needsUpdateProjection = true;
    }

    updateProjection() {
        Mat4.ortho(this.projectionMatrix, -this.vw / 2, this.vw / 2, -this.vh / 2, this.vh / 2);
    }

    getViewMatrix() {
        return Mat4.fromTranslation(-this.position[0], -this.position[1]);
    }

    getProjectionMatrix() {
        if (this.needsUpdateProjection) {
            this.needsUpdateProjection = false;
            this.updateProjection();
        }
        return this.projectionMatrix;
    }

}

class AssetPool {

    static shaders = new Map();
    static textures = new Map();
    static sounds = new Map();
    static toLoad = 0;

    static loadTexture(name, url) {
        const image = new Image();
        image.src = url;
        image.crossOrigin = "Anonymous";
        const promise = new Promise(resolve => {
            image.onload = () => {
                resolve(new Texture(image));
            }
        });
        this.addAsync(this.textures, name, promise);
        return promise;
    }

    static loadAudio(name, url) {
        const promise = fetch(url)
            .then(response => response.arrayBuffer()).then(data => FlappyBird.audio.audioContext.decodeAudioData(data));
        this.addAsync(this.sounds, name, promise);
        return promise;
    }

    static getAudio(name) {
        return this.sounds.get(name);
    }

    static addShader(name, shader) {
        this.add(this.shaders, name, shader);
        return shader;
    }

    static add(dest, name, asset) {
        dest.set(name, asset);
    }

    static addAsync(dest, name, promise) {
        ++this.toLoad;
        promise.then(asset => {
            dest.set(name, asset);
            --this.toLoad;
        });
    }

    static waitForAssetsToLoad() {
        return new Promise(resolve => {
            const wait = () => {
                if (this.toLoad == 0) {
                    resolve(this.assets);
                } else {
                    setTimeout(() => {
                        wait();
                    }, 250);
                }
            }
            wait();
        });
    }

    static getTexture(name) {
        return this.textures.get(name);
    }

    static getShader(name) {
        return this.shaders.get(name);
    }

}

class AudioManager {

    audioContext;
    bgMusicNode = null;
    masterGain;
    bgMusicGain;
    cueGain;
    analyser;
    dataArray;

    constructor() {

        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1.0;

        this.bgMusicGain = this.audioContext.createGain();
        this.bgMusicGain.connect(this.masterGain);
        this.bgMusicGain.gain.value = 1.0;

        this.cueGain = this.audioContext.createGain();
        this.cueGain.connect(this.masterGain);
        this.cueGain.gain.value = 1.0;

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.connect(this.audioContext.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    get masterVolume() {
        return this.masterGain.gain.value;
    }

    set masterVolume(val) {
        this.masterGain.gain.value = MathUtils.sat(val);
    }

    get bgMusicVolume() {
        return this.bgMusicGain.gain.value;
    }

    set bgMusicVolume(val) {
        this.bgMusicGain.gain.value = MathUtils.sat(val);
    }

    get cueVolume() {
        return this.cueGain.gain.value;
    }

    set cueVolume(val) {
        this.cueGain.gain.value = MathUtils.sat(val);
    }

    playBgMusic(clipName, params = {}) {
        const loop = params.loop === undefined ? true : params.loop;
        const time = params.time === undefined ? 0 : params.time;

        const clipData = AssetPool.getAudio(clipName);

        this.stopBgMusic();

        this.bgMusicNode = this.audioContext.createBufferSource();
        this.bgMusicNode.buffer = clipData;
        this.bgMusicNode.loop = loop;
        this.bgMusicNode.start(time);

        this.bgMusicNode.connect(this.bgMusicGain);
        this.bgMusicNode.connect(this.analyser);

    }

    stopBgMusic() {
        if (this.isBgMusicPlaying()) {
            this.bgMusicNode.stop(0);
            this.bgMusicNode = null;
        }
    }

    isBgMusicPlaying() {
        return !(this.bgMusicNode === null);
    }

    playCue(clipName, volume = 1.0) {
        const clipData = AssetPool.getAudio(clipName);

        const cueNode = this.audioContext.createBufferSource();
        cueNode.buffer = clipData;
        cueNode.start(0);

        const gain = this.audioContext.createGain();
        gain.connect(this.cueGain);
        gain.gain.value = MathUtils.sat(volume);

        cueNode.connect(gain);
    }

    onResume() {
        if (this.audioContext.state == "suspended") {
            this.audioContext.resume();
        }
    }

}

class Texture {

    id;
    width;
    height;

    constructor(data) {
        // create texture from image data
        this.id = gl.createTexture();
        this.width = data.width;
        this.height = data.height;

        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);

        // nearest value for filters pixelate texture if downscaling or upscaling
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    bind() {
        gl.bindTexture(gl.TEXTURE_2D, this.id);
    }

    unbind() {
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

}

class Shader {

    programID;

    constructor(vsrc, fsrc) {
        // creates and links shader program
        this.programID = gl.createProgram();

        const vertShader = this.compileShader(vsrc, gl.VERTEX_SHADER);
        const fragShader = this.compileShader(fsrc, gl.FRAGMENT_SHADER);


        gl.attachShader(this.programID, vertShader);
        gl.attachShader(this.programID, fragShader);

        gl.linkProgram(this.programID);

        // check if linking was successful
        if (gl.getProgramParameter(this.programID, gl.LINK_STATUS) == 0) {
            console.log(gl.getProgramInfoLog(this.programID));
        }
    }

    // loads and compiles shader
    compileShader(src, type) {
        const shader = gl.createShader(type);

        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        // check if compiling was successful
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0) {
            console.log(gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    use() {
        gl.useProgram(this.programID);
    }

    detach() {
        gl.useProgram(null);
    }

    supplyFloat(name, v) {
        const loc = gl.getUniformLocation(this.programID, name);
        gl.uniform1f(loc, v);
    }

    supplyIntArray(name, arr) {
        const loc = gl.getUniformLocation(this.programID, name);
        gl.uniform1iv(loc, arr);
    }

    supplyMat4(name, m) {
        const loc = gl.getUniformLocation(this.programID, name);
        gl.uniformMatrix4fv(loc, false, m);
    }

}

class Device {

    static isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(navigator.userAgent);

}

class Input {

    static MAX_TOUCHES = 10;

    elem;
    touchInfo = [];
    keyInfo = new Input.KeyInfo();

    constructor() {
        for (let i = 0; i < Input.MAX_TOUCHES; ++i) {
            this.touchInfo[i] = new Input.TouchInfo();
        }
    }

    isKeyPressed(key) {
        return this.keyInfo.currentlyPressed.has(key);
    }

    isKeyClicked(key) {
        return this.keyInfo.justPressed.has(key);
    }

    isTouched(touchId = 0) {
        return this.touchInfo[touchId].isTouched;
    }

    isJustTouched(touchId = 0) {
        return this.touchInfo[touchId].isJustTouched;
    }

    isMousePressed() {
        return this.isTouched();
    }

    isMouseClicked() {
        return this.isJustTouched();
    }

    getX(touchId = 0) {
        return this.touchInfo[touchId].x;
    }

    getY(touchId = 0) {
        return this.touchInfo[touchId].y;
    }

    getDeltaX(touchId = 0) {
        return this.touchInfo[touchId].deltaX;
    }

    getDeltaY(touchId = 0) {
        return this.touchInfo[touchId].deltaY;
    }
    initEvents(elem) {
        this.elem = elem;

        addEventListener("keydown", (ev) => this.onKeyDown(ev));
        addEventListener("keyup", (ev) => this.onKeyUp(ev));

        if (Device.isMobile) {
            elem.addEventListener("touchstart", (ev) => this.handleTouchEvent(ev));
            elem.addEventListener("touchmove", (ev) => this.handleTouchEvent(ev));
            elem.addEventListener("touchend", (ev) => this.handleTouchEvent(ev));
        } else {
            elem.addEventListener("mousedown", (ev) => this.handleMouseEvent(ev));
            elem.addEventListener("mousemove", (ev) => this.handleMouseEvent(ev));
            elem.addEventListener("mouseup", (ev) => this.handleMouseEvent(ev));
        }

    }

    handleTouchEvent(ev) {
        if (ev.cancelable) {
            ev.preventDefault();
        }
        const boundingRect = ev.target.getBoundingClientRect();
        for (let touch of ev.changedTouches) {
            const x = touch.pageX - boundingRect.x;
            const y = touch.pageY - boundingRect.y;
            const touchInfo = this.touchInfo[touch.identifier];

            touchInfo.x = x;
            touchInfo.y = boundingRect.height - y;

            switch (ev.type) {
                case "touchstart":
                    touchInfo.isTouched = true;
                    break;
                case "touchend":
                    touchInfo.isTouched = false;
                    break;
            }
        }
    }

    handleMouseEvent(ev) {
        const boundingRect = ev.target.getBoundingClientRect();
        const x = ev.pageX - boundingRect.x;
        const y = ev.pageY - boundingRect.y;

        const touchInfo = this.touchInfo[0];

        touchInfo.x = x;
        touchInfo.y = boundingRect.height - y;

        switch (ev.type) {
            case "mousedown":
                touchInfo.isTouched = true;
                break;
            case "mouseup":
                touchInfo.isTouched = false;
        }

    }

    onKeyDown(ev) {
        this.keyInfo.currentlyPressed.add(ev.code);
    }

    onKeyUp(ev) {
        this.keyInfo.currentlyPressed.delete(ev.code);
    }

    update() {
        this.keyInfo.update();
        for (let info of this.touchInfo) {
            info.update();
        }
    }

    static TouchInfo = class {

        x = 0;
        y = 0;
        prevX = 0;
        prevY = 0;
        deltaX = 0;
        deltaY = 0;
        isTouched = false;
        wasTouched = false;
        isJustTouched = false;

        update() {
            this.isJustTouched = this.isTouched && !this.wasTouched;
            this.wasTouched = this.isTouched;
            if (this.isJustTouched) {
                this.prevX = this.x;
                this.prevY = this.y;
            }
            this.deltaX = this.x - this.prevX;
            this.deltaY = this.y - this.prevY;
            this.prevX = this.x;
            this.prevY = this.y;
        }

    }

    static KeyInfo = class {

        currentlyPressed = new Set();
        previouslyPressed = new Set();
        justPressed = new Set();

        update() {
            this.justPressed.clear();
            this.currentlyPressed.forEach((val) => {
                if (!this.previouslyPressed.has(val)) {
                    this.justPressed.add(val);
                }
            });
            this.previouslyPressed = new Set(this.currentlyPressed);
        }
    }

}

class Renderer {

    static MAX_SPRITES = 1000;

    shader;
    batches = [];

    constructor(shader) {
        this.shader = shader;
    }

    add(sprite) {
        let isAdded = false;
        for (let batch of this.batches) {
            if (!batch.isFull && batch.zIndex == sprite.zIndex) {
                batch.addSprite(sprite);
                isAdded = true;
                break;
            }
        }
        if (!isAdded) {
            const batch = new SpriteBatch(this, Renderer.MAX_SPRITES, sprite.zIndex);
            batch.addSprite(sprite);
            this.batches.push(batch);

            this.batches.sort((a, b) => a.zIndex - b.zIndex);
        }
    }

    remove(sprite) {
        for (let batch of this.batches) {
            if (batch.removeSprite(sprite)) {
                return;
            }
        }
    }

    render(camera) {
        for (let batch of this.batches) {
            batch.render(camera);
        }
    }

}

class SpriteBatch {

    static POS_SIZE = 2;
    static POS_OFFSET = 0;
    static COLOR_SIZE = 4;
    static COLOR_OFFSET = this.POS_SIZE;
    static UV_SIZE = 2;
    static UV_OFFSET = this.COLOR_OFFSET + this.COLOR_SIZE;
    static TEX_ID_SIZE = 1;
    static TEX_ID_OFFSET = this.UV_OFFSET + this.UV_SIZE;
    static VERT_SIZE = this.POS_SIZE + this.COLOR_SIZE + this.UV_SIZE + this.TEX_ID_SIZE;

    static positions = [
        [-0.5, 0.5],
        [0.5, 0.5],
        [0.5, -0.5],
        [-0.5, -0.5]
    ];

    vaoID;
    vboID;
    eboID;
    renderer;
    maxSprites;
    zindex;
    vertices;
    sprites;
    textures;
    texSlots = [0, 1, 2, 3, 4, 5, 6, 7];
    spriteCount = 0;
    isFull = false;

    constructor(renderer, maxSprites, zIndex) {
        this.renderer = renderer;
        this.maxSprites = maxSprites;
        this.zIndex = zIndex;
        this.sprites = [];
        this.textures = [];
        this.vertices = new Float32Array(maxSprites * 4 * SpriteBatch.VERT_SIZE);

        this.vaoID = gl.createVertexArray();
        gl.bindVertexArray(this.vaoID);

        this.vboID = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);
        gl.bufferData(gl.ARRAY_BUFFER, this.maxSprites * SpriteBatch.VERT_SIZE * 4 * 4, gl.DYNAMIC_DRAW);

        this.eboID = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eboID);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.genIndices(), gl.STATIC_DRAW);

        gl.vertexAttribPointer(0, SpriteBatch.POS_SIZE, gl.FLOAT, false, SpriteBatch.VERT_SIZE * 4, SpriteBatch.POS_OFFSET * 4);
        gl.vertexAttribPointer(1, SpriteBatch.COLOR_SIZE, gl.FLOAT, false, SpriteBatch.VERT_SIZE * 4, SpriteBatch.COLOR_OFFSET * 4);
        gl.vertexAttribPointer(2, SpriteBatch.UV_SIZE, gl.FLOAT, false, SpriteBatch.VERT_SIZE * 4, SpriteBatch.UV_OFFSET * 4);
        gl.vertexAttribPointer(3, SpriteBatch.TEX_ID_SIZE, gl.FLOAT, false, SpriteBatch.VERT_SIZE * 4, SpriteBatch.TEX_ID_OFFSET * 4);
    }

    addSprite(sprite) {
        if (this.isFull) {
            return;
        }
        if (++this.spriteCount >= this.maxSprites) {
            this.isFull = true;
        }
        this.sprites.push(sprite);
        const tex = sprite.getTexture();
        if (tex != null && !this.textures.includes(tex)) {
            this.textures.push(tex);
        }
    }

    removeSprite(sprite) {
        const idx = this.sprites.indexOf(sprite);
        if (idx != -1) {
            --this.spriteCount;
            this.sprites.splice(idx, 1);
            return true;
        }
        return false;
    }

    render(camera) {
        const shader = this.renderer.shader;
        let offset = 0;
        for (let i = 0; i < this.sprites.length; ++i) {
            offset = this.genVertices(i, offset);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);

        shader.use();
        for (let i = 0; i < this.textures.length; ++i) {
            gl.activeTexture(gl.TEXTURE0 + i + 1);
            this.textures[i].bind();
        }

        // supply uniforms
        shader.supplyMat4("uProjectionMatrix", camera.getProjectionMatrix());
        shader.supplyMat4("uViewMatrix", camera.getViewMatrix());
        shader.supplyIntArray("uTexSlots", this.texSlots);

        // activate VAO
        gl.bindVertexArray(this.vaoID);

        // enable attributes
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        // draw in triangle mode - each 3 vertices make 1 triangle
        gl.drawElements(gl.TRIANGLES, this.spriteCount * 6, gl.UNSIGNED_SHORT, 0);

        // disable attributes
        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(3);

        for (let i = 0; i < this.textures.length; ++i) {
            this.textures[i].unbind();
        }
        shader.detach();
    }

    genVertices(idx, offset) {
        const sprite = this.sprites[idx];
        const tex = sprite.getTexture();
        const color = sprite.getColor();
        const coords = sprite.getCoords();

        let texID = 0;
        for (let i = 0; i < this.textures.length; ++i) {
            if (this.textures[i] == tex) {
                texID = i + 1;
                break;
            }
        }

        for (let i = 0; i < 4; ++i) {
            // pos
            const pos = Vec2.clone(SpriteBatch.positions[i]);
            Vec2.mul(pos, sprite.scale);
            Vec2.rot(pos, sprite.rotation);
            Vec2.add(pos, sprite.position);

            for (let j = 0; j < SpriteBatch.POS_SIZE; ++j) {
                this.vertices[offset + SpriteBatch.POS_OFFSET + j] = pos[j];
            }

            // color
            for (let j = 0; j < SpriteBatch.COLOR_SIZE; ++j) {
                this.vertices[offset + SpriteBatch.COLOR_OFFSET + j] = color[j];
            }

            // uv
            for (let j = 0; j < SpriteBatch.UV_SIZE; ++j) {
                this.vertices[offset + SpriteBatch.UV_OFFSET + j] = coords[i * SpriteBatch.UV_SIZE + j];
            }

            // texID
            this.vertices[offset + SpriteBatch.TEX_ID_OFFSET] = texID;

            offset += SpriteBatch.VERT_SIZE;
        }

        return offset;
    }

    genIndices() {
        const indices = new Uint16Array(this.maxSprites * 6);
        const idxCache = [0, 1, 2, 0, 2, 3];
        for (let i = 0; i < this.maxSprites; ++i) {
            for (let j = 0; j < 6; ++j) {
                indices[i * 6 + j] = idxCache[j] + i * 4;
            }
        }
        return indices;
    }

}

class Spritesheet {

    texture;
    sprites;

    constructor(texture, sw, sh) {
        this.texture = texture;
        const tw = texture.width;
        const th = texture.height;
        const countX = Math.floor(tw / sw);
        const countY = Math.floor(th / sh);
        this.sprites = new Array(countY);
        for (let y = 0; y < countY; ++y) {
            this.sprites[y] = new Array(countX);
            for (let x = 0; x < countX; ++x) {
                this.sprites[y][x] = new Sprite(texture, x * sw, y * sh, sw, sh);
            }
        }
    }

    getSprite(x, y) {
        return this.sprites[y][x];
    }

}

class Sprite {

    texture;
    coords = [
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ];

    constructor(...args) {
        this.texture = args[0];
        if (args.length == 5) {
            this.setRegion(args[1], args[2], args[3], args[4]);
        }
    }

    setRegion(x, y, w, h) {
        const tw = this.texture.width;
        const th = this.texture.height;
        this.coords[0] = x / tw;
        this.coords[1] = y / th;
        this.coords[2] = (x + w) / tw;
        this.coords[3] = y / th;
        this.coords[4] = (x + w) / tw;
        this.coords[5] = (y + h) / th;
        this.coords[6] = x / tw;
        this.coords[7] = (y + h) / th;
    }
}

class SpriteRenderer {

    sprite;
    color = [1, 1, 1, 1];
    zIndex = 0;
    position = [0, 0];
    rotation = 0;
    scale = [1, 1];

    constructor(sprite) {
        this.sprite = sprite;
    }

    getTexture() {
        return this.sprite.texture;
    }

    getColor() {
        return this.color;
    }

    setColor(r, g, b, a) {
        this.color[0] = r;
        this.color[1] = g;
        this.color[2] = b;
        this.color[3] = a;
    }

    getCoords() {
        return this.sprite.coords;
    }

    getSprite() {
        return this.sprite;
    }

    setSprite(sprite) {
        this.sprite = sprite;
    }

}

class Animation {

    frames;
    frameRate;
    totalTime;

    constructor(...args) {
        this.frameRate = args[0];
        this.frames = [];
        for (let i = 1; i < args.length; ++i) {
            this.frames.push(args[i]);
        }
        this.totalTime = this.frames.length * this.frameRate;
    }

    getFrame(time) {
        const idx = Math.floor(time % this.totalTime / this.frameRate);
        return this.frames[idx];
    }

}

class Score {
    level;
    sprites = [];
    activeCount = 0;
    value = 0;

    constructor(level, x, y) {
        this.level = level;
        this.x = x;
        this.y = y;
        this.spritesheet = new Spritesheet(AssetPool.getTexture("digits"), 24, 36);
        for (let i = 0; i < 4; ++i) {
            const sprite = new SpriteRenderer(this.spritesheet.getSprite(0, 0));
            sprite.zIndex = 3;
            Vec2.set(sprite.scale, 24, 36);
            this.sprites.push(sprite);
        }
        this.setScore(0);
    }

    inc() {
        this.setScore(this.value + 1);
        if (this.value % 10 == 0) {
            this.level.background.change();
        }
    }

    setScore(score) {
        this.value = score;
        const digits = score.toString().split("").map(x => parseInt(x));
        for (let i = 0; i < this.sprites.length; ++i) {
            const sprite = this.sprites[i];
            if (i < digits.length) {
                sprite.setSprite(this.spritesheet.getSprite(digits[i], 0));
                Vec2.set(sprite.position, this.x - digits.length * 12 + i * 24 + 12, this.y);
                if (i >= this.activeCount) {
                    this.level.renderer.add(sprite);
                }
            } else {
                if (i < this.activeCount) {
                    this.level.renderer.remove(sprite);
                }
            }
        }
        this.activeCount = digits.length;
    }
}

class Player {

    level;
    sprite;
    anim;
    vy = 0;
    width = 45;
    height = 30;

    ACC = 1780;
    MAX_VEL = 540;
    FORCE = 480;
    MIN_ANGLE = -Math.PI / 2;
    MAX_ANGLE = 0.4;
    MIN_Y = -150;

    constructor(level) {
        this.level = level;
        const spritesheet = new Spritesheet(AssetPool.getTexture("player"), 34, 24);
        this.anim = new Animation(
            80,
            spritesheet.getSprite(0, 0),
            spritesheet.getSprite(0, 1),
            spritesheet.getSprite(0, 2)
        );
        this.sprite = new SpriteRenderer(spritesheet.getSprite(0, 0));
        this.sprite.zIndex = 2;
        Vec2.set(this.sprite.scale, this.width, this.height);
        level.renderer.add(this.sprite);
        this.reset();
    }

    reset() {
        Vec2.set(this.sprite.position, -80, 60);
    }

    getX() {
        return this.sprite.position[0];
    }

    getY() {
        return this.sprite.position[1];
    }

    update(dt) {
        if (this.level.state == "playing" || this.level.state == "gameover") {
            this.vy += this.ACC * dt;
        } else if (this.level.state == "ready") {
            this.vy = 0;
        }

        if (this.vy > this.MAX_VEL) {
            this.vy = this.MAX_VEL;
        }

        if (FlappyBird.input.isJustTouched() || FlappyBird.input.isKeyClicked("Space")) {
            if (this.level.state == "ready") {

                this.level.setState("playing");
            }
            if (this.level.state == "playing") {
                this.vy = -this.FORCE;
                FlappyBird.audio.playCue("wing");
            }
            if (this.level.state == "gameover" && this.level.stateTime - this.level.stateLastChangeTime >= Level.GAMEOVER_SHOW_DELAY * 2) {
                this.level.setState("ready");

            }
        }

        this.sprite.position[1] -= this.vy * dt;
        if (this.getY() < this.MIN_Y) {
            this.sprite.position[1] = this.MIN_Y;
            if (this.level.state != "gameover") {
                FlappyBird.audio.playCue("hit");
            }
            this.level.gameOver();
        }


        if (this.level.state != "gameover") {
            for (let pipe of this.level.pipes) {

                if (this.collide(pipe)) {
                    FlappyBird.audio.playCue("hit");
                    FlappyBird.audio.playCue("die");
                    this.level.gameOver();
                }
            }
        }

        if (this.level.state == "playing" || this.level.state == "gameover") {
            if (this.vy < this.MAX_VEL * 0.7) {
                this.sprite.rotation = this.MAX_ANGLE;
            } else {
                this.sprite.rotation -= 7 * dt;
                if (this.sprite.rotation < this.MIN_ANGLE) {
                    this.sprite.rotation = this.MIN_ANGLE;
                }
            }
        } else if (this.level.state == "ready") {
            this.sprite.rotation = 0;
        }

        if (this.level.state != "gameover") {
            this.sprite.setSprite(this.anim.getFrame(this.level.stateTime));
        }
    }

    collide(pipe) {
        return Math.abs(this.getX() - pipe.x) < (this.width + pipe.width) * 0.45 &&
            (this.getY() - this.height * 0.45 < pipe.y ||
                this.getY() + this.height * 0.45 > pipe.y + Pipe.GAP);
    }

}

class Ground {

    level;
    sprites;
    height = 120;
    y = 40;

    constructor(level) {
        this.level = level;
        this.sprites = [];
        for (let i = 0; i < 2; ++i) {
            const sprite = new SpriteRenderer(new Sprite(AssetPool.getTexture("ground")));
            sprite.zIndex = 2;
            Vec2.set(sprite.scale, FlappyBird.WIDTH, this.height);
            Vec2.set(sprite.position, i * FlappyBird.WIDTH, FlappyBird.HEIGHT * -0.5 + this.y);
            this.sprites.push(sprite);
            level.renderer.add(sprite);
        }

    }

    update(dt) {
        if (this.level.state == "gameover") {
            return;
        }
        if (this.sprites[0].position[0] <= -FlappyBird.WIDTH) {
            for (let sprite of this.sprites) {
                sprite.position[0] += FlappyBird.WIDTH;
            }
        }
        for (let sprite of this.sprites) {
            sprite.position[0] -= this.level.speed * dt;
        }
    }

}

class Pipe {

    level;
    sprites;
    x;
    y;
    passed = false;
    width = 70;
    height = 360;

    static GAP = 120;
    static MAX_HEIGHT = 80;
    static MIN_HEIGHT = -100;
    static SPACING = 230;


    constructor(level, x) {
        this.level = level;
        this.sprites = [];
        this.x = x;

        const topSprite = new SpriteRenderer(new Sprite(AssetPool.getTexture("pipe")));
        topSprite.zIndex = 1;
        Vec2.set(topSprite.scale, this.width, this.height);
        topSprite.rotation = Math.PI;
        topSprite.position[0] = x;
        this.sprites.push(topSprite);
        level.renderer.add(topSprite);

        const bottomSprite = new SpriteRenderer(new Sprite(AssetPool.getTexture("pipe")));
        bottomSprite.zIndex = 1;
        Vec2.set(bottomSprite.scale, this.width, this.height);
        bottomSprite.position[0] = x;
        this.sprites.push(bottomSprite);
        level.renderer.add(bottomSprite);

    }

    setHeight(y) {
        this.y = y;
    }

    reset() {
        this.setHeight(MathUtils.rand(Pipe.MIN_HEIGHT, Pipe.MAX_HEIGHT));
        this.passed = false;
    }

    update(dt) {
        if (this.x <= -0.5 * FlappyBird.WIDTH - this.width) {
            this.x += this.level.pipes.length * Pipe.SPACING;
            this.reset();
        }
        if (this.level.state == "playing") {
            this.x -= this.level.speed * dt;
        }
        if (!this.passed && this.level.player.getX() > this.x) {
            this.passed = true;
            FlappyBird.audio.playCue("point");
            this.level.score.inc();
        }
        Vec2.set(this.sprites[0].position, this.x, this.y + this.height / 2 + Pipe.GAP);
        Vec2.set(this.sprites[1].position, this.x, this.y - this.height / 2);
    }

}

class Filter {
    level;
    filter;
    animDur = 300;
    playing = false;
    startTime;

    constructor(level) {
        this.level = level;
        this.filter = new SpriteRenderer(new Sprite(null));
        this.filter.setColor(0, 0, 0, 0);
        Vec2.set(this.filter.scale, FlappyBird.WIDTH, FlappyBird.HEIGHT);
        this.filter.zIndex = 4;
        level.renderer.add(this.filter);
    }

    update() {
        if (!this.playing) {
            return;
        }
        const val = MathUtils.sat(MathUtils.step(this.startTime, this.startTime + this.animDur, this.level.stateTime));
        this.filter.setColor(1 - val, 1 - val, 1 - val, 1 - val);
        if (val >= 1) {
            this.playing = false;
            this.filter.setColor(0, 0, 0, 0);
        }
    }

    play() {
        this.playing = true;
        this.startTime = this.level.stateTime;
    }
}

class Background {
    level;
    anim = null;
    animDur = 1500;
    startTime;
    night;
    day;
    isDay = true;

    constructor(level) {
        this.level = level;
        this.night = new SpriteRenderer(new Sprite(AssetPool.getTexture("background-night")));
        this.night.zIndex = 1;
        Vec2.set(this.night.scale, FlappyBird.WIDTH, FlappyBird.HEIGHT);
        level.renderer.add(this.night);

        this.day = new SpriteRenderer(new Sprite(AssetPool.getTexture("background")));
        this.day.zIndex = 1;
        Vec2.set(this.day.scale, FlappyBird.WIDTH, FlappyBird.HEIGHT);
        level.renderer.add(this.day);
    }

    reset() {
        this.anim = null;
        this.isDay = true;
        this.day.setColor(1, 1, 1, 1);
    }

    update(dt) {
        if (this.anim == null) {
            return;
        }
        const val = MathUtils.sat(MathUtils.step(this.startTime, this.startTime + this.animDur, this.level.stateTime));
        if (this.anim == "day") {
            this.day.setColor(val, val, val, val);
        } else if (this.anim == "night") {
            this.day.setColor(1 - val, 1 - val, 1 - val, 1 - val);
        }
        if (val >= 1) {
            this.anim = null;
        }
    }

    play(name) {
        this.anim = name;
        this.startTime = this.level.stateTime;
    }

    change() {
        this.play(this.isDay ? "night" : "day");
        this.isDay = !this.isDay;
    }
}

class Level {
    static GAMEOVER_SHOW_DELAY = 800;

    camera;
    renderer;
    stateTime = 0;
    pipes;

    player;
    ground;
    score;
    speed = 150;
    state;
    stateLastChangeTime = 0;
    filter;
    readyText;
    gameoverText;
    gameoverTextVisible = false;
    background;

    createBackground() {
        this.background = new Background(this);
    }

    async load() {
        AssetPool.addShader("default", new Shader(defaultVertex, defaultFragment));
        AssetPool.loadTexture("player", url + "assets/images/yellowbird.png");
        AssetPool.loadTexture("pipe", url + "assets/images/pipe-green.png");
        AssetPool.loadTexture("background", url + "assets/images/background-day.png");
        AssetPool.loadTexture("background-night", url + "assets/images/background-night.png");
        AssetPool.loadTexture("ground", url + "assets/images/base.png");
        AssetPool.loadTexture("digits", url + "assets/images/digits.png");
        AssetPool.loadTexture("gameover", url + "assets/images/gameover.png");
        AssetPool.loadTexture("message", url + "assets/images/message.png");

        AssetPool.loadAudio("wing", url + "assets/audio/audio_wing.ogg");
        AssetPool.loadAudio("point", url + "assets/audio/audio_point.ogg");
        AssetPool.loadAudio("hit", url + "assets/audio/audio_hit.ogg");
        AssetPool.loadAudio("die", url + "assets/audio/audio_die.ogg");
        AssetPool.loadAudio("swoosh", url + "assets/audio/audio_swoosh.ogg");
        await AssetPool.waitForAssetsToLoad();
    }

    setState(state) {
        this.state = state;
        this.stateLastChangeTime = this.stateTime;
        if (state == "ready") {
            this.reset();
            this.gameoverTextVisible = false; this.renderer.remove(this.gameoverText);
            FlappyBird.audio.playCue("swoosh");
        }
    }

    reset() {
        this.score.setScore(0);
        this.background.reset();
        this.player.reset();
        for (let i = 0; i < this.pipes.length; ++i) {
            this.pipes[i].reset();
            this.pipes[i].x = FlappyBird.WIDTH * 1.5 + i * Pipe.SPACING;
        }
    }

    gameOver() {
        if (this.state == "gameover") {
            return;
        }
        this.setState("gameover");
        this.filter.play();
    }

    init() {
        this.camera = new Camera(FlappyBird.WIDTH, FlappyBird.HEIGHT);
        this.renderer = new Renderer(AssetPool.getShader("default"));

        this.createBackground();

        this.player = new Player(this);
        this.ground = new Ground(this);

        this.pipes = [];
        for (let i = 0; i < 3; ++i) {
            this.pipes.push(new Pipe(this, FlappyBird.WIDTH * 1.5 + i * Pipe.SPACING));
        }

        this.score = new Score(this, 0, 190);
        this.filter = new Filter(this);

        this.gameoverText = new SpriteRenderer(new Sprite(AssetPool.getTexture("gameover")));
        this.gameoverText.zIndex = 4;
        Vec2.set(this.gameoverText.scale, 280, 50);
        this.gameoverText.position[1] = 90;

        this.setState("ready");
    }

    update(dt) {
        this.stateTime += dt * 1000;

        this.player.update(dt);
        this.ground.update(dt);
        for (let pipe of this.pipes) {
            pipe.update(dt);
        }
        this.filter.update();

        if (this.state == "gameover" && this.stateTime - this.stateLastChangeTime >= Level.GAMEOVER_SHOW_DELAY && !this.gameoverTextVisible) {
            this.gameoverTextVisible = true; this.renderer.add(this.gameoverText);
            FlappyBird.audio.playCue("swoosh");
        }
        this.background.update(dt);
    }

    render() {
        this.renderer.render(this.camera);
    }

}

class FlappyBird {

    static input;
    static audio;
    static WIDTH = 360;
    static HEIGHT = 520;
    static ASPECT = this.WIDTH / this.HEIGHT;

    canvas;
    dt = 0;
    lastTime;
    viewportWidth;
    viewportHeight;
    level;

    constructor() {
        this.init();
    }

    async init() {
        this.canvas = document.createElement("canvas");
        document.body.appendChild(this.canvas);
        gl = this.canvas.getContext("webgl2");

        addEventListener("resize", () => this.onResize());
        this.onResize();

        FlappyBird.input = new Input();
        FlappyBird.audio = new AudioManager();

        this.canvas.oncontextmenu = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.canvas.addEventListener(Device.isMobile ? "touchstart" : "mousedown", () => FlappyBird.audio.onResume());
        addEventListener("keydown", () => FlappyBird.audio.onResume());
        FlappyBird.input.initEvents(this.canvas);

        this.level = new Level();
        await this.level.load();
        this.level.init();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.lastTime = performance.now();
        this.RAF();
    }

    onResize() {
        const sw = this.canvas.width = innerWidth;
        const sh = this.canvas.height = innerHeight;

        this.viewportWidth = sw;
        this.viewportHeight = sw / FlappyBird.ASPECT;
        if (this.viewportHeight > this.canvas.height) {
            this.viewportWidth = sh * FlappyBird.ASPECT;
            this.viewportHeight = sh;
        }
    }

    RAF() {
        requestAnimationFrame(() => {
            this.RAF();

            const curTime = performance.now();
            this.dt = (curTime - this.lastTime) * 0.001;
            this.lastTime = curTime;

            FlappyBird.input.update();
            this.level.update(this.dt);

            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);


            const offsetX = (this.canvas.width - this.viewportWidth) / 2;
            const offsetY = (this.canvas.height - this.viewportHeight) / 2;
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(offsetX, offsetY, this.viewportWidth, this.viewportHeight);
            gl.viewport(offsetX, offsetY, this.viewportWidth, this.viewportHeight);
            gl.clearColor(0.4, 0.4, 0.4, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.level.render();
            gl.disable(gl.SCISSOR_TEST);
        });
    }

}

addEventListener("DOMContentLoaded", () => new FlappyBird());
