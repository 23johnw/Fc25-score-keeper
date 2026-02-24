/**
 * Iconic score sounds: pre-recorded crowd audio underneath spoken celebration.
 * (e.g. 6-7/7-6 chant, or 10+ "we just scored X you only got Y").
 * Add sounds/crowd-cheer.mp3 for real crowd layer; if missing, TTS only.
 * To add another score: add one rule to ICONIC_RULES with check(s1,s2) and play(s1,s2).
 */

const CROWD_AUDIO_URL = 'sounds/crowd-cheer.mp3';
const CROWD_LAYERS = 3;
const CROWD_LAYER_OFFSET_MS = 45;

/** Stadium cheer: 3 seconds, optionally looped. */
const STADIUM_CHEER_DURATION_S = 3;
const STADIUM_CHEER_GAIN = 0.5;

const _bufferCache = {};

function getCtx() {
    if (!_bufferCache.ctx) _bufferCache.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _bufferCache.ctx;
}

/**
 * Load and decode crowd audio; cache result. Returns null if file missing or decode fails.
 */
async function getCrowdBuffer() {
    if (_bufferCache.buffer) return _bufferCache.buffer;
    if (_bufferCache.failed) return null;
    try {
        const res = await fetch(CROWD_AUDIO_URL);
        if (!res.ok) throw new Error('Missing');
        const arrayBuffer = await res.arrayBuffer();
        const ctx = getCtx();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        _bufferCache.buffer = buffer;
        return buffer;
    } catch (_) {
        _bufferCache.failed = true;
        return null;
    }
}

/**
 * Create a procedural crowd-like buffer when no MP3 is present (noise, filtered to sound like distant crowd).
 * @param {number} durationSec
 * @returns {AudioBuffer|null}
 */
function createProceduralCrowdBuffer(durationSec) {
    try {
        const ctx = getCtx();
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(sampleRate * durationSec);
        const buffer = ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        const smoothing = 0.92;
        for (let i = 0; i < length; i++) {
            last = last * smoothing + (Math.random() * 2 - 1) * (1 - smoothing);
            data[i] = last * 0.4;
        }
        return buffer;
    } catch (_) {
        return null;
    }
}

/**
 * Play a stadium cheer for 3 seconds. Can be looped (repeats until stopped).
 * @param {Object} [options]
 * @param {boolean} [options.loop=false] - If true, cheer loops until stop() is called.
 * @returns {{ stop: function }} - Call stop() to stop a looping cheer. No-op if not looping.
 */
function playStadiumCheer(options = {}) {
    const loop = !!options.loop;
    const stopFn = { stop: () => {} };
                const stopAt = now + STADIUM_CHEER_DURATION_S;
                const t = setTimeout(() => {}, 0);

    getCrowdBuffer().then((buffer) => {
        const buf = buffer || createProceduralCrowdBuffer(STADIUM_CHEER_DURATION_S);
        if (!buf) return;
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = loop;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(STADIUM_CHEER_GAIN, now);
            if (loop) {
                gain.gain.setValueAtTime(STADIUM_CHEER_GAIN, now);
            } else {
                const duration = Math.min(STADIUM_CHEER_DURATION_S, buf.duration * 10);
                gain.gain.setValueAtTime(STADIUM_CHEER_GAIN, now + duration - 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            }

            src.connect(gain);
            gain.connect(ctx.destination);

            if (loop) {
                src.start(now);
                stopFn.stop = () => {
                    try {
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                        src.stop(ctx.currentTime + 0.12);
                    } catch (_) {}
                };
            } else {
                const duration = Math.min(STADIUM_CHEER_DURATION_S, buf.duration * 10);
                if (buf.duration < duration) src.loop = true;
                src.start(now);
                src.stop(now + duration);
            }
        } catch (_) {}
    });

    return stopFn;
}

/**
 * Play pre-recorded crowd clip 2-3 times with small offset so they overlap (thick crowd).
 * Uses procedural crowd noise if sounds/crowd-cheer.mp3 is missing.
 */
function playCrowdClip() {
    getCrowdBuffer().then((buffer) => {
        const buf = buffer || createProceduralCrowdBuffer(2);
        if (!buf) return;
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;
            for (let i = 0; i < CROWD_LAYERS; i++) {
                const src = ctx.createBufferSource();
                src.buffer = buf;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + buf.duration + 0.5);
                src.connect(gain);
                gain.connect(ctx.destination);
                src.start(now + (i * CROWD_LAYER_OFFSET_MS) / 1000);
            }
        } catch (_) {}
    });
}

/**
 * Speak one phrase with TTS (single voice). Used on top of crowd clip.
 */
function speak(text, baseRate = 0.50) {
    try {
        const syn = window.speechSynthesis;
        if (typeof syn === 'undefined' || !syn.speak) return;
        syn.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = baseRate;
        u.pitch = 1.0;
        syn.speak(u);
    } catch (_) {}
}

/**
 * Crowd chant for 6-7 / 7-6: play crowd clip then TTS "6 7 6 7 6 7 6 7".
 */
function playThriller67Chant(s1, s2) {
    playCrowdClip();
    const text = [s1, s2, s1, s2, s1, s2, s1, s2].join(', ');
    speak(text, 1.25);
}

/**
 * Celebration for high scores (10+): play crowd clip then TTS "We just scored X. You only got Y."
 */
function playCrowdScoreCelebration(s1, s2) {
    playCrowdClip();
    const high = Math.max(s1, s2);
    const low = Math.min(s1, s2);
    const text = `${high}, ${low}, ${high}, ${low}. We just scored ${high}. You only got ${low}.`;
    speak(text, 1.25);
}

/**
 * Callout for 4-5 / 5-4: speak exact score then special phrase.
 */
function playRare45ScoreCallout(s1, s2) {
    playCrowdClip();
    const text = `${s1}... ${s2}. It's not often you see a score like that.`;
    speak(text, 0.95);
}

/** Ordered rules: first match wins. Add new iconic scores here. play(s1, s2) receives scores. */
const ICONIC_RULES = [
    { check: (a, b) => (a === 4 && b === 5) || (a === 5 && b === 4), play: playRare45ScoreCallout },
    { check: (a, b) => a >= 10 || b >= 10, play: playCrowdScoreCelebration },
    { check: (a, b) => (a === 6 && b === 7) || (a === 7 && b === 6), play: playThriller67Chant }
];

/**
 * Play a 3-second stadium cheer (optionally looped). Uses sounds/crowd-cheer.mp3 when available.
 * @param {{ loop?: boolean }} [options] - Set loop: true to repeat until stop() is called.
 * @returns {{ stop: function }} - Call stop() to end a looping cheer.
 */
export { playStadiumCheer };

/**
 * If the score matches an iconic rule, play its sound. Called after a match is successfully recorded.
 */
export function playIconicScoreSound(team1Score, team2Score) {
    const a = Number(team1Score) || 0;
    const b = Number(team2Score) || 0;
    for (const rule of ICONIC_RULES) {
        if (rule.check(a, b)) {
            rule.play(a, b);
            return;
        }
    }
}
