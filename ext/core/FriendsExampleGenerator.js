// ext/core/FriendsExampleGenerator.js - Специализированный генератор для правила "Друзья"
//
// НОВАЯ УПРОЩЕННАЯ ВЕРСИЯ - ПОЛНОСТЬЮ ПЕРЕПИСАНА
//
// ПРАВИЛО "ДРУЗЬЯ" (через 10):
// ФОРМУЛЫ:
//   СЛОЖЕНИЕ:  +n = +10 - friend,  где friend = 10 - n
//   ВЫЧИТАНИЕ: -n = -10 + friend,  где friend = 10 - n
//
// ТРИ РЕЖИМА ГЕНЕРАЦИИ:
//
// 1. БЕЗ ФЛАГОВ (onlyAddition=false, onlySubtraction=false):
//    - Start from 0
//    - Первое действие: обычное маленькое действие (по digitCount)
//    - Friends действия: могут быть + ИЛИ -
//    - Simple действия: могут быть + или -
//
// 2. С ФЛАГОМ onlySubtraction=true:
//    - Start from 0
//    - Первое действие: БОЛЬШОЕ положительное (чтобы было откуда вычитать)
//      digitCount=1 → +20..+99, digitCount=2 → +50..+99, digitCount=3 → +500..+999
//    - Friends действия: ТОЛЬКО -
//    - Simple действия: могут быть + или -
//
// 3. С ФЛАГОМ onlyAddition=true:
//    - Start from 0
//    - Первое действие: обычное маленькое действие
//    - Friends действия: ТОЛЬКО +
//    - Simple действия: могут быть + или -

/**
 * ПРИОРИТЕТ 3.1: Конфигурация направления действий для Friends
 * Инкапсулирует логику работы с флагами onlyAddition/onlySubtraction
 */
class ActionDirectionConfig {
  constructor(onlyAddition, onlySubtraction) {
    // Валидация: флаги взаимоисключающие
    if (onlyAddition && onlySubtraction) {
      throw new Error('Флаги onlyAddition и onlySubtraction не могут быть активны одновременно');
    }

    this.onlyAddition = onlyAddition === true;
    this.onlySubtraction = onlySubtraction === true;
    this.isMixed = !this.onlyAddition && !this.onlySubtraction;
  }

  /**
   * Проверяет, разрешено ли Friends-сложение в текущем режиме
   */
  canAddition() {
    return this.onlyAddition || this.isMixed;
  }

  /**
   * Проверяет, разрешено ли Friends-вычитание в текущем режиме
   */
  canSubtraction() {
    return this.onlySubtraction || this.isMixed;
  }

  /**
   * Требуется ли большое первое действие (для onlySubtraction)
   */
  needsBigFirstAction() {
    return this.onlySubtraction;
  }

  /**
   * Возвращает название режима для логирования
   */
  getModeName() {
    if (this.onlyAddition) return 'ТОЛЬКО СЛОЖЕНИЕ';
    if (this.onlySubtraction) return 'ТОЛЬКО ВЫЧИТАНИЕ';
    return 'СМЕШАННЫЙ';
  }
}

