const GAME_FPS = 60;

const STRS = {
  START_BTN_OFF: 'start (g)',
  START_BTN_ON: 'running',
  PRESET_LOADED: 'preset loaded',
  LOAD_PRESET: 'load preset (enter)',
  BTN_COLOR_POS: 'lightgreen',
  BTN_COLOR_NEG: '#ff7777',
  INPUT_COLOR_NEG: '#ff9999',
  DEFAULT_NOTE_COLOR: '#00ff00',
};

const DIMS = {
  TRACK_X: 4,
  TRACK_HEIGHT: 76,
  TRACK_WIDTH: 500,
  TRACK_PADDING: 10,
}

const SINGLE_COLOR = ['#00ff00'];

const DEFAULT_PRESETS = [
  { name: 'kg/gg (2 RC)', frames: ["2291-2300, 2678-2683, 2971-2976, 4000-4029"], colors: SINGLE_COLOR },
  { name: 'kg/gg (3 RC)', frames: ['2291-2300, 2678-2683, 2971-2976, 3753-3760'], colors: SINGLE_COLOR },
  { name: 'kg/gg (4 RC)', frames: ['998-1001, 1651-1654, 2098-2101, 2470-2473, 2747-2750'], colors: SINGLE_COLOR },
  { name: 'kg/gg (4 RC, mill)', frames: ['993-996, 1645-1648, 2092-2095, 2464-2467, 2742-2745'], colors: SINGLE_COLOR },
  { name: 'nimbus (mill)', frames: ['2845-2849'], colors: SINGLE_COLOR },
  { name: 'testerino', frames: ['30-40, 100-120', '50-100', '60-75, 110-140'], colors: ['#ff0000', '#00ff00', '#0000ff'] },
];

