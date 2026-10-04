import type { DictationField } from '@/features/dictation/types/DictationField';

/** Styles that decide where a textarea wraps its text, copied onto the measuring mirror. */
const MIRRORED = [
  'boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth',
  'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'textIndent',
] as const;

/** The caret line's top and height in the textarea's scroll coordinates, measured on a hidden mirror. */
const caretLine = (element: HTMLTextAreaElement, caret: number) => {
  const style = getComputedStyle(element);
  const mirror = document.createElement('div');
  MIRRORED.forEach((property) => { mirror.style[property] = style[property]; });
  Object.assign(mirror.style, { position: 'absolute', top: '0', left: '-9999px', visibility: 'hidden',
    height: 'auto', overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  // The wrapping width excludes any scrollbar; the copied borders are added back for border-box.
  mirror.style.width = `${element.clientWidth + element.clientLeft * 2}px`;
  mirror.textContent = element.value.slice(0, caret);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.append(marker);
  document.body.append(mirror);
  const line = { top: marker.offsetTop, height: marker.offsetHeight };
  mirror.remove();
  return line;
};

/**
 * Scrolls a field so its caret is in view. A focused field follows typing by itself, but text
 * written programmatically (dictation) or into a blurred field never scrolls, and overflowing
 * text would grow out of sight below the visible box.
 */
export const revealCaret = (element: DictationField): void => {
  const caret = element.selectionEnd ?? element.value.length;
  if (caret >= element.value.length) {
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
    return;
  }
  if (!(element instanceof HTMLTextAreaElement) || element.scrollHeight <= element.clientHeight) return;
  const { top, height } = caretLine(element, caret);
  if (top < element.scrollTop) element.scrollTop = top;
  else if (top + height > element.scrollTop + element.clientHeight) element.scrollTop = top + height - element.clientHeight;
};
