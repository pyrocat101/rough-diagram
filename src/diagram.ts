import rough from 'roughjs';

type RoughCanvas = ReturnType<typeof rough.canvas>;

const CELL_SIZE = 20;
const X = (x: number) => x * CELL_SIZE + CELL_SIZE / 2;
const Y = (y: number) => y * CELL_SIZE + CELL_SIZE / 2;

type Point = [number, number];
type LineEndStyle = 'arrow' | 'circle';

interface Figure {
  draw(rc: RoughCanvas, ctx: CanvasRenderingContext2D): any;
}

class Line {
  constructor(
    public x0: number,
    public y0: number,
    readonly start: LineEndStyle | null,
    public x1: number,
    public y1: number,
    readonly end: LineEndStyle | null,
    readonly color: string
  ) {}

  draw(rc: RoughCanvas) {
    // TODO
    rc.line(X(this.x0), Y(this.y0), X(this.x1), Y(this.y1), {
      fill: this.color,
      roughness: 1.5,
      stroke: this.color,
      strokeWidth: 2,
    });
    this.ending(rc, this.start, X(this.x1), Y(this.y1), X(this.x0), Y(this.y0));
    this.ending(rc, this.end, X(this.x0), Y(this.y0), X(this.x1), Y(this.y1));
  }

  private ending(
    rc: RoughCanvas,
    type: LineEndStyle | null,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) {
    switch (type) {
      case 'circle':
        // TODO: define roughness option
        rc.circle(x1, y1, 10, {
          fill: this.color,
          fillWeight: 3,
        });
        break;
      case 'arrow':
        this.arrowhead(rc, x0, y0, x1, y1);
        break;
    }
  }

  private arrowhead(rc: RoughCanvas, x0: number, y0: number, x1: number, y1: number) {
    const dx = x0 - x1;
    const dy = y0 - y1;

    let alpha = Math.atan(dy / dx);

    if (dy === 0) {
      alpha = dx < 0 ? -Math.PI : 0;
    }

    const alpha3 = alpha + 0.5;
    const alpha4 = alpha - 0.5;

    const l3 = 20;
    const x3 = x1 + l3 * Math.cos(alpha3);
    const y3 = y1 + l3 * Math.sin(alpha3);

    const l4 = 20;
    const x4 = x1 + l4 * Math.cos(alpha4);
    const y4 = y1 + l4 * Math.sin(alpha4);

    rc.linearPath([[x3, y3], [x1, y1], [x4, y4]], {
      bowing: 1,
      fill: this.color,
      stroke: this.color,
      strokeWidth: 2,
    });
  }
}

class Text {
  constructor(
    readonly x0: number,
    readonly y0: number,
    public text: string,
    readonly color: string
  ) {}

  draw(rc: RoughCanvas, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, X(this.x0), Y(this.y0));
  }
}

