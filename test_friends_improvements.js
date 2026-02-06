// test_friends_improvements.js - Проверка улучшений генератора Друзья
//
// Проверяем:
// 1. Нет круглых чисел (кратных 10)
// 2. Нет повторов подряд (одно и то же число 2+ раза)
// 3. Хорошее чередование Friends и Simple действий

import { FriendsExampleGenerator } from './ext/core/FriendsExampleGenerator.js';

console.log('🔍 ПРОВЕРКА УЛУЧШЕНИЙ ГЕНЕРАТОРА ДРУЗЬЯ\n');
console.log('═══════════════════════════════════════════════════════\n');

// Генерируем несколько примеров для проверки
const testCases = [
  {
    name: 'Режим "Только вычитание" (как на скриншоте)',
    config: {
      selectedDigits: [9],
      digitCount: 1,
      stepsCount: 12,
      onlySubtraction: true,
      silent: true
    }
  },
  {
    name: 'Смешанный режим',
    config: {
      selectedDigits: [6, 7, 8, 9],
      digitCount: 1,
      stepsCount: 12,
      silent: true
    }
  },
  {
    name: 'Двузначные числа',
    config: {
      selectedDigits: [8, 9],
      digitCount: 2,
      stepsCount: 10,
      silent: true
    }
  }
];

let allTestsPassed = true;

for (const testCase of testCases) {
  console.log(`▶️  ТЕСТ: ${testCase.name}\n`);

  const generator = new FriendsExampleGenerator(testCase.config);

  // Генерируем 5 примеров для проверки
  for (let exampleNum = 1; exampleNum <= 5; exampleNum++) {
    const example = generator.generate();

    if (!example) {
      console.log(`   ❌ Пример ${exampleNum}: не удалось сгенерировать\n`);
      allTestsPassed = false;
      continue;
    }

    console.log(`   🔸 Пример ${exampleNum}:`);

    // Собираем все действия
    const actions = example.steps.map(s => s.action);
    const actionsStr = actions.map(a => (a >= 0 ? '+' : '') + a).join(', ');
    console.log(`      Действия: ${actionsStr}`);

    // ПРОВЕРКА 1: Нет круглых чисел
    const roundNumbers = actions.filter(a => Math.abs(a) % 10 === 0);
    if (roundNumbers.length > 0) {
      console.log(`      ❌ КРУГЛЫЕ ЧИСЛА: ${roundNumbers.map(a => (a >= 0 ? '+' : '') + a).join(', ')}`);
      allTestsPassed = false;
    } else {
      console.log(`      ✅ Нет круглых чисел`);
    }

    // ПРОВЕРКА 2: Нет повторов подряд (проверяем окно 3 шагов)
    let hasRepeats = false;
    let repeatDetails = [];
    for (let i = 0; i < actions.length; i++) {
      const absValue = Math.abs(actions[i]);
      const windowSize = Math.min(3, actions.length - i - 1);

      for (let j = 1; j <= windowSize; j++) {
        if (Math.abs(actions[i + j]) === absValue) {
          hasRepeats = true;
          repeatDetails.push(`позиция ${i+1}-${i+j+1}: ${actions[i]}, ${actions[i+j]}`);
        }
      }
    }

    if (hasRepeats) {
      console.log(`      ❌ ПОВТОРЫ ПОДРЯД: ${repeatDetails.join('; ')}`);
      allTestsPassed = false;
    } else {
      console.log(`      ✅ Нет повторов подряд`);
    }

    // ПРОВЕРКА 3: Разнообразие действий
    const uniqueAbsValues = new Set(actions.map(a => Math.abs(a)));
    const diversityPercent = (uniqueAbsValues.size / actions.length * 100).toFixed(0);
    console.log(`      ℹ️  Разнообразие: ${uniqueAbsValues.size} уникальных из ${actions.length} (${diversityPercent}%)`);

    if (diversityPercent < 50 && actions.length > 5) {
      console.log(`      ⚠️  Низкое разнообразие (меньше 50%)`);
    }

    // ПРОВЕРКА 4: Чередование Friends и Simple
    const friendSteps = example.steps.filter(s => s.isFriend).length;
    const simpleSteps = example.steps.filter(s => !s.isFriend).length;
    console.log(`      ℹ️  Чередование: ${friendSteps} Friends, ${simpleSteps} Simple`);

    // Проверяем что нет слишком длинных цепочек одного типа
    let maxConsecutiveFriends = 0;
    let currentConsecutiveFriends = 0;
    for (const step of example.steps) {
      if (step.isFriend) {
        currentConsecutiveFriends++;
        maxConsecutiveFriends = Math.max(maxConsecutiveFriends, currentConsecutiveFriends);
      } else {
        currentConsecutiveFriends = 0;
      }
    }

    if (maxConsecutiveFriends > 3) {
      console.log(`      ⚠️  Слишком много подряд Friends: ${maxConsecutiveFriends}`);
    } else {
      console.log(`      ✅ Хорошее чередование (макс. подряд Friends: ${maxConsecutiveFriends})`);
    }

    console.log();
  }

  console.log('───────────────────────────────────────────────────────\n');
}

console.log('═══════════════════════════════════════════════════════');
console.log('ИТОГ:');
console.log('═══════════════════════════════════════════════════════\n');

if (allTestsPassed) {
  console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
  console.log('✅ Нет круглых чисел');
  console.log('✅ Нет повторов подряд');
  console.log('✅ Хорошее чередование действий\n');
} else {
  console.log('⚠️ НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОШЛИ');
  console.log('⚠️ Смотри детали выше\n');
}

console.log('📝 Рекомендации:');
console.log('   • Протестируй примеры в браузере');
console.log('   • Проверь что примеры стали более разнообразными');
console.log('   • Убедись что нет повторов -9, -9, -9\n');
