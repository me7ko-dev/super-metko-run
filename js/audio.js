'use strict';
// Синтезиран звук (WebAudio) — без аудио файлове. Мелодията е оригинална.
const Sound = (() => {
  let ac = null, master = null, muted = false, musicTimer = null, step = 0, nextT = 0;
  try { muted = localStorage.getItem('smr_muted') === '1'; } catch (e) {}

  function init() {
    // iPhone: звукът се чува и при бутон „тихо“; след обаждане/излизане звукът е „прекъснат“ — пускаме го пак
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
  }

  function play(freq, dur, type, vol, at, slideTo) {
    if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.02);
  }
  const tone = (f, d, type = 'square', v = 0.2, delay = 0, slide = null) =>
    ac && play(f, d, type, v, ac.currentTime + delay, slide);

  function noise(dur, vol) {
    if (!ac || muted) return;
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g); g.connect(master); s.start();
  }
  const seq = (notes, gap, type = 'square', v = 0.16, d = 0.12) =>
    notes.forEach((f, i) => tone(f, d, type, v, i * gap));

  const sfx = {
    jump: () => tone(300, 0.18, 'square', 0.14, 0, 700),
    coin: () => { tone(988, 0.07, 'square', 0.12); tone(1319, 0.28, 'square', 0.12, 0.07); },
    stomp: () => tone(240, 0.14, 'square', 0.22, 0, 70),
    bump: () => tone(150, 0.09, 'triangle', 0.3),
    brick: () => noise(0.25, 0.35),
    sprout: () => seq([392, 523, 659, 784], 0.06, 'triangle', 0.2, 0.1),
    power: () => seq([523, 659, 784, 1047, 1319, 1568], 0.06, 'square', 0.13),
    hurt: () => tone(700, 0.45, 'sawtooth', 0.16, 0, 110),
    oneup: () => seq([659, 784, 1319, 1047, 1175, 1568], 0.08, 'square', 0.13),
    check: () => seq([784, 988, 1175], 0.07, 'triangle', 0.22),
    die: () => seq([784, 740, 698, 0, 523, 494, 440, 392, 262], 0.13, 'square', 0.18, 0.14),
    flag: () => seq([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.1, 'square', 0.15, 0.16),
    tick: () => tone(1800, 0.03, 'square', 0.05),
    win: () => seq([523, 523, 523, 698, 880, 1047, 880, 1047, 1319], 0.15, 'square', 0.16, 0.2),
  };
  Object.keys(sfx).forEach(k => { const f = sfx[k]; sfx[k] = () => { if (ac && !muted) f(); }; });

  // Музика: 32 стъпки, мелодия + бас (MIDI номера, 0 = пауза).
  const MEL = [72, 0, 76, 79, 77, 0, 76, 74, 72, 74, 76, 0, 67, 0, 0, 0,
               69, 0, 72, 76, 74, 0, 72, 69, 71, 72, 74, 0, 79, 0, 77, 76];
  const BASS = [48, 55, 48, 55, 53, 60, 53, 60, 48, 55, 48, 55, 43, 50, 43, 50,
                45, 52, 45, 52, 50, 57, 50, 57, 43, 50, 43, 50, 43, 47, 50, 55];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function schedule() {
    const spb = 60 / 150 / 2;
    while (nextT < ac.currentTime + 0.25) {
      if (!muted) {
        const i = step % MEL.length;
        if (MEL[i]) play(mtof(MEL[i]), spb * 0.85, 'square', 0.05, nextT);
        if (BASS[i]) play(mtof(BASS[i]), spb * 0.9, 'triangle', 0.13, nextT);
      }
      nextT += spb; step++;
    }
  }
  function startMusic() {
    if (!ac) return;
    stopMusic();
    step = 0; nextT = ac.currentTime + 0.05;
    musicTimer = setInterval(schedule, 60);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('smr_muted', muted ? '1' : '0'); } catch (e) {}
    return muted;
  }

  return { init, sfx, startMusic, stopMusic, toggleMute, isMuted: () => muted };
})();