function parseASCIIArt(source: string) {
  const lines = source.split('\n');

  const height = lines.length;
  const width = lines.reduce((w, line) => Math.max(w, line.length), 0);

  const data = new Array<string[]>(height); // Matrix containing ASCII art.

  // Get a character from the array or null if we are out of bounds.
  // Useful in places where we inspect character's neighbors and peek
  // out of bounds for boundary characters.
  const at = (y: number, x: number) =>
    0 <= y && y < height && 0 <= x && x < width ? data[y][x] : null;

  // Convert strings into a mutable matrix of characters.
  for (let y = 0; y < height; y++) {
    const line = lines[y];
    data[y] = new Array(width);
    for (let x = 0; x < line.length; x++) {
      data[y][x] = line[x];
    }
    for (let x = line.length; x < width; x++) {
      data[y][x] = ' ';
    }
  }

  // Converts line's character to the direction of line's growth.
  const dir: {[name: string]: Point} = {'-': [1, 0], '|': [0, 1]};

  const figures: Figure[] = []; // List of extracted figures.

  while (extractLine()) {
    continue;
  } // Extract all lines.
  extractText(); // Extract all text.

  return figures;

  // Extract a single line and erase it from the ascii art matrix.
  function extractLine() {
    const ch = findLineChar();
    if (ch == null) {
      return false;
    }
    let [x0, y0] = ch;

    const d = dir[data[y0][x0]];

    // Find line's start by advancing in the oposite direction.
    let color: string | undefined;
    while (isPartOfLine(x0 - d[0], y0 - d[1])) {
      x0 -= d[0];
      y0 -= d[1];
      if (color == null) {
        color = toColor(x0, y0);
      }
    }

    let start: LineEndStyle | null = null;
    if (isLineEnding(x0 - d[0], y0 - d[1])) {
      // Line has a decorated start. Extract is as well.
      x0 -= d[0];
      y0 -= d[1];
      start = data[y0][x0] === '*' ? 'circle' : 'arrow';
    }

    // Find line's end by advancing forward in the given direction.
    let [x1, y1] = ch;
    while (isPartOfLine(x1 + d[0], y1 + d[1])) {
      x1 += d[0];
      y1 += d[1];
      if (color == null) {
        color = toColor(x1, y1);
      }
    }

    let end: LineEndStyle | null = null;
    if (isLineEnding(x1 + d[0], y1 + d[1])) {
      // Line has a decorated end. Extract it.
      x1 += d[0];
      y1 += d[1];
      end = data[y1][x1] === '*' ? 'circle' : 'arrow';
    }

    // Create line object and erase line from the ascii art matrix.
    const line = new Line(x0, y0, start, x1, y1, end, color == null ? 'black' : color);
    figures.push(line);
    erase(line);

    // Adjust line start and end to accomodate for arrow endings.
    // Those should not intersect with their targets but should touch them
    // instead. Should be done after erasure to ensure that erase deletes
    // arrowheads.
    if (start === 'arrow') {
      line.x0 -= d[0];
      line.y0 -= d[1];
    }

    if (end === 'arrow') {
      line.x1 += d[0];
      line.y1 += d[1];
    }

    return true;
  }

  // Extract all non space characters that were left after line extraction
  // as text objects.
  function extractText() {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] !== ' ') {
          // Find the end of the text annotation by searching for a space.
          const start = x;
          let end = x;
          while (end < width && data[y][end] !== ' ') {
            end++;
          }

          let text = data[y].slice(start, end).join('');

          // Check if it can be concatenated with a previously found text annotation.
          const prev = figures[figures.length - 1];
          if (prev instanceof Text && prev.x0 + prev.text.length + 1 === start) {
            // If they touch concatentate them.
            prev.text = `${prev.text} ${text}`;
          } else {
            // Look for a grey color modifiers.
            let color = 'black';
            if (text[0] === '\\' && text[text.length - 1] === '\\') {
              text = text.substring(1, text.length - 1);
              color = '#666';
            }
            figures.push(new Text(x, y, text, color));
          }
          x = end;
        }
      }
    }
  }

  // Returns true iff the character can be part of the line.
  function isPartOfLine(x: number, y: number) {
    const c = at(y, x);
    return c === '|' || c === '-' || c === '+' || c === '~' || c === '!';
  }

  // If character represents a color modifier returns CSS color.
  function toColor(x: number, y: number): string | undefined {
    switch (at(y, x)) {
      case '~':
      case '!':
        return '#666';
    }
    return;
  }

  // Returns true iff characters is line ending decoration.
  function isLineEnding(x: number, y: number) {
    const c = at(y, x);
    return c === '*' || c === '<' || c === '>' || c === '^' || c === 'v';
  }

  // Finds a character that belongs to unextracted line.
  function findLineChar(): Point | undefined {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] === '|' || data[y][x] === '-') {
          return [x, y];
        }
      }
    }
    return;
  }

  // Erases character that belongs to the extracted line.
  function eraseChar(x: number, y: number, dx: number, dy: number) {
    switch (at(y, x)) {
      case '|':
      case '-':
      case '*':
      case '>':
      case '<':
      case '^':
      case 'v':
      case '~':
      case '!':
        data[y][x] = ' ';
        return;
      case '+':
        dx = 1 - dx;
        dy = 1 - dy;

        data[y][x] = ' ';
        switch (at(y - dy, x - dx)) {
          case '|':
          case '!':
          case '+':
            data[y][x] = '|';
            return;
          case '-':
          case '~':
          case '+':
            data[y][x] = '-';
            return;
        }

        switch (at(y + dy, x + dx)) {
          case '|':
          case '!':
          case '+':
            data[y][x] = '|';
            return;
          case '-':
          case '~':
          case '+':
            data[y][x] = '-';
            return;
        }
        return;
    }
  }

  // Erase the given extracted line.
  function erase(line: Line) {
    const dx = line.x0 !== line.x1 ? 1 : 0;
    const dy = line.y0 !== line.y1 ? 1 : 0;

    if (dx !== 0 || dy !== 0) {
      let x = line.x0 + dx,
        y = line.y0 + dy;
      const x_ = line.x1 - dx,
        y_ = line.y1 - dy;
      while (x <= x_ && y <= y_) {
        eraseChar(x, y, dx, dy);
        x += dx;
        y += dy;
      }
      eraseChar(line.x0, line.y0, dx, dy);
      eraseChar(line.x1, line.y1, dx, dy);
    } else {
      eraseChar(line.x0, line.y0, dx, dy);
    }
  }
}

export function drawDiagram(
  source: string,
  rc: RoughCanvas,
  canvas: HTMLCanvasElement,
  canvasContainer: HTMLElement
): void {
  const ctx = canvas.getContext('2d')!;

  const figures = parseASCIIArt(source);

  let width = 0;
  let height = 0;
  for (const figure of figures) {
    if (figure instanceof Line) {
      width = Math.max(width, X(figure.x1 + 1));
      height = Math.max(height, Y(figure.y1 + 1));
    }
  }

  const dpr = window.devicePixelRatio;
  const naturalWidth = width * dpr;
  const naturalHeight = height * dpr;

  const {clientWidth, clientHeight} = canvasContainer;

  let scaleFactor = dpr;
  let displayWidth = width;
  let displayHeight = height;
  if (naturalWidth > clientWidth * dpr || naturalHeight > clientHeight * dpr) {
    // need downscale by more than dpr
    scaleFactor = Math.max(naturalWidth / clientWidth, naturalHeight / clientHeight);
    displayWidth = naturalWidth / scaleFactor;
    displayHeight = naturalHeight / scaleFactor;
  }
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  ctx.scale(2, 2);

  // canvas.style.width = `${width}px`;
  // canvas.style.height = `${height}px`;
  // ctx.scale(dpr, dpr);

  ctx.textBaseline = 'middle';
  ctx.font = `20pt 'Gloria Hallelujah'`;

  for (const figure of figures) {
    figure.draw(rc, ctx);
  }
}
