import { FriendsExampleGenerator } from './ext/core/FriendsExampleGenerator.js';

console.log('=== ДЕМОНСТРАЦИЯ ИСПРАВЛЕННОЙ ЛОГИКИ ВЫЧИТАНИЯ ===\n');

// Тест 1: Однозначные (digitCount=1)
console.log('1️⃣  ОДНОЗНАЧНЫЕ (digitCount=1, onlySubtraction=true)');
console.log('   selectedDigits=[9]\n');
const gen1 = new FriendsExampleGenerator({
  digitCount: 1,
  onlySubtraction: true,
  selectedDigits: [9],
  stepsCount: 5,
  silent: true
});
const ex1 = gen1.generate();
const formatted1 = gen1.toTrainerFormat(ex1);
console.log(`   Начало: ${formatted1.start}`);
console.log(`   Шаги:`);
formatted1.steps.forEach((step, i) => {
  if (typeof step === 'string') {
    console.log(`     ${i+1}. ${step} (просто)`);
  } else {
    console.log(`     ${i+1}. ${step.step} (Друзья: ${step.formula})`);
  }
});
console.log(`   Ответ: ${formatted1.answer}\n`);

// Тест 2: Двузначные (digitCount=2)
console.log('2️⃣  ДВУЗНАЧНЫЕ (digitCount=2, onlySubtraction=true)');
console.log('   selectedDigits=[3]\n');
const gen2 = new FriendsExampleGenerator({
  digitCount: 2,
  onlySubtraction: true,
  selectedDigits: [3],
  stepsCount: 5,
  silent: true
});
const ex2 = gen2.generate();
const formatted2 = gen2.toTrainerFormat(ex2);
console.log(`   Начало: ${formatted2.start}`);
console.log(`   Шаги:`);
formatted2.steps.forEach((step, i) => {
  if (typeof step === 'string') {
    console.log(`     ${i+1}. ${step} (просто)`);
  } else {
    console.log(`     ${i+1}. ${step.step} (Друзья: ${step.formula})`);
  }
});
console.log(`   Ответ: ${formatted2.answer}\n`);

// Тест 3: Трёхзначные (digitCount=3)
console.log('3️⃣  ТРЁХЗНАЧНЫЕ (digitCount=3, onlySubtraction=true)');
console.log('   selectedDigits=[7]\n');
const gen3 = new FriendsExampleGenerator({
  digitCount: 3,
  onlySubtraction: true,
  selectedDigits: [7],
  stepsCount: 5,
  silent: true
});
const ex3 = gen3.generate();
const formatted3 = gen3.toTrainerFormat(ex3);
console.log(`   Начало: ${formatted3.start}`);
console.log(`   Шаги:`);
formatted3.steps.forEach((step, i) => {
  if (typeof step === 'string') {
    console.log(`     ${i+1}. ${step} (просто)`);
  } else {
    console.log(`     ${i+1}. ${step.step} (Друзья: ${step.formula})`);
  }
});
console.log(`   Ответ: ${formatted3.answer}\n`);

console.log('✅ Все примеры сгенерированы успешно!');
console.log('\n📊 КЛЮЧЕВЫЕ ИСПРАВЛЕНИЯ:');
console.log('  • Первое число >= 10^digitCount (обеспечивает разряд для Friends вычитания)');
console.log('  • Friends действия используют ТОЛЬКО выбранную цифру в целевом разряде');
console.log('  • Все вспомогательные действия в нецелевых разрядах - ТОЛЬКО по правилу "просто"');
console.log('  • Добавлена валидация чтобы не уходить в отрицательные числа');
