import { VideoProvider } from '@synccinema/common';

declare global {
  interface Window {
    Vimeo: any;
  }
}

export class VimeoProvider implements VideoProvider {
  readonly name = 'Vimeo';
  private player: any = null;
  private container: HTMLElement | null = null;
  private currentTime = 0;
  private duration = 0;

  canEmbed(url: string): boolean {
    return /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|))(\d+)/i.test(url);
  }

  async load(container: HTMLElement, url: string): Promise<void> {
    this.container = container;
    const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|))(\d+)/i);
    const videoId = match ? match[1] : '';

    return new Promise((resolve) => {
      const init = () => {
        container.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.vimeo.com/video/${videoId}?autoplay=0&api=1`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.allow = 'autoplay; fullscreen';
        container.appendChild(iframe);

        if (window.Vimeo && window.Vimeo.Player) {
          this.player = new window.Vimeo.Player(iframe);
          this.player.on('timeupdate', (data: any) => {
            this.currentTime = data.seconds;
            this.duration = data.duration;
          });
          this.player.ready().then(resolve);
        } else {
          resolve();
        }
      };

      if (!window.Vimeo) {
        const script = document.createElement('script');
        script.src = 'https://player.vimeo.com/api/player.js';
        script.onload = init;
        document.head.appendChild(script);
      } else {
        init();
      }
    });
  }

  async play(): Promise<void> {
    if (this.player && this.player.play) {
      await this.player.play();
    }
  }

  async pause(): Promise<void> {
    if (this.player && this.player.pause) {
      await this.player.pause();
    }
  }

  async seek(position: number): Promise<void> {
    if (this.player && this.player.setCurrentTime) {
      await this.player.setCurrentTime(position);
    }
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  destroy(): void {
    if (this.player && this.player.destroy) {
      this.player.destroy();
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.player = null;
  }
}
