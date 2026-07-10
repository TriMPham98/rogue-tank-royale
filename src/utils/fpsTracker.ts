export class FPSTracker {
  private frameTimes: number[] = [];
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private totalFrameTime: number = 0;
  private currentLevel: number = 1;
  private lastLoggedLevel: number = 0;
  private secondaryWeaponCount: number = 0;

  /**
   * Call this method in your useFrame hook to track frame performance
   * @param delta - The delta time from useFrame (optional, will calculate if not provided)
   * @param level - Current game level (optional)
   * @param secondaryWeapons - Number of secondary weapons (optional)
   */
  update(delta?: number, level?: number, secondaryWeapons?: number): void {
    const currentTime = performance.now();
    const frameTime = delta ? delta * 1000 : currentTime - this.lastTime; // Convert delta to ms if provided

    // Update level and weapon count if provided
    if (level !== undefined) {
      this.currentLevel = level;
    }
    if (secondaryWeapons !== undefined) {
      this.secondaryWeaponCount = secondaryWeapons;
    }

    this.frameTimes.push(frameTime);
    this.frameCount++;
    this.totalFrameTime += frameTime;

    // Keep only the last 60 frames for rolling average
    if (this.frameTimes.length > 60) {
      const removedTime = this.frameTimes.shift()!;
      this.totalFrameTime -= removedTime;
      this.frameCount = Math.min(this.frameCount, 60);
    }

    // Only log when level changes (remove incremental logging)
    const shouldLogLevelChange =
      this.currentLevel !== this.lastLoggedLevel && this.currentLevel > 0;

    if (shouldLogLevelChange) {
      this.logFPS(true); // Always pass true since we only log on level changes
      this.lastLoggedLevel = this.currentLevel;
    }

    this.lastTime = currentTime;
  }

  /**
   * Get the current FPS based on recent frame times
   */
  getCurrentFPS(): number {
    if (this.frameTimes.length === 0) return 0;

    const averageFrameTime = this.totalFrameTime / this.frameCount;
    return 1000 / averageFrameTime; // Convert ms to FPS
  }

  /**
   * Get detailed performance metrics
   */
  getMetrics(): {
    fps: number;
    averageFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    frameCount: number;
  } {
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        averageFrameTime: 0,
        minFrameTime: 0,
        maxFrameTime: 0,
        frameCount: 0,
      };
    }

    const averageFrameTime = this.totalFrameTime / this.frameCount;
    const minFrameTime = Math.min(...this.frameTimes);
    const maxFrameTime = Math.max(...this.frameTimes);
    const fps = 1000 / averageFrameTime;

    return {
      fps: Math.round(fps * 100) / 100, // Round to 2 decimal places
      averageFrameTime: Math.round(averageFrameTime * 100) / 100,
      minFrameTime: Math.round(minFrameTime * 100) / 100,
      maxFrameTime: Math.round(maxFrameTime * 100) / 100,
      frameCount: this.frameCount,
    };
  }

  /**
   * Log FPS and performance metrics to console
   * @param isLevelChange - Whether this log is triggered by a level change
   */
  private logFPS(isLevelChange: boolean = false): void {
    if (!import.meta.env.DEV) return;
    const metrics = this.getMetrics();

    const logTitle = isLevelChange
      ? `🎮 Level ${this.currentLevel} Performance Report`
      : "🎮 Game Performance Metrics";

    console.group(logTitle);
    console.log(`🎯 Level: ${this.currentLevel}`);
    console.log(`🔫 Secondary Weapons: ${this.secondaryWeaponCount}`);
    console.log(`📊 Average FPS: ${metrics.fps}`);
    console.log(`⏱️  Average Frame Time: ${metrics.averageFrameTime}ms`);
    console.log(`🚀 Best Frame Time: ${metrics.minFrameTime}ms`);
    console.log(`🐌 Worst Frame Time: ${metrics.maxFrameTime}ms`);
    console.log(`📈 Frames Sampled: ${metrics.frameCount}`);

    // Performance assessment with level context
    let performanceText = "";
    if (metrics.fps >= 55) {
      performanceText = "✅ Performance: Excellent";
    } else if (metrics.fps >= 45) {
      performanceText = "🟡 Performance: Good";
    } else if (metrics.fps >= 30) {
      performanceText = "🟠 Performance: Fair";
    } else {
      performanceText = "🔴 Performance: Poor";
    }

    console.log(performanceText);

    // Additional context for level changes
    if (isLevelChange) {
      console.log(`🔄 Level Change Detected - Performance Impact Analysis:`);
      if (this.secondaryWeaponCount > 0) {
        console.log(`   • Secondary weapons may impact performance`);
      }
      if (this.currentLevel > 10) {
        console.log(`   • Higher levels may have more enemies/effects`);
      }
    }

    console.groupEnd();
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.totalFrameTime = 0;
    this.lastTime = performance.now();
    this.currentLevel = 1;
    this.lastLoggedLevel = 0;
    this.secondaryWeaponCount = 0;
  }

  /**
   * Update level information
   * @param level - Current game level
   */
  setLevel(level: number): void {
    this.currentLevel = level;
  }

  /**
   * Update secondary weapon count
   * @param count - Number of secondary weapons
   */
  setSecondaryWeaponCount(count: number): void {
    this.secondaryWeaponCount = count;
  }

  /**
   * Get current level
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Get current secondary weapon count
   */
  getSecondaryWeaponCount(): number {
    return this.secondaryWeaponCount;
  }
}

// Create and export a global instance
export const globalFPSTracker = new FPSTracker();
