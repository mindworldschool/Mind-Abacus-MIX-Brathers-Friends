// ext/core/MixExampleGenerator.js - Генератор примеров для правила "МИКС" (Братья + Друзья)
//
// ПРАВИЛО "МИКС":
// Одно действие (например +6), которое внутри требует:
// 1. Локального преобразования "Братья" (через 5) в единицах
// 2. Затем действия "Друзья" (через 10) с переносом/заёмом в десятках
//
// РАЗРЯДНОСТЬ:
// - Режим "Однозначные" → 2 разряда (единицы + десятки), диапазон 0..99
// - Всегда начинаем с 0
//
// ДИАПАЗОН:
// - Все промежуточные и финальные значения: 0..99
// - Запрещено выходить за этот диапазон на любом шаге
//
// ПРАВИЛО "ПРОСТО" (для подготовки к МИКС):
// - ТОЛЬКО атомарные движения бусин (одно направление)
// - Сложение: только добавление бусин (U: 0→1, L: увеличение)
// - Вычитание: только убирание бусин (U: 1→0, L: уменьшение)
// - ЗАПРЕЩЕНЫ компенсации "+5−x" и "−5+x"
//
// ВАЖНО: Ограничение знака (onlyAddition/onlySubtraction) применяется ТОЛЬКО к МИКС-шагам (6,7,8,9)
// Вспомогательные PROSTO-шаги для подготовки могут быть ЛЮБОГО знака

export class MixExampleGenerator {
  constructor(config = {}) {
    // Конфигурация генератора
    this.config = {
      // Какие цифры МИКС тренируем: [6, 7, 8, 9]
      selectedMixDigits: Array.isArray(config.selectedMixDigits)
        ? config.selectedMixDigits.filter(n => n >= 6 && n <= 9)
        : [6, 7, 8, 9],

      // Точное количество шагов в цепочке
      chainLength: config.chainLength || config.maxSteps || 7,

      // Минимум МИКС-действий в цепочке
      minMixCount: config.minMixCount || 1,

      // Вероятность вставки МИКС после выполнения минимума (0.0 - 1.0)
      mixTryRate: config.mixTryRate || 0.4,

      // Окно для избежания повторов (количество последних шагов)
      avoidRepeatWindow: config.avoidRepeatWindow || 3,

      // Ограничения направления (применяются ТОЛЬКО к МИКС-шагам!)
      onlyAddition: config.onlyAddition || false,
      onlySubtraction: config.onlySubtraction || false,

      // Тихий режим (отключает детальное логирование)
      silent: config.silent || false
    };

    // Валидация
    if (this.config.selectedMixDigits.length === 0) {
      if (!this.config.silent) {
        console.warn("⚠️ MixExampleGenerator: не выбрано ни одной цифры МИКС! Используем [6]");
      }
      this.config.selectedMixDigits = [6];
    }

    if (this.config.chainLength < 4) {
      if (!this.config.silent) {
        console.warn(`⚠️ MixExampleGenerator: правило МИКС требует минимум 4 шага! Было: ${this.config.chainLength}, устанавливаем 4`);
      }
      this.config.chainLength = 4;
    }

    this._log(`🔀 MixExampleGenerator создан:
  Выбранные цифры МИКС: [${this.config.selectedMixDigits.join(', ')}]
  Точное количество шагов: ${this.config.chainLength}
  Минимум МИКС: ${this.config.minMixCount}
  Вероятность МИКС после минимума: ${this.config.mixTryRate * 100}%
  Окно избежания повторов: ${this.config.avoidRepeatWindow}
  Только сложение (МИКС): ${this.config.onlyAddition}
  Только вычитание (МИКС): ${this.config.onlySubtraction}`);
  }

  // ========== УТИЛИТЫ ДЛЯ ЛОГИРОВАНИЯ ==========

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

  // ========== СЕКЦИЯ 1: ФИЗИКА АБАКУСА ==========

  /**
   * Получить состояние верхней бусины (0 или 1)
   * @param {number} v - значение разряда (0-9)
   */
  _U(v) {
    return v >= 5 ? 1 : 0;
  }

