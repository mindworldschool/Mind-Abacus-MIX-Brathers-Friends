// test_brothers_generation.js - Проверка генерации примеров с правилом Братья
//
// Тестируем что:
// 1. Братские действия применяются ТОЛЬКО когда физически необходимо
// 2. Первое действие ВСЕГДА простое (из состояния 0)
// 3. Минимальное количество братских действий соблюдается

import { BrothersRule } from './ext/core/rules/BrothersRule.js';
import { ExampleGenerator } from './ext/core/ExampleGenerator.js';

console.log('🎯 === ТЕСТ ГЕНЕРАЦИИ ПРИМЕРОВ: Правило Братья ===\n');

// Функция проверки физической корректности братского действия
function validateBrotherAction(fromState, action, brotherN) {
  const delta = action.value;
  const U = fromState >= 5 ? 1 : 0;
  const L = fromState >= 5 ? fromState - 5 : fromState;

  if (delta > 0) {
    // Сложение: должно быть U=0 И L+n > 4
    if (U !== 0) {
      return { valid: false, reason: `Верхняя бусина уже активна (U=${U})` };
    }
    if (L + delta <= 4) {
      return { valid: false, reason: `Можно добавить прямо (L=${L}, L+${delta}=${L+delta} ≤ 4)` };
    }
    return { valid: true, reason: `Нельзя добавить прямо (L=${L}, L+${delta}=${L+delta} > 4)` };
  } else {
    // Вычитание: должно быть U=1 И L < |n|
    const n = Math.abs(delta);
    if (U !== 1) {
      return { valid: false, reason: `Верхняя бусина неактивна (U=${U})` };
    }
    if (L >= n) {
      return { valid: false, reason: `Можно убрать прямо (L=${L} ≥ ${n})` };
    }
    return { valid: true, reason: `Нельзя убрать прямо (L=${L} < ${n})` };
  }
}

// Тест для одной цифры
function testBrotherDigit(n, stepsCount = 10) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔢 ТЕСТ: Генерация примеров для цифры ${n} (брат ${5-n}), ${stepsCount} шагов`);
  console.log(`${'='.repeat(70)}\n`);

  const rule = new BrothersRule({
    selectedDigits: [n],
    minSteps: stepsCount,
    maxSteps: stepsCount,
    silent: true
  });

  const generator = new ExampleGenerator(rule);

  // Генерируем 3 примера
  let allValid = true;

  for (let exampleNum = 1; exampleNum <= 3; exampleNum++) {
    console.log(`\n📝 Пример ${exampleNum}:`);

    const example = generator.generate();
    const { start, steps, answer } = example;

    console.log(`   Старт: ${start}`);

    let currentState = start;
    let brotherCount = 0;
    let simpleCount = 0;
    const errors = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const action = step.action;
      const isFirstAction = i === 0;

      if (typeof action === 'object' && action.isBrother) {
        // Братское действие
        brotherCount++;
        const validation = validateBrotherAction(currentState, action, action.brotherN);

        if (!validation.valid) {
          errors.push(`   ❌ Шаг ${i+1}: ${currentState} → ${action.value >= 0 ? '+' : ''}${action.value} (братское) - ОШИБКА! ${validation.reason}`);
          allValid = false;
        } else {
          console.log(`   ✅ Шаг ${i+1}: ${currentState} → ${action.value >= 0 ? '+' : ''}${action.value} (братское) - ${validation.reason}`);
        }

        // Проверяем что первое действие НЕ братское
        if (isFirstAction) {
          errors.push(`   ❌ КРИТИЧЕСКАЯ ОШИБКА: Первое действие БРАТСКОЕ! Из состояния 0 братские действия невозможны!`);
          allValid = false;
        }
      } else {
        // Простое действие
        simpleCount++;
        const value = typeof action === 'number' ? action : action.value;
        console.log(`   ➡️  Шаг ${i+1}: ${currentState} → ${value >= 0 ? '+' : ''}${value} (простое)`);
      }

      currentState = rule.applyAction(currentState, action);
    }

    console.log(`   Ответ: ${answer} (ожидалось: ${currentState})`);

    if (currentState !== answer) {
      errors.push(`   ❌ Ответ не совпадает: ${currentState} !== ${answer}`);
      allValid = false;
    }

    // Статистика
    const totalSteps = steps.length;
    const brotherPercentage = Math.round(brotherCount / totalSteps * 100);

    console.log(`\n   📊 Статистика:`);
    console.log(`      Всего шагов: ${totalSteps}`);
    console.log(`      Братских: ${brotherCount} (${brotherPercentage}%)`);
    console.log(`      Простых: ${simpleCount} (${100 - brotherPercentage}%)`);

    // Проверка минимума
    const minBrotherSteps = totalSteps <= 7
      ? Math.max(1, Math.ceil(totalSteps * 0.25))
      : totalSteps <= 12
        ? Math.ceil(totalSteps * 0.30)
        : Math.ceil(totalSteps * 0.35);

    if (brotherCount >= minBrotherSteps) {
      console.log(`      ✅ Минимум братских соблюден: ${brotherCount} ≥ ${minBrotherSteps}`);
    } else {
      errors.push(`      ❌ Минимум братских НЕ соблюден: ${brotherCount} < ${minBrotherSteps}`);
      allValid = false;
    }

    // Выводим ошибки
    if (errors.length > 0) {
      console.log(`\n   ❌ ОШИБКИ:`);
      errors.forEach(err => console.log(err));
    }
  }

  return allValid;
}

// Запускаем тесты
console.log('🚀 Запуск тестов для всех цифр...\n');

let allPassed = true;

// Тест 1: Малое количество шагов (7)
console.log('\n' + '█'.repeat(70));
console.log('ТЕСТ 1: Малое количество шагов (7)');
console.log('█'.repeat(70));
for (const n of [1, 2, 3, 4]) {
  const passed = testBrotherDigit(n, 7);
  if (!passed) allPassed = false;
}

// Тест 2: Среднее количество шагов (10)
console.log('\n' + '█'.repeat(70));
console.log('ТЕСТ 2: Среднее количество шагов (10)');
console.log('█'.repeat(70));
for (const n of [1, 2, 3, 4]) {
  const passed = testBrotherDigit(n, 10);
  if (!passed) allPassed = false;
}

// Финальный итог
console.log(`\n${'='.repeat(70)}`);
if (allPassed) {
  console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Генерация примеров корректна.');
} else {
  console.log('❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Требуется доработка.');
}
console.log(`${'='.repeat(70)}\n`);
