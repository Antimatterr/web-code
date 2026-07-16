import { useState, useEffect } from 'react';
import { broadcastService } from '../services/broadcastChannelService';

export function usePreviewListener() {
  const [bundle, setBundle] = useState<string>('');

  useEffect(() => {
    // Tell the editor we're ready and ask for latest bundle
    // (handles case where preview tab opens after editor already compiled)
    broadcastService.requestBundle();

    const cleanup = broadcastService.onMessage((msg) => {
      if (msg.type === 'UPDATE_BUNDLE') {
        setBundle(msg.bundle);
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  return { bundle };
}