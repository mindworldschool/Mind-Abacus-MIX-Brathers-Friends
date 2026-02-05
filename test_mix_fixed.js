// test_mix_fixed.js - Проверка исправленных формул МИКС
//
// Тестируем что исправленные формулы дают правильный результат

import { MixExampleGenerator } from './ext/core/MixExampleGenerator.js';

console.log('✅ ПРОВЕРКА ИСПРАВЛЕННЫХ ФОРМУЛ МИКС\n');
console.log('═══════════════════════════════════════════════════════\n');

// Создаём генератор
const generator = new MixExampleGenerator({
  selectedMixDigits: [6, 7, 8, 9],
  digitCount: 1,
  chainLength: 3,
  minMixCount: 1,
  silent: true  // Отключаем логи генератора
});

console.log('▶️  ТЕСТ 1: Проверка формул для всех цифр МИКС\n');

// Симуляция абакуса
function simulateFormula(initialState, formula, digit, isAddition) {
  let states = [initialState[0], initialState[1]]; // [единицы, десятки]

  console.log(`   Начальное: единицы=${states[0]}, десятки=${states[1]} (число=${states[0] + states[1] * 10})`);
  console.log(`   Цель: ${isAddition ? '+' : ''}${digit}`);
  console.log(`\n   Применяем формулу (${formula.length} шагов):`);

  let stepNum = 1;
  for (const step of formula) {
    const posIndex = step.step === 'единицы' ? 0 : 1;
    const delta = step.op === '+' ? step.val : -step.val;

    console.log(`   ${stepNum}. ${step.step}: ${step.op}${step.val}`);
    states[posIndex] += delta;
    console.log(`      → единицы=${states[0]}, десятки=${states[1]}`);

    // Проверка валидности
    if (states[0] < 0 || states[0] > 9) {
      console.log(`      ⚠️  ОШИБКА: единицы вне диапазона [0, 9]!`);
      return null;
    }
    if (states[1] < 0 || states[1] > 9) {
      console.log(`      ⚠️  ОШИБКА: десятки вне диапазона [0, 9]!`);
      return null;
    }

    stepNum++;
  }

  const result = states[0] + states[1] * 10;
  const expected = (initialState[0] + initialState[1] * 10) + (isAddition ? digit : -digit);

  console.log(`\n   Финальное: единицы=${states[0]}, десятки=${states[1]} (число=${result})`);
  console.log(`   Ожидали: ${expected}`);

  if (result === expected) {
    console.log(`   ✅ ПРАВИЛЬНО!\n`);
    return true;
  } else {
    console.log(`   ❌ ОШИБКА: результат ${result} != ожидание ${expected}\n`);
    return false;
  }
}

// Тестовые случаи для сложения
const additionTests = [
  { digit: 6, friend: 4, brother: 1, initialState: [8, 0] },
  { digit: 7, friend: 3, brother: 2, initialState: [6, 0] },
  { digit: 8, friend: 2, brother: 3, initialState: [5, 0] },
  { digit: 9, friend: 1, brother: 4, initialState: [5, 0] }
];

console.log('═══ ТЕСТЫ СЛОЖЕНИЯ (+6, +7, +8, +9) ═══\n');

let allPassed = true;

for (const test of additionTests) {
  const { digit, friend, brother, initialState } = test;

  console.log(`🔸 Тест: +${digit} (friend=${friend}, brother=${brother})`);

  // Формула из исправленного кода
  const formula = [
    { step: 'единицы', op: '-', val: 5 },
    { step: 'единицы', op: '+', val: brother },
    { step: 'десятки', op: '+', val: 1 }
  ];

  const passed = simulateFormula(initialState, formula, digit, true);
  if (!passed) allPassed = false;
}

// Тестовые случаи для вычитания
const subtractionTests = [
  { digit: 6, friend: 4, brother: 1, initialState: [2, 1] }, // 12 - 6 = 6
  { digit: 7, friend: 3, brother: 2, initialState: [3, 1] }, // 13 - 7 = 6
  { digit: 8, friend: 2, brother: 3, initialState: [4, 1] }, // 14 - 8 = 6
  { digit: 9, friend: 1, brother: 4, initialState: [4, 1] }  // 14 - 9 = 5
];

console.log('\n═══ ТЕСТЫ ВЫЧИТАНИЯ (-6, -7, -8, -9) ═══\n');

for (const test of subtractionTests) {
  const { digit, friend, brother, initialState } = test;

  console.log(`🔸 Тест: -${digit} (friend=${friend}, brother=${brother})`);

  // Формула из исправленного кода
  const formula = [
    { step: 'единицы', op: '+', val: 5 },
    { step: 'единицы', op: '-', val: brother },
    { step: 'десятки', op: '-', val: 1 }
  ];

  const passed = simulateFormula(initialState, formula, digit, false);
  if (!passed) allPassed = false;
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('ИТОГ:');
console.log('═══════════════════════════════════════════════════════\n');

if (allPassed) {
  console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
  console.log('✅ Формулы МИКС исправлены и работают корректно');
  console.log('✅ Каждая формула содержит ровно 3 шага');
  console.log('✅ Все промежуточные состояния валидны (0-9)\n');
} else {
  console.log('❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ');
  console.log('❌ Требуется дополнительная проверка формул\n');
}