export class FriendsExampleGenerator {
  constructor(config = {}) {
    this.config = {
      selectedDigits: Array.isArray(config.selectedDigits)
        ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9],
      digitCount: config.digitCount || 1,
      stepsCount: config.stepsCount || config.maxSteps || 7,
      onlyAddition: config.onlyAddition === true,  // Строгая проверка
      onlySubtraction: config.onlySubtraction === true,  // Строгая проверка
      simpleDigits: config.blocks?.simple?.digits
        ? config.blocks.simple.digits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9],
      brothersActive: config.blocks?.brothers?.active || false,
      silent: config.silent || false,
      blocks: config.blocks || {}
    };

    // ПРИОРИТЕТ 3.1: Создаем объект управления направлением действий
    // Инкапсулирует валидацию конфликта флагов (ПРИОРИТЕТ 1.2)
    try {
      this.directionConfig = new ActionDirectionConfig(
        this.config.onlyAddition,
        this.config.onlySubtraction
      );
    } catch (error) {
      this._error('❌ ОШИБКА КОНФИГУРАЦИИ:', error.message);
      throw error;
    }

    // Валидация
    if (this.config.selectedDigits.length === 0) {
      this.config.selectedDigits = [1];
    }
    if (this.config.digitCount < 1) {
      this.config.digitCount = 1;
    }
    if (this.config.stepsCount < 3) {
      this.config.stepsCount = 3;
    }

    // Разрядность состояния = digitCount + 1 (для переноса)
    this.stateDigitCount = this.config.digitCount + 1;
    // Целевой разряд где применяется Friends
    this.targetPosition = this.config.digitCount - 1;
    // Максимальное значение
    this.maxValue = Math.pow(10, this.stateDigitCount + 1) - 1;

    this._log(`🤝 FriendsExampleGenerator (НОВАЯ ВЕРСИЯ):
  Выбранные цифры Друзья: [${this.config.selectedDigits.join(', ')}]
  Разрядность действий: ${this.config.digitCount}
  Целевой разряд: ${this.targetPosition}
  Количество шагов: ${this.config.stepsCount}
  🚩 Режим направления: ${this.directionConfig.getModeName()}`);
  }

  _log(...args) {
    if (!this.config.silent) console.log(...args);
  }

  _warn(...args) {
    if (!this.config.silent) console.warn(...args);
  }

  _error(...args) {
    console.error(...args);
  }

  // ========== ФИЗИКА АБАКУСА ==========

  _U(v) {
    return v >= 5 ? 1 : 0;
  }

  _L(v) {
    return v >= 5 ? v - 5 : v;
  }

  _toValue(U, L) {
    return 5 * U + L;
  }

  _canPlusDirect(v, n) {
    if (n < 1 || n > 9) return false;
    const targetV = v + n;
    if (targetV > 9) return false;

    const U1 = this._U(v);
    const L1 = this._L(v);
    const U2 = this._U(targetV);
    const L2 = this._L(targetV);

    const dU = U2 - U1;
    const dL = L2 - L1;

    // Проверка: только добавление (нельзя смешивать)
    if (dU < 0 || dL < 0) return false;

    // Проверка барьера 5: переход 4→5 требует Братья
    if (v === 4 && targetV === 5) return false;

    return true;
  }

  _canMinusDirect(v, n) {
    if (n < 1 || n > 9) return false;
    const targetV = v - n;
    if (targetV < 0) return false;

    const U1 = this._U(v);
    const L1 = this._L(v);
    const U2 = this._U(targetV);
    const L2 = this._L(targetV);

    const dU = U2 - U1;
    const dL = L2 - L1;

    // Проверка: только убирание
    if (dU > 0 || dL > 0) return false;

    // Проверка барьера 5: переход 5→4 требует Братья
    if (v === 5 && targetV === 4) return false;

    return true;
  }

  // ========== ТРЕБОВАНИЯ ДЛЯ FRIENDS ==========

  _getAdditionRequirements(digit) {
    const friend = 10 - digit;
    switch(digit) {
      case 1: return { states: [9] };
      case 2: return { states: [8, 9] };
      case 3: return { states: [7, 8, 9] };
      case 4: return { states: [6, 7, 8, 9] };
      case 5: return { states: [5, 6, 7, 8, 9] };
      case 6: return { states: [4, 9] };
      case 7: return { states: [3, 4, 8, 9] };
      case 8: return { states: [2, 3, 4, 7, 8, 9] };
      case 9: return { states: [1, 2, 3, 4, 6, 7, 8, 9] };
      default: return { states: [] };
    }
  }

  _getSubtractionRequirements(digit) {
    const friend = 10 - digit;
    switch(digit) {
      case 1: return { states: [0] };
      case 2: return { states: [0, 1] };
      case 3: return { states: [0, 1, 2] };
      case 4: return { states: [0, 1, 2, 3] };
      case 5: return { states: [0, 1, 2, 3, 4] };
      case 6: return { states: [0, 5] };
      case 7: return { states: [0, 1, 5, 6] };
      case 8: return { states: [0, 1, 2, 5, 6, 7] };
      case 9: return { states: [0, 1, 2, 3, 5, 6, 7, 8] };
      default: return { states: [] };
    }
  }

  // ========== УТИЛИТЫ ==========

  stateToNumber(states) {
    if (!Array.isArray(states)) return 0;
    let result = 0;
    for (let i = 0; i < states.length; i++) {
      result += (states[i] || 0) * Math.pow(10, i);
    }
    return result;
  }

  _numberToDigits(num, digitCount) {
    const digits = [];
    let remaining = Math.abs(num);
    for (let i = 0; i < digitCount; i++) {
      digits.push(remaining % 10);
      remaining = Math.floor(remaining / 10);
    }
    return digits;
  }

  _isValidState(states) {
    for (let i = 0; i < states.length; i++) {
      const v = states[i] || 0;
      if (v < 0 || v > 9) return false;
    }
    return true;
  }

  /**
   * Нормализация состояния - обработка переносов между разрядами.
   * Если разряд >9, переносим в следующий разряд.
   * Если разряд <0, занимаем из следующего разряда.
   * Возвращает null если нормализация невозможна (уход в отрицательные числа).
   */
  _normalizeState(states) {
    const normalized = [...states];

    // Обрабатываем переносы снизу вверх
    for (let i = 0; i < normalized.length; i++) {
      let value = normalized[i] || 0;

      // Перенос вверх (если разряд >= 10)
      if (value >= 10) {
        const carry = Math.floor(value / 10);
        normalized[i] = value % 10;
        if (i + 1 < normalized.length) {
          normalized[i + 1] = (normalized[i + 1] || 0) + carry;
        } else {
          // Переполнение за пределы массива
          this._warn(`⚠️ Переполнение: разряд ${i} = ${value}, нет места для переноса`);
          return null;
        }
      }

      // Заём из старшего разряда (если разряд < 0)
      else if (value < 0) {
        const borrow = Math.ceil(-value / 10);
        normalized[i] = value + (borrow * 10);
        if (i + 1 < normalized.length) {
          normalized[i + 1] = (normalized[i + 1] || 0) - borrow;
        } else {
          // Нельзя занять - число станет отрицательным
          this._warn(`⚠️ Невозможно занять: разряд ${i} = ${value}, старшего разряда нет`);
          return null;
        }
      }
    }

    // Финальная проверка: все разряды должны быть в [0..9]
    for (let i = 0; i < normalized.length; i++) {
      const v = normalized[i] || 0;
      if (v < 0 || v > 9) {
        this._warn(`⚠️ Нормализация не удалась: разряд ${i} = ${v}`);
        return null;
      }
    }

    return normalized;
  }

  _buildFormula(value, position) {
    const isPositive = value >= 0;
    const digit = Math.abs(this._numberToDigits(Math.abs(value), this.config.digitCount)[position]);
    const friend = 10 - digit;

    if (isPositive) {
      return `${value} = +10 - ${friend}`;
    } else {
      return `${value} = -10 + ${friend}`;
    }
  }

  /**
   * Проверка переполнения разрядности.
   *
   * ВАЖНО: Для правила "Друзья" нужен дополнительный разряд для формулы +10-friend!
   *
   * Логика проверки:
   * - digitCount=1: состояние использует разряды [0, 1], разряд 1 может быть 0-9 (для десятков)
   *   Результат: 0-99. Переполнение если разряд >=2 не нулевой.
   * - digitCount=2: состояние использует разряды [0, 1, 2], разряд 2 может быть 0-9 (для сотен)
   *   Результат: 0-999. Переполнение если разряд >=3 не нулевой.
   *
   * Общее правило: разряды с индексом >= stateDigitCount должны быть 0.
   */
  _checkOverflow(states) {
    // Проверяем, что все разряды ВЫШЕ stateDigitCount-1 равны 0
    // stateDigitCount = digitCount + 1, так что проверяем начиная с digitCount+1
    for (let i = this.stateDigitCount; i < states.length; i++) {
      if (states[i] !== 0) {
        this._warn(`⚠️ Переполнение разрядности: разряд ${i} = ${states[i]} (должен быть 0)`);
        return true; // Есть переполнение!
      }
    }

    // Также проверяем, что в пределах stateDigitCount все разряды в диапазоне 0-9
    for (let i = 0; i < this.stateDigitCount; i++) {
      const val = states[i] || 0;
      if (val < 0 || val > 9) {
        this._warn(`⚠️ Невалидное значение разряда: разряд ${i} = ${val} (должно быть 0-9)`);
        return true;
      }
    }

    return false; // Нет переполнения
  }

  // ========== ГЛАВНАЯ ЛОГИКА ГЕНЕРАЦИИ ==========

  generate() {
    this._log("\n🎯 === НАЧАЛО ГЕНЕРАЦИИ ===");
    this._log(`Режим: ${this.directionConfig.getModeName()}`);

    const maxAttempts = 100;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this._log(`\n--- Попытка ${attempt} ---`);

      const example = this._generateExample();

      if (example) {
        this._log("✅ === ГЕНЕРАЦИЯ УСПЕШНА ===\n");
        return example;
      }
    }

    this._warn("⚠️ Не удалось сгенерировать пример за 100 попыток, возвращаем минимальный");
    return this._generateMinimalExample();
  }

  _generateExample() {
    let states = Array(this.stateDigitCount).fill(0);
    const steps = [];
    const targetSteps = this.config.stepsCount;

    // Особый случай: для режима onlySubtraction с маленькими цифрами
    // может быть невозможно генерировать Friends действия
    // Проверяем: если все selectedDigits <= 4 и режим onlySubtraction
    const hasOnlySmallDigits = this.config.selectedDigits.every(d => d <= 4);
    const isSubtractionMode = this.directionConfig.onlySubtraction;
    const isDigitCount1 = this.config.digitCount === 1;

    // Ослабляем требования: минимум 1 Friends действие или 20% от общего числа (что меньше)
    // Но для специального случая (onlySubtraction + маленькие цифры + digitCount=1) - 0
    let minFriendSteps;
    if (isSubtractionMode && hasOnlySmallDigits && isDigitCount1) {
      minFriendSteps = 0; // Не требуем Friends для этого сложного случая
      this._log(`📊 Особый случай: onlySubtraction с маленькими цифрами, minFriends=0`);
    } else {
      minFriendSteps = Math.max(1, Math.floor(targetSteps * 0.2));
    }
    let friendStepsCount = 0;

    // ПРИОРИТЕТ 2.2: Улучшенное логирование для отладки
    this._log(`📊 Цель: ${targetSteps} шагов, минимум Friends: ${minFriendSteps}`);

    // ШАГ 1: ПЕРВОЕ ДЕЙСТВИЕ
    const firstAction = this._generateFirstAction();
    if (!firstAction) {
      this._warn("❌ Не удалось сгенерировать первое действие");
      return null;
    }

    const newStates = this._applySimpleAction(states, firstAction);
    if (!newStates || !this._isValidState(newStates)) {
      this._warn("❌ Первое действие привело к невалидному состоянию");
      return null;
    }
    if (this._checkOverflow(newStates)) {
      this._warn("❌ Первое действие вызвало переполнение разрядности");
      return null;
    }

    steps.push({
      action: firstAction,
      isFriend: false,
      states: [...newStates]
    });
    states = newStates;
    this._log(`🎬 Первое действие: ${firstAction >= 0 ? '+' : ''}${firstAction}, состояние: [${states.join(', ')}]`);

    // ШАГ 2: ОСНОВНОЙ ЦИКЛ
    let attempts = 0;
    // Увеличиваем количество попыток для большей гибкости
    const maxLoopAttempts = targetSteps * 100;
    let consecutiveSimpleActions = 0; // Счетчик подряд идущих Simple действий

    while (steps.length < targetSteps && attempts < maxLoopAttempts) {
      attempts++;
      const stepsRemaining = targetSteps - steps.length;
      const needMoreFriends = friendStepsCount < minFriendSteps;

      // Решаем: генерировать Friends или Simple
      let action = null;

      // Приоритет Friends если:
      // 1. Нужно больше Friends действий
      // 2. Или с вероятностью 50% если осталось >= 2 шагов
      // 3. Или если слишком много подряд Simple действий (больше 3)
      const shouldTryFriends = needMoreFriends ||
                               (stepsRemaining >= 2 && Math.random() < 0.5) ||
                               consecutiveSimpleActions > 3;

      if (shouldTryFriends) {
        // Пытаемся Friends
        action = this._tryGenerateFriendAction(states);
        if (action) {
          const newStates = this._applyFriendAction(states, action);
          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: action.value,
              isFriend: true,
              friendN: action.friendDigit,
              formula: this._buildFormula(action.value, this.targetPosition),
              states: [...newStates]
            });
            states = newStates;
            friendStepsCount++;
            consecutiveSimpleActions = 0; // Сбрасываем счетчик
            // Убираем детальные логи для ускорения
            // this._log(`Шаг ${steps.length}: Friends ${action.value >= 0 ? '+' : ''}${action.value}, состояние: [${states.join(', ')}]`);
            continue;
          }
        }
      }

      // Генерируем Simple
      action = this._generateSimpleAction(states);
      if (action) {
        const newStates = this._applySimpleAction(states, action);
        if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
          steps.push({
            action: action,
            isFriend: false,
            states: [...newStates]
          });
          states = newStates;
          consecutiveSimpleActions++;
          // Убираем детальные логи для ускорения
          // this._log(`Шаг ${steps.length}: Simple ${action >= 0 ? '+' : ''}${action}, состояние: [${states.join(', ')}]`);
        }
      }
    }

    // Проверяем результат - ослабленное условие
    if (steps.length === targetSteps && friendStepsCount >= minFriendSteps) {
      this._log(`✅ Пример готов: ${steps.length} шагов, ${friendStepsCount} Friends`);
      return {
        start: Array(this.stateDigitCount).fill(0),
        steps,
        answer: [...states]
      };
    }

    // Если почти достигли цели (не хватает 1-2 шагов), то это тоже успех
    if (steps.length >= targetSteps - 2 && friendStepsCount >= minFriendSteps) {
      this._log(`✅ Пример готов (почти достигли цели): ${steps.length} шагов, ${friendStepsCount} Friends`);
      // Дополняем простыми действиями если нужно
      while (steps.length < targetSteps) {
        const simpleAction = this._generateSimpleAction(states);
        if (simpleAction) {
          const newStates = this._applySimpleAction(states, simpleAction);
          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: simpleAction,
              isFriend: false,
              states: [...newStates]
            });
            states = newStates;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      return {
        start: Array(this.stateDigitCount).fill(0),
        steps,
        answer: [...states]
      };
    }

    this._warn(`❌ Не достигли цели: шагов ${steps.length}/${targetSteps}, Friends ${friendStepsCount}/${minFriendSteps}`);
    return null;
  }

  // ========== ГЕНЕРАЦИЯ ПЕРВОГО ДЕЙСТВИЯ ==========

  _generateFirstAction() {
    this._log(`🔍 _generateFirstAction: digitCount=${this.config.digitCount}, режим=${this.directionConfig.getModeName()}`);

    // Для onlySubtraction - генерируем действие в ВЕРХНЕЙ части диапазона
    // Это обеспечит достаточно места для вычитания
    if (this.directionConfig.needsBigFirstAction()) {
      let minValue, maxValue;

      // КРИТИЧНО: Для правила Друзья при вычитании нужен дополнительный разряд!
      // Формула: -n = -10 + friend требует разряд десятков >= 1
      // Поэтому генерируем число с учетом stateDigitCount (а не digitCount)

      // Для digitCount=1 (stateDigitCount=2): нужно >= 10 для Friends вычитания
      // Для digitCount=2 (stateDigitCount=3): нужно >= 100 для Friends вычитания
      // Общая логика: минимум = 10^digitCount (начало следующего разряда)
      minValue = Math.pow(10, this.config.digitCount);

      // Максимум = верхняя половина доступного диапазона состояния
      // Для digitCount=1: [10, 99] (максимум состояния = 99)
      // Для digitCount=2: [100, 999] (максимум состояния = 999)
      maxValue = Math.pow(10, this.stateDigitCount) - 1;

      const bigNumber = minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
      this._log(`🎯 Первое действие (onlySubtraction): +${bigNumber} (диапазон: [${minValue}, ${maxValue}])`);
      this._log(`   ℹ️ Это обеспечит разряд ${this.config.digitCount} >= 1 для Friends вычитания`);
      return bigNumber;
    }

    // Для остальных режимов - обычное маленькое действие
    const maxValue = Math.pow(10, this.config.digitCount) - 1;
    const minValue = Math.pow(10, this.config.digitCount - 1);
    const value = minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
    this._log(`🎯 Первое действие (обычный режим): +${value} (диапазон: [${minValue}, ${maxValue}])`);
    return value;
  }

  // ========== ГЕНЕРАЦИЯ FRIENDS ДЕЙСТВИЯ ==========

  _tryGenerateFriendAction(states) {
    const targetVal = states[this.targetPosition] || 0;
    const nextVal = states[this.targetPosition + 1] || 0;

    // Пробуем для каждой выбранной цифры
    const digits = [...this.config.selectedDigits].sort(() => Math.random() - 0.5);

    for (const friendDigit of digits) {
      // ПРИОРИТЕТ 2.1: Проверка флагов с комментариями
      // Пробуем сложение (разрешено если: onlyAddition=true ИЛИ смешанный режим)
      if (this.directionConfig.canAddition()) {
        const addReq = this._getAdditionRequirements(friendDigit);
        if (addReq.states.includes(targetVal)) {
          const friend = 10 - friendDigit;
          // Проверяем: можем ли вычесть friend и добавить +10
          if (this._canMinusDirect(targetVal, friend) && this._canPlusDirect(nextVal, 1)) {
            // Генерируем многозначное действие
            const value = this._buildMultiDigitAction(friendDigit, states, true);
            if (value !== null) {
              return { value, friendDigit, isAddition: true };
            }
          }
        }
      }

      // ПРИОРИТЕТ 2.1: Проверка флагов с комментариями
      // Пробуем вычитание (разрешено если: onlySubtraction=true ИЛИ смешанный режим)
      if (this.directionConfig.canSubtraction()) {
        const subReq = this._getSubtractionRequirements(friendDigit);
        if (subReq.states.includes(targetVal)) {
          const friend = 10 - friendDigit;
          // Проверяем: можем ли добавить friend и вычесть -10
          if (this._canPlusDirect(targetVal, friend) && this._canMinusDirect(nextVal, 1)) {
            // Генерируем многозначное действие
            const value = this._buildMultiDigitAction(friendDigit, states, false);
            if (value !== null) {
              // КРИТИЧНО: Проверяем что не уйдем в отрицательные числа
              const currentNumber = this.stateToNumber(states);
              if (currentNumber >= value) {
                return { value: -value, friendDigit, isAddition: false };
              }
            }
          }
        }
      }
    }

    return null;
  }

  _buildMultiDigitAction(friendDigit, states, isAddition) {
    const actionDigits = Array(this.config.digitCount).fill(0);
    actionDigits[this.targetPosition] = friendDigit;

    // Для остальных разрядов подбираем простые цифры
    // 🔥 ВАЖНО: Проверяем, что для НЕцелевых разрядов НЕ требуется Friends/Brothers
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      if (pos === this.targetPosition) continue;

      const currentVal = states[pos] || 0;
      const possibleDigits = [];

      for (let d = 0; d <= 9; d++) {
        // 🔥 КРИТИЧНО: Проверяем ВСЕ цифры, не только целевой разряд
        // Для нецелевых разрядов НЕ ДОЛЖНЫ требоваться Brothers/Friends
        if (d === 0) {
          // d=0 означает "не изменять этот разряд" - всегда разрешено
          possibleDigits.push(0);
        } else if (isAddition && this._canPlusDirect(currentVal, d)) {
          possibleDigits.push(d);
        } else if (!isAddition && this._canMinusDirect(currentVal, d)) {
          possibleDigits.push(d);
        }
      }

      if (possibleDigits.length === 0) {
        return null;
      }

      // 🔥 ИСПРАВЛЕНО: Избегаем круглых чисел
      // Предпочитаем не-нулевые цифры для разнообразия
      const nonZeroDigits = possibleDigits.filter(d => d !== 0);
      if (nonZeroDigits.length > 0) {
        // Выбираем случайную не-нулевую цифру
        actionDigits[pos] = nonZeroDigits[Math.floor(Math.random() * nonZeroDigits.length)];
      } else {
        // Если доступна только 0, используем её
        actionDigits[pos] = 0;
      }
    }

    // Конвертируем в число
    let result = 0;
    for (let i = 0; i < actionDigits.length; i++) {
      result += actionDigits[i] * Math.pow(10, i);
    }

    return result;
  }

  // ========== ГЕНЕРАЦИЯ SIMPLE ДЕЙСТВИЯ ==========

  /**
   * Генерирует простое действие (без Brothers и Friends).
   * Действие представлено одним числом (например, +23 или -15).
   * Проверяет что каждый разряд можно изменить простым жестом.
   * 🔥 ИСПРАВЛЕНО: НЕ учитывает флаги onlyAddition/onlySubtraction.
   * Флаги применяются ТОЛЬКО к Friends действиям, Simple могут быть любыми.
   */
  _generateSimpleAction(states, skipFirstCheck = false) {
    const currentNumber = this.stateToNumber(states.slice(0, this.config.digitCount));
    const maxValue = Math.pow(10, this.config.digitCount) - 1;
    // Убираем детальные логи
    // this._log(`🔍 _generateSimpleAction: текущее число=${currentNumber}, maxValue=${maxValue}`);

    // Для однозначных чисел используем упрощенную логику
    if (this.config.digitCount === 1) {
      // Собираем доступные действия
      const availableActions = [];

      // 🔥 ИСПРАВЛЕНО: Сложение всегда разрешено для Simple действий
      for (let digit = 1; digit <= 9; digit++) {
        const currentVal = states[0] || 0;
        if (this._canPlusDirect(currentVal, digit)) {
          availableActions.push(digit);
        }
      }

      // 🔥 ИСПРАВЛЕНО: Вычитание всегда разрешено для Simple действий
      for (let digit = 1; digit <= 9; digit++) {
        const currentVal = states[0] || 0;
        if (this._canMinusDirect(currentVal, digit) && currentNumber >= digit) {
          availableActions.push(-digit);
        }
      }

      // Выбираем случайное действие из доступных
      if (availableActions.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableActions.length);
        return availableActions[randomIndex];
      }

      // Последний fallback: +1
      return 1;
    }

    // Для многозначных чисел - существующая логика
    // 🔥 ИСПРАВЛЕНО: НЕ учитываем флаги onlyAddition/onlySubtraction для Simple действий
    // Пробуем сгенерировать корректное простое действие
    for (let attempt = 0; attempt < 100; attempt++) {
      // Генерируем случайное число
      const value = 1 + Math.floor(Math.random() * maxValue);

      // 🔥 ИСПРАВЛЕНО: Определяем направление случайно, БЕЗ учета флагов
      // Флаги применяются ТОЛЬКО к Friends действиям
      const isAddition = Math.random() < 0.5;

      const action = isAddition ? value : -value;

      // Проверяем что не уйдем в минус
      if (!isAddition && currentNumber < value) {
        continue;
      }

      // Проверяем что каждый разряд можно изменить простым способом
      const actionDigits = this._numberToDigits(value, this.config.digitCount);
      let isValid = true;

      for (let pos = 0; pos < this.config.digitCount; pos++) {
        const currentVal = states[pos] || 0;
        const digit = actionDigits[pos] || 0;

        if (digit === 0) continue;  // Нет изменений в этом разряде

        if (isAddition) {
          if (!this._canPlusDirect(currentVal, digit)) {
            isValid = false;
            break;
          }
        } else {
          if (!this._canMinusDirect(currentVal, digit)) {
            isValid = false;
            break;
          }
        }
      }

      if (isValid) {
        // this._log(`🔍 Сгенерировано простое действие: ${action >= 0 ? '+' : ''}${action}`);
        return action;
      }
    }

    // 🔥 ИСПРАВЛЕНО: Fallback без учета флагов
    // Сложение (всегда доступно для Simple)
    for (let digit = 1; digit <= 9; digit++) {
      if (this._canPlusDirect(states[0] || 0, digit)) {
        // this._log(`🔍 Fallback: простое действие +${digit}`);
        return digit;
      }
    }

    // Вычитание (всегда доступно для Simple)
    for (let digit = 1; digit <= 9; digit++) {
      if (this._canMinusDirect(states[0] || 0, digit) && currentNumber >= digit) {
        // this._log(`🔍 Fallback: простое действие -${digit}`);
        return -digit;
      }
    }

    // Совсем последний fallback: +1
    // this._log(`🔍 Последний fallback: +1`);
    return 1;
  }

  // ========== ПРИМЕНЕНИЕ ДЕЙСТВИЙ ==========

  _applySimpleAction(states, action) {
    const newStates = [...states];
    const value = Math.abs(action);
    const isAddition = action >= 0;

    // КРИТИЧНО: Используем stateDigitCount вместо digitCount
    // Потому что первое действие может быть больше digitCount
    // (например, +68 для digitCount=1 в режиме onlySubtraction)
    const actionDigits = this._numberToDigits(value, this.stateDigitCount);

    for (let pos = 0; pos < actionDigits.length; pos++) {
      const digit = actionDigits[pos] || 0;
      if (isAddition) {
        newStates[pos] = (newStates[pos] || 0) + digit;
      } else {
        newStates[pos] = (newStates[pos] || 0) - digit;
      }
    }

    // Нормализуем переносы
    return this._normalizeState(newStates);
  }

  _applyFriendAction(states, action) {
    const newStates = [...states];
    const value = action.value;
    const isAddition = action.isAddition;
    const friendDigit = action.friendDigit;
    const friend = 10 - friendDigit;

    // Применяем формулу Friends к целевому разряду
    if (isAddition) {
      // +n = +10 - friend
      newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) + 1;  // +10
      newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) - friend;      // -friend
    } else {
      // -n = -10 + friend
      newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) - 1;  // -10
      newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) + friend;      // +friend
    }

    // Применяем остальные разряды (Simple)
    // КРИТИЧНО: Используем stateDigitCount для правильной обработки всех разрядов
    const actionDigits = this._numberToDigits(Math.abs(value), this.stateDigitCount);
    for (let pos = 0; pos < this.stateDigitCount; pos++) {
      if (pos === this.targetPosition) continue;  // Целевой разряд уже обработан по правилу Friends
      if (pos === this.targetPosition + 1) continue;  // Этот разряд тоже обработан (+10 или -10)

      const digit = actionDigits[pos] || 0;
      if (isAddition) {
        newStates[pos] = (newStates[pos] || 0) + digit;
      } else {
        newStates[pos] = (newStates[pos] || 0) - digit;
      }
    }

    // Нормализуем переносы
    return this._normalizeState(newStates);
  }

  // ========== МИНИМАЛЬНЫЙ ПРИМЕР ==========

  _generateMinimalExample() {
    this._warn("⚠️ Генерируем минимальный пример");

    const steps = [];
    let states = Array(this.stateDigitCount).fill(0);

    // Первое действие: учитываем режим и digitCount
    let action;
    if (this.directionConfig.needsBigFirstAction()) {
      // Для onlySubtraction - используем ту же логику что и в _generateFirstAction
      const minValue = Math.pow(10, this.config.digitCount);
      const maxValue = Math.pow(10, this.stateDigitCount) - 1;
      action = minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
    } else {
      // Для обычного режима - генерируем действие в пределах digitCount
      const maxValue = Math.pow(10, this.config.digitCount) - 1;
      const minValue = Math.pow(10, this.config.digitCount - 1);
      action = minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
    }

    let newStates = this._applySimpleAction(states, action);
    if (!newStates) {
      // Fallback: если не получилось, берем простое действие
      action = this.config.digitCount === 1 ? 5 : 15;
      newStates = this._applySimpleAction(states, action);
    }
    steps.push({ action, isFriend: false, states: [...newStates] });
    states = newStates;

    // Второе действие: Friends (только если разрешено вычитание)
    if (this.directionConfig.canSubtraction() && (states[this.targetPosition + 1] || 0) >= 1) {
      const friendDigit = 1;
      const friend = 9;
      newStates = [...states];
      newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) - 1;
      newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) + friend;
      steps.push({
        action: -friendDigit,
        isFriend: true,
        friendN: friendDigit,
        formula: this._buildFormula(-friendDigit, this.targetPosition),
        states: [...newStates]
      });
      states = newStates;
    } else if (this.directionConfig.canAddition() && (states[this.targetPosition] || 0) === 9) {
      // Попытка Friends сложения
      const friendDigit = 1;
      const friend = 9;
      newStates = [...states];
      newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) + 1;
      newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) - friend;
      steps.push({
        action: friendDigit,
        isFriend: true,
        friendN: friendDigit,
        formula: this._buildFormula(friendDigit, this.targetPosition),
        states: [...newStates]
      });
      states = newStates;
    }

    // Остальные: простые действия
    while (steps.length < this.config.stepsCount) {
      // Генерируем простое действие в пределах digitCount
      const maxActionValue = Math.pow(10, this.config.digitCount) - 1;
      const simpleAction = 1 + Math.floor(Math.random() * Math.min(9, maxActionValue));
      const isAddition = Math.random() < 0.5;
      action = isAddition ? simpleAction : -simpleAction;

      // Проверяем, не уйдем ли в минус
      const currentNumber = this.stateToNumber(states.slice(0, this.config.digitCount));
      if (!isAddition && currentNumber < simpleAction) {
        action = simpleAction; // Меняем на сложение
      }

      newStates = this._applySimpleAction(states, action);
      if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
        steps.push({ action, isFriend: false, states: [...newStates] });
        states = newStates;
      } else {
        // Fallback: просто +1
        newStates = this._applySimpleAction(states, 1);
        if (newStates && this._isValidState(newStates)) {
          steps.push({ action: 1, isFriend: false, states: [...newStates] });
          states = newStates;
        } else {
          break;
        }
      }
    }

    return {
      start: Array(this.stateDigitCount).fill(0),
      steps,
      answer: [...states]
    };
  }

  // ========== ФОРМАТИРОВАНИЕ ==========

  toTrainerFormat(example) {
    if (!example || !example.steps) {
      throw new Error("Невалидный пример для форматирования");
    }

    const formattedSteps = [];

    for (const step of example.steps) {
      if (step.isFriend) {
        const value = step.action;
        const sign = value >= 0 ? '+' : '';
        formattedSteps.push({
          step: `${sign}${value}`,
          isFriend: true,
          friendN: step.friendN,
          formula: step.formula
        });
      } else {
        const value = step.action;
        const sign = value >= 0 ? '+' : '';
        formattedSteps.push(`${sign}${value}`);
      }
    }

    return {
      start: 0,
      steps: formattedSteps,
      answer: this.stateToNumber(example.answer)
    };
  }
}
