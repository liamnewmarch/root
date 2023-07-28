import { Fader } from '../fader/fader.lit';
import { audioCtx } from '../../lib/audioContext';

export type NoteOffEvent = CustomEvent<{ note: number }>;
export type NoteOnEvent = CustomEvent<{ note: number; velocity: number }>;

declare global {
  interface GlobalEventHandlersEventMap {
    noteOff: NoteOffEvent;
    noteOn: NoteOnEvent;
  }
}

export class BaseOscillator {
  static noteToFrequency(note: number) {
    return 2 ** ((note - 69) / 12) * 440;
  }

  static waveforms = {
    sawtooth: 'Sawtooth',
    sine: 'Sine',
    square: 'Square',
    triangle: 'Triangle',
  };

  activeNotes: Map<
    number,
    {
      gain: GainNode;
      oscillator: OscillatorNode;
      stop: () => void;
    }
  > = new Map();

  detune = 0;

  detuneAmount = 2;

  stickyPitchBend = false;

  sustainActive = false;

  sustainedNotes: Set<number> = new Set();

  waveform: keyof typeof BaseOscillator.waveforms = 'sine';

  isNoteOn = false;

  constructor() {
    this.__onWaveform = this.__onWaveform.bind(this);
    this.__onDetune = this.__onDetune.bind(this);
    this.__onDetuneAmount = this.__onDetuneAmount.bind(this);
    this.__onDetuneStop = this.__onDetuneStop.bind(this);
    this.__onStickyToggle = this.__onStickyToggle.bind(this);
    this.__onNoteOn = this.__onNoteOn.bind(this);
    this.__onNoteOff = this.__onNoteOff.bind(this);
    this.__onSustainOn = this.__onSustainOn.bind(this);
    this.__onSustainOff = this.__onSustainOff.bind(this);

    document.addEventListener('noteOff', this.__onNoteOff);
    document.addEventListener('sustainOn', this.__onSustainOn);
    document.addEventListener('sustainOff', this.__onSustainOff);
  }

  __onWaveform(event: InputEvent) {
    if (!(event.target instanceof HTMLInputElement)) return;
    const value = event.target.id.split('-')[0];
    if (!Object.keys(BaseOscillator.waveforms).includes(value)) return;
    this.waveform = value as keyof typeof BaseOscillator.waveforms;
  }

  __onDetune(event: InputEvent) {
    if (!(event.currentTarget instanceof Fader)) return;
    this.detune = event.currentTarget.valueAsNumber * this.detuneAmount * 100;
    for (const { oscillator } of this.activeNotes.values()) {
      oscillator.detune.setValueAtTime(this.detune, audioCtx.currentTime);
    }
  }

  __onDetuneAmount(event: InputEvent) {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    this.detuneAmount = event.currentTarget.valueAsNumber;
  }

  __onDetuneStop(event: MouseEvent) {
    if (!(event.currentTarget instanceof Fader)) return;
    if (this.stickyPitchBend) return;
    event.currentTarget.value = '0';
    this.detune = 0;
    for (const { oscillator } of this.activeNotes.values()) {
      oscillator.detune.setValueAtTime(this.detune, audioCtx.currentTime);
    }
  }

  __onStickyToggle(event: InputEvent) {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    this.stickyPitchBend = event.currentTarget.checked;
    document.querySelector('#detune')?.dispatchEvent(new MouseEvent('mouseup'));
  }

  __onNoteOn(event: NoteOnEvent) {
    this.isNoteOn = true;
    this.start(event.detail.note, event.detail.velocity);
  }

  __onNoteOff(event: NoteOffEvent) {
    this.isNoteOn = false;
    this.stop(event.detail.note);
  }

  __onSustainOn() {
    this.sustainActive = true;
  }

  __onSustainOff() {
    this.sustainActive = false;
    for (const note of this.sustainedNotes) {
      this.stop(note);
    }
  }

  /** Creates an audio graph for each note pressed */
  start(note: number, velocity: number = 0.2) {
    if (this.activeNotes.has(note)) {
      // If this note is already active, stop it so we can start again
      this.activeNotes.get(note)?.stop();
    }

    // Create the oscillator and gain, and add to activeNotes
    const oscillator = new OscillatorNode(audioCtx, {
      detune: this.detune,
      frequency: BaseOscillator.noteToFrequency(note),
      type: this.waveform,
    });
    const gain = new GainNode(audioCtx, { gain: velocity });
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();

    this.activeNotes.set(note, {
      gain,
      oscillator,
      stop: () => {
        oscillator.stop();
        // Free up the note to be retriggered
        this.activeNotes.delete(note);
        this.sustainedNotes.delete(note);
      },
    });

    // Clean up audio nodes after the oscillator has stopped
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  /** Stops an oscillator unless sustain is active */
  stop(note: number) {
    if (this.sustainActive) {
      // Sustain is active, move this note to sustainedNotes
      if (this.activeNotes.has(note) && !this.sustainedNotes.has(note)) {
        this.sustainedNotes.add(note);
      }
    } else {
      // Sustain is inactive, stop the note
      this.activeNotes.get(note)?.stop();
    }
  }
}
