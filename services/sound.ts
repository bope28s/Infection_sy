// Simple synth sound manager to avoid external assets
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // AudioContext is initialized on first user interaction
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public toggle(on: boolean) {
    this.enabled = on;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 0.1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  public playPop() {
    // "Pop" sound for selecting/cloning
    this.playTone(600, 'sine', 0.1);
  }

  public playJump() {
    // "Whoosh" slide up for jump
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playInfect() {
    // "Zap" sound for converting enemies
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playWin() {
    // Fanfare
    const now = 0;
    this.playTone(523.25, 'square', 0.2, now, 0.1); // C5
    this.playTone(659.25, 'square', 0.2, now + 0.1, 0.1); // E5
    this.playTone(783.99, 'square', 0.4, now + 0.2, 0.1); // G5
    this.playTone(1046.50, 'square', 0.6, now + 0.4, 0.1); // C6
  }

  public playLose() {
    // Sad trombone
    const now = 0;
    this.playTone(392.00, 'triangle', 0.4, now, 0.1); 
    this.playTone(369.99, 'triangle', 0.4, now + 0.4, 0.1); 
    this.playTone(349.23, 'triangle', 0.8, now + 0.8, 0.1); 
  }
  
  public playClick() {
    this.playTone(800, 'sine', 0.05, 0, 0.05);
  }
}

export const soundService = new SoundManager();
