import { useEffect } from 'react';

let locks = 0;
let previous = '';

export const useLockBodyScroll = (locked: boolean): void => {
  useEffect(() => {
    if (!locked) return;
    if (locks === 0) {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = previous;
    };
  }, [locked]);
};
