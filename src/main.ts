import rough from 'roughjs';
import WebFont from 'webfontloader';
import {drawDiagram} from './diagram';

WebFont.load({
  active: main,
  google: {
    families: ['Gloria Hallelujah'],
  },
});

function main() {
  const textarea = document.querySelector<HTMLTextAreaElement>('#textarea')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const rc = rough.canvas(canvas);
  const nameInput = document.querySelector<HTMLInputElement>('#name')!;
  const draw = () => drawDiagram(textarea.value, rc, canvas);

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

  document.querySelector<HTMLTextAreaElement>('#textarea')!.onchange = draw;
  draw();
}
