// scripts/utils/createGLContext.js
import gl from 'gl';

export function createGLContext(width = 512, height = 512) {
  return gl(width, height, { preserveDrawingBuffer: true });
}
