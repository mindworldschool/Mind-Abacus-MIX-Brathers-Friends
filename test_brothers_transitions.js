// test_brothers_transitions.js - Проверка правильности братских переходов
//
// Тестируем что братские переходы создаются ТОЛЬКО когда прямое действие НЕВОЗМОЖНО

import { BrothersRule } from './ext/core/rules/BrothersRule.js';

console.log('🧮 === ТЕСТ ФИЗИКИ АБАКУСА: Братские переходы ===\n');

// Ожидаемые братские переходы (по физике абакуса)
const EXPECTED_TRANSITIONS = {
  1: {
    addition: [
      { from: 4, to: 5, reason: 'L=4, L+1=5 > 4 (переполнение нижних)' }
    ],
    subtraction: [
      { from: 5, to: 4, reason: 'U=1, L=0, L<1 (нижних не хватает)' }
    ]
  },
  2: {
    addition: [
      { from: 3, to: 5, reason: 'L=3, L+2=5 > 4 (переполнение нижних)' },
      { from: 4, to: 6, reason: 'L=4, L+2=6 > 4 (переполнение нижних)' }
    ],
    subtraction: [
      { from: 5, to: 3, reason: 'U=1, L=0, L<2 (нижних не хватает)' },
      { from: 6, to: 4, reason: 'U=1, L=1, L<2 (нижних не хватает)' }
    ]
  },
  3: {
    addition: [
      { from: 2, to: 5, reason: 'L=2, L+3=5 > 4 (переполнение нижних)' },
      { from: 3, to: 6, reason: 'L=3, L+3=6 > 4 (переполнение нижних)' },
      { from: 4, to: 7, reason: 'L=4, L+3=7 > 4 (переполнение нижних)' }
    ],
    subtraction: [
      { from: 5, to: 2, reason: 'U=1, L=0, L<3 (нижних не хватает)' },
      { from: 6, to: 3, reason: 'U=1, L=1, L<3 (нижних не хватает)' },
      { from: 7, to: 4, reason: 'U=1, L=2, L<3 (нижних не хватает)' }
    ]
  },
  4: {
    addition: [
      { from: 1, to: 5, reason: 'L=1, L+4=5 > 4 (переполнение нижних)' },
      { from: 2, to: 6, reason: 'L=2, L+4=6 > 4 (переполнение нижних)' },
      { from: 3, to: 7, reason: 'L=3, L+4=7 > 4 (переполнение нижних)' },
      { from: 4, to: 8, reason: 'L=4, L+4=8 > 4 (переполнение нижних)' }
    ],
    subtraction: [
      { from: 5, to: 1, reason: 'U=1, L=0, L<4 (нижних не хватает)' },
      { from: 6, to: 2, reason: 'U=1, L=1, L<4 (нижних не хватает)' },
      { from: 7, to: 3, reason: 'U=1, L=2, L<4 (нижних не хватает)' },
      { from: 8, to: 4, reason: 'U=1, L=3, L<4 (нижних не хватает)' }
    ]
  }
};

