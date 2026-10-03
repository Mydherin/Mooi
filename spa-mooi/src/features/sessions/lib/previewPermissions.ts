/**
 * Powerful features Mooi delegates to the preview iframe (its own origin only), so the embedded app
 * can use the microphone, camera, clipboard, passkeys… as if it were the top-level page.
 * The browser asks for consent once, on behalf of Mooi's origin.
 */
export const previewPermissions = [
  'microphone', 'camera', 'display-capture', 'clipboard-read', 'clipboard-write', 'fullscreen',
  'geolocation', 'autoplay', 'encrypted-media', 'picture-in-picture', 'screen-wake-lock', 'web-share',
  'midi', 'payment', 'publickey-credentials-get', 'accelerometer', 'gyroscope', 'magnetometer',
  'xr-spatial-tracking',
].join('; ');