  /**
   * Получить количество активных нижних бусин (0-4)
   * @param {number} v - значение разряда (0-9)
   */
  _L(v) {
    return v >= 5 ? v - 5 : v;
  }

  /**
   * Собрать значение из верхней и нижних бусин
   * @param {number} U - верхняя бусина (0 или 1)
   * @param {number} L - нижние бусины (0-4)
   */
  _toValue(U, L) {
    return 5 * U + L;
  }

  // ========== СЕКЦИЯ 2: ВАЛИДАТОРЫ "ПРОСТО" (СТРОГИЕ) ==========

  /**
   * Проверка правила ПРОСТО для сложения: ОДНО ОДНОНАПРАВЛЕННОЕ движение вверх
   *
   * Можно ТОЛЬКО ДОБАВЛЯТЬ бусины (нельзя убирать):
   * - Верхняя: 0→1 (добавить) или не менять
   * - Нижние: L→L+k (добавить) или не менять
   *
   * НЕЛЬЗЯ смешивать добавление и убирание!
   *
   * @param {number} v - текущее значение разряда (0-9)
   * @param {number} n - сколько добавить (1-9)
   * @returns {boolean}
   */
  _canPlusDirect(v, n) {
    if (n < 1 || n > 9) return false;

    const targetV = v + n;
    if (targetV > 9) return false; // выход за пределы

    const U1 = this._U(v);
    const L1 = this._L(v);
    const U2 = this._U(targetV);
    const L2 = this._L(targetV);

    // Изменения бусин
    const topChange = U2 - U1;  // -1, 0, или +1
    const botChange = L2 - L1;  // -4..+4

    // КРИТИЧНО: ОДНОНАПРАВЛЕННОСТЬ!
    // При сложении можем только ДОБАВЛЯТЬ (не убирать)
    if (topChange < 0 || botChange < 0) {
      return false; // ❌ Убирание запрещено при движении "вверх"
    }

    // Должно быть хоть какое-то изменение
    if (topChange === 0 && botChange === 0) return false;

    return true;
  }

  /**
   * Проверка правила ПРОСТО для вычитания: ОДНО ОДНОНАПРАВЛЕННОЕ движение вниз
   *
   * Можно ТОЛЬКО УБИРАТЬ бусины (нельзя добавлять):
   * - Верхняя: 1→0 (убрать) или не менять
   * - Нижние: L→L-k (убрать) или не менять
   *
   * НЕЛЬЗЯ смешивать добавление и убирание!
   *
   * @param {number} v - текущее значение разряда (0-9)
   * @param {number} n - сколько отнять (1-9)
   * @returns {boolean}
   */
  _canMinusDirect(v, n) {
    if (n < 1 || n > 9) return false;

    const targetV = v - n;
    if (targetV < 0) return false; // уход в минус

    const U1 = this._U(v);
    const L1 = this._L(v);
    const U2 = this._U(targetV);
    const L2 = this._L(targetV);

    // Изменения бусин
    const topChange = U2 - U1;  // -1, 0, или +1
    const botChange = L2 - L1;  // -4..+4

    // КРИТИЧНО: ОДНОНАПРАВЛЕННОСТЬ!
    // При вычитании можем только УБИРАТЬ (не добавлять)
    if (topChange > 0 || botChange > 0) {
      return false; // ❌ Добавление запрещено при движении "вниз"
    }

    // Должно быть хоть какое-то изменение
    if (topChange === 0 && botChange === 0) return false;

    return true;
  }

  // ========== СЕКЦИЯ 3: ТАБЛИЦЫ ТРЕБОВАНИЙ ДЛЯ МИКС ==========

