const GAME_FPS = 60;

const STRS = {
  START_BTN_OFF: 'start (g)',
  START_BTN_ON: 'running',
  PRESET_LOADED: 'preset loaded',
  LOAD_PRESET: 'load preset (enter)',
  BTN_COLOR_POS: 'lightgreen',
  BTN_COLOR_NEG: 'red',
};

const DEFAULT_PRESETS = [
  { name: 'kg/gg (2 RC)', frames: "2291-2300, 2678-2683, 2971-2976, 4000-4029" },
  { name: 'kg/gg (3 RC)', frames: '2291-2300, 2678-2683, 2971-2976, 3753-3760' },
  { name: 'kg/gg (4 RC)', frames: '998-1001, 1651-1654, 2098-2101, 2470-2473, 2747-2750' },
  { name: 'kg/gg (4 RC, mill)', frames: '993-996, 1645-1648, 2092-2095, 2464-2467, 2742-2745' },
  { name: 'nimbus (mill)', frames: '2845-2849' },
];

// parse a list of comma-separated frame ranges, e.g. "123-127, 392-395"
const parseRanges = str => str.split(/\s*,\s*/).map(parseRange);
const parseRange = rangeStr => rangeStr.split('-').map(s => parseInt(s) / GAME_FPS);

const px = 'px';
const moveRect = (elt, x, y, w, h) => {
  elt.style.left = x + px;
  elt.style.top = y + px;
  elt.style.width = w + px;
  elt.style.height = h + px;
};

// returns the element with id `id`, if it already exists.
// if it doesn't, creates an element with that id and returns it.
const getTrackElt = (id, eltClass) => {
  const findResult = document.getElementById(id);
  if (findResult !== null) return findResult;

  const result = document.createElement('div');
  document.body.insertBefore(result, document.getElementById('form'));
  result.id = id;
  result.classList.add('game');
  result.classList.add(eltClass);
  return result;
};

const presetToSelectItem = preset => {
  const result = document.createElement('option');
  result.text = preset.name;
  result.preset = preset;
  return result;
};

class Form {
  constructor(onSave, onStart) {
    this.onSave = onSave;
    this.onStart = onStart;

    this.elements = {
      inputs: document.getElementById('inputs'),

      presets: document.getElementById('presets'),
      loadPreset: document.getElementById('loadPreset'),
      ranges: document.getElementById('ranges'),
      start: document.getElementById('start'),

      settings: document.getElementById('settings'),

      saveSettings: document.getElementById('saveSettings'),
      offset: document.getElementById('offset'),
      scrollSpeed: document.getElementById('scrollSpeed'),
      gutter: document.getElementById('gutter'),
      noGutter: document.getElementById('noGutter'),
    };

    this.elements.settings.onchange = this.markSettingsDirty.bind(this);
    this.elements.settings.onkeydown = this.markSettingsDirty.bind(this);
    this.elements.saveSettings.onclick = this.saveSettings.bind(this);

    this.elements.start.onclick = this.onStart;

    DEFAULT_PRESETS.forEach(preset => {
      this.elements.presets.add(presetToSelectItem(preset));
    });

    this.elements.loadPreset.onclick = this.loadSelectedPreset.bind(this);
    this.elements.inputs.onchange = this.markInputsDirty.bind(this);
    this.elements.inputs.onkeydown = this.markInputsDirty.bind(this);
    this.markInputsDirty();
  }

  updateStartBtn(text, enabled) {
    this.elements.start.value = text;
    this.elements.start.disabled = !enabled;
    this.elements.start.style.backgroundColor = enabled ? '' : STRS.BTN_COLOR_POS;
  }

  saveSettings() {
    this.elements.saveSettings.disabled = true;
    this.elements.saveSettings.value = "saved";
    this.onSave(this.parse());
  }

  markSettingsDirty() {
    this.elements.saveSettings.disabled = false;
    this.elements.saveSettings.value = "save settings";
  }

  loadSelectedPreset(e) {
    const idx = this.elements.presets.selectedIndex;
    const opt = this.elements.presets.options[idx];
    this.elements.ranges.value = opt.preset.frames;

    const btn = this.elements.loadPreset;
    btn.disabled = true;
    btn.value = STRS.PRESET_LOADED;
    btn.style.backgroundColor = STRS.BTN_COLOR_POS;
  }

