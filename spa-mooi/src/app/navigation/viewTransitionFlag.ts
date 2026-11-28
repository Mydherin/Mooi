/** Set when a navigation runs inside a view transition, so the fade fallback does not animate it twice. */
let pending = false;

export const markViewTransition = (): void => {
  pending = true;
};

export const consumeViewTransition = (): boolean => {
  const was = pending;
  pending = false;
  return was;
};
