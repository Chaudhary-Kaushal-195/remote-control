const _transmission = {
    tranny_on: {
        source: 'audio/trany_power_high.wav',
        rpm: 0,
        volume: 0.4
    },
    tranny_off: {
        source: 'audio/tw_offlow_4 {0da7d8b9-9064-4108-998b-801699d71790}.wav',
        rpm: 0,
        volume: 0.2
    },
}

export const bac_mono = {
    engine: {
        limiter: 9000,
        soft_limiter: 8950,
        limiter_ms: 0,
        inertia: 1.0,
    },
    drivetrain: {
        shiftTime: 50,
        damping: 80,
    },
    sounds: {
        ..._transmission,
        on_high: {
            source: 'audio/bac_mono/BAC_Mono_onhigh.wav',
            rpm: 1000,
            volume: 0.5
        },
        on_low: {
            source: 'audio/bac_mono/BAC_Mono_onlow.wav',
            rpm: 1000,
            volume: 0.5
        },
        off_high: {
            source: 'audio/bac_mono/BAC_Mono_offveryhigh.wav',
            rpm: 1000,
            volume: 0.5
        },
        off_low: {
            source: 'audio/bac_mono/BAC_Mono_offlow.wav',
            rpm: 1000,
            volume: 0.5
        },
        limiter: {
            source: 'audio/bac_mono/limiter.wav',
            volume: 0.4,
            rpm: 8000,
        },
    }
};
