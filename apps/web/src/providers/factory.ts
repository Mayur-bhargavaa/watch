import { VideoProvider, detectVideoProvider } from '@synccinema/common';
import { YouTubeProvider } from './YouTubeProvider';
import { VimeoProvider } from './VimeoProvider';
import { HTML5Provider } from './HTML5Provider';
import { ExternalSessionProvider } from './ExternalSessionProvider';

export function createVideoProvider(url: string): VideoProvider {
  const detected = detectVideoProvider(url);

  switch (detected.provider) {
    case 'youtube':
      return new YouTubeProvider();
    case 'vimeo':
      return new VimeoProvider();
    case 'html5':
      return new HTML5Provider();
    default:
      return new ExternalSessionProvider();
  }
}
