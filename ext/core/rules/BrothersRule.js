// ext/core/rules/BrothersRule.js - Правило "Братья" с поддержкой простых шагов

import { BaseRule } from "./BaseRule.js";

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 🔥 Устанавливаем имя напрямую
    this.name = "Братья";

    // Какие "братья" тренируем: [1,2,3,4]
    const brothersDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [4]; // по умолчанию только 4

    // Какие цифры разрешены в блоке "Просто" для вспомогательных шагов
    const simpleBlockDigits = config.blocks?.simple?.digits
      ? config.blocks.simple.digits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9)
      : [1, 2, 3, 4, 5]; // по умолчанию 1-5

    // 🔥 АДАПТИВНЫЙ ПРИОРИТЕТ: чем меньше выбрано цифр, тем выше приоритет
    // Это компенсирует меньшее количество возможных братских переходов
    let brotherPriority;
    if (brothersDigits.length === 1) {
      brotherPriority = 0.75;  // 75% для 1 цифры
    } else if (brothersDigits.length === 2) {
      brotherPriority = 0.70;  // 70% для 2 цифр
    } else if (brothersDigits.length === 3) {
      brotherPriority = 0.65;  // 65% для 3 цифр
    } else {
      brotherPriority = 0.60;  // 60% для 4 цифр
    }

    this.config = {
      ...this.config,
      name: "Братья",
      minState: 0,
      maxState: 9,
      minSteps: config.minSteps ?? 3,
      maxSteps: config.maxSteps ?? 7,
      brothersDigits,
      simpleBlockDigits,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,
      brotherPriority,  // Адаптивный приоритет братским шагам
      blocks: config.blocks ?? {},
      silent: config.silent || false  // Флаг тихого режима
    };

    this._log(
      `👬 BrothersRule: братья=[${brothersDigits.join(", ")}], ` +
      `простые=[${simpleBlockDigits.join(", ")}], ` +
      `onlyAdd=${this.config.onlyAddition}, onlySub=${this.config.onlySubtraction}`
    );

    // Таблица "братских" пар для быстрой проверки
    this.brotherPairs = this._buildBrotherPairs(brothersDigits);
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

  /**
   * Создание таблицы обменных пар
   * Для каждого выбранного "брата N" создаем возможные переходы через 5
   *
   * 🧮 ФИЗИКА АБАКУСА:
   * Братское действие применяется ТОЛЬКО когда прямое действие НЕВОЗМОЖНО!
   * - Верхняя бусина (U): 0 или 1 (значение 5)
   * - Нижние бусины (L): 0-4 (максимум 4)
   * - Состояние: S = U×5 + L
   */
  _buildBrotherPairs(digits) {
    const pairs = new Set();

    for (const n of digits) {
      const brother = 5 - n; // брат для n

      // Переходы "вверх": v → v+n через +5-brother
      for (let v = 0; v <= 9; v++) {
        const vNext = v + n;
        if (vNext >= 0 && vNext <= 9) {
          // Проверяем физическую возможность через 5
          const U = v >= 5 ? 1 : 0;
          const L = v >= 5 ? v - 5 : v;

          // ✅ ИСПРАВЛЕНО: +n через +5-brother возможно ТОЛЬКО если:
          // - верхняя бусина неактивна (U=0)
          // - прямое добавление НЕВОЗМОЖНО: L + n > 4 (нижние переполнятся)
          if (U === 0 && L + n > 4) {
            pairs.add(`${v}-${vNext}-brother${n}`);
          }
        }
      }

      // Переходы "вниз": v → v-n через -5+brother
      for (let v = 0; v <= 9; v++) {
        const vNext = v - n;
        if (vNext >= 0 && vNext <= 9) {
          const U = v >= 5 ? 1 : 0;
          const L = v >= 5 ? v - 5 : v;

          // ✅ ИСПРАВЛЕНО: -n через -5+brother возможно ТОЛЬКО если:
          // - верхняя бусина активна (U=1)
          // - прямое убирание НЕВОЗМОЖНО: L < n (нижних не хватает)
          if (U === 1 && L < n) {
            pairs.add(`${v}-${vNext}-brother${n}`);
          }
        }
      }
    }

    this._log(`📊 Создано ${pairs.size} братских переходов`);
    return pairs;
  }

  // ===== Помощники по физике одной стойки S∈[0..9] =====
  _U(S) { return S >= 5 ? 1 : 0; }
  _L(S) { return S >= 5 ? S - 5 : S; }

  _canPlusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    const U = this._U(S);
    if (U === 0) {
      return L + v <= 4; // нижние бусины не выходят за 4
    } else {
      return S + v <= 9; // общее состояние не выходит за 9
    }
  }

  _canMinusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return L >= v; // достаточно активных нижних бусин
  }

  /** Начальное состояние */
  generateStartState() {
    return 0;
  }

  /** Случайная длина цепочки */
  generateStepsCount() {
    const min = this.config.minSteps;
    const max = this.config.maxSteps;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /** Проверка валидности состояния */
  isValidState(v) {
    return v >= this.config.minState && v <= this.config.maxState;
  }

  /**
   * Возвращаем И братские, И простые шаги
   *
   * ЛОГИКА "Только сложение/вычитание":
   * - Применяется ТОЛЬКО к братским шагам (выбранной тренируемой цифре)
   * - Простые вспомогательные шаги ВСЕГДА доступны с любым знаком
   *
   * ЛОГИКА "Избежание повторов":
   * - Не повторяем одно и то же число подряд (особенно с противоположным знаком)
   * - Между повторами одного числа должны быть другие числа
   *
   * @param {number} currentState - Текущее состояние (0-9)
   * @param {boolean} isFirstAction - Это первый шаг?
   * @param {number} position - Позиция разряда (для совместимости, не используется в одноразрядном режиме)
   * @param {*} fullState - Полное состояние (для совместимости с ExampleGenerator, не используется)
   * @param {Array} previousSteps - История предыдущих шагов для проверки повторов
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0, fullState = null, previousSteps = []) {
    const { onlyAddition, onlySubtraction, brothersDigits, simpleBlockDigits } = this.config;
    const v = currentState;
    const brotherActions = [];
    const simpleActions = [];

    // Получаем последнее действие для проверки повторов
    const lastStep = previousSteps.length > 0 ?
      previousSteps[previousSteps.length - 1] : null;

    // Извлекаем значение последнего действия
    const getStepValue = (step) => {
      if (!step) return null;
      const action = step.action ?? step;
      if (typeof action === 'object') {
        return action.value; // братский шаг или объект
      }
      return action; // простой числовой шаг
    };

    const lastValue = getStepValue(lastStep);

    // Функция проверки: блокируем подряд идущие действия с одинаковым абсолютным значением
    const canUseNumber = (num) => {
      // Первый шаг - можно всё
      if (previousSteps.length === 0) return true;

      // Блокируем если абсолютные значения совпадают (проверяем только последнее действие - подряд)
      if (Math.abs(lastValue) === Math.abs(num)) {
        return false;
      }

      return true;
    };

    // === БРАТСКИЕ ШАГИ (с ограничением знака) ===
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue;
      const delta = v2 - v;
      const dir = delta > 0 ? "up" : "down";

      // 🔥 ОГРАНИЧЕНИЯ ПРИМЕНЯЮТСЯ ТОЛЬКО К БРАТСКИМ ШАГАМ!
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (isFirstAction && delta < 0) continue;
      
      // 🔥 НОВОЕ: Проверяем повторы для БРАТСКИХ шагов
      if (!canUseNumber(delta)) continue;

      // Ищем, есть ли для этого перехода братская формула
      let brotherN = null;
      for (const n of brothersDigits) {
        if (this.brotherPairs.has(`${v}-${v2}-brother${n}`)) {
          brotherN = n;
          break;
        }
      }

      if (brotherN != null) {
        const formula = this._buildBrotherFormula(v, v2, brotherN, dir);
        if (formula) {
          brotherActions.push({
            label: `через 5 (брат ${brotherN})`,
            value: delta,
            isBrother: true,
            brotherN: brotherN,
            formula
          });
        }
      }
    }

    // === ПРОСТЫЕ ШАГИ (БЕЗ ограничений знака - вспомогательные!) ===
    const L = this._L(v);
    const U = this._U(v);

    // ✅ СЛОЖЕНИЕ: всегда доступно
    for (const digit of simpleBlockDigits) {
      if (isFirstAction && digit <= 0) continue;
      
      // 🔥 НОВОЕ: Проверяем повторы для ПРОСТЫХ шагов
      if (!canUseNumber(digit)) continue;
      
      // Цифры 1-4: проверяем нижние бусины
      if (digit >= 1 && digit <= 4) {
        if (this._canPlusLower(v, digit)) {
          simpleActions.push(digit);
        }
      }
      // Цифра 5: проверяем верхнюю бусину
      else if (digit === 5) {
        if (U === 0 && v <= 4) {
          simpleActions.push(5);
        }
      }
      // Цифры 6-9: проверяем комбинацию верхней + нижних
      else if (digit >= 6 && digit <= 9) {
        const lower = digit - 5;
        if (U === 0 && this._canPlusLower(v, lower) && v + digit <= 9) {
          simpleActions.push(digit);
        }
      }
    }

    // ✅ ВЫЧИТАНИЕ: всегда доступно
    if (!isFirstAction) {
      for (const digit of simpleBlockDigits) {
        // 🔥 НОВОЕ: Проверяем повторы для ПРОСТЫХ шагов вычитания
        if (!canUseNumber(-digit)) continue;
        
        // Цифры 1-4: проверяем нижние бусины
        if (digit >= 1 && digit <= 4) {
          if (this._canMinusLower(v, digit)) {
            simpleActions.push(-digit);
          }
        }
        // Цифра 5: проверяем верхнюю бусину
        else if (digit === 5) {
          if (U === 1 && v >= 5) {
            simpleActions.push(-5);
          }
        }
        // Цифры 6-9: проверяем комбинацию верхней + нижних
        else if (digit >= 6 && digit <= 9) {
          const lower = digit - 5;
          if (U === 1 && this._canMinusLower(v, lower) && v - digit >= 0) {
            simpleActions.push(-digit);
          }
        }
      }
    }

    // 🔥 ПРИОРИТИЗАЦИЯ НЕИСПОЛЬЗОВАННЫХ: предпочитаем действия с новыми абсолютными значениями
    let prioritizedBrotherActions = brotherActions;
    let prioritizedSimpleActions = simpleActions;

    if (previousSteps.length > 0) {
      // Собираем все использованные абсолютные значения
      const usedAbsValues = new Set();
      for (const step of previousSteps) {
        const stepValue = getStepValue(step);
        if (stepValue !== null) {
          usedAbsValues.add(Math.abs(stepValue));
        }
      }

      // Приоритизируем неиспользованные братские действия
      if (brotherActions.length > 1) {
        const unusedBrothers = brotherActions.filter(action => {
          const val = action.value;
          return !usedAbsValues.has(Math.abs(val));
        });
        if (unusedBrothers.length > 0) {
          prioritizedBrotherActions = unusedBrothers;
          this._log(`✨ Братья: приоритизируем ${unusedBrothers.length} неиспользованных`);
        } else {
          this._log(`🔄 Братья: fallback - все уже были использованы`);
        }
      }

      // Приоритизируем неиспользованные простые действия
      if (simpleActions.length > 1) {
        const unusedSimple = simpleActions.filter(action => {
          return !usedAbsValues.has(Math.abs(action));
        });
        if (unusedSimple.length > 0) {
          prioritizedSimpleActions = unusedSimple;
          this._log(`✨ Простые: приоритизируем ${unusedSimple.length} неиспользованных`);
        } else {
          this._log(`🔄 Простые: fallback - все уже были использованы`);
        }
      }
    }

    // 🔥 ПРИОРИТИЗАЦИЯ: динамический процент братских шагов
    if (prioritizedBrotherActions.length > 0 && Math.random() < this.config.brotherPriority) {
      this._log(`👬 Приоритет братским шагам из ${v} (доступно ${prioritizedBrotherActions.length})`);
      return prioritizedBrotherActions;
    }

    const allActions = [...prioritizedBrotherActions, ...prioritizedSimpleActions];
    this._log(`🎲 Состояние ${v}: братских=${prioritizedBrotherActions.length}, простых=${prioritizedSimpleActions.length}, всего=${allActions.length}`);
    return allActions;
  }

  /**
   * Построение формулы для братского шага
   */
  _buildBrotherFormula(from, to, brotherN, direction) {
    const delta = to - from;
    const brother = 5 - brotherN;
    
    if (direction === "up") {
      // +n через +5-brother
      return [
        { op: "+", val: 5 },
        { op: "-", val: brother }
      ];
    } else {
      // -n через -5+brother
      return [
        { op: "-", val: 5 },
        { op: "+", val: brother }
      ];
    }
  }

  /**
   * Применение действия к состоянию
   */
  applyAction(currentState, action) {
    const delta = typeof action === "object" ? action.value : action;
    return currentState + delta;
  }

  /**
   * Форматирование действия для отображения
   */
  formatAction(action) {
    const val = typeof action === "object" ? action.value : action;
    return val >= 0 ? `+${val}` : `${val}`;
  }

  /**
   * Преобразование состояния в число
   */
  stateToNumber(state) {
    return typeof state === 'number' ? state : 0;
  }

  /**
   * Валидация: минимальное количество братских шагов
   *
   * 🎯 АДАПТИВНАЯ ЛОГИКА:
   * - Малое количество шагов (3-7): минимум 25-30%
   * - Среднее количество (8-12): минимум 30-35%
   * - Большое количество (13+): минимум 35-40%
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { minState, maxState } = this.config;

    if (!steps || steps.length < 1) {
      this._warn("❌ validateExample: нет шагов");
      return false;
    }

    let s = start;
    let brotherStepsCount = 0;

    for (const step of steps) {
      const act = step.action ?? step;
      s = this.applyAction(s, act);
      if (s < minState || s > maxState) {
        this._warn(`❌ validateExample: выход за диапазон [${minState}, ${maxState}]: ${s}`);
        return false;
      }
      if (typeof act === "object" && act.isBrother) {
        brotherStepsCount++;
      }
    }

    if (s !== answer) {
      this._warn(`❌ validateExample: ответ не совпадает: ${s} !== ${answer}`);
      return false;
    }

    // Вычисляем минимальное количество братских шагов
    const totalSteps = steps.length;
    let minBrotherSteps;

    if (totalSteps <= 7) {
      // Малое количество: минимум 25-30%
      minBrotherSteps = Math.max(1, Math.ceil(totalSteps * 0.25));
    } else if (totalSteps <= 12) {
      // Среднее количество: минимум 30-35%
      minBrotherSteps = Math.ceil(totalSteps * 0.30);
    } else {
      // Большое количество: минимум 35-40%
      minBrotherSteps = Math.ceil(totalSteps * 0.35);
    }

    if (brotherStepsCount < minBrotherSteps) {
      this._warn(
        `❌ validateExample: недостаточно братских шагов: ${brotherStepsCount}/${minBrotherSteps} ` +
        `(${Math.round(brotherStepsCount / totalSteps * 100)}% из ${totalSteps} шагов)`
      );
      return false;
    }

    const percentage = Math.round(brotherStepsCount / totalSteps * 100);
    this._log(
      `✅ validateExample: пример валидный (${steps.length} шагов, ` +
      `${brotherStepsCount} братских = ${percentage}%)`
    );
    return true;
  }
}
