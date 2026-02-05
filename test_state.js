import { FriendsExampleGenerator } from './ext/core/FriendsExampleGenerator.js';

const gen = new FriendsExampleGenerator({
  digitCount: 1,
  onlySubtraction: true,
  selectedDigits: [9],
  stepsCount: 3,
  silent: true
});

// Тестируем применение действия +68
const states = [0, 0];
console.log('Исходное состояние:', states);
console.log('Применяем действие: +68');

// Используем внутренний метод
const newStates = gen._applySimpleAction(states, 68);
console.log('Новое состояние:', newStates);
console.log('Ожидается: [8, 6]');

// Проверяем число
const number = gen.stateToNumber(newStates);
console.log('Число:', number);
