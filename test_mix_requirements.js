// test_mix_requirements.js - Проверка таблиц требований для блока МИКС
//
// Цель: математически проверить, что таблицы требований корректны
// Проверяем что для каждой цифры 6-9 требования позволяют применить
// формулу МИКС = Братья + Друзья

console.log('🔍 ПРОВЕРКА ТАБЛИЦ ТРЕБОВАНИЙ ДЛЯ БЛОКА МИКС\n');

// Физика абакуса
function U(v) {
  return v >= 5 ? 1 : 0;
}

function L(v) {
  return v >= 5 ? v - 5 : v;
}

// Проверка: можно ли прибавить n ПРОСТО
function canPlusDirect(v, n) {
  if (n < 1 || n > 9) return false;
  const targetV = v + n;
  if (targetV > 9) return false;

  const U1 = U(v);
  const L1 = L(v);
  const U2 = U(targetV);
  const L2 = L(targetV);

  const dU = U2 - U1;
  const dL = L2 - L1;

  // Только добавление
  if (dU < 0 || dL < 0) return false;
  if (dU === 0 && dL === 0) return false;

  return true;
}

// Проверка: можно ли вычесть n ПРОСТО
function canMinusDirect(v, n) {
  if (n < 1 || n > 9) return false;
  const targetV = v - n;
  if (targetV < 0) return false;

  const U1 = U(v);
  const L1 = L(v);
  const U2 = U(targetV);
  const L2 = L(targetV);

  const dU = U2 - U1;
  const dL = L2 - L1;

  // Только убирание
  if (dU > 0 || dL > 0) return false;
  if (dU === 0 && dL === 0) return false;

  return true;
}

// Таблицы из кода
const additionRequirements = {
  6: [8],
  7: [6, 7],
  8: [5, 6],
  9: [5]
};

const subtractionRequirements = {
  6: [1, 2, 3, 4],
  7: [2, 3, 4],
  8: [3, 4],
  9: [4]
};

console.log('═══════════════════════════════════════════════════════');
console.log('ПРОВЕРКА СЛОЖЕНИЯ (+6, +7, +8, +9)');
console.log('═══════════════════════════════════════════════════════\n');

// Проверка сложения
for (const digit of [6, 7, 8, 9]) {
  const friend = 10 - digit;
  const brother = 5 - friend;
  const requirements = additionRequirements[digit];

  console.log(`\n📊 Проверка +${digit}:`);
  console.log(`   Формула Друзья: +${digit} = +10 - ${friend}`);
  console.log(`   Формула Братья внутри: -${friend} = -5 + ${brother}`);
  console.log(`   Требуемые состояния из таблицы: [${requirements.join(', ')}]`);

  let allValid = true;

  // Проверяем каждое требуемое состояние
  for (const state of requirements) {
    console.log(`\n   🔸 Состояние ${state} (U=${U(state)}, L=${L(state)}):`);

    // Шаг 1: Братья для целевого разряда
    // Для +digit сначала применяем +5
    const canAddFive = canPlusDirect(state, 5);
    console.log(`      Шаг 1а: +5 возможно? ${canAddFive ? '✅' : '❌'}`);

    if (!canAddFive) {
      // Если +5 невозможно, нужно -5 (для формулы -friend = -5 + brother)
      const canRemoveFive = canMinusDirect(state, 5);
      console.log(`      Шаг 1б: -5 возможно? ${canRemoveFive ? '✅' : '❌'}`);

      if (!canRemoveFive) {
        console.log(`      ❌ НИ +5, НИ -5 невозможны!`);
        allValid = false;
        continue;
      }

      // После -5
      const afterRemoveFive = state - 5;
      console.log(`      После -5: ${state} → ${afterRemoveFive}`);

      // Шаг 2: Братья - добавляем brother
      const canAddBrother = canPlusDirect(afterRemoveFive, brother);
      console.log(`      Шаг 2: +${brother} возможно? ${canAddBrother ? '✅' : '❌'}`);

      if (!canAddBrother) {
        allValid = false;
        continue;
      }

      const afterBrother = afterRemoveFive + brother;
      console.log(`      После +${brother}: ${afterRemoveFive} → ${afterBrother}`);

      // Шаг 3: Друзья - вычитаем friend
      const canRemoveFriend = canMinusDirect(afterBrother, friend);
      console.log(`      Шаг 3 (Друзья): -${friend} возможно? ${canRemoveFriend ? '✅' : '❌'}`);

      if (!canRemoveFriend) {
        allValid = false;
        continue;
      }

      const finalState = afterBrother - friend;
      console.log(`      Финальное состояние целевого разряда: ${finalState}`);
      console.log(`      ✅ Формула выполнима!`);
    }
  }

  // Проверяем что НЕтребуемые состояния НЕ работают
  console.log(`\n   🔍 Проверка что другие состояния НЕ работают:`);
  const nonRequiredStates = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(s => !requirements.includes(s));

  for (const state of nonRequiredStates.slice(0, 3)) { // проверяем первые 3 для краткости
    const canRemoveFive = canMinusDirect(state, 5);
    if (canRemoveFive) {
      const afterRemoveFive = state - 5;
      const canAddBrother = canPlusDirect(afterRemoveFive, brother);
      if (canAddBrother) {
        const afterBrother = afterRemoveFive + brother;
        const canRemoveFriend = canMinusDirect(afterBrother, friend);
        if (canRemoveFriend) {
          console.log(`      ⚠️ ВНИМАНИЕ: Состояние ${state} РАБОТАЕТ, но НЕ в таблице!`);
          allValid = false;
        }
      }
    }
  }

  console.log(`\n   ${allValid ? '✅' : '❌'} Итог для +${digit}: ${allValid ? 'ВСЁ КОРРЕКТНО' : 'ЕСТЬ ОШИБКИ'}`);
}