  /**
   * Таблица A - когда +k обязано быть МИКС (по единицам)
   *
   * k  | c=10−k | Требуемое состояние единиц ДО шага | Пояснение
   * ---|--------|-------------------------------------|----------
   * +6 | 4      | 8 (U=1,L=3)                         | Для "+10−4" не хватает 1 нижней (L=3), "Братья" даёт +1 нижнюю → L=4 → можно −4
   * +7 | 3      | 6 (U=1,L=1) или 7 (U=1,L=2)         | Для "+10−3" нужно 3 нижних, а их 1–2; "Братья" добавит +2 нижних
   * +8 | 2      | 5 (U=1,L=0) или 6 (U=1,L=1)         | Для "+10−2" нужно 2 нижних, а их 0–1; "Братья" добавит +3 нижних
   * +9 | 1      | 5 (U=1,L=0)                         | Для "+10−1" нужна 1 нижняя, но L=0; "Братья" добавит +4 нижних
   *
   * @param {number} digit - цифра МИКС (6-9)
   * @returns {number[]} - массив валидных состояний единиц
   */
  _getAdditionRequirements(digit) {
    switch(digit) {
      case 6:
        return [8]; // U=1, L=3
      case 7:
        return [6, 7]; // U=1, L=1 или L=2
      case 8:
        return [5, 6]; // U=1, L=0 или L=1
      case 9:
        return [5]; // U=1, L=0
      default:
        return [];
    }
  }

  /**
   * Таблица C - когда −k обязано быть МИКС (по единицам)
   *
   * k  | c=10−k | Требуемое состояние единиц ДО шага | Пояснение
   * ---|--------|-------------------------------------|----------
   * −6 | 4      | 1..4 (U=0,L=1..4)                   | Нельзя сделать +4 "Просто" (места нет), делаем +4 как +5−1, затем заем −10
   * −7 | 3      | 2..4 (U=0,L=2..4)                   | Нельзя сделать +3 "Просто", делаем +3 как +5−2
   * −8 | 2      | 3..4 (U=0,L=3..4)                   | Нельзя сделать +2 "Просто", делаем +2 как +5−3
   * −9 | 1      | 4 (U=0,L=4)                         | Нельзя сделать +1 "Просто", делаем +1 как +5−4
   *
   * @param {number} digit - цифра МИКС (6-9)
   * @returns {number[]} - массив валидных состояний единиц
   */
  _getSubtractionRequirements(digit) {
    switch(digit) {
      case 6:
        return [1, 2, 3, 4]; // U=0, L=1..4
      case 7:
        return [2, 3, 4]; // U=0, L=2..4
      case 8:
        return [3, 4]; // U=0, L=3..4
      case 9:
        return [4]; // U=0, L=4
      default:
        return [];
    }
  }

  /**
   * Таблица B/D - ограничения на десятки для МИКС
   *
   * Для +МИКС: tens ∈ 0..8 (иначе перенос сделает сотни, выйдем за 99)
   * Для −МИКС: tens ∈ 1..9 (иначе нечего занимать, уйдем в минус)
   *
   * @param {number} tens - текущее значение десятков (0-9)
   * @param {boolean} isAddition - это сложение?
   * @returns {boolean}
   */
  _canApplyMixToTens(tens, isAddition) {
    if (isAddition) {
      return tens >= 0 && tens <= 8; // для +МИКС
    } else {
      return tens >= 1 && tens <= 9; // для −МИКС
    }
  }

  // ========== СЕКЦИЯ 4: ПРОВЕРКА ВОЗМОЖНОСТИ МИКС ==========

  /**
   * Проверить: можно ли выполнить МИКС с данной цифрой и знаком?
   *
   * @param {object} state - текущее состояние {units, tens}
   * @param {number} digit - цифра МИКС (6-9)
   * @param {boolean} isAddition - сложение или вычитание
   * @returns {boolean}
   */
  _canApplyMix(state, digit, isAddition) {
    const { units, tens } = state;

    // Проверка 1: ограничения на десятки
    if (!this._canApplyMixToTens(tens, isAddition)) {
      return false;
    }

    // Проверка 2: состояние единиц должно быть в требуемом диапазоне
    const requirements = isAddition
      ? this._getAdditionRequirements(digit)
      : this._getSubtractionRequirements(digit);

    if (!requirements.includes(units)) {
      return false;
    }

    // Проверка 3: физическая возможность формулы Друзья
    const friend = 10 - digit;

    if (isAddition) {
      // +k = +10 - friend
      // Нужно уметь вычесть friend из единиц
      return this._canMinusDirect(units, friend);
    } else {
      // -k = -10 + friend
      // Нужно уметь прибавить friend к единицам
      return this._canPlusDirect(units, friend);
    }
  }

