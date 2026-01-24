// ext/core/MultiDigitGenerator.js - Генератор многозначных примеров
//
// Поддерживает:
// - UnifiedSimpleRule (Просто)
// - BrothersRule (Братья - через 5)
//
// Примечание: FriendsRule (Друзья) теперь использует специализированный
// FriendsExampleGenerator вместо MultiDigitGenerator

/**
 * MultiDigitGenerator - класс-обёртка для генерации многозначных примеров.
 *
 * КЛЮЧЕВЫЕ ОСОБЕННОСТИ:
 * 1. Каждый разряд живёт по правилам базового правила (физика абакуса)
 * 2. Использует ВЫБРАННЫЕ в настройках цифры (selectedDigits из config)
 * 3. Поддержка переменной разрядности (+389-27+164)
 *
 * ОГРАНИЧЕНИЯ:
 *   - Круглые числа (+10, +20...): вероятность 15%, макс 1 на пример
 *   - Ответы могут быть любой разрядности, но не превышают выбранную
 */

export class MultiDigitGenerator {
  constructor(RuleClass, maxDigitCount, config = {}) {
    this.baseRule = new RuleClass(config);

    // Определяем тип правила (Friends теперь обрабатывается отдельно)
    this.isBrothersRule = RuleClass.name === 'BrothersRule' || this.baseRule.name === 'Братья';
    this.isSimpleRule = RuleClass.name === 'UnifiedSimpleRule' ||
                        this.baseRule.name === 'Просто' ||
                        !this.isBrothersRule;

    // Количество разрядов
    this.displayDigitCount = Math.max(1, Math.min(9, maxDigitCount));
    this.maxDigitCount = this.displayDigitCount + 1; // +1 для переноса

    this.config = {
      ...config,
      maxDigitCount: this.maxDigitCount,
      variableDigitCounts: config.variableDigitCounts || false,
      duplicateDigitProbability: 0.1,
      maxZeroDigits: 1,
      roundNumberProbability: 0.15,
      maxRoundNumbersPerExample: 1,
      _duplicatesUsed: 0,
      _zeroDigitsUsed: 0,
      _roundNumbersUsed: 0
    };

    this._log(`📊 Разрядность: пример=${this.displayDigitCount}, абакус=${this.maxDigitCount}`);

    const ruleType = this.isBrothersRule ? 'Brothers' : 'Simple';
    this.name = `${this.baseRule.name} (Multi-Digit ${this.displayDigitCount}, ${ruleType})`;

    const selectedDigits = this.baseRule.config?.selectedDigits || [];

    this._log(`🔢 MultiDigitGenerator создан:
  Базовое правило: ${this.baseRule.name}
  Тип: ${ruleType}
  Разрядность примера: ${this.displayDigitCount}
  Выбранные цифры: [${selectedDigits.join(', ')}]
  isBrothers: ${this.isBrothersRule}, isSimple: ${this.isSimpleRule}`);

    this._log(`🔧 MultiDigitGenerator config:`, {
      mirrorMode: this.config.mirrorMode,
      roundMode: this.config.roundMode,
      dictationMode: this.config.dictationMode
    });
  }

  // Утилиты для логирования с учетом флага silent
  _log(...args) {
    if (!this.config.silent) {
      console.log(...args);
    }
  }

  _warn(...args) {
    if (!this.config.silent) {
      console.warn(...args);
    }
  }

  _error(...args) {
    console.error(...args);
  }

  generateStartState() {
    return Array(this.maxDigitCount).fill(0);
  }

  generateStepsCount() {
    return this.baseRule.generateStepsCount();
  }

  generateExample() {
    // MultiDigitGenerator теперь используется только для Brothers и Simple
    // Friends обрабатывается отдельным FriendsExampleGenerator
    return this._generateStandardExample();
  }


  /**
   * Проверка валидности состояния
   */
  _isValidState(states) {
    for (let i = 0; i < states.length; i++) {
      if (states[i] < 0 || states[i] > 9) {
        return false;
      }
    }
    return true;
  }


  // ========== СТАНДАРТНАЯ ГЕНЕРАЦИЯ (Просто, Братья) ==========
  