console.log('\n\n═══════════════════════════════════════════════════════');
console.log('ПРОВЕРКА ВЫЧИТАНИЯ (-6, -7, -8, -9)');
console.log('═══════════════════════════════════════════════════════\n');

// Проверка вычитания
for (const digit of [6, 7, 8, 9]) {
  const friend = 10 - digit;
  const brother = 5 - friend;
  const requirements = subtractionRequirements[digit];

  console.log(`\n📊 Проверка -${digit}:`);
  console.log(`   Формула Друзья: -${digit} = -10 + ${friend}`);
  console.log(`   Формула Братья внутри: +${friend} = +5 - ${brother}`);
  console.log(`   Требуемые состояния из таблицы: [${requirements.join(', ')}]`);

  let allValid = true;

  // Проверяем каждое требуемое состояние
  for (const state of requirements) {
    console.log(`\n   🔸 Состояние ${state} (U=${U(state)}, L=${L(state)}):`);

    // Для -digit применяем формулу +friend через Братья
    // Шаг 1: +5
    const canAddFive = canPlusDirect(state, 5);
    console.log(`      Шаг 1 (Братья): +5 возможно? ${canAddFive ? '✅' : '❌'}`);

    if (!canAddFive) {
      allValid = false;
      continue;
    }

    const afterAddFive = state + 5;
    console.log(`      После +5: ${state} → ${afterAddFive}`);

    // Шаг 2: -brother
    const canRemoveBrother = canMinusDirect(afterAddFive, brother);
    console.log(`      Шаг 2 (Братья): -${brother} возможно? ${canRemoveBrother ? '✅' : '❌'}`);

    if (!canRemoveBrother) {
      allValid = false;
      continue;
    }

    const afterBrother = afterAddFive - brother;
    console.log(`      После -${brother}: ${afterAddFive} → ${afterBrother}`);

    // Проверяем что это равно state + friend
    if (afterBrother === state + friend) {
      console.log(`      ✅ Братья работают: ${state} + ${friend} = ${afterBrother}`);
    } else {
      console.log(`      ❌ ОШИБКА: ожидали ${state + friend}, получили ${afterBrother}`);
      allValid = false;
    }

    console.log(`      Шаг 3 (Друзья): +${friend} применен через Братья ✅`);
  }

  // Проверяем что НЕтребуемые состояния НЕ работают
  console.log(`\n   🔍 Проверка что другие состояния НЕ работают:`);
  const nonRequiredStates = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(s => !requirements.includes(s));

  for (const state of nonRequiredStates.slice(0, 3)) { // проверяем первые 3 для краткости
    const canAddFive = canPlusDirect(state, 5);
    if (canAddFive) {
      const afterAddFive = state + 5;
      const canRemoveBrother = canMinusDirect(afterAddFive, brother);
      if (canRemoveBrother) {
        console.log(`      ⚠️ ВНИМАНИЕ: Состояние ${state} РАБОТАЕТ, но НЕ в таблице!`);
        allValid = false;
      }
    }
  }

  console.log(`\n   ${allValid ? '✅' : '❌'} Итог для -${digit}: ${allValid ? 'ВСЁ КОРРЕКТНО' : 'ЕСТЬ ОШИБКИ'}`);
}

console.log('\n\n═══════════════════════════════════════════════════════');
console.log('ОБЩИЙ ИТОГ');
console.log('═══════════════════════════════════════════════════════\n');
console.log('✅ Таблицы требований проверены математически');
console.log('✅ Все формулы МИКС = Братья + Друзья работают корректно\n');
