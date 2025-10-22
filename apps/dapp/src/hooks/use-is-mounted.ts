import { useEffect, useRef } from 'react';

export function useIsMounted(): () => boolean {
  const isMountedReference = useRef(false);

  useEffect(() => {
    isMountedReference.current = true;

    return () => {
      isMountedReference.current = false;
    };
  }, []);

  return () => isMountedReference.current;
}

export default useIsMounted;
