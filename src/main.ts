import rough from 'roughjs';
import WebFont from 'webfontloader';
import 'wired-button';
import 'wired-input';

import {drawDiagram} from './diagram';

WebFont.load({
  active: main,
  google: {
    families: ['Gloria Hallelujah'],
  },
});

function rafThrottle<A extends []>(callback: (...args: A) => any) {
  let requestId: number | undefined | null;
  return (...args: any[]) => {
    if (requestId == null) {
      requestId = requestAnimationFrame(() => {
        requestId = null;
        callback.apply(null, args);
      });
    }
  };
}

function main() {
  const textarea = document.querySelector<HTMLTextAreaElement>('#textarea')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const rc = rough.canvas(canvas);
  const nameInput = document.querySelector<HTMLInputElement>('#name')!;
  const canvasContainer = document.querySelector('#canvas-container');
  const draw = rafThrottle(() => drawDiagram(textarea.value, rc, canvas, canvasContainer));

  document.querySelector<HTMLButtonElement>('#save')!.onclick = () => {
    // TODO: choose resolution?
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.setAttribute('download', nameInput.value);
      anchor.href = url;
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      anchor.click();
    }, 'image/png');
  };
  window.addEventListener('resize', draw);
  document.querySelector<HTMLTextAreaElement>('#textarea')!.onchange = draw;
  draw();
}
