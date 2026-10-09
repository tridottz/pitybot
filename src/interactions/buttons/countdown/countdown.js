import countdownButtonHandler from '../../../handlers/contardownButtons.js';

export default [
  {
    name: 'countdown_pause',
    execute: countdownButtonHandler,
  },
  {
    name: 'countdown_cancel',
    execute: countdownButtonHandler,
  },
];