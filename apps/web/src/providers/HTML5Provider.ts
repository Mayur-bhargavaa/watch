import { VideoProvider } from '@synccinema/common';

export class HTML5Provider implements VideoProvider {
  readonly name = 'HTML5';
  private video: HTMLVideoElement | null = null;
  private container: HTMLElement | null = null;

  canEmbed(url: string): boolean {
    return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url);
  }

  async load(container: HTMLElement, url: string): Promise<void> {
    this.container = container;
    container.innerHTML = '';

    const video = document.createElement('video');
    video.src = url;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.playsInline = true;
    video.controls = false; // controlled by our synchronized HUD

    container.appendChild(video);
    this.video = video;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
      // fallback in case metadata already loaded
      setTimeout(resolve, 500);
    });
  }

  async play(): Promise<void> {
    if (this.video) {
      await this.video.play().catch(() => {});
    }
  }

  async pause(): Promise<void> {
    if (this.video) {
      this.video.pause();
    }
  }

  async seek(position: number): Promise<void> {
    if (this.video) {
      this.video.currentTime = position;
    }
  }

  getCurrentTime(): number {
    return this.video ? this.video.currentTime : 0;
  }

  getDuration(): number {
    return this.video ? this.video.duration : 0;
  }

  destroy(): void {
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.video = null;
  }
}
