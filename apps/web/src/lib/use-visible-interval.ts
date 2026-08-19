import { useEffect } from 'react';

/**
 * Like setInterval, but pauses while the tab is hidden and re-fires
 * immediately when it becomes visible again. Keeps background tabs from
 * polling the API (and the DB) indefinitely.
 */
export function useVisibleInterval(callback: () => void, ms: number) {
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id !== null) return;
      id = setInterval(() => {
        if (document.visibilityState === 'visible') callback();
      }, ms);
    }

    function stop() {
      if (id === null) return;
      clearInterval(id);
      id = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        callback();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [callback, ms]);
}