// Функция для проверки братских переходов для одной цифры
function testBrotherTransitions(n) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔢 ТЕСТ: Братские переходы для цифры ${n} (брат ${5-n})`);
  console.log(`${'='.repeat(60)}\n`);

  const rule = new BrothersRule({
    selectedDigits: [n],
    silent: true
  });

  const expected = EXPECTED_TRANSITIONS[n];
  const actualPairs = rule.brotherPairs;

  console.log(`📊 Создано ${actualPairs.size} братских переходов\n`);

  // Проверяем СЛОЖЕНИЕ (+n)
  console.log(`➕ СЛОЖЕНИЕ (+${n}):`);
  console.log(`   Ожидается: ${expected.addition.length} переходов\n`);

  let additionCorrect = 0;
  let additionWrong = 0;

  for (const exp of expected.addition) {
    const key = `${exp.from}-${exp.to}-brother${n}`;
    const exists = actualPairs.has(key);

    if (exists) {
      console.log(`   ✅ ${exp.from}→${exp.to}: ${exp.reason}`);
      additionCorrect++;
    } else {
      console.log(`   ❌ ${exp.from}→${exp.to}: ОТСУТСТВУЕТ! ${exp.reason}`);
      additionWrong++;
    }
  }

  // Проверяем что нет лишних переходов сложения
  for (let v = 0; v <= 9; v++) {
    const vNext = v + n;
    if (vNext >= 0 && vNext <= 9) {
      const key = `${v}-${vNext}-brother${n}`;
      const exists = actualPairs.has(key);
      const shouldExist = expected.addition.some(exp => exp.from === v && exp.to === vNext);

      if (exists && !shouldExist) {
        const U = v >= 5 ? 1 : 0;
        const L = v >= 5 ? v - 5 : v;
        console.log(`   ⚠️  ${v}→${vNext}: ЛИШНИЙ! (U=${U}, L=${L}, L+${n}=${L+n} ≤ 4, можно прямо)`);
        additionWrong++;
      }
    }
  }

  // Проверяем ВЫЧИТАНИЕ (-n)
  console.log(`\n➖ ВЫЧИТАНИЕ (-${n}):`);
  console.log(`   Ожидается: ${expected.subtraction.length} переходов\n`);

  let subtractionCorrect = 0;
  let subtractionWrong = 0;

  for (const exp of expected.subtraction) {
    const key = `${exp.from}-${exp.to}-brother${n}`;
    const exists = actualPairs.has(key);

    if (exists) {
      console.log(`   ✅ ${exp.from}→${exp.to}: ${exp.reason}`);
      subtractionCorrect++;
    } else {
      console.log(`   ❌ ${exp.from}→${exp.to}: ОТСУТСТВУЕТ! ${exp.reason}`);
      subtractionWrong++;
    }
  }

  // Проверяем что нет лишних переходов вычитания
  for (let v = 0; v <= 9; v++) {
    const vNext = v - n;
    if (vNext >= 0 && vNext <= 9) {
      const key = `${v}-${vNext}-brother${n}`;
      const exists = actualPairs.has(key);
      const shouldExist = expected.subtraction.some(exp => exp.from === v && exp.to === vNext);

      if (exists && !shouldExist) {
        const U = v >= 5 ? 1 : 0;
        const L = v >= 5 ? v - 5 : v;
        console.log(`   ⚠️  ${v}→${vNext}: ЛИШНИЙ! (U=${U}, L=${L}, L≥${n}, можно прямо)`);
        subtractionWrong++;
      }
    }
  }

  // Итоги
  console.log(`\n📈 ИТОГИ для цифры ${n}:`);
  console.log(`   Сложение: ${additionCorrect}/${expected.addition.length} ✓, ${additionWrong} ошибок`);
  console.log(`   Вычитание: ${subtractionCorrect}/${expected.subtraction.length} ✓, ${subtractionWrong} ошибок`);

  const totalCorrect = additionCorrect + subtractionCorrect;
  const totalExpected = expected.addition.length + expected.subtraction.length;
  const totalWrong = additionWrong + subtractionWrong;

  if (totalWrong === 0 && totalCorrect === totalExpected) {
    console.log(`   🎉 ТЕСТ ПРОЙДЕН! Все переходы корректны.`);
    return true;
  } else {
    console.log(`   ❌ ТЕСТ ПРОВАЛЕН! Найдены ошибки.`);
    return false;
  }
}

// Запускаем тесты для всех цифр
let allPassed = true;

for (const n of [1, 2, 3, 4]) {
  const passed = testBrotherTransitions(n);
  if (!passed) allPassed = false;
}

// Финальный итог
console.log(`\n${'='.repeat(60)}`);
if (allPassed) {
  console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Физика абакуса корректна.');
} else {
  console.log('❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Требуется доработка.');
}
console.log(`${'='.repeat(60)}\n`);