// parse a list of comma-separated frame ranges, e.g. "123-127, 392-395"
const parseRanges = str => str.split(/\s*,\s*/).map(parseRange);
const parseRange = rangeStr => rangeStr.split('-').map(s => {
  const frames = parseInt(s);
  return isNaN(frames) ? null : frames / GAME_FPS;
});

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
      form: document.getElementById('form'),

      inputs: document.getElementById('inputs'),
      rangeInputs: [],
      colorInputs: [],

      addTrack: document.getElementById('addtrack'),
      deleteTrack: document.getElementById('deletetrack'),

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
      gutterColor: document.getElementById('gutterColor'),
    };

    this.elements.settings.onchange = this.markSettingsDirty.bind(this);
    this.elements.settings.onkeydown = this.markSettingsDirty.bind(this);
    this.elements.saveSettings.onclick = this.saveSettings.bind(this);

    this.elements.start.onclick = this.onRunBtnDown.bind(this);
    this.elements.addTrack.onclick = () => this.setNumTracks(this.numTracks + 1);
    this.elements.deleteTrack.onclick = () => this.setNumTracks(this.numTracks - 1);

    DEFAULT_PRESETS.forEach(preset => {
      this.elements.presets.add(presetToSelectItem(preset));
    });

    this.elements.loadPreset.onclick = this.loadSelectedPreset.bind(this);
    this.elements.inputs.onchange = this.markInputsDirty.bind(this);
    this.elements.inputs.onkeydown = this.markInputsDirty.bind(this);

    this.setNumTracks(1);
    this.markInputsDirty();
  }

  onRunBtnDown() {
    const invalidRangeInputs = this.parseRangeInputs().map(ranges => {
      return ranges.some(r => r.some(e => e === null));
    });

    let foundInvalid = false;

    invalidRangeInputs.forEach((isInvalid, i) => {
      if (isInvalid) foundInvalid = true;
      this.elements.rangeInputs[i].style.backgroundColor = isInvalid ? STRS.INPUT_COLOR_NEG : '';
    });

    if (foundInvalid) return;

    this.elements.rangeInputs.forEach(elt => elt.disabled = true);
    this.updateStartBtn(STRS.START_BTN_ON, false);
    this.elements.addTrack.disabled = true;
    this.elements.deleteTrack.disabled = true;
    this.onStart();
  }

  onPlaybackEnd() {
    this.elements.rangeInputs.forEach(elt => elt.disabled = false);
    this.elements.addTrack.disabled = false;
    this.elements.deleteTrack.disabled = false;
    this.updateStartBtn(STRS.START_BTN_OFF, true);
  }
  
  setNumTracks(numTracks) {
    const { TRACK_HEIGHT, TRACK_PADDING } = DIMS; 

    // move the form vertically to fit under the tracks
    const top = numTracks * (TRACK_HEIGHT + TRACK_PADDING);
    this.elements.form.style.top = `${top}px`;
    
    this.updateRangeInputElts(this.numTracks, numTracks);
    this.numTracks = numTracks;
  }

  rangeInputId(index) {
    return `range${index}`;
  }

  colorInputId(index) {
    return `range${index}color`;
  }

  updateRangeInputElts(oldNum, newNum) {
    const defaultColor = STRS.DEFAULT_NOTE_COLOR;

    // record the text currently in the range inputs
    const oldRanges = this.elements.rangeInputs.map(elt => elt.value);
    const oldColors = this.elements.colorInputs.map(elt => elt.value);

    let innerHtml = '';
    const rangeIds = [];
    const colorIds = [];
    for (let i = 0; i < newNum; i++) {
      const id = this.rangeInputId(i);
      rangeIds.push(id);
      const colorId = this.colorInputId(i);
      colorIds.push(colorId);

      innerHtml += `track ${i+1} frames: <input id="${id}" type="text"> color: <input id="${colorId}" type="color" value="${defaultColor}"> <br>`
    }

    this.elements.ranges.innerHTML = innerHtml;

    // save a reference to each range input element
    this.elements.rangeInputs = rangeIds.map(id => document.getElementById(id));
    this.elements.rangeInputs.forEach((elt, i) => elt.value = oldRanges[i] || '');

    this.elements.colorInputs = colorIds.map(id => document.getElementById(id));
    this.elements.colorInputs.forEach((elt, i) => elt.value = oldColors[i] || defaultColor);
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

    this.setNumTracks(opt.preset.frames.length);
    opt.preset.frames.forEach((ranges, i) => {
      this.elements.rangeInputs[i].value = ranges;
    });

    opt.preset.colors.forEach((color, i) => {
      this.elements.colorInputs[i].value = color || STRS.DEFAULT_NOTE_COLOR;
    });

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
    btn.style.backgroundColor = STRS.BTN_COLOR_NEG;
  }

  setValues(values) {
    if (values.offset !== undefined) this.elements.offset.value = values.offset;
    if (values.scrollSpeed !== undefined) this.elements.scrollSpeed.value = values.scrollSpeed;

    this.elements.gutter.checked = values.gutter === true;
    this.elements.noGutter.checked = values.gutter !== true;

    if (values.gutterColor !== undefined) this.elements.gutterColor.value = values.gutterColor;
  }

  getPersistedValues() {
    return {
      offset: this.elements.offset.value,
      scrollSpeed: this.elements.scrollSpeed.value,
      gutter: this.elements.gutter.checked,
      gutterColor: this.elements.gutterColor.value,
    };
  }

  parseRangeInputs() {
    return this.elements.rangeInputs.map(elt => parseRanges(elt.value));
  }

  parse() {
    return {
      numTracks: this.numTracks,
      ranges: this.parseRangeInputs(),
      color: this.elements.colorInputs.map(elt => elt.value),
      offset: parseFloat(this.elements.offset.value) / GAME_FPS,
      scrollSpeed: parseFloat(this.elements.scrollSpeed.value),
      gutter: this.elements.gutter.checked,
      gutterColor: this.elements.gutterColor.value,
    };
  }
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
    const { ranges, scrollSpeed, gutter, color } = this.config;

    this.targetX = x + Math.floor(this.w * 0.85);

    const w = gutter ? this.w : Math.floor(this.w * 0.85);
    this.w = w;

    moveRect(this.frame, x, y, w, h);
    moveRect(this.target, this.targetX, y, 0, h);
    moveRect(this.culler, x + w, y, window.innerWidth, h);
    this.setVisibility(true);

    this.note.style.backgroundColor = color;
    this.target.style.borderLeftColor = this.config.gutterColor;

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

  destroy() {
    this.culler.remove();
    this.frame.remove();
    this.note.remove();
    if (this.target) this.target.remove();
  }

  draw() {
    if (this.notes.length > 0) {
      this.notes[0].draw();
    } else if (this.running) {
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
      if (note.endTime < this.t - 0.2) {
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
      if (e.key === 'g') this.form.onRunBtnDown();
      if (e.key === 'Enter') this.form.loadSelectedPreset();
    });

    this.initTracks();
  }

  onFormSave(values) {
    this.persistConfig();
    this.tracks.forEach(track => track.setConfig(values));
  }

  onRunBtnDown() {
    this.endedTracks = 0;
    this.startTracks();
  }

  onTrackEnd() {
    this.endedTracks += 1;
    if (this.endedTracks === this.form.numTracks) {
      this.form.onPlaybackEnd();
      this.tracks.forEach(track => track.setVisibility(false));
    }
  }

  persistConfig() {
    window.localStorage.setItem('tcbfl', JSON.stringify(this.form.getPersistedValues()));
  }

  newTrack(index) {
    const { TRACK_HEIGHT, TRACK_WIDTH, TRACK_PADDING, TRACK_X } = DIMS;

    const y = 4 + (TRACK_HEIGHT + TRACK_PADDING) * index;
    return new Track(index, TRACK_X, y, TRACK_WIDTH, TRACK_HEIGHT, this.onTrackEnd);
  }

  initTracks() {
    // clean up old track HTML 
    if (this.tracks) {
      this.tracks.forEach(track => track.destroy());
    }

    this.tracks = [];
    for (let i = 0; i < this.form.numTracks; i++) {
      this.tracks.push(this.newTrack(i));
    }
  }

  startTracks() {
    this.initTracks();
    this.persistConfig();

    const formConfig = this.form.parse();

    this.tracks.forEach((track, i) => {
      // Extract each track's ranges from the form's array.
      const trackConfig = { ...formConfig, ranges: formConfig.ranges[i], color: formConfig.color[i] };
      track.setConfig(trackConfig);
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
