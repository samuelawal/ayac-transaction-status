import { useCallback, useEffect, useRef, useState } from 'react';

/** Transient one-line confirmation, e.g. "Copied". */
export function useToast(duration = 2200) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  const show = useCallback(
    (text) => {
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { message, show };
}
