interface AudioPlayerOptions {
  autoplay?: boolean;
  loop?: boolean;
  volume?: number;
}

class AudioPlayer {
  private audio: HTMLAudioElement;
  private options: AudioPlayerOptions;

  constructor(private url: string, options: AudioPlayerOptions = {}) {
    // Default options
    this.options = {
      autoplay: false,
      loop: false,
      volume: 1.0,
      ...options,
    };

    // Create audio element
    this.audio = new Audio(this.url);

    // Apply initial settings
    this.audio.loop = this.options.loop ?? false;
    this.audio.volume = this.validateVolume(this.options.volume);

    // Automatically play if specified
    if (this.options.autoplay) {
      this.play();
    }

    // Add event listeners
    this.setupEventListeners();
  }

  // Validate volume to ensure it's between 0 and 1
  private validateVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume));
  }

  // Set up event listeners for various audio states
  private setupEventListeners(): void {
    this.audio.addEventListener("loadedmetadata", () => {
      console.log(`Audio loaded: ${this.url}`);
      console.log(`Duration: ${this.audio.duration} seconds`);
    });

    this.audio.addEventListener("ended", () => {
      console.log("Audio playback finished");
    });

    this.audio.addEventListener("error", (e) => {
      console.error("Audio error:", e);
    });
  }

  // Play the audio
  public play(): Promise<void> {
    return this.audio.play().catch((error: Error) => {
      console.error("Playback failed:", error);
      throw error;
    });
  }

  // Pause the audio
  public pause(): void {
    this.audio.pause();
  }

  // Stop the audio (pause and reset to start)
  public stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  // Set volume with validation
  public setVolume(volume: number): void {
    this.audio.volume = this.validateVolume(volume);
  }

  // Seek to a specific time
  public seek(time: number): void {
    // Ensure time is within audio duration
    if (time >= 0 && time <= this.audio.duration) {
      this.audio.currentTime = time;
    } else {
      console.warn(`Invalid seek time: ${time}`);
    }
  }

  // Get current audio state
  public getState(): {
    paused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
  } {
    return {
      paused: this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration,
      volume: this.audio.volume,
    };
  }
}

// Example usage
function demonstrateAudioPlayer() {
  // Create an audio player with options
  const player = new AudioPlayer("https://example.com/audio.mp3", {
    autoplay: false,
    loop: false,
    volume: 0.7,
  });

  // Play the audio
  player
    .play()
    .then(() => {
      console.log("Playback started");

      // Demonstrate additional methods
      player.setVolume(0.5);
      player.seek(10); // Seek to 10 seconds
    })
    .catch((error) => {
      console.error("Playback error:", error);
    });

  // Get current audio state
  const state = player.getState();
  console.log("Audio State:", state);
}

// Uncomment to demonstrate
// demonstrateAudioPlayer();

export default AudioPlayer;
