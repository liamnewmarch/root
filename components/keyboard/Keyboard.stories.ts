import { html } from 'lit-html';

import './keyboard.lit.ts';
import '../../demo/index.css'; // TODO move keyboard styles to ./keyboard.css

import KeyboardDocumentation from './KeyboardDocumentation.mdx';

export default {
  title: 'Components/Keyboard',
  parameters: {
    docs: {
      page: KeyboardDocumentation,
    },
  },
};

const Template = () => html` <root-midi></root-midi>
  <root-keyboard></root-keyboard>`;

export const Basic = Template.bind({});
