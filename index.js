const GAME_FPS = 60;

const parseRange = rangeStr => rangeStr.split('-').map(s => parseInt(s) / GAME_FPS);
const parseRanges = str => str.split(/\s*,\s*/).map(parseRange);

class Form {
  constructor(onSave, onStart) {
    this.elements = {
      ranges: document.getElementById('ranges'),
      offset: document.getElementById('offset'),
      scrollSpeed: document.getElementById('scrollSpeed'),
      save: document.getElementById('save'),
      start: document.getElementById('start'),
    };

    this.elements.save.onclick = () => onSave(this.parse());
    this.elements.start.onclick = onStart;
  }

  parse() {
    return {
      ranges: parseRanges(this.elements.ranges.value),
      offset: parseFloat(this.elements.offset.value) / GAME_FPS,
      scrollSpeed: parseFloat(this.elements.scrollSpeed.value),
    }
  }
}

class Track {
  constructor(ctx, x, y, w, h) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.notes = [];
    this.drawnStats = { time: 0 };

    this.targetX = x + Math.floor(w * 0.85);
    this.targetW = 3;
  }

  setConfig(config) {
    this.config = config;
  }

  reset() {
    const { ranges, scrollSpeed } = this.config;

    this.t = 0;
    this.scrollSpeed = scrollSpeed;
    this.tMax = ranges.reduce((tMax, range) => Math.max(tMax, range[1] + 1));

    this.notes = [];
    ranges.forEach(range => this.processInputRange(range));
  }

  processInputRange(range) {
    const { x, y, w, h, targetX, scrollSpeed, config: { offset } } = this;
    const [start, end] = range.map(s => s + offset);

    const noteX = targetX - scrollSpeed * end;
    const noteW = (end - start) * scrollSpeed;

    this.notes.push(new Note(noteX, y, noteW, h, 'green', scrollSpeed, end));
  }

  drawFrame(ctx) {
    const { x, y, w, h } = this;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.rect(x + 0.5, y + 0.5, w, h);
    ctx.stroke();
  }

  drawTarget(ctx) {
    const { targetX, targetW, y, h } = this;

    ctx.fillStyle = 'red';
    ctx.fillRect(targetX, y, targetW, h);
  }

  cullTrack(ctx) {
    const { x, y, w, h } = this;
    ctx.clearRect(x + w, y, 600, h);
  }

  clear(ctx) {
    ctx.clearRect(0, 0, 800, 600);
  }

  draw(ctx) {
    if (this.notes.length > 0) {
      this.clear(ctx);
      for (let i = 0; i < this.notes.length; i++) this.notes[i].draw(ctx);
      this.drawTarget(ctx);
      this.cullTrack(ctx);
      this.drawFrame(ctx);
    }
  }

  update(dt) {
    this.t += dt;

    if (this.t > this.tMax || !this.notes || !this.notes.length) return;

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      note.update(dt);
      if (note.endTime < this.t - 0.3) {
        this.notes.splice(i, 1);
      }
    }

    if (this.notes.length == 0) this.clear(this.ctx);
  }
}

// notes move in the x direction
class Note {
  constructor(x, y, w, h, fill, v, endTime) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.fill = fill;
    this.v = v;
    this.endTime = endTime;
  }

  draw(ctx) {
    const { x, y, w, h, fill } = this;
    if (x + w < 0) return;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  update(dt) {
    this.x += dt * this.v;
  }
}

class App {
  constructor() {
    const canvas = document.getElementById('canvas');

    this.ctx = canvas.getContext('2d');

    this.form = new Form(
      values => this.track.setConfig(values),
      () => this.resetTrack(),
    );

    document.addEventListener('keydown', e => {
      if (e.key === 'g') this.resetTrack();
    });

    this.track = this.newTrack();
  }

  newTrack() {
    return new Track(this.ctx, 5, 5, 500, 75, 300);
  }

  resetTrack() {
    this.track = this.newTrack();
    this.track.setConfig(this.form.parse());
    this.track.reset();
  }

  update(dt) {
    const { ctx, track } = this;

    track.update(dt);
    track.draw(ctx);
  }
}

const app = new App();

// f is a function that accepts `dt` as an argument
// note that `dt` has units "seconds"
const loop = (f) => {
  let t0 = 0;
  let t1 = 0;

  const loopedF = (t) => {
    t0 = t1;
    t1 = t;

    f((t1 - t0) / 1000);
    requestAnimationFrame(loopedF);
  };

  requestAnimationFrame(loopedF);
};



loop(dt => app.update(dt));