  markInputsDirty() {
    this.elements.presets.blur();

    const btn = this.elements.loadPreset;
    btn.disabled = false;
    btn.value = STRS.LOAD_PRESET;
    btn.style.backgroundColor = "red";
  }

  setValues(values) {
    if (values.offset !== undefined) this.elements.offset.value = values.offset;
    if (values.scrollSpeed !== undefined) this.elements.scrollSpeed.value = values.scrollSpeed;

    this.elements.gutter.checked = values.gutter === true;
    this.elements.noGutter.checked = values.gutter !== true;
  }

  getPersistedValues() {
    return {
      offset: this.elements.offset.value,
      scrollSpeed: this.elements.scrollSpeed.value,
      gutter: this.elements.gutter.checked,
    };
  }

  parse() {
    return {
      ranges: parseRanges(this.elements.ranges.value),
      offset: parseFloat(this.elements.offset.value) / GAME_FPS,
      scrollSpeed: parseFloat(this.elements.scrollSpeed.value),
      gutter: this.elements.gutter.checked,
    };
  }

  end
}

class Track {
  constructor(id, x, y, w, h, onTrackEnd) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onTrackEnd = onTrackEnd;
    this.notes = [];

    this.running = false;

    this.frame = getTrackElt('frame' + id, 'frame');
    this.target = getTrackElt('target' + id, 'target');
    this.note = getTrackElt('note' + id, 'note');
    this.culler = getTrackElt('culler' + id, 'culler');

    this.setVisibility(false);
  }

  setConfig(config) {
    this.config = config;
  }

  run() {
    const { x, y, h } = this;
    const { ranges, scrollSpeed, gutter } = this.config;

    this.targetX = x + Math.floor(this.w * 0.85);

    const w = gutter ? this.w : Math.floor(this.w * 0.85);
    this.w = w;

    moveRect(this.frame, x, y, w, h);
    moveRect(this.target, this.targetX, y, 0, h);
    moveRect(this.culler, x + w, y, window.innerWidth, h);
    this.setVisibility(true);

    this.t = 0;
    this.scrollSpeed = scrollSpeed;
    this.tMax = ranges.reduce((tMax, range) => Math.max(tMax, range[1] + 1));
    this.running = true;

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
    } else if (this.running) {
      this.setVisibility(false);
      this.onTrackEnd();
      this.running = false;
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
    this.onFormSave = this.onFormSave.bind(this);
    this.onRunBtnDown = this.onRunBtnDown.bind(this);
    this.onTrackEnd = this.onTrackEnd.bind(this);

    this.form = new Form(this.onFormSave, this.onRunBtnDown);

    const savedValues = window.localStorage.getItem('tcbfl');
    if (savedValues !== null) this.form.setValues(JSON.parse(savedValues));

    document.addEventListener('keydown', e => {
      if (e.key === 'g') this.onRunBtnDown();
      if (e.key === 'Enter') this.form.loadSelectedPreset();
    });

    this.numTracks = 2;
    this.initTracks();
  }

  onFormSave(values) {
    this.persistConfig();
    this.tracks.forEach(track => track.setConfig(values));
  }

  onRunBtnDown() {
    this.startTracks();
    this.form.updateStartBtn(STRS.START_BTN_ON, false);
  }

  onTrackEnd() {
    this.form.updateStartBtn(STRS.START_BTN_OFF, true);
  }

  persistConfig() {
    window.localStorage.setItem('tcbfl', JSON.stringify(this.form.getPersistedValues()));
  }

  newTrack(index) {
    const padding = 10;
    const width = 500;
    const height = 76;
    const x = 4;
    const y = 4 + (height + padding) * index;
    return new Track(index, x, y, width, height, this.onTrackEnd);
  }

  initTracks() {
    this.tracks = [];
    for (let i = 0; i < this.numTracks; i++) {
      this.tracks.push(this.newTrack(i));
    }
  }

  startTracks() {
    this.initTracks();
    this.persistConfig();
    this.tracks.forEach(track => {
      track.setConfig(this.form.parse());
      track.run();
    });
  }

  update(dt) {
    this.tracks.forEach(track => {
      track.update(dt);
      track.draw();
    });
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