  _generateStandardExample() {
    const states = this.generateStartState();
    const stepsCount = this.generateStepsCount();
    const steps = [];

    this._log(`🎯 Генерация стандартного примера: ${stepsCount} шагов`);
    
    this.config._duplicatesUsed = 0;
    this.config._zeroDigitsUsed = 0;
    this.config._roundNumbersUsed = 0;
    
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (steps.length < stepsCount && attempts < maxAttempts) {
      attempts++;
      const isFirst = steps.length === 0;
      
      const result = this._generateMultiDigitAction(states, isFirst, steps);
      
      if (!result) continue;
      
      const newStates = [...states];
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        newStates[pos] += (result.digits[pos] || 0);
      }
      
      let allValid = true;
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        if (newStates[pos] < 0 || newStates[pos] > 9) {
          allValid = false;
          break;
        }
      }
      
      if (!allValid) continue;
      
      // 🔴 КРИТИЧНО: Проверка переполнения разрядности!
      // Для Братьев тоже возможен перенос в следующий разряд
      if (this._checkOverflow(newStates)) {
        this._log(`  ⚠️ Переполнение разрядности! Пропускаем шаг.`);
        continue;
      }
      
      steps.push({
        action: result.sign * result.value,
        states: [...newStates],
        digits: result.digits
      });
      
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        states[pos] = newStates[pos];
      }

      this._log(`  ✅ Шаг ${steps.length}: ${result.sign > 0 ? '+' : ''}${result.value}`);
    }
    
    return {
      start: this.generateStartState(),
      steps,
      answer: [...states]
    };
  }

  _generateMultiDigitAction(states, isFirst, previousSteps) {
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const digitCount = this._chooseDigitCount(isFirst);
      const result = this._generateDigits(states, digitCount, isFirst, previousSteps);

      if (!result) continue;

      if (this._validateMultiDigitAction(result, states, isFirst)) {
        return result;
      }
    }

    return null;
  }

  /**
   * 🪞 Генерация зеркального числа (все разряды одинаковые)
   * Например: 11, 22, 33, 111, 222, и т.д.
   */
  _generateMirrorNumber(actionsPerPosition, states, isFirst) {
    this._log(`🪞 _generateMirrorNumber: вход`);
    this._log(`   actionsPerPosition:`, actionsPerPosition);
    this._log(`   states:`, states);
    this._log(`   displayDigitCount:`, this.displayDigitCount);

    // Берем действия для первого разряда как базу
    const firstPositionActions = actionsPerPosition[0];
    if (!firstPositionActions || firstPositionActions.length === 0) {
      this._warn(`⚠️ Нет действий для первого разряда`);
      return null;
    }

    this._log(`   firstPositionActions:`, firstPositionActions);

    // Проверяем, какие действия возможны для ВСЕХ разрядов
    const commonActions = firstPositionActions.filter(action => {
      // Проверяем, что это действие доступно для всех разрядов
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        const posActions = actionsPerPosition[pos];
        if (!posActions || !posActions.includes(action)) {
          return false;
        }
        // Также проверяем, что результат будет в границах 0-9
        const newState = states[pos] + action;
        if (newState < 0 || newState > 9) {
          return false;
        }
      }
      return true;
    });

    this._log(`   commonActions (доступны для всех разрядов):`, commonActions);

    if (commonActions.length === 0) {
      this._warn(`⚠️ Нет общих действий для всех разрядов`);
      return null;
    }

    // Выбираем случайное действие из общих
    const chosenAction = commonActions[Math.floor(Math.random() * commonActions.length)];

    // Создаем зеркальное число: все разряды = chosenAction
    const digits = Array(this.maxDigitCount).fill(0);
    for (let pos = 0; pos < this.displayDigitCount; pos++) {
      digits[pos] = chosenAction;
    }

    // Вычисляем значение
    let value = 0;
    for (let pos = 0; pos < this.displayDigitCount; pos++) {
      value += Math.abs(chosenAction) * Math.pow(10, pos);
    }

    const sign = Math.sign(chosenAction);

    this._log(`🪞 Зеркальное число: ${sign > 0 ? '+' : ''}${value} (все разряды: ${chosenAction})`);

    return { value, sign, digits, digitCount: this.displayDigitCount };
  }

  /**
   * 🔵 Генерация круглого числа (только старший разряд ненулевой)
   * Например: 10, 20, 30, 100, 200, и т.д.
   */
  _generateRoundNumber(actionsPerPosition, states, isFirst) {
    this._log(`🔵 _generateRoundNumber: вход`);
    this._log(`   actionsPerPosition:`, actionsPerPosition);
    this._log(`   states:`, states);
    this._log(`   displayDigitCount:`, this.displayDigitCount);

    // Старший разряд = последний в массиве (позиция displayDigitCount - 1)
    const highestPos = this.displayDigitCount - 1;
    const highestActions = actionsPerPosition[highestPos];

    this._log(`   highestPos:`, highestPos);
    this._log(`   highestActions:`, highestActions);

    if (!highestActions || highestActions.length === 0) {
      this._warn(`⚠️ Нет действий для старшего разряда`);
      return null;
    }

    // Фильтруем действия, которые дадут валидное состояние
    const validActions = highestActions.filter(action => {
      const newState = states[highestPos] + action;
      return newState >= 0 && newState <= 9 && action !== 0;
    });

    this._log(`   validActions:`, validActions);

    if (validActions.length === 0) {
      this._warn(`⚠️ Нет валидных действий для старшего разряда`);
      return null;
    }

    // Выбираем случайное действие
    const chosenAction = validActions[Math.floor(Math.random() * validActions.length)];

    // Создаем круглое число: только старший разряд ненулевой
    const digits = Array(this.maxDigitCount).fill(0);
    digits[highestPos] = chosenAction;

    // Вычисляем значение (например, для 2 разрядов: 3 * 10^1 = 30)
    const value = Math.abs(chosenAction) * Math.pow(10, highestPos);
    const sign = Math.sign(chosenAction);

    this._log(`🔵 Круглое число: ${sign > 0 ? '+' : ''}${value} (старший разряд: ${chosenAction})`);

    return { value, sign, digits, digitCount: this.displayDigitCount };
  }

  _chooseDigitCount(isFirst) {
    if (isFirst || !this.config.variableDigitCounts) {
      return this.displayDigitCount;
    }
    
    const minDigits = Math.max(1, this.displayDigitCount - 1);
    const maxDigits = this.displayDigitCount;
    
    if (minDigits === maxDigits) return maxDigits;
    
    return Math.random() < 0.7 ? maxDigits : minDigits;
  }

  _generateDigits(states, digitCount, isFirst, previousSteps) {
    // 🪞 Проверяем режимы зеркала и круглых чисел
    const mirrorMode = this.config.mirrorMode === true;
    const roundMode = this.config.roundMode === true;

    this._log(`🔍 _generateDigits: mirrorMode=${mirrorMode}, roundMode=${roundMode}, displayDigitCount=${this.displayDigitCount}`);
    this._log(`🔍 config:`, this.config);

    const allowDuplicates = Math.random() < this.config.duplicateDigitProbability;

    const actionsPerPosition = [];
    
    for (let pos = 0; pos < this.displayDigitCount; pos++) {
      const currentState = states[pos];
      const isFirstForDigit = (currentState === 0);
      
      let availableActions;
      
      // Разные правила имеют разные сигнатуры getAvailableActions
      try {
        if (this.isBrothersRule) {
          // BrothersRule: (currentState, isFirst, previousSteps)
          availableActions = this.baseRule.getAvailableActions(currentState, isFirstForDigit, previousSteps);
        } else {
          // UnifiedSimpleRule: (currentState, isFirst) или (currentState, isFirst, previousSteps)
          availableActions = this.baseRule.getAvailableActions(currentState, isFirstForDigit, previousSteps);
        }
      } catch (e) {
        // Fallback на простой вызов
        availableActions = this.baseRule.getAvailableActions(currentState, isFirstForDigit);
      }
      
      if (!availableActions || availableActions.length === 0) {
        actionsPerPosition[pos] = [];
        continue;
      }
      
      const actions = [];
      for (const action of availableActions) {
        const value = this._getActionValue(action);
        if (value !== 0) actions.push(value);
      }
      
      actionsPerPosition[pos] = actions;
    }
    
    const hasAnyActions = actionsPerPosition.some(arr => arr.length > 0);
    if (!hasAnyActions) return null;

    // 🪞 ЗЕРКАЛЬНЫЙ РЕЖИМ: все разряды должны иметь одинаковые действия
    if (mirrorMode && this.displayDigitCount >= 2) {
      this._log(`🪞 Вызываем _generateMirrorNumber`);
      const mirrorResult = this._generateMirrorNumber(actionsPerPosition, states, isFirst);
      this._log(`🪞 Результат _generateMirrorNumber:`, mirrorResult);
      if (mirrorResult) return mirrorResult;
      this._warn(`⚠️ _generateMirrorNumber вернул null, переходим к обычной генерации`);
    }

    // 🔵 КРУГЛЫЕ ЧИСЛА: только старший разряд ненулевой
    if (roundMode && this.displayDigitCount >= 2) {
      this._log(`🔵 Вызываем _generateRoundNumber`);
      const roundResult = this._generateRoundNumber(actionsPerPosition, states, isFirst);
      this._log(`🔵 Результат _generateRoundNumber:`, roundResult);
      if (roundResult) return roundResult;
      this._warn(`⚠️ _generateRoundNumber вернул null, переходим к обычной генерации`);
    }

    // Знаки
    const possibleSigns = new Set();
    for (const actions of actionsPerPosition) {
      for (const action of actions) {
        if (action > 0) possibleSigns.add(1);
        if (action < 0) possibleSigns.add(-1);
      }
    }
    
    if (possibleSigns.size === 0) return null;
    
    const signs = Array.from(possibleSigns);
    for (let i = signs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [signs[i], signs[j]] = [signs[j], signs[i]];
    }
    
    for (const targetSign of signs) {
      const digits = Array(this.maxDigitCount).fill(0);
      const usedDigits = new Set();
      let success = true;
      
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        const actions = actionsPerPosition[pos];
        if (!actions || actions.length === 0) continue;
        
        let filtered = actions.filter(a => Math.sign(a) === targetSign);
        
        if (isFirst && pos === this.displayDigitCount - 1 && filtered.length === 0 && targetSign < 0) {
          success = false;
          break;
        }
        
        if (filtered.length === 0) continue;
        
        if (!allowDuplicates) {
          const unique = filtered.filter(a => !usedDigits.has(Math.abs(a)));
          if (unique.length > 0) filtered = unique;
        }
        
        const chosen = filtered[Math.floor(Math.random() * filtered.length)];
        digits[pos] = chosen;
        usedDigits.add(Math.abs(chosen));
      }
      
      if (!success) continue;
      
      const hasNonZero = digits.some(d => d !== 0);
      if (!hasNonZero) continue;
      
      if (digits[digitCount - 1] === 0) continue;
      
      let value = 0;
      let finalSign = 0;
      
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        const d = digits[pos];
        if (d !== 0) {
          value += Math.abs(d) * Math.pow(10, pos);
          if (finalSign === 0) finalSign = Math.sign(d);
        }
      }
      
      return { value, sign: finalSign, digits, digitCount };
    }
    
    return null;
  }

  _validateMultiDigitAction(result, states, isFirst) {
    const { digits, value } = result;
    
    if (value === 0) return false;
    
    // Круглые числа
    if (this._isRoundNumber(value)) {
      if (this.config._roundNumbersUsed >= this.config.maxRoundNumbersPerExample) {
        return false;
      }
      if (Math.random() > this.config.roundNumberProbability) {
        return false;
      }
      this.config._roundNumbersUsed++;
    }
    
    // Валидность состояний
    for (let pos = 0; pos < this.displayDigitCount; pos++) {
      const newState = states[pos] + digits[pos];
      if (newState < 0 || newState > 9) {
        return false;
      }
    }
    
    return true;
  }

  _isRoundNumber(value) {
    const absValue = Math.abs(value);
    return absValue >= 10 && absValue % 10 === 0;
  }

  /**
   * Проверка переполнения разрядности.
   * Для 2-значных чисел результат должен быть 0-99, не 357!
   * По ТЗ: "Результат не выходит за пределы выбранной разрядности"
   */
  _checkOverflow(states) {
    // Проверяем, что все разряды ВЫШЕ displayDigitCount равны 0
    for (let i = this.displayDigitCount; i < this.maxDigitCount; i++) {
      if (states[i] !== 0) {
        return true; // Есть переполнение!
      }
    }
    return false; // Нет переполнения
  }

  /**
   * Получить полное числовое значение состояния (включая перенос).
   * Используется для отладки и проверки.
   */
  _getFullValue(states) {
    let result = 0;
    for (let i = 0; i < this.maxDigitCount && i < states.length; i++) {
      result += states[i] * Math.pow(10, i);
    }
    return result;
  }

  _getActionValue(action) {
    if (typeof action === 'object' && action !== null) {
      return action.value !== undefined ? action.value : 0;
    }
    return action;
  }

  // ========== ОБЩИЕ МЕТОДЫ ==========

  applyAction(state, action) {
    if (typeof action === 'object' && action.digits) {
      const newState = [...state];
      
      for (let pos = 0; pos < this.displayDigitCount; pos++) {
        const digit = action.digits[pos];
        if (!digit) continue;
        
        if (typeof digit === 'object' && digit.isFriend && digit.formula) {
          for (const part of digit.formula) {
            if (Math.abs(part.val) === 10) {
              const carryValue = part.op === '+' ? 1 : -1;
              const nextPos = pos + 1;
              if (nextPos < this.maxDigitCount) {
                newState[nextPos] += carryValue;
              }
            } else {
              const digitValue = part.op === '+' ? part.val : -part.val;
              newState[pos] += digitValue;
            }
          }
        } else if (typeof digit === 'object') {
          newState[pos] += (digit.value || 0);
        } else {
          newState[pos] += digit;
        }
      }
      
      return newState;
    }
    
    const actionValue = typeof action === 'object' ? action.action : action;
    const absValue = Math.abs(actionValue);
    const sign = Math.sign(actionValue);
    const digits = this._numberToDigits(absValue);
    
    const newState = [...state];
    for (let pos = 0; pos < this.maxDigitCount; pos++) {
      newState[pos] += sign * (digits[pos] || 0);
    }
    return newState;
  }

  _numberToDigits(num) {
    const digits = [];
    let n = Math.abs(num);
    
    for (let i = 0; i < this.maxDigitCount; i++) {
      digits.push(n % 10);
      n = Math.floor(n / 10);
    }
    
    return digits;
  }

  stateToNumber(state) {
    if (!Array.isArray(state)) return 0;
    
    let result = 0;
    for (let i = 0; i < this.displayDigitCount && i < state.length; i++) {
      result += state[i] * Math.pow(10, i);
    }
    
    return result;
  }

  isValidState(state) {
    if (!Array.isArray(state)) return false;
    return state.every(digit => digit >= 0 && digit <= 9);
  }

  formatAction(action) {
    const value = typeof action === 'object' ? action.value : action;
    return value >= 0 ? `+${value}` : `${value}`;
  }

  validateExample(example) {
    const { start, steps, answer } = example;

    if (!Array.isArray(start) || start.some(s => s !== 0)) {
      this._error('❌ MultiDigit: стартовое состояние должно быть [0,0,...]');
      return false;
    }

    let currentStates = [...start];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (i === 0 && step.action < 0) {
        this._error('❌ MultiDigit: первый шаг должен быть положительным');
        return false;
      }

      currentStates = this.applyAction(currentStates, step);

      if (!this.isValidState(currentStates)) {
        this._error(`❌ MultiDigit: шаг ${i + 1} невалиден`);
        return false;
      }

      // Проверка переполнения разрядности
      if (this._checkOverflow(currentStates)) {
        this._error(`❌ MultiDigit: шаг ${i + 1} - переполнение разрядности!`);
        return false;
      }
    }
    
    const finalNumber = this.stateToNumber(currentStates);
    const answerNumber = this.stateToNumber(answer);

    if (finalNumber !== answerNumber) {
      this._error(`❌ MultiDigit: финал ${finalNumber} ≠ ответ ${answerNumber}`);
      return false;
    }

    this._log(`✅ MultiDigit: пример валиден`);
    return true;
  }
}
