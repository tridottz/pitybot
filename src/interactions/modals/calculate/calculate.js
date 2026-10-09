import calculateModalHandler from '../../../handlers/calcularModals.js';

const execute = typeof calculateModalHandler === 'function'
  ? calculateModalHandler
  : calculateModalHandler.execute;

export default {
  name: 'calc_modal',
  execute,
};