  // ========== СЕКЦИЯ 5: ПОДГОТОВКА К МИКС (ТОЛЬКО "ПРОСТО") ==========

  /**
   * Найти путь от текущего состояния единиц к целевому используя ТОЛЬКО "Просто" шаги
   *
   * ВАЖНО: Шаги подготовки могут быть ЛЮБОГО знака (+ и -)
   *
   * @param {number} currentUnits - текущее значение единиц (0-9)
   * @param {number} targetUnits - целевое значение единиц (0-9)
   * @param {number} currentTens - текущее значение десятков (0-9)
   * @returns {number[]|null} - массив шагов для единиц или null если невозможно
   */
  _findProstoPath(currentUnits, targetUnits, currentTens) {
    if (currentUnits === targetUnits) {
      return []; // уже в целевом состоянии
    }

    const maxAttempts = 20;
    const path = [];
    let units = currentUnits;
    let attempts = 0;

    while (units !== targetUnits && attempts < maxAttempts) {
      attempts++;

      const delta = targetUnits - units;
      const isUp = delta > 0;

      // Пробуем найти ПРЯМОЙ "Просто" шаг
      let found = false;

      if (isUp) {
        // Нужно увеличить единицы
        for (let step = Math.min(9, delta); step >= 1; step--) {
          if (this._canPlusDirect(units, step) && units + step <= 9) {
            path.push(step);
            units += step;
            found = true;
            break;
          }
        }
      } else {
        // Нужно уменьшить единицы
        for (let step = Math.min(9, Math.abs(delta)); step >= 1; step--) {
          if (this._canMinusDirect(units, step) && units - step >= 0) {
            path.push(-step);
            units -= step;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Прямой путь не найден - пробуем обходной через 0 или 9
        if (isUp && units < 5) {
          // Попробуем через 0 → 5 → target
          if (units > 0) {
            // Сначала вниз к 0
            for (let step = units; step >= 1; step--) {
              if (this._canMinusDirect(units, step)) {
                path.push(-step);
                units -= step;
                found = true;
                break;
              }
            }
          } else {
            // Потом вверх через 5
            if (this._canPlusDirect(0, 5)) {
              path.push(5);
              units = 5;
              found = true;
            }
          }
        } else if (!isUp && units >= 5) {
          // Попробуем через 9 → 5 → target
          if (units < 9) {
            // Сначала вверх к 9
            const toNine = 9 - units;
            for (let step = toNine; step >= 1; step--) {
              if (this._canPlusDirect(units, step)) {
                path.push(step);
                units += step;
                found = true;
                break;
              }
            }
          } else {
            // Потом вниз через 5
            if (this._canMinusDirect(9, 4)) {
              path.push(-4);
              units = 5;
              found = true;
            }
          }
        }
      }

      if (!found) {
        // Не можем найти путь
        return null;
      }
    }

    if (units !== targetUnits) {
      return null; // не достигли цели
    }

    return path;
  }

  // ========== СЕКЦИЯ 6: ГЕНЕРАЦИЯ PROSTO ШАГОВ ==========

  /**
   * Сгенерировать допустимые PROSTO действия для текущего состояния
   *
   * @param {object} state - текущее состояние {units, tens}
   * @param {boolean} isFirst - это первое действие в цепочке?
   * @param {number[]} lastSteps - последние N шагов для избежания повторов
   * @returns {number[]} - массив допустимых действий
   */
  _getAvailableProstoActions(state, isFirst = false, lastSteps = []) {
    const { units, tens } = state;
    const value = tens * 10 + units;
    const actions = [];

    // Функция проверки повторов
    const isRepeat = (action) => {
      const window = this.config.avoidRepeatWindow;
      if (lastSteps.length === 0 || window === 0) return false;

      const recentSteps = lastSteps.slice(-window);

      // Не повторяем точно такое же действие
      if (recentSteps.includes(action)) return true;

      // Не делаем противоположное действие (например +3 после -3)
      if (recentSteps.includes(-action)) return true;

      return false;
    };

    // Сложение (всегда доступно)
    for (let d = 1; d <= 9; d++) {
      if (isFirst && d <= 0) continue; // первое действие должно быть положительным

      const newValue = value + d;
      if (newValue > 99) continue; // выход за диапазон

      const newUnits = newValue % 10;
      const newTens = Math.floor(newValue / 10);

      // Проверяем: можно ли сделать это действие "Просто"
      if (this._canPlusDirect(units, d) && units + d === newUnits && tens === newTens) {
        if (!isRepeat(d)) {
          actions.push(d);
        }
      }
    }

    // Вычитание (если не первое действие)
    if (!isFirst) {
      for (let d = 1; d <= 9; d++) {
        const newValue = value - d;
        if (newValue < 0) continue; // уход в минус

        const newUnits = newValue % 10;
        const newTens = Math.floor(newValue / 10);

        // Проверяем: можно ли сделать это действие "Просто"
        if (this._canMinusDirect(units, d) && units - d === newUnits && tens === newTens) {
          if (!isRepeat(-d)) {
            actions.push(-d);
          }
        }
      }
    }

    return actions;
  }

  // ========== СЕКЦИЯ 7: ПРИМЕНЕНИЕ ДЕЙСТВИЯ ==========

  /**
   * Применить действие к состоянию
   *
   * @param {object} state - текущее состояние {units, tens}
   * @param {number} action - действие (может быть отрицательным)
   * @returns {object} - новое состояние {units, tens}
   */
  _applyAction(state, action) {
    const { units, tens } = state;
    const value = tens * 10 + units;
    const newValue = value + action;

    return {
      units: newValue % 10,
      tens: Math.floor(newValue / 10)
    };
  }

  /**
   * Применить МИКС действие к состоянию с формулой
   *
   * @param {object} state - текущее состояние {units, tens}
   * @param {number} digit - цифра МИКС (6-9)
   * @param {boolean} isAddition - сложение или вычитание
   * @returns {object} - новое состояние {units, tens}
   */
  _applyMixAction(state, digit, isAddition) {
    const { units, tens } = state;
    const friend = 10 - digit;

    if (isAddition) {
      // +k = (+5 - brother) + (+10 - friend)
      // Итоговый эффект: units -= friend, tens += 1
      return {
        units: units - friend,
        tens: tens + 1
      };
    } else {
      // -k = (-5 + brother) + (-10 + friend)
      // Итоговый эффект: units += friend, tens -= 1
      return {
        units: units + friend,
        tens: tens - 1
      };
    }
  }

  // ========== СЕКЦИЯ 8: ГЛАВНЫЙ МЕТОД ГЕНЕРАЦИИ ==========

  /**
   * Сгенерировать пример с ТОЧНЫМ количеством шагов
   *
   * @returns {object} - {startValue, steps[], finalValue, stats}
   */
  generate() {
    const maxAttempts = 100;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const example = this._generateAttempt();

      if (!example) {
        if (attempt % 30 === 0) {
          this._warn(`⚠️ Попытка ${attempt}: не удалось сгенерировать пример`);
        }
        continue;
      }

      if (!this._validateExample(example)) {
        if (attempt % 30 === 0) {
          this._warn(`⚠️ Попытка ${attempt}: пример не прошёл валидацию`);
        }
        continue;
      }

      this._log(`✅ Пример сгенерирован за ${attempt} попыток`);
      return example;
    }

    // Переход на fallback
    this._warn(`❌ Не удалось сгенерировать пример за ${maxAttempts} попыток! Используем fallback`);
    return this._fallbackExample();
  }

  /**
   * Одна попытка генерации примера
   */
  _generateAttempt() {
    const targetSteps = this.config.chainLength;
    const minMixCount = this.config.minMixCount;

    const steps = [];
    let state = { units: 0, tens: 0 };
    let mixCount = 0;
    let attempts = 0;
    const maxAttempts = targetSteps * 50;

    const lastActions = []; // для отслеживания повторов

    this._log(`🎯 Генерация МИКС примера: ${targetSteps} шагов (точно), минимум ${minMixCount} МИКС`);

    while (steps.length < targetSteps && attempts < maxAttempts) {
      attempts++;
      const isFirst = steps.length === 0;
      const stepsRemaining = targetSteps - steps.length;

      // Решаем: пытаться ли сгенерировать МИКС действие
      const needMoreMix = mixCount < minMixCount;
      const tryMix = needMoreMix || (stepsRemaining >= 2 && Math.random() < this.config.mixTryRate);

      if (tryMix) {
        // Попытка сгенерировать МИКС действие
        const mixResult = this._tryGenerateMixAction(state, isFirst, lastActions);

        if (mixResult) {
          // Успешно сгенерировали МИКС
          // Добавляем подготовительные шаги
          for (const prepStep of mixResult.preparationSteps) {
            steps.push(prepStep);
            state = this._applyAction(state, prepStep.action);
            lastActions.push(prepStep.action);
          }

          // Добавляем МИКС шаг
          steps.push(mixResult.mixStep);
          state = mixResult.newState;
          lastActions.push(mixResult.mixStep.displayOp === '+' ? mixResult.mixStep.displayVal : -mixResult.mixStep.displayVal);
          mixCount++;

          continue;
        }
      }

      // Генерируем простое действие
      const prostoActions = this._getAvailableProstoActions(state, isFirst, lastActions);

      if (prostoActions.length === 0) {
        // Нет доступных действий
        if (steps.length >= 3 && mixCount >= minMixCount) {
          break; // достаточно шагов
        }
        continue;
      }

      // Выбираем случайное действие
      const action = prostoActions[Math.floor(Math.random() * prostoActions.length)];
      const newState = this._applyAction(state, action);

      // Проверяем границы
      const newValue = newState.tens * 10 + newState.units;
      if (newValue < 0 || newValue > 99) {
        continue; // выход за диапазон
      }

      steps.push({
        displayOp: action >= 0 ? '+' : '-',
        displayVal: Math.abs(action),
        type: 'PROSTO',
        action: action,
        meta: {
          stateBefore: { ...state },
          stateAfter: { ...newState }
        }
      });

      state = newState;
      lastActions.push(action);
    }

    // Проверка: достигли ли ТОЧНОГО количества шагов?
    if (steps.length !== targetSteps) {
      return null;
    }

    // Проверка: есть ли минимум МИКС действий?
    if (mixCount < minMixCount) {
      return null;
    }

    const finalValue = state.tens * 10 + state.units;

    // Подсчет статистики
    const stats = {
      mixCount: mixCount,
      prostoCount: steps.filter(s => s.type === 'PROSTO').length,
      digitDistribution: {},
      attemptCount: attempts
    };

    for (const digit of this.config.selectedMixDigits) {
      stats.digitDistribution[digit] = steps.filter(s => s.type === 'MIX' && s.displayVal === digit).length;
    }

    return {
      startValue: 0,
      steps: steps,
      finalValue: finalValue,
      stats: stats
    };
  }

  /**
   * Попытка сгенерировать МИКС действие
   */
  _tryGenerateMixAction(state, isFirst, lastActions) {
    const { selectedMixDigits, onlyAddition, onlySubtraction } = this.config;

    // Выбираем случайную цифру МИКС (избегая повторов)
    const availableDigits = selectedMixDigits.filter(digit => {
      const window = this.config.avoidRepeatWindow;
      if (lastActions.length === 0 || window === 0) return true;

      const recentSteps = lastActions.slice(-window);

      // Не повторяем ту же цифру
      if (recentSteps.includes(digit) || recentSteps.includes(-digit)) {
        return false;
      }

      return true;
    });

    if (availableDigits.length === 0) {
      // Все цифры были недавно использованы
      return null;
    }

    const digit = availableDigits[Math.floor(Math.random() * availableDigits.length)];

    // Определяем возможные знаки для МИКС
    const possibleSigns = [];

    if (!onlySubtraction && (isFirst || !onlyAddition)) {
      possibleSigns.push(true); // сложение
    }

    if (!onlyAddition && !isFirst) {
      possibleSigns.push(false); // вычитание
    }

    if (possibleSigns.length === 0) {
      return null;
    }

    // Пробуем случайный знак
    const isAddition = possibleSigns[Math.floor(Math.random() * possibleSigns.length)];

    // Проверяем: можно ли выполнить МИКС с текущим состоянием?
    if (this._canApplyMix(state, digit, isAddition)) {
      // Можем выполнить МИКС сразу - НЕ нужна подготовка
      const newState = this._applyMixAction(state, digit, isAddition);
      const friend = 10 - digit;
      const brother = 5 - friend;

      return {
        preparationSteps: [],
        mixStep: {
          displayOp: isAddition ? '+' : '-',
          displayVal: digit,
          type: 'MIX',
          action: isAddition ? digit : -digit,
          meta: {
            stateBefore: { ...state },
            stateAfter: { ...newState },
            formula: isAddition
              ? [
                  { step: 'units', op: '+', val: 5 },
                  { step: 'units', op: '-', val: brother },
                  { step: 'tens', op: '+', val: 1 },
                  { step: 'units', op: '-', val: friend }
                ]
              : [
                  { step: 'units', op: '-', val: 5 },
                  { step: 'units', op: '+', val: brother },
                  { step: 'tens', op: '-', val: 1 },
                  { step: 'units', op: '+', val: friend }
                ]
          }
        },
        newState: newState
      };
    }

    // Нужна подготовка - ищем путь к целевому состоянию единиц
    const targetUnits = isAddition
      ? this._getAdditionRequirements(digit)[0]
      : this._getSubtractionRequirements(digit)[0];

    if (!targetUnits) {
      return null;
    }

    // Ищем путь подготовки
    const preparationPath = this._findProstoPath(state.units, targetUnits, state.tens);

    if (!preparationPath) {
      return null; // не можем подготовить
    }

    // Проверяем ограничения на десятки ПОСЛЕ подготовки
    let prepState = { ...state };
    for (const step of preparationPath) {
      prepState = this._applyAction(prepState, step);
    }

    if (!this._canApplyMixToTens(prepState.tens, isAddition)) {
      return null; // десятки вышли за допустимые границы
    }

    // Формируем подготовительные шаги
    const preparationSteps = preparationPath.map(action => ({
      displayOp: action >= 0 ? '+' : '-',
      displayVal: Math.abs(action),
      type: 'PROSTO',
      action: action,
      meta: {
        purpose: 'preparation_for_mix'
      }
    }));

    // Применяем МИКС
    const newState = this._applyMixAction(prepState, digit, isAddition);
    const friend = 10 - digit;
    const brother = 5 - friend;

    return {
      preparationSteps: preparationSteps,
      mixStep: {
        displayOp: isAddition ? '+' : '-',
        displayVal: digit,
        type: 'MIX',
        action: isAddition ? digit : -digit,
        meta: {
          stateBefore: { ...prepState },
          stateAfter: { ...newState },
          formula: isAddition
            ? [
                { step: 'units', op: '+', val: 5 },
                { step: 'units', op: '-', val: brother },
                { step: 'tens', op: '+', val: 1 },
                { step: 'units', op: '-', val: friend }
              ]
            : [
                { step: 'units', op: '-', val: 5 },
                { step: 'units', op: '+', val: brother },
                { step: 'tens', op: '-', val: 1 },
                { step: 'units', op: '+', val: friend }
              ]
        }
      },
      newState: newState
    };
  }

  // ========== СЕКЦИЯ 9: ВАЛИДАЦИЯ ==========

  /**
   * Валидация примера
   */
  _validateExample(example) {
    const { startValue, steps, finalValue, stats } = example;

    // 1. Проверка ТОЧНОГО количества шагов
    if (steps.length !== this.config.chainLength) {
      return false;
    }

    // 2. Проверка наличия МИКС шагов (минимум M!)
    if (stats.mixCount < this.config.minMixCount) {
      return false;
    }

    // 3. Валидность всех промежуточных состояний
    let state = { units: 0, tens: 0 };
    for (const step of steps) {
      if (step.type === 'MIX') {
        state = step.meta.stateAfter;
      } else {
        state = this._applyAction(state, step.action);
      }

      const value = state.tens * 10 + state.units;
      if (value < 0 || value > 99) {
        return false; // выход за диапазон
      }
    }

    // 4. Корректность финального ответа
    const computedFinal = state.tens * 10 + state.units;
    if (computedFinal !== finalValue) {
      return false;
    }

    return true;
  }

  // ========== СЕКЦИЯ 10: FALLBACK ==========

  /**
   * Упрощенный fallback-пример если генерация не удалась
   */
  _fallbackExample() {
    const targetSteps = this.config.chainLength;
    const steps = [];
    let state = { units: 0, tens: 0 };
    let mixCount = 0;

    this._log(`⚠️ Используем fallback генерацию для ${targetSteps} шагов`);

    // Пытаемся добавить хотя бы 1 МИКС
    const digit = this.config.selectedMixDigits[0] || 6;

    // Подготовка к МИКС: доводим единицы до 8 для +6
    while (state.units < 8 && steps.length < targetSteps - 1) {
      const step = Math.min(3, 8 - state.units);
      if (this._canPlusDirect(state.units, step)) {
        steps.push({
          displayOp: '+',
          displayVal: step,
          type: 'PROSTO',
          action: step,
          meta: {}
        });
        state = this._applyAction(state, step);
      } else {
        break;
      }
    }

    // Добавляем МИКС
    if (state.units === 8 && state.tens <= 8 && steps.length < targetSteps) {
      const newState = this._applyMixAction(state, digit, true);
      steps.push({
        displayOp: '+',
        displayVal: digit,
        type: 'MIX',
        action: digit,
        meta: {
          stateBefore: { ...state },
          stateAfter: { ...newState },
          formula: []
        }
      });
      state = newState;
      mixCount++;
    }

    // Заполняем остальные шаги простыми действиями
    while (steps.length < targetSteps) {
      const action = Math.random() < 0.5 ? 1 : -1;
      const newState = this._applyAction(state, action);
      const newValue = newState.tens * 10 + newState.units;

      if (newValue >= 0 && newValue <= 99) {
        steps.push({
          displayOp: action >= 0 ? '+' : '-',
          displayVal: Math.abs(action),
          type: 'PROSTO',
          action: action,
          meta: {}
        });
        state = newState;
      } else {
        // Если не можем - просто останавливаемся
        break;
      }
    }

    const finalValue = state.tens * 10 + state.units;

    return {
      startValue: 0,
      steps: steps,
      finalValue: finalValue,
      stats: {
        mixCount: mixCount,
        prostoCount: steps.length - mixCount,
        digitDistribution: { [digit]: mixCount },
        attemptCount: 1
      }
    };
  }

  // ========== СЕКЦИЯ 11: ФОРМАТИРОВАНИЕ ДЛЯ ТРЕНАЖЕРА ==========

  /**
   * Преобразовать внутренний формат в формат тренажера
   *
   * @param {object} example - внутренний формат примера
   * @returns {object} - формат для trainer_logic.js
   */
  toTrainerFormat(example) {
    const formattedSteps = [];

    for (const step of example.steps) {
      if (step.type === 'MIX') {
        // МИКС шаг - возвращаем объект с формулой
        formattedSteps.push({
          step: `${step.displayOp}${step.displayVal}`,
          isMix: true,
          mixDigit: step.displayVal,
          formula: step.meta.formula || []
        });
      } else {
        // PROSTO шаг - возвращаем строку
        formattedSteps.push(`${step.displayOp}${step.displayVal}`);
      }
    }

    return {
      start: example.startValue,
      steps: formattedSteps,
      answer: example.finalValue
    };
  }
}
