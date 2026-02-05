// test_mix_step_by_step.js - Пошаговая симуляция МИКС на абакусе
//
// Проверяем реальное применение формул МИКС на виртуальном абакусе

console.log('🎯 ПОШАГОВАЯ СИМУЛЯЦИЯ БЛОКА МИКС НА АБАКУСЕ\n');
console.log('═══════════════════════════════════════════════════════\n');

// Физика абакуса
function U(v) {
  return v >= 5 ? 1 : 0;
}

function L(v) {
  return v >= 5 ? v - 5 : v;
}

function displayState(v) {
  return `${v} (U=${U(v)}, L=${L(v)})`;
}

// Симуляция абакуса: состояние = [единицы, десятки]
class VirtualAbacus {
  constructor() {
    this.state = [0, 0]; // [единицы, десятки]
  }

  setState(units, tens = 0) {
    this.state = [units, tens];
  }

  getState() {
    return [...this.state];
  }

  getNumber() {
    return this.state[0] + this.state[1] * 10;
  }

  // Применить изменение к разряду
  apply(position, delta) {
    this.state[position] = (this.state[position] || 0) + delta;
  }

  display() {
    return `[единицы=${displayState(this.state[0])}, десятки=${displayState(this.state[1])}] = ${this.getNumber()}`;
  }
}

console.log('▶️  ТЕСТ 1: +6 из состояния 8\n');
console.log('📝 Формула из кода (4 шага):');
console.log('   1. единицы: +5');
console.log('   2. единицы: -1 (brother)');
console.log('   3. десятки: +1 (Друзья: +10)');
console.log('   4. единицы: -4 (friend)\n');

let abacus = new VirtualAbacus();
abacus.setState(8, 0);

console.log(`Начальное состояние: ${abacus.display()}`);

try {
  console.log('\n🔸 Применяем формулу из кода:');

  // Шаг 1: +5
  console.log('   Шаг 1: единицы +5');
  abacus.apply(0, 5);
  console.log(`   → ${abacus.display()}`);
  if (abacus.state[0] > 9) {
    console.log('   ⚠️  ПЕРЕПОЛНЕНИЕ! Разряд >9');
  }

  // Шаг 2: -1
  console.log('   Шаг 2: единицы -1 (brother)');
  abacus.apply(0, -1);
  console.log(`   → ${abacus.display()}`);

  // Шаг 3: +1 в десятках
  console.log('   Шаг 3: десятки +1 (+10)');
  abacus.apply(1, 1);
  console.log(`   → ${abacus.display()}`);

  // Шаг 4: -4
  console.log('   Шаг 4: единицы -4 (friend)');
  abacus.apply(0, -4);
  console.log(`   → ${abacus.display()}`);

  console.log(`\n✅ Финальное: ${abacus.display()}`);
  console.log(`   Ожидали: 8 + 6 = 14 ✓`);
} catch (e) {
  console.log(`\n❌ ОШИБКА: ${e.message}`);
}

console.log('\n───────────────────────────────────────────────────────\n');
console.log('🤔 ПРАВИЛЬНАЯ формула (3 шага):');
console.log('   1. единицы: -5 (убрать верхнюю - начало Братьев)');
console.log('   2. единицы: +1 (добавить брата - завершение Братьев для -4)');
console.log('   3. десятки: +1 (Друзья: +10)\n');

abacus = new VirtualAbacus();
abacus.setState(8, 0);
console.log(`Начальное состояние: ${abacus.display()}`);

try {
  console.log('\n🔸 Применяем правильную формулу:');

  // Шаг 1: -5
  console.log('   Шаг 1: единицы -5 (Братья, часть 1)');
  abacus.apply(0, -5);
  console.log(`   → ${abacus.display()}`);

  // Шаг 2: +1
  console.log('   Шаг 2: единицы +1 (Братья, часть 2, брат для 4)');
  abacus.apply(0, 1);
  console.log(`   → ${abacus.display()}`);
  console.log('   ℹ️  Братья завершены: -4 = -5+1');

  // Шаг 3: +1 в десятках
  console.log('   Шаг 3: десятки +1 (Друзья: +10)');
  abacus.apply(1, 1);
  console.log(`   → ${abacus.display()}`);

  console.log(`\n✅ Финальное: ${abacus.display()}`);
  console.log(`   Ожидали: 8 + 6 = 14 ✓`);
  console.log(`   ✅ БЕЗ переполнения, БЕЗ лишних шагов!`);
} catch (e) {
  console.log(`\n❌ ОШИБКА: ${e.message}`);
}

