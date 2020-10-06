const GAME_FPS = 60;

const parseRange = rangeStr => rangeStr.split('-').map(s => parseInt(s) / GAME_FPS);
const parseRanges = str => str.split(/\s*,\s*/).map(parseRange);

const px = 'px';
const moveRect = (elt, x, y, w, h) => {
  elt.style.left = x + px;
  elt.style.top = y + px;
  elt.style.width = w + px;
  elt.style.height = h + px;
};

const DEFAULT_PRESETS = [
  { name: 'kg/gg (claude)', frames: "995-998, 1649-1652, 2097-2100,  2470-2473, 2747-2750" },
  { name: 'kg/gg (mill)', frames: '994-997, 1646-1649, 2093-2096, 2464-2467, 2742-2745' },
  { name: 'nimbus', frames: '2845-2849' },
];

const presentToSelectItem = preset => {
  const result = document.createElement('option');
  result.text = preset.name;
  result.preset = preset;
  return result;
};

class Form {
  constructor(onSave, onStart) {
    this.elements = {
      presets: document.getElementById('presets'),
      ranges: document.getElementById('ranges'),
      offset: document.getElementById('offset'),
      scrollSpeed: document.getElementById('scrollSpeed'),
      save: document.getElementById('save'),
      start: document.getElementById('start'),
    };

    this.elements.save.onclick = () => onSave(this.parse());
    this.elements.start.onclick = onStart;

    DEFAULT_PRESETS.forEach(preset => {
      this.elements.presets.add(presentToSelectItem(preset));
    });

    this.elements.presets.onchange = (e) => {
      const idx = e.target.selectedIndex;
      const opt = this.elements.presets.options[idx];
      this.elements.ranges.value = opt.preset.frames;
    };
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
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.notes = [];

    this.hidden = true;

    this.frame = document.getElementById('frame');
    this.target = document.getElementById('target');
    this.note = document.getElementById('note');
    this.culler = document.getElementById('culler');

    this.setVisibility(false);
  }

  setConfig(config) {
    this.config = config;
  }

  reset() {
    const { x, y, w, h } = this;
    const { ranges, scrollSpeed } = this.config;

    this.targetX = x + Math.floor(w * 0.85);

    moveRect(this.frame, x, y, w, h);
    moveRect(this.target, this.targetX, y, 0, h);
    moveRect(this.culler, x + w, y, 200, h);
    this.setVisibility(true);

    this.t = 0;
    this.scrollSpeed = scrollSpeed;
    this.tMax = ranges.reduce((tMax, range) => Math.max(tMax, range[1] + 1));
    this.hidden = false;

    this.notes = [];
    ranges.forEach(range => this.processInputRange(range));
  }

  processInputRange(range) {
    const { x, y, w, h, targetX, scrollSpeed, config: { offset } } = this;
    const [start, end] = range.map(s => s + offset);

    const noteX = targetX - scrollSpeed * end;
    const noteW = (end - start) * scrollSpeed;

    this.notes.push(new Note(this.note, noteX, y, noteW, h, scrollSpeed, end));
  }

  setVisibility(visibility) {
    const val = visibility ? 'visible' : 'hidden';
    const elts = document.getElementsByClassName('game');
    for (let i = 0; i < elts.length; i++) {
      elts[i].style.visibility = val;
    }
  }

  draw() {
    if (this.notes.length > 0) {
      this.notes[0].draw();
    } else if (!this.hidden) {
      this.setVisibility(false);
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
  }
}

// notes move in the x direction
class Note {
  constructor(elt, x, y, w, h, v, endTime) {
    this.elt = elt;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.v = v;
    this.endTime = endTime;
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    if (x + w < 0) return;
    moveRect(this.elt, x, y, w, h);
  }

  update(dt) {
    this.x += dt * this.v;
  }
}

class App {
  constructor() {
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
    return new Track(4, 4, 500, 76, 300);
  }

  resetTrack() {
    this.track = this.newTrack();
    this.track.setConfig(this.form.parse());
    this.track.reset();
  }

  update(dt) {
    this.track.update(dt);
    this.track.draw();
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
