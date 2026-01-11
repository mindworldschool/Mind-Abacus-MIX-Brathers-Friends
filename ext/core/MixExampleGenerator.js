// ext/core/MixExampleGenerator.js - Генератор примеров для правила "МИКС" (Братья + Друзья)
//
// ПРАВИЛО "МИКС":
// Одно действие (например +6), которое внутри требует:
// 1. Локального преобразования "Братья" (через 5) в целевом разряде
// 2. Затем действия "Друзья" (через 10) с переносом/заёмом в следующий разряд
//
// РАЗРЯДНОСТЬ:
// - digitCount=1 → состояние 2 разряда [единицы, десятки], диапазон 0..99
// - digitCount=2 → состояние 3 разряда [единицы, десятки, сотни], диапазон 0..999
// - digitCount=3 → состояние 4 разряда [единицы, десятки, сотни, тысячи], диапазон 0..9999
// - digitCount=N → состояние N+1 разрядов
//
// ЦЕЛЕВОЙ РАЗРЯД (где применяется МИКС):
// - targetPosition = digitCount - 1
// - digitCount=1: МИКС в единицах (позиция 0)
// - digitCount=2: МИКС в десятках (позиция 1)
// - digitCount=3: МИКС в сотнях (позиция 2)
//
// ИЕРАРХИЯ ПРАВИЛ ПО ПОЗИЦИЯМ:
// - targetPosition: МИКС для цифр 6-9 (Brothers + Friends)
// - targetPosition-1: Friends для цифр 6-9, Brothers для 5, Simple для 0-4
// - targetPosition-2 и ниже: Brothers для цифр 6-9, Brothers для 5, Simple для 0-4
//
// ДИАПАЗОН:
// - Все промежуточные и финальные значения: 0..10^(digitCount+1)-1
// - digitCount=1: 0..99
// - digitCount=2: 0..999
// - digitCount=3: 0..9999
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

      // Разрядность ДЕЙСТВИЙ (1 для однозначных, 2 для двузначных, 3 для трехзначных и т.д.)
      digitCount: config.digitCount || 1,

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

    // Валидация digitCount
    if (this.config.digitCount < 1 || this.config.digitCount > 9) {
      if (!this.config.silent) {
        console.warn(`⚠️ MixExampleGenerator: digitCount должен быть 1-9! Было: ${this.config.digitCount}, устанавливаем 1`);
      }
      this.config.digitCount = 1;
    }

    // Валидация выбранных цифр
    if (this.config.selectedMixDigits.length === 0) {
      if (!this.config.silent) {
        console.warn("⚠️ MixExampleGenerator: не выбрано ни одной цифры МИКС! Используем [6]");
      }
      this.config.selectedMixDigits = [6];
    }

    if (this.config.chainLength < 2) {
      if (!this.config.silent) {
        console.warn(`⚠️ MixExampleGenerator: правило МИКС требует минимум 2 шага! Было: ${this.config.chainLength}, устанавливаем 2`);
      }
      this.config.chainLength = 2;
    }

    // РАЗРЯДНОСТЬ СОСТОЯНИЯ = digitCount + 1 (дополнительный разряд для переноса)
    // Примеры:
    //   digitCount=1 (действия однозначные) → stateDigitCount=2 [единицы, десятки]
    //   digitCount=2 (действия двузначные)  → stateDigitCount=3 [единицы, десятки, сотни]
    //   digitCount=3 (действия трехзначные) → stateDigitCount=4 [единицы, десятки, сотни, тысячи]
    this.stateDigitCount = this.config.digitCount + 1;

    // ЦЕЛЕВОЙ РАЗРЯД = самый старший разряд ДЕЙСТВИЯ (digitCount - 1)
    // Это разряд где применяется правило "МИКС"
    this.targetPosition = this.config.digitCount - 1;

    // МАКСИМАЛЬНОЕ ЗНАЧЕНИЕ
    this.maxValue = Math.pow(10, this.stateDigitCount) - 1;

    this._log(`🔀 MixExampleGenerator создан:
  Выбранные цифры МИКС: [${this.config.selectedMixDigits.join(', ')}]
  Разрядность действий: ${this.config.digitCount}
  Разрядность состояния: ${this.stateDigitCount}
  Целевой разряд: ${this.targetPosition} (${this._getPositionName(this.targetPosition)})
  Точное количество шагов: ${this.config.chainLength}
  Минимум МИКС: ${this.config.minMixCount}
  Максимальное значение: ${this.maxValue}
  Вероятность МИКС после минимума: ${this.config.mixTryRate * 100}%
  Окно избежания повторов: ${this.config.avoidRepeatWindow}
  Только сложение (МИКС): ${this.config.onlyAddition}
  Только вычитание (МИКС): ${this.config.onlySubtraction}`);
  }

  // ========== УТИЛИТЫ ДЛЯ ЛОГИРОВАНИЯ И ИМЕНОВАНИЯ ==========

  _getPositionName(pos) {
    const names = ['единицы', 'десятки', 'сотни', 'тысячи', 'десятки тысяч', 'сотни тысяч', 'миллионы', 'десятки миллионов', 'сотни миллионов'];
    return names[pos] || `разряд ${pos}`;
  }

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

  // ========== СЕКЦИЯ 2: РАБОТА С СОСТОЯНИЕМ (МАССИВ) ==========

  /**
   * Преобразовать массив состояния в число
   * @param {number[]} states - массив разрядов [v0, v1, v2, ...]
   * @returns {number}
   */
  _stateToNumber(states) {
    if (!Array.isArray(states)) return 0;

    let result = 0;
    for (let i = 0; i < states.length; i++) {
      result += (states[i] || 0) * Math.pow(10, i);
    }
    return result;
  }

  /**
   * Преобразовать число в массив состояния
   * @param {number} value - числовое значение
   * @returns {number[]}
   */
  _numberToState(value) {
    const states = Array(this.stateDigitCount).fill(0);
    let remaining = value;

    for (let i = 0; i < this.stateDigitCount; i++) {
      states[i] = remaining % 10;
      remaining = Math.floor(remaining / 10);
    }

    return states;
  }

  /**
   * Скопировать состояние
   * @param {number[]} states
   * @returns {number[]}
   */
  _copyState(states) {
    return [...states];
  }

  // ========== СЕКЦИЯ 3: ВАЛИДАТОРЫ "ПРОСТО" (СТРОГИЕ) ==========

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

  // ========== СЕКЦИЯ 4: ТАБЛИЦЫ ТРЕБОВАНИЙ ДЛЯ МИКС ==========

  /**
   * Таблица A - когда +k обязано быть МИКС (по целевому разряду)
   *
   * k  | c=10−k | Требуемое состояние целевого разряда ДО шага | Пояснение
   * ---|--------|----------------------------------------------|----------
   * +6 | 4      | 8 (U=1,L=3)                                  | Для "+10−4" не хватает 1 нижней (L=3), "Братья" даёт +1 нижнюю → L=4 → можно −4
   * +7 | 3      | 6 (U=1,L=1) или 7 (U=1,L=2)                  | Для "+10−3" нужно 3 нижних, а их 1–2; "Братья" добавит +2 нижних
   * +8 | 2      | 5 (U=1,L=0) или 6 (U=1,L=1)                  | Для "+10−2" нужно 2 нижних, а их 0–1; "Братья" добавит +3 нижних
   * +9 | 1      | 5 (U=1,L=0)                                  | Для "+10−1" нужна 1 нижняя, но L=0; "Братья" добавит +4 нижних
   *
   * @param {number} digit - цифра МИКС (6-9)
   * @returns {number[]} - массив валидных состояний целевого разряда
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
   * Таблица C - когда −k обязано быть МИКС (по целевому разряду)
   *
   * k  | c=10−k | Требуемое состояние целевого разряда ДО шага | Пояснение
   * ---|--------|----------------------------------------------|----------
   * −6 | 4      | 1..4 (U=0,L=1..4)                            | Нельзя сделать +4 "Просто" (места нет), делаем +4 как +5−1, затем заем −10
   * −7 | 3      | 2..4 (U=0,L=2..4)                            | Нельзя сделать +3 "Просто", делаем +3 как +5−2
   * −8 | 2      | 3..4 (U=0,L=3..4)                            | Нельзя сделать +2 "Просто", делаем +2 как +5−3
   * −9 | 1      | 4 (U=0,L=4)                                  | Нельзя сделать +1 "Просто", делаем +1 как +5−4
   *
   * @param {number} digit - цифра МИКС (6-9)
   * @returns {number[]} - массив валидных состояний целевого разряда
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
   * Таблица B/D - ограничения на следующий разряд для МИКС
   *
   * Для +МИКС: следующий разряд ∈ 0..8 (иначе перенос сделает переполнение)
   * Для −МИКС: следующий разряд ∈ 1..9 (иначе нечего занимать, уйдем в минус)
   *
   * @param {number} nextDigitValue - текущее значение следующего разряда (0-9)
   * @param {boolean} isAddition - это сложение?
   * @returns {boolean}
   */
  _canApplyMixToNextDigit(nextDigitValue, isAddition) {
    if (isAddition) {
      return nextDigitValue >= 0 && nextDigitValue <= 8; // для +МИКС
    } else {
      return nextDigitValue >= 1 && nextDigitValue <= 9; // для −МИКС
    }
  }

  // ========== СЕКЦИЯ 5: ПРОВЕРКА ВОЗМОЖНОСТИ МИКС ==========

  /**
   * Проверить: можно ли выполнить МИКС с данной цифрой и знаком?
   *
   * @param {number[]} states - текущее состояние массива
   * @param {number} digit - цифра МИКС (6-9)
   * @param {boolean} isAddition - сложение или вычитание
   * @returns {boolean}
   */
  _canApplyMix(states, digit, isAddition) {
    const targetValue = states[this.targetPosition] || 0;
    const nextValue = states[this.targetPosition + 1] || 0;

    // Проверка 1: ограничения на следующий разряд
    if (!this._canApplyMixToNextDigit(nextValue, isAddition)) {
      return false;
    }

    // Проверка 2: состояние целевого разряда должно быть в требуемом диапазоне
    const requirements = isAddition
      ? this._getAdditionRequirements(digit)
      : this._getSubtractionRequirements(digit);

    if (!requirements.includes(targetValue)) {
      return false;
    }

    // Проверка 3: физическая возможность формулы Друзья
    const friend = 10 - digit;

    if (isAddition) {
      // +k = +10 - friend
      // Нужно уметь вычесть friend из целевого разряда
      return this._canMinusDirect(targetValue, friend);
    } else {
      // -k = -10 + friend
      // Нужно уметь прибавить friend к целевому разряду
      return this._canPlusDirect(targetValue, friend);
    }
  }

  // ========== СЕКЦИЯ 6: ПОДГОТОВКА К МИКС (ТОЛЬКО "ПРОСТО") ==========

  /**
   * Найти путь от текущего состояния целевого разряда к требуемому используя ТОЛЬКО "Просто" шаги
   *
   * ВАЖНО: Шаги подготовки могут быть ЛЮБОГО знака (+ и -)
   *
   * @param {number} currentValue - текущее значение целевого разряда (0-9)
   * @param {number} targetValue - целевое значение целевого разряда (0-9)
   * @returns {number[]|null} - массив шагов для целевого разряда или null если невозможно
   */
  _findProstoPath(currentValue, targetValue) {
    if (currentValue === targetValue) {
      return []; // уже в целевом состоянии
    }

    const maxAttempts = 20;
    const path = [];
    let value = currentValue;
    let attempts = 0;

    while (value !== targetValue && attempts < maxAttempts) {
      attempts++;

      const delta = targetValue - value;
      const isUp = delta > 0;

      // Пробуем найти ПРЯМОЙ "Просто" шаг
      let found = false;

      if (isUp) {
        // Нужно увеличить значение
        for (let step = Math.min(9, delta); step >= 1; step--) {
          if (this._canPlusDirect(value, step) && value + step <= 9) {
            path.push(step);
            value += step;
            found = true;
            break;
          }
        }
      } else {
        // Нужно уменьшить значение
        for (let step = Math.min(9, Math.abs(delta)); step >= 1; step--) {
          if (this._canMinusDirect(value, step) && value - step >= 0) {
            path.push(-step);
            value -= step;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Прямой путь не найден - пробуем обходной через 0 или 9
        if (isUp && value < 5) {
          // Попробуем через 0 → 5 → target
          if (value > 0) {
            // Сначала вниз к 0
            for (let step = value; step >= 1; step--) {
              if (this._canMinusDirect(value, step)) {
                path.push(-step);
                value -= step;
                found = true;
                break;
              }
            }
          } else {
            // Потом вверх через 5
            if (this._canPlusDirect(0, 5)) {
              path.push(5);
              value = 5;
              found = true;
            }
          }
        } else if (!isUp && value >= 5) {
          // Попробуем через 9 → 5 → target
          if (value < 9) {
            // Сначала вверх к 9
            const toNine = 9 - value;
            for (let step = toNine; step >= 1; step--) {
              if (this._canPlusDirect(value, step)) {
                path.push(step);
                value += step;
                found = true;
                break;
              }
            }
          } else {
            // Потом вниз через 5
            if (this._canMinusDirect(9, 4)) {
              path.push(-4);
              value = 5;
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

    if (value !== targetValue) {
      return null; // не достигли цели
    }

    return path;
  }

  // ========== СЕКЦИЯ 7: ГЕНЕРАЦИЯ PROSTO ШАГОВ ==========

  /**
   * Сгенерировать допустимые PROSTO действия для текущего состояния
   *
   * @param {number[]} states - текущее состояние
   * @param {boolean} isFirst - это первое действие в цепочке?
   * @param {number[]} lastActions - последние N действий для избежания повторов
   * @returns {number[]} - массив допустимых действий
   */
  _getAvailableProstoActions(states, isFirst = false, lastActions = []) {
    const value = this._stateToNumber(states);
    const actions = [];

    // Шаг для изменения целевого разряда
    // digitCount=1, targetPosition=0: step = 1 (единицы)
    // digitCount=2, targetPosition=1: step = 10 (десятки)
    // digitCount=3, targetPosition=2: step = 100 (сотни)
    const step = Math.pow(10, this.targetPosition);

    const targetValue = states[this.targetPosition] || 0;

    // Функция проверки: не повторяем одно и то же число подряд
    const isRepeat = (action) => {
      if (lastActions.length === 0) return false;

      // Проверяем только ПОСЛЕДНЕЕ действие (подряд = непосредственно предыдущее)
      const lastAction = lastActions[lastActions.length - 1];

      // Блокируем если абсолютные значения совпадают (не важен знак)
      // Например: после +3 блокируем -3, после +68 блокируем -68
      if (Math.abs(lastAction) === Math.abs(action)) {
        return true; // ❌ Одно и то же число подряд
      }

      return false; // ✅ Разные числа
    };

    // Для многозначных: генерируем варианты с разными младшими разрядами
    // КРИТИЧЕСКИ ВАЖНО: Младший разряд (единицы) ВСЕГДА 1-9, НИКОГДА не 0!
    const generateLowerDigits = () => {
      if (this.targetPosition === 0) return [0]; // для digitCount=1 нет младших разрядов

      const variants = new Set();
      const maxVariants = 9; // генерируем до 9 вариантов

      while (variants.size < maxVariants) {
        // Генерируем число, где единицы ВСЕГДА 1-9
        const units = Math.floor(Math.random() * 9) + 1; // 1-9

        // Для остальных разрядов (если есть): 0-9
        let randomLower = units;
        for (let pos = 1; pos < this.targetPosition; pos++) {
          const digitValue = Math.floor(Math.random() * 10); // 0-9
          randomLower += digitValue * Math.pow(10, pos);
        }

        variants.add(randomLower);
      }

      return Array.from(variants);
    };

    const lowerDigitsVariants = generateLowerDigits();

    // Сложение (всегда доступно)
    for (let digit = 1; digit <= 9; digit++) {
      if (isFirst && digit <= 0) continue; // первое действие должно быть положительным

      // Для многозначных: пробуем разные комбинации с младшими разрядами
      for (const lowerDigit of lowerDigitsVariants) {
        // PROSTO действие: изменяем целевой разряд + младшие разряды
        const action = digit * step + lowerDigit;
        const newValue = value + action;

        if (newValue > this.maxValue) continue; // выход за диапазон

        const newStates = this._numberToState(newValue);
        const newTargetValue = newStates[this.targetPosition] || 0;

        // Проверяем: можно ли сделать это действие "Просто" в целевом разряде
        if (this._canPlusDirect(targetValue, digit) && targetValue + digit === newTargetValue) {
          if (!isRepeat(action)) {
            actions.push(action);
          }
        }
      }
    }

    // Вычитание (если не первое действие)
    if (!isFirst) {
      for (let digit = 1; digit <= 9; digit++) {
        // Для многозначных: пробуем разные комбинации с младшими разрядами
        for (const lowerDigit of lowerDigitsVariants) {
          // PROSTO действие: изменяем целевой разряд + младшие разряды
          const action = digit * step + lowerDigit;
          const newValue = value - action;

          if (newValue < 0) continue; // уход в минус

          const newStates = this._numberToState(newValue);
          const newTargetValue = newStates[this.targetPosition] || 0;

          // Проверяем: можно ли сделать это действие "Просто" в целевом разряде
          if (this._canMinusDirect(targetValue, digit) && targetValue - digit === newTargetValue) {
            if (!isRepeat(-action)) {
              actions.push(-action);
            }
          }
        }
      }
    }

    return actions;
  }

  // ========== СЕКЦИЯ 8: ПРИМЕНЕНИЕ ДЕЙСТВИЯ ==========

  /**
   * Применить простое действие к состоянию
   *
   * @param {number[]} states - текущее состояние
   * @param {number} action - действие (может быть отрицательным)
   * @returns {number[]} - новое состояние
   */
  _applyAction(states, action) {
    const value = this._stateToNumber(states);
    const newValue = value + action;
    return this._numberToState(newValue);
  }

  /**
   * Применить МИКС действие к состоянию
   *
   * Для многозначных: действие = digit × 10^targetPosition + (нижние разряды)
   * Нижние разряды выбираются случайно через соответствующие правила
   *
   * @param {number[]} states - текущее состояние
   * @param {number} digit - цифра МИКС (6-9)
   * @param {boolean} isAddition - сложение или вычитание
   * @returns {object} - {newStates, fullAction, lowerDigits}
   */
  _applyMixAction(states, digit, isAddition) {
    const friend = 10 - digit;

    // Для многозначных: выбираем случайные значения для нижних разрядов (0..targetPosition-1)
    // Используем правило: Friends для позиции targetPosition-1 если цифра 6-9, Brothers для позиции targetPosition-2 и ниже
    // ВАЖНО: Запрещаем круглые числа - младший разряд (единицы) ВСЕГДА 1-9
    const lowerDigits = [];
    for (let pos = this.targetPosition - 1; pos >= 0; pos--) {
      let randomDigit;
      if (pos === 0) {
        // Младший разряд (единицы): ТОЛЬКО 1-9 (НЕ 0!)
        randomDigit = Math.floor(Math.random() * 9) + 1;
      } else {
        // Остальные разряды: могут быть 0-9
        randomDigit = Math.floor(Math.random() * 10);
      }
      lowerDigits.push(randomDigit);
    }

    // Полное действие: digit × 10^targetPosition + нижние разряды
    let fullAction = digit * Math.pow(10, this.targetPosition);
    for (let i = 0; i < lowerDigits.length; i++) {
      const pos = this.targetPosition - 1 - i;
      fullAction += lowerDigits[i] * Math.pow(10, pos);
    }

    if (!isAddition) {
      fullAction = -fullAction;
    }

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:
    // Применяем ПОЛНОЕ действие (включая младшие разряды) к состоянию
    // Раньше применялся только эффект МИКС к целевому разряду, а младшие разряды игнорировались!
    const currentValue = this._stateToNumber(states);
    const newValue = currentValue + fullAction;
    const newStates = this._numberToState(newValue);

    return {
      newStates,
      fullAction,
      lowerDigits
    };
  }

  // ========== СЕКЦИЯ 9: ГЛАВНЫЙ МЕТОД ГЕНЕРАЦИИ ==========

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
    let states = Array(this.stateDigitCount).fill(0);
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

      // ВАЖНО: Не пытаемся делать МИКС на первых 1-2 шагах для разнообразия
      const minStepsBeforeMix = Math.min(2, Math.floor(targetSteps / 3));
      const canTryMixNow = steps.length >= minStepsBeforeMix;

      // Даже если нужно больше МИКС, используем вероятность (70%) вместо 100%
      const mixProbability = needMoreMix ? 0.7 : this.config.mixTryRate;
      const tryMix = canTryMixNow && (needMoreMix || stepsRemaining >= 2) && Math.random() < mixProbability;

      if (tryMix) {
        // Попытка сгенерировать МИКС действие
        const mixResult = this._tryGenerateMixAction(states, isFirst, lastActions);

        if (mixResult) {
          // Успешно сгенерировали МИКС
          // Добавляем подготовительные шаги
          for (const prepStep of mixResult.preparationSteps) {
            steps.push(prepStep);
            states = this._applyAction(states, prepStep.action);
            lastActions.push(prepStep.action);
          }

          // Добавляем МИКС шаг
          steps.push(mixResult.mixStep);
          states = mixResult.newStates;
          lastActions.push(mixResult.mixStep.action);
          mixCount++;

          continue;
        }
      }

      // Генерируем простое действие
      const prostoActions = this._getAvailableProstoActions(states, isFirst, lastActions);

      if (prostoActions.length === 0) {
        // Нет доступных действий
        if (steps.length >= 3 && mixCount >= minMixCount) {
          break; // достаточно шагов
        }
        return null;
      }

      // Выбираем случайное действие
      const action = prostoActions[Math.floor(Math.random() * prostoActions.length)];
      const newStates = this._applyAction(states, action);

      // Проверяем границы
      const newValue = this._stateToNumber(newStates);
      if (newValue < 0 || newValue > this.maxValue) {
        continue; // выход за диапазон
      }

      steps.push({
        displayOp: action >= 0 ? '+' : '-',
        displayVal: Math.abs(action),
        type: 'PROSTO',
        action: action,
        meta: {
          statesBefore: this._copyState(states),
          statesAfter: this._copyState(newStates)
        }
      });

      states = newStates;
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

    const finalValue = this._stateToNumber(states);

    // Подсчет статистики
    const stats = {
      mixCount: mixCount,
      prostoCount: steps.filter(s => s.type === 'PROSTO').length,
      digitDistribution: {},
      attemptCount: attempts
    };

    for (const digit of this.config.selectedMixDigits) {
      stats.digitDistribution[digit] = steps.filter(s => s.type === 'MIX' && s.meta?.mixDigit === digit).length;
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
  _tryGenerateMixAction(states, isFirst, lastActions) {
    const { selectedMixDigits, onlyAddition, onlySubtraction } = this.config;

    // Выбираем случайную цифру МИКС (избегая повторов)
    const availableDigits = selectedMixDigits.filter(digit => {
      const window = this.config.avoidRepeatWindow;
      if (lastActions.length === 0 || window === 0) return true;

      const recentSteps = lastActions.slice(-window);

      // Не повторяем ту же цифру
      const digitAction = digit * Math.pow(10, this.targetPosition);
      if (recentSteps.some(a => Math.abs(a) === digitAction)) {
        return false;
      }

      return true;
    });

    if (availableDigits.length === 0) {
      // Все цифры были недавно использованы
      return null;
    }

    // Перемешиваем доступные цифры для равномерного распределения
    const shuffledDigits = [...availableDigits].sort(() => Math.random() - 0.5);

    // Пробуем разные цифры, пока не найдём подходящую
    for (const digit of shuffledDigits) {
      const result = this._tryGenerateMixForDigit(states, digit, isFirst, onlyAddition, onlySubtraction);
      if (result) {
        return result;
      }
    }

    // Ни одна цифра не подошла
    return null;
  }

  /**
   * Попытка сгенерировать МИКС для конкретной цифры
   */
  _tryGenerateMixForDigit(states, digit, isFirst, onlyAddition, onlySubtraction) {
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

    // Перемешиваем знаки для равномерного распределения
    const shuffledSigns = [...possibleSigns].sort(() => Math.random() - 0.5);

    // Пробуем разные знаки
    for (const isAddition of shuffledSigns) {
      const result = this._tryGenerateMixForDigitAndSign(states, digit, isAddition, lastActions);
      if (result) {
        return result;
      }
    }

    // Не удалось с этой цифрой
    return null;
  }

  /**
   * Попытка сгенерировать МИКС для конкретной цифры и знака
   */
  _tryGenerateMixForDigitAndSign(states, digit, isAddition, lastActions = []) {
    // Проверяем: можно ли выполнить МИКС с текущим состоянием?
    if (this._canApplyMix(states, digit, isAddition)) {
      // Можем выполнить МИКС сразу - НЕ нужна подготовка
      const { newStates, fullAction, lowerDigits } = this._applyMixAction(states, digit, isAddition);

      // НОВАЯ ПРОВЕРКА: не повторяем одно и то же число подряд
      if (lastActions.length > 0) {
        const lastAction = lastActions[lastActions.length - 1];
        if (Math.abs(lastAction) === Math.abs(fullAction)) {
          return null; // ❌ Одно и то же число подряд - пропускаем это действие
        }
      }

      const friend = 10 - digit;
      const brother = 5 - friend;

      return {
        preparationSteps: [],
        mixStep: {
          displayOp: isAddition ? '+' : '-',
          displayVal: Math.abs(fullAction),
          type: 'MIX',
          action: fullAction,
          meta: {
            statesBefore: this._copyState(states),
            statesAfter: this._copyState(newStates),
            mixDigit: digit,
            lowerDigits: lowerDigits,
            formula: isAddition
              ? [
                  { step: this._getPositionName(this.targetPosition), op: '+', val: 5 },
                  { step: this._getPositionName(this.targetPosition), op: '-', val: brother },
                  { step: this._getPositionName(this.targetPosition + 1), op: '+', val: 1 },
                  { step: this._getPositionName(this.targetPosition), op: '-', val: friend }
                ]
              : [
                  { step: this._getPositionName(this.targetPosition), op: '-', val: 5 },
                  { step: this._getPositionName(this.targetPosition), op: '+', val: brother },
                  { step: this._getPositionName(this.targetPosition + 1), op: '-', val: 1 },
                  { step: this._getPositionName(this.targetPosition), op: '+', val: friend }
                ]
          }
        },
        newStates: newStates
      };
    }

    // Нужна подготовка - ищем путь к целевому состоянию
    const requirements = isAddition
      ? this._getAdditionRequirements(digit)
      : this._getSubtractionRequirements(digit);

    if (requirements.length === 0) {
      return null;
    }

    const targetValue = requirements[0];
    const currentValue = states[this.targetPosition] || 0;

    // Ищем путь подготовки
    const preparationPath = this._findProstoPath(currentValue, targetValue);

    if (!preparationPath) {
      return null; // не можем подготовить
    }

    // Проверяем ограничения на следующий разряд ПОСЛЕ подготовки
    // ВАЖНО: Генерируем случайные младшие разряды для КАЖДОГО подготовительного шага
    let prepStates = this._copyState(states);
    const preparationSteps = [];

    for (const step of preparationPath) {
      // Базовое действие для целевого разряда
      let prepAction = step * Math.pow(10, this.targetPosition);

      // КРИТИЧЕСКИ ВАЖНО: Добавляем случайные младшие разряды (единицы ВСЕГДА 1-9)
      if (this.targetPosition > 0) {
        // Единицы: ВСЕГДА 1-9 (НЕ 0!)
        const units = Math.floor(Math.random() * 9) + 1;
        prepAction += units;

        // Остальные разряды (если есть): 0-9
        for (let pos = 1; pos < this.targetPosition; pos++) {
          const digitValue = Math.floor(Math.random() * 10);
          prepAction += digitValue * Math.pow(10, pos);
        }
      }

      prepStates = this._applyAction(prepStates, prepAction);

      preparationSteps.push({
        displayOp: prepAction >= 0 ? '+' : '-',
        displayVal: Math.abs(prepAction),
        type: 'PROSTO',
        action: prepAction,
        meta: {
          purpose: 'preparation_for_mix'
        }
      });
    }

    const nextValue = prepStates[this.targetPosition + 1] || 0;
    if (!this._canApplyMixToNextDigit(nextValue, isAddition)) {
      return null; // следующий разряд вышел за допустимые границы
    }

    // Применяем МИКС
    const { newStates, fullAction, lowerDigits } = this._applyMixAction(prepStates, digit, isAddition);

    // НОВАЯ ПРОВЕРКА: не повторяем одно и то же число подряд
    // Проверяем последнее действие (либо последнее подготовительное, либо из lastActions)
    const allActions = preparationSteps.length > 0
      ? preparationSteps.map(s => s.action)
      : lastActions;

    if (allActions.length > 0) {
      const lastActionValue = allActions[allActions.length - 1];
      if (Math.abs(lastActionValue) === Math.abs(fullAction)) {
        return null; // ❌ Одно и то же число подряд - пропускаем это действие
      }
    }

    const friend = 10 - digit;
    const brother = 5 - friend;

    return {
      preparationSteps: preparationSteps,
      mixStep: {
        displayOp: isAddition ? '+' : '-',
        displayVal: Math.abs(fullAction),
        type: 'MIX',
        action: fullAction,
        meta: {
          statesBefore: this._copyState(prepStates),
          statesAfter: this._copyState(newStates),
          mixDigit: digit,
          lowerDigits: lowerDigits,
          formula: isAddition
            ? [
                { step: this._getPositionName(this.targetPosition), op: '+', val: 5 },
                { step: this._getPositionName(this.targetPosition), op: '-', val: brother },
                { step: this._getPositionName(this.targetPosition + 1), op: '+', val: 1 },
                { step: this._getPositionName(this.targetPosition), op: '-', val: friend }
              ]
            : [
                { step: this._getPositionName(this.targetPosition), op: '-', val: 5 },
                { step: this._getPositionName(this.targetPosition), op: '+', val: brother },
                { step: this._getPositionName(this.targetPosition + 1), op: '-', val: 1 },
                { step: this._getPositionName(this.targetPosition), op: '+', val: friend }
              ]
        }
      },
      newStates: newStates
    };
  }

  // ========== СЕКЦИЯ 10: ВАЛИДАЦИЯ ==========

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
    let states = Array(this.stateDigitCount).fill(0);
    for (const step of steps) {
      if (step.type === 'MIX') {
        states = step.meta.statesAfter;
      } else {
        states = this._applyAction(states, step.action);
      }

      const value = this._stateToNumber(states);
      if (value < 0 || value > this.maxValue) {
        return false; // выход за диапазон
      }
    }

    // 4. Корректность финального ответа
    const computedFinal = this._stateToNumber(states);
    if (computedFinal !== finalValue) {
      return false;
    }

    return true;
  }

  // ========== СЕКЦИЯ 11: FALLBACK ==========

  /**
   * Упрощенный fallback-пример если генерация не удалась
   */
  _fallbackExample() {
    const targetSteps = this.config.chainLength;
    const steps = [];
    let states = Array(this.stateDigitCount).fill(0);
    let mixCount = 0;

    this._log(`⚠️ Используем fallback генерацию для ${targetSteps} шагов`);

    // Пытаемся добавить хотя бы 1 МИКС
    const digit = this.config.selectedMixDigits[0] || 6;

    // Подготовка к МИКС: доводим целевой разряд до 8 для +6
    // ВАЖНО: Избегаем круглых чисел - добавляем случайные младшие разряды
    let prepAction = 8 * Math.pow(10, this.targetPosition);
    if (this.targetPosition > 0) {
      // Добавляем случайные ненулевые единицы (1-9)
      prepAction += Math.floor(Math.random() * 9) + 1;
    }
    states = this._applyAction(states, prepAction);
    steps.push({
      displayOp: '+',
      displayVal: prepAction,
      type: 'PROSTO',
      action: prepAction,
      meta: {}
    });

    // Добавляем МИКС
    if (states[this.targetPosition] === 8 && states[this.targetPosition + 1] <= 8 && steps.length < targetSteps) {
      const { newStates, fullAction } = this._applyMixAction(states, digit, true);
      steps.push({
        displayOp: '+',
        displayVal: Math.abs(fullAction),
        type: 'MIX',
        action: fullAction,
        meta: {
          statesBefore: this._copyState(states),
          statesAfter: this._copyState(newStates),
          formula: []
        }
      });
      states = newStates;
      mixCount++;
    }

    // Заполняем остальные шаги простыми действиями
    const step = Math.pow(10, this.targetPosition);
    while (steps.length < targetSteps) {
      // ВАЖНО: Избегаем круглых чисел - добавляем случайные единицы
      let action = step;
      if (this.targetPosition > 0) {
        // Добавляем случайные ненулевые единицы (1-9)
        action += Math.floor(Math.random() * 9) + 1;
      }
      // Случайно выбираем знак
      action = Math.random() < 0.5 ? action : -action;

      const newStates = this._applyAction(states, action);
      const newValue = this._stateToNumber(newStates);

      if (newValue >= 0 && newValue <= this.maxValue) {
        steps.push({
          displayOp: action >= 0 ? '+' : '-',
          displayVal: Math.abs(action),
          type: 'PROSTO',
          action: action,
          meta: {}
        });
        states = newStates;
      } else {
        // Если не можем - просто останавливаемся
        break;
      }
    }

    const finalValue = this._stateToNumber(states);

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

  // ========== СЕКЦИЯ 12: ФОРМАТИРОВАНИЕ ДЛЯ ТРЕНАЖЕРА ==========

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
          mixDigit: step.meta.mixDigit || step.displayVal,
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
