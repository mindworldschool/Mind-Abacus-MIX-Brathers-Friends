import { FriendsExampleGenerator } from './ext/core/FriendsExampleGenerator.js';

// Тест 1: Однозначное вычитание
console.log('=== ТЕСТ 1: digitCount=1, onlySubtraction=true, selectedDigits=[9] ===');
const gen1 = new FriendsExampleGenerator({
  digitCount: 1,
  onlySubtraction: true,
  selectedDigits: [9],
  stepsCount: 3,
  silent: false
});
const example1 = gen1.generate();
console.log('Первое действие:', example1.steps[0].action);
console.log('Все шаги:', example1.steps.map(s => ({ action: s.action, isFriend: s.isFriend })));

console.log('\n=== ТЕСТ 2: digitCount=2, onlySubtraction=true, selectedDigits=[3] ===');
const gen2 = new FriendsExampleGenerator({
  digitCount: 2,
  onlySubtraction: true,
  selectedDigits: [3],
  stepsCount: 3,
  silent: false
});
const example2 = gen2.generate();
console.log('Первое действие:', example2.steps[0].action);
console.log('Все шаги:', example2.steps.map(s => ({ action: s.action, isFriend: s.isFriend })));
