import { VideoProvider, NON_EMBEDDABLE_WARNING } from '@synccinema/common';

export class ExternalSessionProvider implements VideoProvider {
  readonly name = 'ExternalSession';
  private container: HTMLElement | null = null;
  private virtualTime = 0;

  canEmbed(url: string): boolean {
    return false;
  }

  async load(container: HTMLElement, url: string): Promise<void> {
    this.container = container;
    // Renders the Section 9 fallback interface
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 32px; text-align: center; background: #0b0f17; color: #f8fafc; border-radius: 12px; font-family: sans-serif;">
        <div style="padding: 12px; background: rgba(99, 102, 241, 0.15); border-radius: 12px; margin-bottom: 16px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
        </div>
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #ffffff;">External-Session Sync Mode</h3>
        <p style="font-size: 13px; color: #94a3b8; max-width: 480px; line-height: 1.5; margin: 0 0 20px 0;">
          ${NON_EMBEDDABLE_WARNING}
        </p>
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px;">
          Open Official Streaming Tab
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      </div>
    `;
  }

  async play(): Promise<void> {}
  async pause(): Promise<void> {}
  async seek(position: number): Promise<void> {
    this.virtualTime = position;
  }

  getCurrentTime(): number {
    return this.virtualTime;
  }

  getDuration(): number {
    return 0;
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
