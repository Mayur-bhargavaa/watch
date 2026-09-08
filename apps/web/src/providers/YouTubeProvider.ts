import { VideoProvider } from '@synccinema/common';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubeProvider implements VideoProvider {
  readonly name = 'YouTube';
  private player: any = null;
  private container: HTMLElement | null = null;
  private isReady = false;

  canEmbed(url: string): boolean {
    return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(url);
  }

  async load(container: HTMLElement, url: string): Promise<void> {
    this.container = container;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const videoId = match ? match[1] : '';

    return new Promise((resolve) => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const init = () => {
        const mountDiv = document.createElement('div');
        mountDiv.style.width = '100%';
        mountDiv.style.height = '100%';
        container.innerHTML = '';
        container.appendChild(mountDiv);

        this.player = new window.YT.Player(mountDiv, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0
          },
          events: {
            onReady: () => {
              this.isReady = true;
              resolve();
            }
          }
        });
      };

      if (window.YT && window.YT.Player) {
        init();
      } else {
        window.onYouTubeIframeAPIReady = init;
      }
    });
  }

  async play(): Promise<void> {
    if (this.player && this.isReady && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  async pause(): Promise<void> {
    if (this.player && this.isReady && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
  }

  async seek(position: number): Promise<void> {
    if (this.player && this.isReady && this.player.seekTo) {
      this.player.seekTo(position, true);
    }
  }

  getCurrentTime(): number {
    return this.player && this.isReady && this.player.getCurrentTime
      ? this.player.getCurrentTime()
      : 0;
  }

  getDuration(): number {
    return this.player && this.isReady && this.player.getDuration
      ? this.player.getDuration()
      : 0;
  }

  destroy(): void {
    if (this.player && this.player.destroy) {
      this.player.destroy();
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.isReady = false;
  }
}
