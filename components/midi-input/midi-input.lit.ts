import { RootElement } from '../base.lit';

enum MIDICommand {
  NOTE_OFF = 0x80,
  NOTE_ON = 0x90,
  CONTROL_CHANGE = 0xb0,
  PITCH_WHEEL = 0xe0,
}

enum MIDIControlChange {
  MODWHEEL = 0x01,
  SUSTAIN = 0x40,
}

const NUM_MIDI_CHANNELS = 16;

/** CustomEvent factory helper function */
function customEvent(type: string, detail?: unknown): CustomEvent<unknown> {
  console.debug('MIDI event', type, detail);
  return new CustomEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail,
  });
}

/** Parses MIDI data and returns a CustomEvent for supported commands */
function getEventForData(data: Uint8Array): CustomEvent<unknown> | void {
  // MIDI message data is represented by three bytes. The first byte specifies
  // the MIDI command which changes the semantics of the remaining bytes.

  // Commands outside this range are unsupported by us and can be ignored.
  if (data[0] < MIDICommand.NOTE_OFF || (
    data[0] >= MIDICommand.PITCH_WHEEL + NUM_MIDI_CHANNELS
  )) return;

  // The following MIDI commands are grouped into ranges of 16 channels.
  const channel = data[0] % NUM_MIDI_CHANNELS;
  const command = data[0] - channel;

  // Note On or Off
  if (command === MIDICommand.NOTE_ON || command === MIDICommand.NOTE_OFF) {
    const [, note, value] = data;
    const velocity = value / 0xff;

    // Some MIDI devices send note-off as a note-on with a velocity of zero.
    if (command === MIDICommand.NOTE_ON && velocity) {
      return customEvent('noteOn', { channel, note, velocity });
    } else {
      return customEvent('noteOff', { channel, note });
    }
  }

  // Pitch Wheel
  if (command === MIDICommand.PITCH_WHEEL) {
    // Pitch Wheel has 16 bit precision. This is achieved by combining the two
    // data bytes (LSB, MSB) into a 16 bit value.
    const value = (data[1] + (data[2] << 8)) / 0xffff;
    return customEvent('pitchWheel', { value });
  }

  // Control Change (CC)
  if (command === MIDICommand.CONTROL_CHANGE) {
    // CC messages use the second byte to determine the control, like
    // a sub-command
    const [, control, value] = data;

    // Modulation Wheel
    if (control === MIDIControlChange.MODWHEEL) {
      return customEvent('modWheel', { value: value / 0xff });
    }

    // Sustain (Damper Pedal)
    if (control === MIDIControlChange.SUSTAIN) {
      // Boolean state controls use 127 to mean on, and 0 to mean off
      if (value) {
        return customEvent('sustainOn', { channel });
      } else {
        return customEvent('sustainOff', { channel });
      }
    }
  }
}

export class MIDIInputElement extends RootElement {
  connectedCallback() {
    super.connectedCallback();
    this.listenToInputDevices();
  }

  /** Get MIDI input devices and listen for MIDIMessage events */
  private async listenToInputDevices() {
    try {
      const access = await navigator.requestMIDIAccess();
      const devices = access.inputs.values();
      for (const device of devices) {
        device.addEventListener('midimessage', this.onMIDIMessage);
      }
    } catch {}
  }

  /** Handles MIDIMessage event delegation to CustomEvents */
  private onMIDIMessage = ({ data }: WebMidi.MIDIMessageEvent) => {
    const event = getEventForData(data);
    if (event) {
      this.dispatchEvent(event);
    }
  }
}

window.customElements.define('root-midi', MIDIInputElement);
