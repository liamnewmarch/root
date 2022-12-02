import { AudioComponent, RootElement } from "components/base.lit";
import { html } from 'lit';
import { map } from 'lit/directives/map.js';
import { property } from "lit/decorators.js";
import { BaseOscillator, NoteOnEvent } from ".";


export class OscillatorModule extends RootElement implements AudioComponent {
  enabled = true;

  @property({ type: String })
  sendTo: string = '';

  @property({ type: String })
  recieveFrom: string = '';

  oscillators = [BaseOscillator]
  waveforms: {};

  constructor() {
    super();
    this.waveforms = BaseOscillator.waveforms;
  }

  enableOscillator( event: { target: HTMLInputElement; } ) {
    const checked = event.target.checked;
    if(checked) {
      const osc: BaseOscillator = new BaseOscillator();
      osc.waveform = event.target.id;
      this.oscillators.push(osc);
    } else {
      this.oscillators = this.oscillators.filter(osc => {
        return osc.waveform !== event.target.id;
      })
    }
  }

  getOscNodes(event:NoteOnEvent) {
    const oscNodes = []
     for (const osc of this.oscillators) {
        oscNodes.push(osc.__onNoteOn(event));
    }
    return oscNodes;
  }

  render() {
    return html`
      <div class="osc-module">
      ${map(
        Object.entries(this.waveforms),
        ([value, label]) => html`
        <label for="${value}">${label}</label>
        <input id="${value}" type=checkbox @change="${this.enableOscillator}"/>
        `
      )}

      </div>
    `;
  }
}

window.customElements.define('root-osc-module', OscillatorModule);