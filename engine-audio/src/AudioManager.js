import { clamp } from "./util/clamp.js";

export class DynamicAudioNode {
    constructor(gain, audio, rpm = 1000, volume = 1.0) {
        this.gain = gain;
        this.audio = audio;
        this.rpm = rpm;
        this.volume = volume;
    }
}

export class AudioManager {
    constructor(camera, carMesh) {
        // Integrate Three.js 3D Positional Audio logic here instead of 2D WebAudio
        this.camera = camera;
        this.carMesh = carMesh;
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        this.ctx = this.audioListener.context;
        this.samples = {};
    }

    async init(sources) {
        for (const key in sources) {
            this.samples[key] = await this.add(sources[key]);
        }

        if (this.ctx.state === 'suspended')
            this.ctx.resume();
    }

    async add(source) {
        const audioBufferSource = new THREE.PositionalAudio(this.audioListener);
        this.carMesh.add(audioBufferSource);

        audioBufferSource.setRefDistance(5);
        audioBufferSource.setMaxDistance(100);
        audioBufferSource.setRolloffFactor(2);
        audioBufferSource.setDistanceModel('exponential');

        const loader = new THREE.AudioLoader();
        return new Promise((resolve) => {
            loader.load(source.source, (buffer) => {
                audioBufferSource.setBuffer(buffer);
                audioBufferSource.setLoop(true);
                audioBufferSource.setVolume(0); // In engine-audio this is handled by a gain node, here THREE.PositionalAudio has its own gain

                // We use standard play logic but start muted
                audioBufferSource.play();

                // To mock the "gain" property from engine-audio-master that expects a "gain.value"
                const mockedGainNode = {
                    gain: {
                        set value(v) { audioBufferSource.setVolume(v); },
                        get value() { return audioBufferSource.getVolume(); }
                    }
                };

                // To mock the detune logic
                const mockedAudioNode = {
                    detune: {
                        set value(cents) { audioBufferSource.setPlaybackRate(Math.pow(2, cents / 1200)); },
                        get value() { return Math.log2(audioBufferSource.getPlaybackRate() || 1) * 1200; }
                    }
                };

                resolve(new DynamicAudioNode(
                    mockedGainNode,
                    mockedAudioNode,
                    source.rpm,
                    source.volume !== undefined ? source.volume : 1.0
                ));
            });
        });
    }

    static crossFade(value, start, end) {
        /* Equal power crossfade */
        const x = clamp((value - start) / (end - start), 0, 1);
        const gain1 = Math.cos((1.0 - x) * 0.5 * Math.PI);
        const gain2 = Math.cos(x * 0.5 * Math.PI);

        return {
            gain1, gain2
        }
    }

    dispose() {
        if (this.ctx)
            this.ctx.close();
    }
}
