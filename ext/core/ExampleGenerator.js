// ext/core/ExampleGenerator.js - Генератор примеров на основе правил
//
// Поддерживает:
// - UnifiedSimpleRule (Просто)
// - BrothersRule (Братья - через 5)
// - FriendsRule (Друзья - через 10)
// - MultiDigitGenerator (многозначные числа)

export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    this._log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  // Утилиты для логирования с учетом флага silent
  _log(...args) {
    if (!this.rule.config?.silent) {
      console.log(...args);
    }
  }

  _warn(...args) {
    if (!this.rule.config?.silent) {
      console.warn(...args);
    }
  }

  _error(...args) {
    console.error(...args);
  }

  /**
   * Сгенерировать один пример.
   *  - если digitCount === 1 → одноразрядная логика (_generateSingleDigitAttempt)
   *  - если digitCount > 1 и правило НЕ MultiDigitGenerator → векторная логика
   *  - если правило MultiDigitGenerator → используем его метод напрямую
   */
  generate() {
    const ruleName = this.rule.constructor.name;
    const isMultiDigit = ruleName === 'MultiDigitGenerator';
    
    // Если правило - это MultiDigitGenerator, он сам генерирует пример
    if (isMultiDigit) {
      this._log('🔢 ExampleGenerator: используем MultiDigitGenerator');
      return this.rule.generateExample();
    }

    // Иначе используем старую логику
    const digitCount = this.rule.config?.digitCount || 1;
    const combineLevels = this.rule.config?.combineLevels || false;

    // Сколько попыток даём генератору, чтобы подобрать валидную цепочку
    let maxAttempts = digitCount === 1 ? 100 : (digitCount <= 3 ? 200 : 250);

    if (!combineLevels && digitCount > 1) {
      maxAttempts *= 2;
    }

    this._log(
      `🎯 Генерация примера: digitCount=${digitCount}, combineLevels=${combineLevels}, попыток=${maxAttempts}`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let example;

        if (digitCount === 1) {
          example = this._generateSingleDigitAttempt();
        } else {
          example = this._generateMultiDigitAttemptVectorBased();
        }

        // Если получили цепочку длиннее лимита maxSteps — обрежем и пересчитаем ответ
        const maxStepsAllowed =
          this.rule.config?.maxSteps ??
          this.rule.config?.actionsCount?.max ??
          6;

        if (example.steps.length > maxStepsAllowed) {
          example.steps = example.steps.slice(0, maxStepsAllowed);
          example.answer = example.steps.reduce(
            (state, step) => this.rule.applyAction(state, step.action),
            example.start
          );
        }

        // Валидация минимальной длины
        const minStepsRequired =
          this.rule.config?.minSteps ??
          this.rule.config?.actionsCount?.min ??
          2;

        if (example.steps.length < minStepsRequired) {
          if (attempt % 30 === 0) {
            this._warn(
              `⚠️ Попытка ${attempt}: слишком короткая цепочка (${example.steps.length} < ${minStepsRequired})`
            );
          }
          continue;
        }

        // Проверка промежуточных состояний
        if (!this._validateIntermediateStates(example)) {
          if (attempt % 30 === 0) {
            this._warn(`⚠️ Попытка ${attempt}: невалидное промежуточное состояние`);
          }
          continue;
        }

        // Проверяем валидацию правила (например, для BrothersRule - наличие братских шагов)
        if (!this.validate(example)) {
          if (attempt % 30 === 0) {
            this._warn(`⚠️ Попытка ${attempt}: пример не прошёл валидацию правила`);
          }
          continue;
        }

        this._log(
          `✅ Пример сгенерирован за ${attempt} попыток: ${this.formatForDisplay(example)}`
        );
        return example;
      } catch (e) {
        if (attempt % 30 === 0) {
          this._warn(`⚠️ Попытка ${attempt} упала с ошибкой:`, e.message);
        }
      }
    }

    // Если не смогли сгенерировать — даём минимальный fallback
    this._error(
      `❌ Не удалось сгенерировать пример за ${maxAttempts} попыток. Возвращаем fallback.`
    );
    return this._fallbackExample();
  }

  /**
   * Генерация одноразрядного примера (digitCount === 1).
   */
  _generateSingleDigitAttempt() {
    const start = this.rule.generateStartState();
    const stepsCount = this.rule.generateStepsCount();

    const steps = [];
    let currentState = start;

    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = i === 0;
      const availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction,
        0, // position для одноразрядного
        null, // fullState - не используется в одноразрядном режиме
        steps // previousSteps для предотвращения повторов
      );

      if (!availableActions || availableActions.length === 0) {
        // тупик → прерываем
        break;
      }

      const action =
        availableActions[Math.floor(Math.random() * availableActions.length)];
      const newState = this.rule.applyAction(currentState, action);

      steps.push({
        action,
        fromState: currentState,
        toState: newState
      });

      currentState = newState;
    }

    return {
      start,
      steps,
      answer: currentState
    };
  }

  /**
   * Генерация многоразрядного примера в векторном режиме.
   * (Сохраняется для обратной совместимости)
   */
  _generateMultiDigitAttemptVectorBased() {
    const digitCount = this.rule.config?.digitCount || 1;
    const combineLevels = this.rule.config?.combineLevels ?? false;

    const start = Array.isArray(this.rule.generateStartState())
      ? this.rule.generateStartState()
      : Array(digitCount).fill(0);

    const stepsCount = this.rule.generateStepsCount();
    const steps = [];
    let currentState = [...start];

    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = i === 0;

      // собираем допустимые шаги отдельно для каждого разряда
      const actionsPerDigit = [];
      for (let pos = 0; pos < digitCount; pos++) {
        const digitValue = currentState[pos];
        const acts = this.rule.getAvailableActions(
          digitValue,
          isFirstAction,
          pos,
          currentState,
          steps
        );
        actionsPerDigit.push(acts.length > 0 ? acts : [0]);
      }

      // Если combineLevels → генерим единый вектор
      // Если нет → только один разряд "двигается"
      let chosenVector;

      if (combineLevels) {
        // декартово произведение
        const combinations = this._cartesian(actionsPerDigit);
        if (combinations.length === 0) break;
        chosenVector = combinations[Math.floor(Math.random() * combinations.length)];
      } else {
        // выбираем один случайный разряд, остальные 0
        const validPositions = actionsPerDigit
          .map((arr, idx) => (arr.some(a => a !== 0) ? idx : -1))
          .filter(idx => idx >= 0);

        if (validPositions.length === 0) break;

        const chosenPos =
          validPositions[Math.floor(Math.random() * validPositions.length)];
        const nonZeroActions = actionsPerDigit[chosenPos].filter(a => a !== 0);

        if (nonZeroActions.length === 0) break;

        const chosenAction =
          nonZeroActions[Math.floor(Math.random() * nonZeroActions.length)];

        chosenVector = Array(digitCount).fill(0);
        chosenVector[chosenPos] = chosenAction;
      }

      // Применяем вектор
      const newState = currentState.map((v, idx) => v + chosenVector[idx]);

      // Проверяем границы 0..9
      if (newState.some(v => v < 0 || v > 9)) {
        // откат — не добавляем шаг
        continue;
      }

      // Собираем action как массив {position, value}
      const actionVector = chosenVector.map((val, pos) => ({ position: pos, value: val }));

      steps.push({
        action: actionVector,
        fromState: [...currentState],
        toState: [...newState]
      });

      currentState = newState;
    }

    return {
      start,
      steps,
      answer: currentState
    };
  }

  /**
   * Минимальный fallback-пример, если генерация не удалась.
   */
  _fallbackExample() {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) {
      return {
        start: 0,
        steps: [
          { action: 1, fromState: 0, toState: 1 },
          { action: 2, fromState: 1, toState: 3 }
        ],
        answer: 3
      };
    }
    // многоразрядный fallback
    const start = Array(digitCount).fill(0);
    return {
      start,
      steps: [
        {
          action: [{ position: 0, value: 1 }],
          fromState: [...start],
          toState: start.map((v, i) => (i === 0 ? 1 : v))
        }
      ],
      answer: start.map((v, i) => (i === 0 ? 1 : v))
    };
  }

  /**
   * Декартово произведение массивов.
   */
  _cartesian(arrays) {
    return arrays.reduce(
      (acc, curr) => {
        const res = [];
        for (const a of acc) {
          for (const b of curr) {
            res.push([...a, b]);
          }
        }
        return res;
      },
      [[]]
    );
  }

  /**
   * Проверка промежуточных состояний в многозначном режиме:
   * нельзя уходить <0 или >9 ни в одном разряде.
   */
  _validateIntermediateStates(example) {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) return true;

    for (let i = 0; i < example.steps.length; i++) {
      const stateArr = example.steps[i].toState;
      if (Array.isArray(stateArr)) {
        if (stateArr.some(d => d < 0 || d > 9)) {
          this._warn(
            `❌ Шаг ${i + 1}: состояние [${stateArr.join(
              ", "
            )}] содержит недопустимое значение`
          );
          return false;
        }
      }
    }

    const finalArr = example.answer;
    if (Array.isArray(finalArr)) {
      if (finalArr.some(d => d < 0 || d > 9)) {
        this._warn(
          `❌ Финал содержит недопустимую цифру [${finalArr.join(
            ", "
          )}]`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Формат для отладки в консоли.
   */
  formatForDisplay(example) {
    const { start, steps, answer } = example;

    const stepsStr = steps
      .map(step => this.rule.formatAction(step.action))
      .join(" ");

    const startNum = this.rule.stateToNumber(start);
    const answerNum = this.rule.stateToNumber(answer);

    if (startNum === 0) {
      return `${stepsStr} = ${answerNum}`;
    } else {
      return `${startNum} ${stepsStr} = ${answerNum}`;
    }
  }

  /**
   * Формат для trainer_logic.js:
   *  - steps => массив строк вида "+3", "-7", "+5"
   *            ИЛИ объектов:
   *            - { step: "+1", isBrother: true, brotherN: 4, formula: [...] }
   *            - { step: "+9", isFriend: true, friendN: 9, formula: [...] }
   *  - answer => конечное число
   *
   * В многозначном режиме склеиваем вектор действий в строку типа "+32".
   * Поддерживает как старый формат (vector), так и новый (MultiDigitGenerator).
   */
  toTrainerFormat(example) {
    const ruleName = this.rule.constructor.name;
    const isMultiDigit = ruleName === 'MultiDigitGenerator';
    
    // === МНОГОЗНАЧНЫЙ РЕЖИМ (MultiDigitGenerator) ===
    if (isMultiDigit) {
      this._log('🔢 toTrainerFormat: обработка MultiDigitGenerator');
      
      const formattedSteps = [];
      
      for (const step of example.steps) {
        // Формат от MultiDigitGenerator: { action: 21, states: [...], digits: [1, 2] }
        const value = step.action;
        // 🔥 ИСПРАВЛЕНИЕ: для отрицательных чисел используем минус
        const sign = value >= 0 ? '+' : '-';
        
        formattedSteps.push(`${sign}${Math.abs(value)}`);
      }
      
      const finalAnswer = this.rule.stateToNumber(example.answer);
      
      return {
        start: 0, // Всегда стартуем с 0
        steps: formattedSteps,
        answer: finalAnswer
      };
    }
    
    const digitCount = this.rule.config?.digitCount || 1;

    // === МНОГОЗНАЧНЫЙ КЕЙС (старый векторный формат) ===
    if (digitCount > 1 && Array.isArray(example.start)) {
      const formattedSteps = [];

      for (const step of example.steps) {
        const vector = Array.isArray(step.action)
          ? step.action
          : [step.action];

        // соберём значения по позициям
        const byPos = [];
        for (const part of vector) {
          byPos[part.position] = part.value;
        }

        // знак шага (предполагаем единый знак векторного шага)
        const signValue = byPos.find(v => v !== 0) || 0;
        const signStr = signValue >= 0 ? "+" : "-";

        // абсолютные значения от старшего к младшему
        const maxPos = byPos.length - 1;
        let magnitudeStr = "";
        for (let p = maxPos; p >= 0; p--) {
          const v = byPos[p] || 0;
          magnitudeStr += Math.abs(v).toString();
        }

        formattedSteps.push(`${signStr}${magnitudeStr}`);
      }

      const finalAnswer = this.rule.stateToNumber(example.answer);

      return {
        start: this.rule.stateToNumber(example.start),
        steps: formattedSteps,
        answer: finalAnswer
      };
    }

    // === ОДНОРАЗРЯДНЫЙ КЕЙС (с поддержкой братских и дружеских шагов) ===
    const formattedSteps = [];

    for (const step of example.steps) {
      const action = step.action;

      // 🔥 ПРОВЕРКА: это объект с формулой?
      if (typeof action === "object" && action !== null) {
        
        // === БРАТСКИЙ ШАГ (через 5) ===
        if (action.isBrother && action.formula) {
          const val = action.value;
          const signStr = val >= 0 ? "+" : "";

          formattedSteps.push({
            step: `${signStr}${val}`,        // для UI: "+1", "-2" и т.д.
            isBrother: true,
            brotherN: action.brotherN,       // какой брат (1,2,3,4)
            formula: action.formula          // [{op:"+",val:5},{op:"-",val:4}]
          });

          this._log(`👬 Братский шаг: ${signStr}${val} (брат ${action.brotherN})`);
          continue;
        }

        // === ДРУЖЕСКИЙ ШАГ (через 10) ===
        if (action.isFriend && action.formula) {
          const val = action.value;
          const signStr = val >= 0 ? "+" : "";

          formattedSteps.push({
            step: `${signStr}${val}`,        // для UI: "+9", "-8" и т.д.
            isFriend: true,
            friendN: action.friendN,         // какой друг (1-9)
            formula: action.formula          // [{op:"+",val:10},{op:"-",val:1}]
          });

          this._log(`🤝 Дружеский шаг: ${signStr}${val} (друг ${action.friendN})`);
          continue;
        }

        // Обычный объект {position, value} из многоразрядного режима
        if (action.value !== undefined) {
          const v = action.value;
          formattedSteps.push(v >= 0 ? `+${v}` : `${v}`);
          continue;
        }
      }

      // Обычный числовой шаг (Просто)
      const val = typeof action === "number" ? action : parseInt(action, 10);
      if (!isNaN(val)) {
        formattedSteps.push(val >= 0 ? `+${val}` : `${val}`);
      }
    }

    return {
      start: this.rule.stateToNumber(example.start),
      steps: formattedSteps,
      answer: this.rule.stateToNumber(example.answer)
    };
  }

  /**
   * Делегируем правилам финальную валидацию.
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true;
  }

  /**
   * Сгенерировать несколько примеров подряд.
   */
  generateMultiple(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(this.generate());
    }
    return out;
  }
}