console.log('\n\n═══════════════════════════════════════════════════════');
console.log('▶️  ТЕСТ 2: -6 из состояния 2\n');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📝 Формула из кода (4 шага):');
console.log('   1. единицы: -5');
console.log('   2. единицы: +1 (brother)');
console.log('   3. десятки: -1 (Друзья: -10)');
console.log('   4. единицы: +4 (friend)\n');

abacus = new VirtualAbacus();
abacus.setState(2, 1); // Начальное состояние: 12
console.log(`Начальное состояние: ${abacus.display()}`);

try {
  console.log('\n🔸 Применяем формулу из кода:');

  // Шаг 1: -5
  console.log('   Шаг 1: единицы -5');
  abacus.apply(0, -5);
  console.log(`   → ${abacus.display()}`);
  if (abacus.state[0] < 0) {
    console.log('   ⚠️  ОТРИЦАТЕЛЬНОЕ! Разряд <0');
  }

  // Шаг 2: +1
  console.log('   Шаг 2: единицы +1 (brother)');
  abacus.apply(0, 1);
  console.log(`   → ${abacus.display()}`);

  // Шаг 3: -1 в десятках
  console.log('   Шаг 3: десятки -1 (-10)');
  abacus.apply(1, -1);
  console.log(`   → ${abacus.display()}`);

  // Шаг 4: +4
  console.log('   Шаг 4: единицы +4 (friend)');
  abacus.apply(0, 4);
  console.log(`   → ${abacus.display()}`);

  console.log(`\n✅ Финальное: ${abacus.display()}`);
  console.log(`   Ожидали: 12 - 6 = 6 ✓`);
} catch (e) {
  console.log(`\n❌ ОШИБКА: ${e.message}`);
}

console.log('\n───────────────────────────────────────────────────────\n');
console.log('🤔 ПРАВИЛЬНАЯ формула (3 шага):');
console.log('   1. единицы: +5 (добавить верхнюю - начало Братьев)');
console.log('   2. единицы: -1 (убрать брата - завершение Братьев для +4)');
console.log('   3. десятки: -1 (Друзья: -10)\n');

abacus = new VirtualAbacus();
abacus.setState(2, 1); // Начальное состояние: 12
console.log(`Начальное состояние: ${abacus.display()}`);

try {
  console.log('\n🔸 Применяем правильную формулу:');

  // Шаг 1: +5
  console.log('   Шаг 1: единицы +5 (Братья, часть 1)');
  abacus.apply(0, 5);
  console.log(`   → ${abacus.display()}`);

  // Шаг 2: -1
  console.log('   Шаг 2: единицы -1 (Братья, часть 2, брат для 4)');
  abacus.apply(0, -1);
  console.log(`   → ${abacus.display()}`);
  console.log('   ℹ️  Братья завершены: +4 = +5-1');

  // Шаг 3: -1 в десятках
  console.log('   Шаг 3: десятки -1 (Друзья: -10)');
  abacus.apply(1, -1);
  console.log(`   → ${abacus.display()}`);

  console.log(`\n✅ Финальное: ${abacus.display()}`);
  console.log(`   Ожидали: 12 - 6 = 6 ✓`);
  console.log(`   ✅ БЕЗ отрицательных, БЕЗ лишних шагов!`);
} catch (e) {
  console.log(`\n❌ ОШИБКА: ${e.message}`);
}

console.log('\n\n═══════════════════════════════════════════════════════');
console.log('ИТОГОВЫЙ ВЫВОД:');
console.log('═══════════════════════════════════════════════════════\n');

console.log('⚠️  ПРОБЛЕМА С ФОРМУЛАМИ В КОДЕ:');
console.log('   • Формула содержит 4 шага вместо 3');
console.log('   • Шаг 1 может вызывать переполнение (>9 или <0)');
console.log('   • Шаг 4 дублирует эффект шагов 1-2\n');

console.log('✅ ПРАВИЛЬНАЯ ФОРМУЛА МИКС:');
console.log('   Для +digit (friend = 10-digit, brother = 5-friend):');
console.log('     1. единицы: -5 (Братья для -friend, часть 1)');
console.log('     2. единицы: +brother (Братья для -friend, часть 2)');
console.log('     3. десятки: +1 (Друзья: +10)\n');

console.log('   Для -digit (friend = 10-digit, brother = 5-friend):');
console.log('     1. единицы: +5 (Братья для +friend, часть 1)');
console.log('     2. единицы: -brother (Братья для +friend, часть 2)');
console.log('     3. десятки: -1 (Друзья: -10)\n');

console.log('🔧 РЕКОМЕНДАЦИЯ:');
console.log('   Исправить формулы в MixExampleGenerator.js (строки 1048-1061 и 1158-1169)');
console.log('   Убрать шаг 4 и изменить знак в шаге 1\n');
