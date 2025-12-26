// ext/core/FriendsExampleGenerator.js - Специализированный генератор для правила "Друзья"
//
// ПРАВИЛО "ДРУЗЬЯ" (через 10):
// Применяется когда невозможно выполнить +n или -n напрямую на текущем разряде.
// Действие выполняется через следующий разряд (десяток).
//
// ФОРМУЛЫ:
//   СЛОЖЕНИЕ:  +n = +10 - friend,  где friend = 10 - n
//   ВЫЧИТАНИЕ: -n = -10 + friend,  где friend = 10 - n
//
// ЦЕЛЕВОЙ РАЗРЯД (где происходит переход через 10):
//   Двузначные (digitCount=2): целевой = 1 (десятки)
//   Трехзначные (digitCount=3): целевой = 2 (сотни)
//   Четырехзначные (digitCount=4): целевой = 3 (тысячи)
//   Общая формула: targetPosition = digitCount - 1
//
// ДИАПАЗОНЫ (промежуточные результаты могут расти):
//   Двузначные: 0-999 (трехзначные промежуточные!)
//   Трехзначные: 0-9999 (четырехзначные промежуточные!)
//   Формула: maxValue = 10^(digitCount+1) - 1
//
// ПРАВИЛО ПРОСТО:
//   Одно ОДНОНАПРАВЛЕННОЕ движение бусин:
//   - Сложение: только ДОБАВЛЕНИЕ (U: 0→1, L: увеличение)
//   - Вычитание: только УБИРАНИЕ (U: 1→0, L: уменьшение)
//   - НЕЛЬЗЯ смешивать добавление и убирание!
//
// ЗАПРЕТ МИКСА:
//   Нельзя в одном многозначном действии смешивать:
//   - Друзья в целевом разряде + Братья в другом разряде
//   Все разряды (кроме целевого) должны работать по правилу Просто!

export class FriendsExampleGenerator {
  constructor(config = {}) {
    // Конфигурация генератора
    this.config = {
      // Какие цифры "друзья" тренируем: [1..9]
      selectedDigits: Array.isArray(config.selectedDigits)
        ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9],

      // Разрядность ДЕЙСТВИЙ (1 для однозначных, 2 для двузначных и т.д.)
      digitCount: config.digitCount || 1,

      // ТОЧНОЕ количество шагов (не диапазон!)
      stepsCount: config.stepsCount || config.maxSteps || 7,

      // Ограничения направления
      onlyAddition: config.onlyAddition || false,
      onlySubtraction: config.onlySubtraction || false,

      // Какие цифры разрешены для простых (вспомогательных) действий
      simpleDigits: config.blocks?.simple?.digits
        ? config.blocks.simple.digits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9],

      // Активен ли блок "Братья" (влияет на использование верхней бусины)
      brothersActive: config.blocks?.brothers?.active || false,

      // Тихий режим (отключает детальное логирование fallback)
      silent: config.silent || false,

      // Исходная конфигурация
      blocks: config.blocks || {}
    };

    // Валидация
    if (this.config.selectedDigits.length === 0) {
      if (!this.config.silent) {
        console.warn("⚠️ FriendsExampleGenerator: не выбрано ни одной цифры! Используем [1]");
      }
      this.config.selectedDigits = [1];
    }

    // Проверяем что digitCount >= 1
    if (this.config.digitCount < 1) {
      if (!this.config.silent) {
        console.warn("⚠️ FriendsExampleGenerator: digitCount должен быть >= 1! Устанавливаем 1");
      }
      this.config.digitCount = 1;
    }

    // МИНИМУМ для правила Друзья: 4 шага
    // Причина: нужно минимум 1-2 шага подготовки + 1 Friends + 1 заполнение
    const MIN_STEPS_FOR_FRIENDS = 4;
    if (this.config.stepsCount < MIN_STEPS_FOR_FRIENDS) {
      if (!this.config.silent) {
        console.warn(`⚠️ FriendsExampleGenerator: правило Друзья требует минимум ${MIN_STEPS_FOR_FRIENDS} шага! Было: ${this.config.stepsCount}, устанавливаем ${MIN_STEPS_FOR_FRIENDS}`);
      }
      this.config.stepsCount = MIN_STEPS_FOR_FRIENDS;
    }

    // РАЗРЯДНОСТЬ СОСТОЯНИЯ = digitCount + 1 (дополнительный разряд для переноса)
    // Примеры:
    //   digitCount=1 (действия однозначные) → stateDigitCount=2 [единицы, десятки]
    //   digitCount=2 (действия двузначные)  → stateDigitCount=3 [единицы, десятки, сотни]
    //   digitCount=3 (действия трехзначные) → stateDigitCount=4 [единицы, десятки, сотни, тысячи]
    this.stateDigitCount = this.config.digitCount + 1;

    // ЦЕЛЕВОЙ РАЗРЯД = самый старший разряд ДЕЙСТВИЯ (digitCount - 1)
    // Это разряд где применяется правило "Друзья"
    this.targetPosition = this.config.digitCount - 1;

    // РАСШИРЕННЫЙ ДИАПАЗОН (промежуточные результаты могут расти)
    this.maxValue = Math.pow(10, this.stateDigitCount + 1) - 1;

    // Трекинг использования цифр Friends для разнообразия
    this.digitUsageCount = {};
    for (const digit of this.config.selectedDigits) {
      this.digitUsageCount[digit] = 0;
    }

    this._log(`🤝 FriendsExampleGenerator создан:
  Выбранные цифры Друзья: [${this.config.selectedDigits.join(', ')}]
  Простые цифры: [${this.config.simpleDigits.join(', ')}]
  Разрядность действий: ${this.config.digitCount}
  Разрядность состояния: ${this.stateDigitCount}
  Целевой разряд: ${this.targetPosition} (${this._getPositionName(this.targetPosition)})
  Точное количество шагов: ${this.config.stepsCount}
  Максимальное значение: ${this.maxValue}
  Братья активны: ${this.config.brothersActive} (верхняя бусина ${this.config.brothersActive ? 'разрешена' : 'запрещена'})`);
  }

  // Вспомогательный метод: название разряда
  _getPositionName(pos) {
    const names = ['единицы', 'десятки', 'сотни', 'тысячи', 'десятки тысяч', 'сотни тысяч', 'миллионы'];
    return names[pos] || `разряд ${pos}`;
  }

  // Утилита для логирования с учетом флага silent
  _log(...args) {
    if (!this.config.silent) {
      console.log(...args);
    }
  }

  // Утилита для предупреждений (подавляются в тихом режиме)
  _warn(...args) {
    if (!this.config.silent) {
      console.warn(...args);
    }
  }

  // Утилита для ошибок (всегда выводятся)
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

  /**
   * Проверка правила ПРОСТО для сложения: ОДНО ОДНОНАПРАВЛЕННОЕ движение вверх
   *
   * Можно ТОЛЬКО ДОБАВЛЯТЬ бусины (нельзя убирать):
   * - Верхняя: 0→1 (добавить) или 0→0 / 1→1 (не трогать)
   * - Нижние: L→L+k (добавить) или L→L (не трогать)
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
   * - Верхняя: 1→0 (убрать) или 0→0 / 1→1 (не трогать)
   * - Нижние: L→L-k (убрать) или L→L (не трогать)
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

  /**
   * Можно ли добавить +10 к целевому разряду (перенос)?
   * @param {number[]} states - состояние всех разрядов
   * @returns {boolean}
   */
  _canAddTenToTarget(states) {
    const targetVal = states[this.targetPosition] || 0;
    return targetVal < 9; // Есть свободные бусины
  }

  /**
   * Можно ли убрать -10 из целевого разряда (заём)?
   * @param {number[]} states - состояние всех разрядов
   * @returns {boolean}
   */
  _canSubtractTenFromTarget(states) {
    const targetVal = states[this.targetPosition] || 0;
    return targetVal > 0; // Есть активные бусины
  }

  // ========== СЕКЦИЯ 2: МНОГОЗНАЧНЫЕ ДЕЙСТВИЯ ==========

  /**
   * Добавляет случайные цифры к базовому действию для нецелевых разрядов
   *
   * Например: baseAction = +300 (целевой разряд 2), states = [5, 3, 0]
   * Результат: +347 где 4 для десятков, 7 для единиц (подобраны по правилу Просто)
   *
   * @param {number} baseAction - базовое действие (например +300, -200)
   * @param {number[]} states - текущее состояние
   * @param {boolean} isFriend - это Friends действие?
   * @returns {number} - полное многозначное действие с заполненными разрядами
   */
  _addRandomDigitsToAction(baseAction, states, isFriend = false) {
    const isAddition = baseAction >= 0;
    const actionDigits = this._numberToDigits(Math.abs(baseAction), this.config.digitCount);

    // Для каждого нецелевого разряда пытаемся добавить случайную цифру
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      if (pos === this.targetPosition) continue; // Целевой разряд не трогаем

      const currentVal = states[pos] || 0;
      const possibleDigits = [];

      // КРИТИЧНО: Для нецелевых разрядов ОБЯЗАТЕЛЬНО проверяем правило Просто!
      // Без этого генерируются невозможные действия на абакусе (например 4+2 требует Братья)
      for (let d = 0; d <= 9; d++) {
        if (isAddition) {
          // Для сложения: проверяем границы И правило Просто (однонаправленное движение)
          if (currentVal + d <= 9 && (d === 0 || this._canPlusDirect(currentVal, d))) {
            possibleDigits.push(d);
          }
        } else {
          // Для вычитания: проверяем границы И правило Просто
          if (currentVal >= d && (d === 0 || this._canMinusDirect(currentVal, d))) {
            possibleDigits.push(d);
          }
        }
      }

      if (possibleDigits.length > 0) {
        // ВСЕГДА предпочитаем ненулевые цифры, если они доступны
        // Используем 0 ТОЛЬКО если других вариантов нет
        const nonZero = possibleDigits.filter(d => d > 0);
        const candidates = nonZero.length > 0 ? nonZero : possibleDigits;
        actionDigits[pos] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    const result = this._digitsToNumber(actionDigits);
    return isAddition ? result : -result;
  }

  /**
   * Разбить число на цифры по разрядам
   *
   * Пример: 123 → [3, 2, 1] (младшие разряды первые)
   *
   * @param {number} num - число
   * @param {number} minDigits - минимальное количество разрядов
   * @returns {number[]} - массив цифр
   */
  _numberToDigits(num, minDigits = 1) {
    const digits = [];
    let n = Math.abs(num);

    while (n > 0 || digits.length < minDigits) {
      digits.push(n % 10);
      n = Math.floor(n / 10);
    }

    return digits;
  }

  /**
   * Собрать число из цифр по разрядам
   *
   * Пример: [3, 2, 1] → 123
   *
   * @param {number[]} digits - массив цифр (младшие первые)
   * @returns {number}
   */
  _digitsToNumber(digits) {
    let result = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      result = result * 10 + digits[i];
    }
    return result;
  }

  /**
   * Проверить: можно ли применить многозначное действие по правилу Просто?
   *
   * КРИТИЧНО: Проверяем КАЖДЫЙ разряд отдельно!
   *
   * @param {number[]} states - текущее состояние
   * @param {number} value - значение действия (может быть многозначным)
   * @returns {boolean}
   */
  _canApplySimpleDirect(states, value) {
    const isAddition = value >= 0;
    const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);

    // Проверяем каждый разряд
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      const currentVal = states[pos] || 0;
      const digitChange = actionDigits[pos] || 0;

      if (digitChange === 0) continue; // Разряд не меняется

      if (isAddition) {
        if (!this._canPlusDirect(currentVal, digitChange)) {
          return false; // ❌ Этот разряд требует Братья
        }
      } else {
        if (!this._canMinusDirect(currentVal, digitChange)) {
          return false; // ❌ Этот разряд требует Братья
        }
      }
    }

    // Все разряды можно сделать правилом Просто!
    return true;
  }

  /**
   * Проверить: является ли действие Friends (переход через 10 в целевом разряде)?
   *
   * @param {number[]} states - текущее состояние
   * @param {number} value - значение действия
   * @param {number} friendDigit - цифра Friends (1-9)
   * @returns {boolean}
   */
  _isFriendsAction(states, value, friendDigit) {
    const isAddition = value >= 0;
    const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);
    const targetDigit = actionDigits[this.targetPosition] || 0;

    // Проверка 1: цифра в целевом разряде должна совпадать с friendDigit
    if (targetDigit !== friendDigit) {
      return false;
    }

    const targetVal = states[this.targetPosition] || 0;

    if (isAddition) {
      // Проверка 2: должен быть переход через 10
      const newVal = targetVal + targetDigit;
      if (newVal < 10) {
        return false; // Нет перехода через 10
      }

      // Проверка 3: можем ли выполнить формулу +n = +10 - friend?
      const friend = 10 - targetDigit;
      return this._canMinusDirect(targetVal, friend);
    } else {
      // Проверка 2: должен быть переход через 0
      const newVal = targetVal - targetDigit;
      if (newVal >= 0) {
        return false; // Нет перехода через 0
      }

      // Проверка 3: можем ли выполнить формулу -n = -10 + friend?
      const friend = 10 - targetDigit;
      return this._canPlusDirect(targetVal, friend);
    }
  }

  /**
   * Проверить: есть ли МИКС (Друзья в целевом + Братья в другом)?
   *
   * КРИТИЧНО: Все разряды кроме целевого должны работать по Просто!
   *
   * @param {number[]} states - текущее состояние
   * @param {number} value - значение действия
   * @param {number} friendDigit - цифра Friends
   * @returns {boolean} - true если есть МИКС (действие недоступно)
   */
  _hasMix(states, value, friendDigit) {
    const isAddition = value >= 0;
    const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);

    // Проверяем все разряды КРОМЕ целевого
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      if (pos === this.targetPosition) continue; // Целевой разряд пропускаем

      const currentVal = states[pos] || 0;
      const digitChange = actionDigits[pos] || 0;

      if (digitChange === 0) continue; // Разряд не меняется

      // Проверяем: можем ли сделать этот разряд по правилу Просто?
      if (isAddition) {
        if (!this._canPlusDirect(currentVal, digitChange)) {
          return true; // ❌ МИКС! Этот разряд требует Братья
        }
      } else {
        if (!this._canMinusDirect(currentVal, digitChange)) {
          return true; // ❌ МИКС! Этот разряд требует Братья
        }
      }
    }

    // Проверка переполнения разрядов (не больше 9)
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      const currentVal = states[pos] || 0;
      const digitChange = actionDigits[pos] || 0;
      const newVal = isAddition ? currentVal + digitChange : currentVal - digitChange;

      if (newVal < 0 || newVal > 9) {
        return true; // ❌ Выход за пределы разряда
      }
    }

    return false; // ✅ МИКСА нет, все разряды работают по Просто
  }

  // ========== СЕКЦИЯ 3: ТАБЛИЦЫ ТРЕБОВАНИЙ ДЛЯ КАЖДОЙ ЦИФРЫ ==========

  /**
   * Получить требования к состоянию целевого разряда для применения +digit по правилу Друзья
   *
   * Возвращает: { minState, maxState, states: [...] }
   */
  _getAdditionRequirements(digit) {
    const friend = 10 - digit;

    switch(digit) {
      case 1:
        return { minState: 9, maxState: 9, states: [9] };
      case 2:
        return { minState: 8, maxState: 9, states: [8, 9] };
      case 3:
        return { minState: 7, maxState: 9, states: [7, 8, 9] };
      case 4:
        return { minState: 6, maxState: 9, states: [6, 7, 8, 9] };
      case 5:
        return { minState: 5, maxState: 9, states: [5, 6, 7, 8, 9] };
      case 6:
        return { minState: 4, maxState: 9, states: [4, 5, 6, 7, 8, 9] };
      case 7:
        return { minState: 3, maxState: 9, states: [3, 4, 5, 6, 7, 8, 9] };
      case 8:
        return { minState: 2, maxState: 9, states: [2, 3, 4, 5, 6, 7, 8, 9] };
      case 9:
        return { minState: 1, maxState: 9, states: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
      default:
        return { minState: friend, maxState: 9, states: [] };
    }
  }

  /**
   * Получить требования к состоянию целевого разряда для применения -digit по правилу Друзья
   *
   * Возвращает: { minState, maxState, states: [...] }
   */
  _getSubtractionRequirements(digit) {
    const friend = 10 - digit;
    const maxAllowed = 9 - friend;

    switch(digit) {
      case 1:
        return { minState: 0, maxState: 0, states: [0] };
      case 2:
        return { minState: 0, maxState: 1, states: [0, 1] };
      case 3:
        return { minState: 0, maxState: 2, states: [0, 1, 2] };
      case 4:
        return { minState: 0, maxState: 3, states: [0, 1, 2, 3] };
      case 5:
        return { minState: 0, maxState: 4, states: [0, 1, 2, 3, 4] };
      case 6:
        return { minState: 0, maxState: 3, states: [0, 1, 2, 3] };
      case 7:
        return { minState: 0, maxState: 2, states: [0, 1, 2] };
      case 8:
        return { minState: 0, maxState: 1, states: [0, 1] };
      case 9:
        return { minState: 0, maxState: 0, states: [0] };
      default:
        return { minState: 0, maxState: maxAllowed, states: [] };
    }
  }

  // ========== СЕКЦИЯ 4: ГЕНЕРАЦИЯ ПРИМЕРОВ ==========

  /**
   * Главный метод: сгенерировать пример с ТОЧНЫМ количеством шагов
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

      this._log(`✅ Пример сгенерирован за ${attempt} попыток: ${this._formatForDisplay(example)}`);
      return example;
    }

    // Переход на fallback (не критическая ошибка - fallback всегда работает)
    this._warn(`❌ Не удалось сгенерировать пример за ${maxAttempts} попыток!`);

    // Попытки fallback с минимизацией круглых чисел и улучшенной оценкой качества
    const maxFallbackAttempts = 30; // Увеличено с 10 до 30 для лучшего качества
    let bestExample = null;
    let bestScore = Infinity; // Чем ниже счет, тем лучше

    for (let attempt = 0; attempt < maxFallbackAttempts; attempt++) {
      const example = this._fallbackExample();
      if (!example || !example.steps) continue;

      // Подсчет круглых чисел (оканчивающихся на 0)
      const roundCount = example.steps.filter(s => Math.abs(s.action) % 10 === 0).length;

      // Штраф за подряд идущие круглые числа
      let consecutiveRoundPenalty = 0;
      for (let i = 0; i < example.steps.length - 1; i++) {
        if (Math.abs(example.steps[i].action) % 10 === 0 &&
            Math.abs(example.steps[i + 1].action) % 10 === 0) {
          consecutiveRoundPenalty += 5; // Большой штраф за подряд идущие круглые
        }
      }

      // Штраф за финальный ответ на 9
      const finalAnswer = example.answer || this.stateToNumber(example.steps[example.steps.length - 1].states);
      const endsIn9 = finalAnswer % 10 === 9;
      const endsPenalty = endsIn9 ? 3 : 0;

      // Бонус за разнообразие знаков (+ и -)
      const plusCount = example.steps.filter(s => s.action > 0).length;
      const minusCount = example.steps.filter(s => s.action < 0).length;
      const signDiversity = Math.abs(plusCount - minusCount);
      const diversityPenalty = signDiversity > 5 ? signDiversity : 0; // Штраф если слишком перекошено

      // Общий счет (чем ниже, тем лучше)
      const score = roundCount * 10 + consecutiveRoundPenalty + endsPenalty + diversityPenalty;

      // Если найден отличный вариант (0 круглых), сразу возвращаем
      if (roundCount === 0 && consecutiveRoundPenalty === 0) {
        return example;
      }

      // Сохраняем лучший вариант
      if (score < bestScore) {
        bestScore = score;
        bestExample = example;
      }
    }

    return bestExample || this._fallbackExample();
  }

  /**
   * Генерация одной попытки примера
   */
  _generateAttempt() {
    // Инициализация состояния (с дополнительным разрядом для переноса)
    let states = Array(this.stateDigitCount).fill(0);
    const steps = [];
    const targetSteps = this.config.stepsCount; // ТОЧНОЕ количество

    let friendStepsCount = 0;
    let attempts = 0;
    const maxAttempts = targetSteps * 50; // Больше попыток для большего количества шагов

    // Минимум Friends = 1 (обязательно)
    const minFriendSteps = 1;

    // Трекинг последних действий для разнообразия
    let lastSimpleDigit = null;
    let stepsSinceLastFriend = 0;

    this._log(`🎯 Генерация Friends примера: ${targetSteps} шагов (точно)`);

    while (steps.length < targetSteps && attempts < maxAttempts) {
      attempts++;
      const isFirst = steps.length === 0;
      const stepsRemaining = targetSteps - steps.length;

      // Решаем: пытаться ли сгенерировать Friends действие
      const needMoreFriends = friendStepsCount < minFriendSteps;

      // Стратегия: равномерное распределение Friends
      // - Если не хватает минимума → ОБЯЗАТЕЛЬНО
      // - Если прошло 3+ шагов с последнего Friends → вероятность 50%
      // - Иначе вероятность 30%
      const wantMoreFriends = stepsSinceLastFriend >= 3 ? 0.5 : 0.3;

      const tryFriend = needMoreFriends ||
                        (stepsRemaining >= 2 && Math.random() < wantMoreFriends);

      if (tryFriend) {
        // Попытка сгенерировать Friends действие
        const friendAction = this._generateFriendAction(states, isFirst);

        if (friendAction) {
          // Применяем Friends действие
          const newStates = this._applyAction(states, friendAction);

          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            const signStr = friendAction.value >= 0 ? '+' : '';
            steps.push({
              action: friendAction.value,
              step: `${signStr}${friendAction.value}`,  // ✅ Добавлено для печати
              isFriend: true,
              friendN: Math.abs(this._numberToDigits(Math.abs(friendAction.value), this.config.digitCount)[this.targetPosition]),
              formula: this._buildFormula(friendAction.value, this.targetPosition),
              states: [...newStates]
            });

            states = newStates;
            friendStepsCount++;
            stepsSinceLastFriend = 0;

            // Обновляем статистику использования цифры
            const usedDigit = Math.abs(this._numberToDigits(Math.abs(friendAction.value), this.config.digitCount)[this.targetPosition]);
            this.digitUsageCount[usedDigit]++;

            continue;
          }
        }
      }

      // Генерируем простое действие
      const simpleAction = this._generateSimpleAction(states, isFirst, lastSimpleDigit);

      if (!simpleAction) {
        // Ничего не подошло
        if (steps.length >= 3 && friendStepsCount >= minFriendSteps && stepsRemaining === 0) {
          break; // Уже есть минимум и достигли цели
        }
        continue;
      }

      // Применяем действие
      const newStates = this._applyAction(states, simpleAction);

      if (!newStates || !this._isValidState(newStates) || this._checkOverflow(newStates)) {
        continue;
      }

      steps.push({
        action: simpleAction.value,
        isFriend: false,
        states: [...newStates]
      });

      states = newStates;
      stepsSinceLastFriend++;
      lastSimpleDigit = Math.abs(simpleAction.value) % 10; // Последняя цифра
    }

    // Проверка: достигли ли ТОЧНОГО количества шагов?
    if (steps.length !== targetSteps) {
      return null; // ❌ Не достигли точного количества
    }

    // Проверка: есть ли хотя бы 1 Friends действие?
    if (friendStepsCount === 0) {
      return null; // ❌ Нет Friends
    }

    return {
      start: Array(this.stateDigitCount).fill(0),
      steps,
      answer: [...states]
    };
  }

  /**
   * Генерация Friends действия
   *
   * Стратегия:
   * 1. Выбираем цифру Friends (равномерно из selectedDigits)
   * 2. Выбираем знак (+/-)
   * 3. Генерируем многозначное действие
   * 4. Проверяем отсутствие МИКСА
   * 5. Если текущее состояние не подходит → пробуем другую цифру
   */
  _generateFriendAction(states, isFirst) {
    const { selectedDigits, onlyAddition, onlySubtraction } = this.config;

    // Сортируем цифры по частоте использования (меньше использованные - приоритет)
    const sortedDigits = [...selectedDigits].sort((a, b) => {
      return this.digitUsageCount[a] - this.digitUsageCount[b];
    });

    // Перемешиваем первую половину (наименее использованные)
    const halfLen = Math.ceil(sortedDigits.length / 2);
    const priorityDigits = sortedDigits.slice(0, halfLen).sort(() => Math.random() - 0.5);
    const restDigits = sortedDigits.slice(halfLen);

    const digitsToTry = [...priorityDigits, ...restDigits];

    for (const friendDigit of digitsToTry) {
      // Пробуем сложение
      if (!onlySubtraction && (isFirst || true)) {
        const action = this._tryGenerateFriendAddition(friendDigit, states, isFirst);
        if (action) return action;
      }

      // Пробуем вычитание
      if (!onlyAddition && !isFirst) {
        const action = this._tryGenerateFriendSubtraction(friendDigit, states);
        if (action) return action;
      }
    }

    return null;
  }

  /**
   * Попытка сгенерировать +action с правилом Друзья для заданной цифры
   */
  _tryGenerateFriendAddition(friendDigit, states, isFirst) {
    const requirements = this._getAdditionRequirements(friendDigit);
    const targetVal = states[this.targetPosition] || 0;

    // Проверка: подходит ли текущее состояние целевого разряда?
    if (!requirements.states.includes(targetVal)) {
      return null; // Целевой разряд не готов
    }

    // Проверка: можем ли применить формулу?
    const friend = 10 - friendDigit;
    if (!this._canMinusDirect(targetVal, friend)) {
      return null; // Не можем вычесть friend
    }

    // Генерируем многозначное действие
    // Целевой разряд: friendDigit
    // Остальные разряды: подбираем так, чтобы работало правило Просто

    const actionDigits = Array(this.config.digitCount).fill(0);
    actionDigits[this.targetPosition] = friendDigit;

    // Подбираем цифры для остальных разрядов
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      if (pos === this.targetPosition) continue;

      const currentVal = states[pos] || 0;

      // Подбираем случайную цифру, которая работает по Просто
      const possibleDigits = [];
      for (let d = 0; d <= 9; d++) {
        if (this._canPlusDirect(currentVal, d)) {
          possibleDigits.push(d);
        }
      }

      if (possibleDigits.length === 0) {
        return null; // Не можем подобрать для этого разряда
      }

      // Выбираем случайную (предпочитаем ненулевые для разнообразия)
      const nonZero = possibleDigits.filter(d => d > 0);
      const candidates = nonZero.length > 0 && Math.random() < 0.7 ? nonZero : possibleDigits;
      actionDigits[pos] = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const value = this._digitsToNumber(actionDigits);

    // Финальная проверка: нет МИКСА?
    if (this._hasMix(states, value, friendDigit)) {
      return null; // ❌ МИКС
    }

    return { value, isFriend: true };
  }

  /**
   * Попытка сгенерировать -action с правилом Друзья для заданной цифры
   */
  _tryGenerateFriendSubtraction(friendDigit, states) {
    const requirements = this._getSubtractionRequirements(friendDigit);
    const targetVal = states[this.targetPosition] || 0;

    // Проверка: подходит ли текущее состояние целевого разряда?
    if (!requirements.states.includes(targetVal)) {
      return null;
    }

    // Проверка: можем ли применить формулу?
    const friend = 10 - friendDigit;
    if (!this._canPlusDirect(targetVal, friend)) {
      return null;
    }

    // Проверка: есть ли что занимать из целевого разряда?
    if (!this._canSubtractTenFromTarget(states)) {
      return null;
    }

    // Генерируем многозначное действие
    const actionDigits = Array(this.config.digitCount).fill(0);
    actionDigits[this.targetPosition] = friendDigit;

    // Подбираем цифры для остальных разрядов
    for (let pos = 0; pos < this.config.digitCount; pos++) {
      if (pos === this.targetPosition) continue;

      const currentVal = states[pos] || 0;

      const possibleDigits = [];
      for (let d = 0; d <= 9; d++) {
        if (this._canMinusDirect(currentVal, d)) {
          possibleDigits.push(d);
        }
      }

      if (possibleDigits.length === 0) {
        return null;
      }

      const nonZero = possibleDigits.filter(d => d > 0);
      const candidates = nonZero.length > 0 && Math.random() < 0.7 ? nonZero : possibleDigits;
      actionDigits[pos] = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const value = -this._digitsToNumber(actionDigits);

    // Финальная проверка: нет МИКСА?
    if (this._hasMix(states, value, friendDigit)) {
      return null;
    }

    return { value, isFriend: true };
  }

  /**
   * Построить формулу для Friends действия
   *
   * @param {number} value - значение действия (может быть многозначным)
   * @param {number} targetPos - позиция целевого разряда
   */
  _buildFormula(value, targetPos) {
    const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);
    const targetDigit = actionDigits[targetPos] || 0;
    const friend = 10 - targetDigit;

    if (value > 0) {
      // +n = +10 - friend
      return [
        { op: '+', val: 10 },
        { op: '-', val: friend }
      ];
    } else {
      // -n = -10 + friend
      return [
        { op: '-', val: 10 },
        { op: '+', val: friend }
      ];
    }
  }

  /**
   * Генерация простого (не-Friends) действия для разнообразия
   */
  _generateSimpleAction(states, isFirst, lastDigit = null) {
    const availableActions = [];

    // Генерируем многозначные простые действия
    const maxActionValue = Math.pow(10, this.config.digitCount) - 1;

    // Пробуем несколько случайных действий
    for (let attempt = 0; attempt < 50; attempt++) {
      // Генерируем случайное многозначное действие
      const actionDigits = [];
      for (let pos = 0; pos < this.config.digitCount; pos++) {
        const currentVal = states[pos] || 0;

        // Подбираем случайную цифру для этого разряда
        const possibleDigits = [];
        for (let d = 0; d <= 9; d++) {
          if (this._canPlusDirect(currentVal, d)) {
            possibleDigits.push(d);
          }
        }

        if (possibleDigits.length > 0) {
          actionDigits.push(possibleDigits[Math.floor(Math.random() * possibleDigits.length)]);
        } else {
          actionDigits.push(0);
        }
      }

      const value = this._digitsToNumber(actionDigits);

      // Избегаем повторения последней цифры
      const firstDigit = actionDigits[0];
      if (lastDigit !== null && firstDigit === lastDigit && Math.random() < 0.7) {
        continue; // Пропускаем с вероятностью 70%
      }

      if (value > 0 && isFirst) {
        if (this._canApplySimpleDirect(states, value)) {
          availableActions.push(value);
        }
      }

      // Вычитание (только если не первое действие)
      if (!isFirst) {
        // Пробуем вычитание
        const subDigits = [];
        let canSubtract = true;

        for (let pos = 0; pos < this.config.digitCount; pos++) {
          const currentVal = states[pos] || 0;
          const possibleDigits = [];

          for (let d = 0; d <= 9; d++) {
            if (this._canMinusDirect(currentVal, d)) {
              possibleDigits.push(d);
            }
          }

          if (possibleDigits.length > 0) {
            subDigits.push(possibleDigits[Math.floor(Math.random() * possibleDigits.length)]);
          } else {
            canSubtract = false;
            break;
          }
        }

        if (canSubtract) {
          const subValue = this._digitsToNumber(subDigits);
          if (subValue > 0) {
            availableActions.push(-subValue);
          }
        }
      }
    }

    if (availableActions.length === 0) {
      return null;
    }

    const action = availableActions[Math.floor(Math.random() * availableActions.length)];
    return { value: action, isFriend: false };
  }

  /**
   * Применить действие к состоянию абакуса
   */
  _applyAction(states, actionObj) {
    const newStates = [...states];
    const value = actionObj.value;
    const isFriend = actionObj.isFriend;

    if (!isFriend) {
      // Простое действие: применяем к каждому разряду
      const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);
      const isAddition = value >= 0;

      for (let pos = 0; pos < this.config.digitCount; pos++) {
        const digit = actionDigits[pos] || 0;
        if (isAddition) {
          newStates[pos] = (newStates[pos] || 0) + digit;
        } else {
          newStates[pos] = (newStates[pos] || 0) - digit;
        }
      }
    } else {
      // Friends действие: перенос в целевом разряде
      const actionDigits = this._numberToDigits(Math.abs(value), this.config.digitCount);
      const isAddition = value >= 0;

      // Применяем ко всем разрядам кроме целевого
      for (let pos = 0; pos < this.config.digitCount; pos++) {
        if (pos === this.targetPosition) continue;

        const digit = actionDigits[pos] || 0;
        if (isAddition) {
          newStates[pos] = (newStates[pos] || 0) + digit;
        } else {
          newStates[pos] = (newStates[pos] || 0) - digit;
        }
      }

      // Целевой разряд: применяем формулу Friends
      const targetDigit = actionDigits[this.targetPosition] || 0;
      const friend = 10 - targetDigit;

      if (isAddition) {
        // +n = +10 - friend
        // Добавляем перенос в следующий разряд
        if (this.targetPosition + 1 < newStates.length) {
          newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) + 1;
        } else {
          newStates.push(1); // Создаем новый разряд
        }
        // Вычитаем friend из целевого
        newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) - friend;
      } else {
        // -n = -10 + friend
        // Занимаем из следующего разряда
        if (this.targetPosition + 1 < newStates.length) {
          newStates[this.targetPosition + 1] = (newStates[this.targetPosition + 1] || 0) - 1;
        }
        // Добавляем friend к целевому
        newStates[this.targetPosition] = (newStates[this.targetPosition] || 0) + friend;
      }
    }

    // Валидация
    for (let i = 0; i < newStates.length; i++) {
      if (newStates[i] < 0 || newStates[i] > 9) {
        return null; // Невалидное состояние
      }
    }

    return newStates;
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

  /**
   * Проверка переполнения: результат должен быть в расширенном диапазоне
   */
  _checkOverflow(states) {
    const value = this.stateToNumber(states);
    return value > this.maxValue; // Проверяем расширенный диапазон
  }

  /**
   * Валидация примера
   */
  _validateExample(example) {
    const { start, steps, answer } = example;

    // 1. Проверка ТОЧНОГО количества шагов
    if (steps.length !== this.config.stepsCount) {
      return false;
    }

    // 2. Проверка наличия Friends шагов (минимум 1!)
    const friendSteps = steps.filter(s => s.isFriend);
    if (friendSteps.length < 1) {
      return false;
    }

    // 3. Проверка что используемые цифры входят в selectedDigits
    const allowedDigits = new Set(this.config.selectedDigits);
    for (const step of friendSteps) {
      if (step.friendN && !allowedDigits.has(step.friendN)) {
        return false;
      }
    }

    // 4. Валидность всех промежуточных состояний
    for (const step of steps) {
      if (!this._isValidState(step.states)) {
        return false;
      }

      // Проверка переполнения (расширенный диапазон)
      if (this._checkOverflow(step.states)) {
        return false;
      }
    }

    // 5. Корректность финального ответа
    const finalStates = steps[steps.length - 1].states;
    if (!this._arraysEqual(finalStates, answer)) {
      return false;
    }

    return true;
  }

  /**
   * Минимальный fallback-пример если генерация не удалась
   *
   * УПРОЩЕННАЯ СТРАТЕГИЯ:
   * 1. Используем первую выбранную цифру Friends
   * 2. Случайное начало (первое действие)
   * 3. Агрессивно подготавливаем единицы к нужному состоянию (любые Просто действия)
   * 4. Применяем Friends действие
   * 5. Заполняем остальные шаги
   */
  _fallbackExample() {
    const steps = [];
    let states = Array(this.stateDigitCount).fill(0);
    const targetSteps = this.config.stepsCount;

    if (!this.config.silent) {
      console.log(`⚠️ Используем fallback генерацию для ${targetSteps} шагов`);
    }

    let friendsAdded = 0;

    // Максимальная разрешенная цифра для простых действий
    const maxSimpleDigit = Math.max(...this.config.simpleDigits);

    // Массив разрешенных цифр в порядке убывания (для поиска максимального подходящего действия)
    const simpleDigitsDesc = [...this.config.simpleDigits].sort((a, b) => b - a);

    // Динамическое количество Friends в зависимости от количества шагов
    // Примерно 1 Friends на каждые 3-4 шага
    const minFriends = Math.max(1, Math.floor(targetSteps / 4));
    const maxFriends = Math.max(2, Math.floor(targetSteps / 3));

    if (!this.config.silent) {
      console.log(`🎯 Выбранные Friends цифры: [${this.config.selectedDigits.join(', ')}]`);
      console.log(`🎯 Планируем Friends: минимум ${minFriends}, максимум ${maxFriends}`);
    }

    // Множитель для преобразования однозначной цифры в многозначное действие
    // digitCount=1, targetPosition=0 → multiplier=1 (однозначные)
    // digitCount=2, targetPosition=1 → multiplier=10 (двузначные)
    // digitCount=3, targetPosition=2 → multiplier=100 (трехзначные)
    const multiplier = Math.pow(10, this.targetPosition);
    this._log(`🔢 Множитель для действий: ${multiplier} (digitCount=${this.config.digitCount}, targetPosition=${this.targetPosition})`);

    // ШАГ 1: Умное начало - СЛУЧАЙНОЕ маленькое действие из simpleDigits
    // Многошаговая подготовка сама доведет до нужного состояния
    if (steps.length < targetSteps - 1) {
      // Выбираем случайное действие из simpleDigits (небольшое, чтобы не переполнить)
      const availableSmallDigits = this.config.simpleDigits.filter(d => d <= 4);
      const smartStartDigit = availableSmallDigits.length > 0
        ? availableSmallDigits[Math.floor(Math.random() * availableSmallDigits.length)]
        : this.config.simpleDigits[Math.floor(Math.random() * this.config.simpleDigits.length)];

      if (smartStartDigit > 0) {
        const baseAction = smartStartDigit * multiplier; // Базовое действие для целевого разряда
        const fullAction = this._addRandomDigitsToAction(baseAction, states, false); // Добавляем цифры для остальных разрядов
        const newStates = this._applyAction(states, { value: fullAction, isFriend: false });
        if (newStates && this._isValidState(newStates)) {
          steps.push({
            action: fullAction,
            isFriend: false,
            states: [...newStates]
          });
          states = newStates;
          this._log(`🎯 Случайное начало: +${fullAction} (база: ${baseAction}, с дополнительными разрядами), состояние: [${newStates.join(', ')}]`);
        }
      }
    }

    // ШАГ 2: ЦИКЛ генерации Friends действий
    // Пытаемся добавить несколько Friends с простыми шагами между ними
    while (friendsAdded < maxFriends && steps.length < targetSteps - 2) {
      this._log(`\n🔄 Попытка ${friendsAdded + 1} Friends...`);

      // Выбираем СЛУЧАЙНУЮ цифру Friends для РАЗНООБРАЗИЯ
      const friendDigit = this.config.selectedDigits[Math.floor(Math.random() * this.config.selectedDigits.length)] || 1;
      const requiredTargetVal = 10 - friendDigit; // Для digit=1 нужно 9, для digit=9 нужно 1
      this._log(`  Выбрана Friends цифра: ${friendDigit} (нужно состояние ЦЕЛЕВОГО разряда [${this._getPositionName(this.targetPosition)}] >= ${requiredTargetVal})`);

      // ШАГ 2.1: Выбираем СЛУЧАЙНОЕ целевое значение ЦЕЛЕВОГО РАЗРЯДА из диапазона
      // НО ВАЖНО: вычитание friend должно быть возможно по правилу Просто!
      // Ищем валидные состояния в диапазоне [requiredTargetVal, 9]
      const friend = 10 - friendDigit;
      const validTargets = [];
      for (let v = requiredTargetVal; v <= 9; v++) {
        if (this._canMinusDirect(v, friend)) {
          validTargets.push(v);
        }
      }

      if (validTargets.length === 0) {
        this._warn(`❌ Нет валидных целевых состояний для friend=${friend} в диапазоне [${requiredTargetVal}, 9]!`);
        break;
      }

      const targetTargetVal = validTargets[Math.floor(Math.random() * validTargets.length)];
      this._log(`🎲 Целевое состояние ${this._getPositionName(this.targetPosition)}: ${targetTargetVal} (валидные: [${validTargets.join(', ')}])`);
      this._log(`   После Friends останется: ${targetTargetVal - friend} бусин`);

      // ШАГ 2.2: ПОДГОТАВЛИВАЕМ ЦЕЛЕВОЙ РАЗРЯД к целевому состоянию
      // Для многозначных используем УПРОЩЕННУЮ стратегию:
      // - Генерируем действия вида X*multiplier (только целевой разряд меняется, остальные = 0)
      // - Например: digitCount=2 → +10, +20, +30 (а не +23, +47)
      let maxIterations = 20;
      while ((states[this.targetPosition] || 0) !== targetTargetVal && steps.length < targetSteps - 1 && maxIterations-- > 0) {
        const currentTarget = states[this.targetPosition] || 0;

        // Если нужно ДОБАВИТЬ к целевому разряду
        if (currentTarget < targetTargetVal) {
          const remaining = targetTargetVal - currentTarget;

          // Пробуем добавить МАКСИМАЛЬНО ВОЗМОЖНОЕ из разрешенных simpleDigits
          let added = false;
          for (const tryDigit of simpleDigitsDesc) {
            if (tryDigit > remaining) continue; // Слишком большое действие
            if (currentTarget + tryDigit > 9) continue; // Переполнение

            // Проверяем: можем ли добавить по правилу Просто?
            if (this._canPlusDirect(currentTarget, tryDigit)) {
              const baseAction = tryDigit * multiplier; // Базовое действие для целевого разряда
              const fullAction = this._addRandomDigitsToAction(baseAction, states, false); // Добавляем цифры для остальных разрядов
              const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

              if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
                steps.push({
                  action: fullAction,
                  isFriend: false,
                  states: [...newStates]
                });
                states = newStates;
                added = true;
                this._log(`➕ Подготовка: +${fullAction}, состояние: [${newStates.join(', ')}]`);
                break;
              }
            }
          }

          if (!added) {
            // Прямой путь невозможен - пробуем МНОГОШАГОВЫЙ ОБХОДНОЙ путь через 9
            this._warn(`⚠️ Прямой путь невозможен: ${currentTarget}→${targetTargetVal}. Пробуем через 9...`);

            // Путь: current → 9 → target (многошаговый)
            let tempTargetVal = currentTarget;
            let tempStates = [...states];  // Локальная копия!
            let pathSuccess = true;
            const allTempSteps = [];

            // Шаг 1: current → 9
            while (tempTargetVal < 9 && steps.length + allTempSteps.length < targetSteps - 1) {
              let stepAdded = false;
              for (const tryDigit of simpleDigitsDesc) {
                if (tempTargetVal + tryDigit <= 9 && this._canPlusDirect(tempTargetVal, tryDigit)) {
                  const baseAction = tryDigit * multiplier;
                  const fullAction = this._addRandomDigitsToAction(baseAction, tempStates, false);
                  const newStates = this._applyAction(tempStates, { value: fullAction, isFriend: false });
                  if (newStates && this._isValidState(newStates)) {
                    allTempSteps.push({ action: fullAction, isFriend: false, states: [...newStates] });
                    tempStates = newStates;
                    tempTargetVal = newStates[this.targetPosition] || 0;
                    stepAdded = true;
                    break;
                  }
                }
              }
              if (!stepAdded) {
                pathSuccess = false;
                break;
              }
            }

            // Шаг 2: 9 → target (если дошли до 9)
            if (pathSuccess && tempTargetVal === 9) {
              while (tempTargetVal > targetTargetVal && steps.length + allTempSteps.length < targetSteps - 1) {
                const toRemove = tempTargetVal - targetTargetVal;
                let stepAdded = false;

                for (const tryDigit of simpleDigitsDesc) {
                  if (tryDigit <= toRemove && this._canMinusDirect(tempTargetVal, tryDigit)) {
                    const baseAction = -tryDigit * multiplier;
                    const fullAction = this._addRandomDigitsToAction(baseAction, tempStates, false);
                    const newStates = this._applyAction(tempStates, { value: fullAction, isFriend: false });
                    if (newStates && this._isValidState(newStates)) {
                      allTempSteps.push({ action: fullAction, isFriend: false, states: [...newStates] });
                      tempStates = newStates;
                      tempTargetVal = newStates[this.targetPosition] || 0;
                      stepAdded = true;
                      break;
                    }
                  }
                }
                if (!stepAdded) {
                  pathSuccess = false;
                  break;
                }
              }
            }

            // Применяем изменения только если весь путь успешен
            if (pathSuccess && tempTargetVal === targetTargetVal) {
              this._log(`🔄 Обходной путь через 9: ${allTempSteps.length} шагов`);
              steps.push(...allTempSteps);
              states = tempStates;  // Применяем изменения
              added = true;
            }

            if (!added) {
              this._warn(`❌ Невозможно подготовить ${this._getPositionName(this.targetPosition)}: ${currentTarget}→${targetTargetVal}`);
              break;
            }
          }
        }
        // Если нужно УБРАТЬ из целевого разряда
        else if (currentTarget > targetTargetVal) {
          const toRemove = currentTarget - targetTargetVal;

          // Пробуем убрать МАКСИМАЛЬНО ВОЗМОЖНОЕ из разрешенных simpleDigits
          let removed = false;
          for (const tryDigit of simpleDigitsDesc) {
            if (tryDigit > toRemove) continue; // Слишком большое действие
            if (currentTarget - tryDigit < 0) continue; // Нельзя уйти в минус

            // Проверяем: можем ли убрать по правилу Просто?
            if (this._canMinusDirect(currentTarget, tryDigit)) {
              const baseAction = -tryDigit * multiplier;
              const fullAction = this._addRandomDigitsToAction(baseAction, states, false);
              const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

              if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
                steps.push({
                  action: fullAction,
                  isFriend: false,
                  states: [...newStates]
                });
                states = newStates;
                removed = true;
                this._log(`➖ Подготовка: ${fullAction}, состояние: [${newStates.join(', ')}]`);
                break;
              }
            }
          }

          if (!removed) {
            // Прямой путь невозможен - пробуем МНОГОШАГОВЫЙ ОБХОДНОЙ путь через 0
            this._warn(`⚠️ Прямой путь невозможен: ${currentTarget}→${targetTargetVal}. Пробуем через 0...`);

            // Путь: current → 0 → target (многошаговый)
            let tempTargetVal = currentTarget;
            let tempStates = [...states];  // Локальная копия!
            let pathSuccess = true;
            const allTempSteps = [];

            // Шаг 1: current → 0
            while (tempTargetVal > 0 && steps.length + allTempSteps.length < targetSteps - 1) {
              let stepAdded = false;
              for (const tryDigit of simpleDigitsDesc) {
                if (tempTargetVal >= tryDigit && this._canMinusDirect(tempTargetVal, tryDigit)) {
                  const baseAction = -tryDigit * multiplier;
                  const fullAction = this._addRandomDigitsToAction(baseAction, tempStates, false);
                  const newStates = this._applyAction(tempStates, { value: fullAction, isFriend: false });
                  if (newStates && this._isValidState(newStates)) {
                    allTempSteps.push({ action: fullAction, isFriend: false, states: [...newStates] });
                    tempStates = newStates;
                    tempTargetVal = newStates[this.targetPosition] || 0;
                    stepAdded = true;
                    break;
                  }
                }
              }
              if (!stepAdded) {
                pathSuccess = false;
                break;
              }
            }

            // Шаг 2: 0 → target (если дошли до 0)
            if (pathSuccess && tempTargetVal === 0) {
              while (tempTargetVal < targetTargetVal && steps.length + allTempSteps.length < targetSteps - 1) {
                const toAdd = targetTargetVal - tempTargetVal;
                let stepAdded = false;

                for (const tryDigit of simpleDigitsDesc) {
                  if (tryDigit <= toAdd && this._canPlusDirect(tempTargetVal, tryDigit)) {
                    const baseAction = tryDigit * multiplier;
                    const fullAction = this._addRandomDigitsToAction(baseAction, tempStates, false);
                    const newStates = this._applyAction(tempStates, { value: fullAction, isFriend: false });
                    if (newStates && this._isValidState(newStates)) {
                      allTempSteps.push({ action: fullAction, isFriend: false, states: [...newStates] });
                      tempStates = newStates;
                      tempTargetVal = newStates[this.targetPosition] || 0;
                      stepAdded = true;
                      break;
                    }
                  }
                }
                if (!stepAdded) {
                  pathSuccess = false;
                  break;
                }
            }
          }

            // Применяем изменения только если весь путь успешен
            if (pathSuccess && tempTargetVal === targetTargetVal) {
              this._log(`🔄 Обходной путь через 0: ${allTempSteps.length} шагов`);
              steps.push(...allTempSteps);
              states = tempStates;  // Применяем изменения
              removed = true;
            }

            if (!removed) {
              this._warn(`❌ Невозможно подготовить ${this._getPositionName(this.targetPosition)}: ${currentTarget}→${targetTargetVal}`);
              break;
            }
          }
        }
      }

      this._log(`🔧 Подготовка завершена: ${this._getPositionName(this.targetPosition)} = ${states[this.targetPosition]}, целевое = ${targetTargetVal}`);

      // ШАГ 2.3: Применяем Friends действие (МНОГОЗНАЧНОЕ для digitCount > 1!)
      const currentTarget = states[this.targetPosition] || 0;
      // friend уже объявлен выше

      // КРИТИЧЕСКАЯ ПРОВЕРКА:
      // 1. Достигли ли целевого состояния (targetTargetVal)?
      // 2. Можно ли вычесть friend по правилу Просто?
      // Например, из 6 (U=1,L=1) вычесть -2 НЕЛЬЗЯ по Просто (это МИКС!)
      if (currentTarget === targetTargetVal && this._canMinusDirect(currentTarget, friend) && steps.length < targetSteps) {
        // Применяем Friends через _applyAction - он правильно обработает целевой разряд
        const baseFriendAction = friendDigit * multiplier; // Базовое Friends действие для целевого разряда
        const fullFriendAction = this._addRandomDigitsToAction(baseFriendAction, states, true); // Добавляем цифры для остальных разрядов
        const newStates = this._applyAction(states, { value: fullFriendAction, isFriend: true });

        if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
          const signStr = fullFriendAction >= 0 ? '+' : '';
          steps.push({
            action: fullFriendAction,
            step: `${signStr}${fullFriendAction}`,  // ✅ Добавлено для печати
            isFriend: true,
            friendN: friendDigit,
            formula: this._buildFormula(fullFriendAction, this.targetPosition),
            states: [...newStates]
          });
          states = newStates;
          friendsAdded++;
          this._log(`✅ Friends #${friendsAdded} добавлен: +${fullFriendAction} (база: ${baseFriendAction}, с дополнительными разрядами), состояние: [${newStates.join(', ')}]`);

          // ШАГ 2.3: Добавляем 1-2 простых шага после Friends для разнообразия
          const simpleStepsAfter = friendsAdded < maxFriends ? (Math.floor(Math.random() * 2) + 1) : 0; // 1-2 шага, или 0 если это последний Friends
          for (let i = 0; i < simpleStepsAfter && steps.length < targetSteps - 1; i++) {
            const currentTargetVal = states[this.targetPosition] || 0;
            // Выбираем случайное действие из разрешенных simpleDigits
            const randomDigit = this.config.simpleDigits[Math.floor(Math.random() * this.config.simpleDigits.length)];
            const baseRandomAction = randomDigit * multiplier;

            // Пробуем добавить
            if (currentTargetVal + randomDigit <= 9 && this._canPlusDirect(currentTargetVal, randomDigit)) {
              const fullRandomAction = this._addRandomDigitsToAction(baseRandomAction, states, false);
              const newSimpleStates = this._applyAction(states, { value: fullRandomAction, isFriend: false });
              if (newSimpleStates && this._isValidState(newSimpleStates)) {
                steps.push({
                  action: fullRandomAction,
                  isFriend: false,
                  states: [...newSimpleStates]
                });
                states = newSimpleStates;
                this._log(`  ➕ Простой шаг: +${fullRandomAction}, состояние: [${newSimpleStates.join(', ')}]`);
                continue;
              }
            }

            // Если не можем добавить - пробуем вычесть
            if (currentTargetVal > 0 && currentTargetVal >= randomDigit && this._canMinusDirect(currentTargetVal, randomDigit)) {
              const fullRandomAction = this._addRandomDigitsToAction(-baseRandomAction, states, false);
              const newSimpleStates = this._applyAction(states, { value: fullRandomAction, isFriend: false });
              if (newSimpleStates && this._isValidState(newSimpleStates)) {
                steps.push({
                  action: fullRandomAction,
                  isFriend: false,
                  states: [...newSimpleStates]
                });
                states = newSimpleStates;
                this._log(`  ➖ Простой шаг: ${fullRandomAction}, состояние: [${newSimpleStates.join(', ')}]`);
              }
            }
          }
        }
      } else {
        // Проверяем причину отказа
        if (currentTarget !== targetTargetVal) {
          this._warn(`⚠️ Не удалось достичь целевого состояния! Текущее=${currentTarget}, целевое=${targetTargetVal}`);
        } else if (currentTarget < requiredTargetVal) {
          this._warn(`⚠️ Недостаточно бусин! Текущее=${currentTarget}, требуется минимум ${requiredTargetVal}`);
        } else if (!this._canMinusDirect(currentTarget, friend)) {
          this._warn(`⚠️ Невозможно вычесть friend=${friend} из ${currentTarget} по правилу Просто (будет МИКС)!`);
          this._warn(`   Для friend=${friend} валидные состояния: те, где вычитание -${friend} однонаправленное`);
        }
        break; // Прерываем цикл Friends, если не можем подготовить
      }
    }

    // Проверка: достигли ли минимального количества Friends
    if (friendsAdded < minFriends) {
      this._warn(`❌ КРИТИЧНО: Fallback не смог сгенерировать минимум ${minFriends} Friends! Сгенерировано: ${friendsAdded}`);
    } else {
      this._log(`✅ Успешно сгенерировано ${friendsAdded} Friends действий!`);
    }

    // ШАГ 4: Заполняем оставшиеся шаги РАЗНООБРАЗНЫМИ простыми действиями
    // Создаем РАНДОМНЫЙ массив действий для каждого примера из разрешенных simpleDigits
    const simpleActions = [];
    for (let i = 0; i < 10; i++) {
      simpleActions.push(this.config.simpleDigits[Math.floor(Math.random() * this.config.simpleDigits.length)]);
    }

    let actionIndex = 0;
    let failedAttempts = 0;
    const maxFailedAttempts = 50;

    while (steps.length < targetSteps && failedAttempts < maxFailedAttempts) {
      const targetVal = states[this.targetPosition] || 0;
      const digit = simpleActions[actionIndex % simpleActions.length];
      const baseAction = digit * multiplier; // Базовое действие для целевого разряда

      // Случайный выбор: сначала сложение или вычитание?
      const tryAdditionFirst = Math.random() < 0.5;

      if (tryAdditionFirst) {
        // Пробуем добавить к целевому разряду
        if (targetVal + digit <= 9 && this._canPlusDirect(targetVal, digit)) {
          const fullAction = this._addRandomDigitsToAction(baseAction, states, false);
          const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: fullAction,
              isFriend: false,
              states: [...newStates]
            });
            states = newStates;
            actionIndex++;
            failedAttempts = 0;
            continue;
          }
        }

        // Если не можем добавить - пробуем вычитание
        if (targetVal > 0 && targetVal >= digit && this._canMinusDirect(targetVal, digit)) {
          const fullAction = this._addRandomDigitsToAction(-baseAction, states, false);
          const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: fullAction,
              isFriend: false,
              states: [...newStates]
            });
            states = newStates;
            actionIndex++;
            failedAttempts = 0;
            continue;
          }
        }
      } else {
        // Пробуем вычитание первым
        if (targetVal > 0 && targetVal >= digit && this._canMinusDirect(targetVal, digit)) {
          const fullAction = this._addRandomDigitsToAction(-baseAction, states, false);
          const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: fullAction,
              isFriend: false,
              states: [...newStates]
            });
            states = newStates;
            actionIndex++;
            failedAttempts = 0;
            continue;
          }
        }

        // Если не можем вычесть - пробуем добавить
        if (targetVal + digit <= 9 && this._canPlusDirect(targetVal, digit)) {
          const fullAction = this._addRandomDigitsToAction(baseAction, states, false);
          const newStates = this._applyAction(states, { value: fullAction, isFriend: false });

          if (newStates && this._isValidState(newStates) && !this._checkOverflow(newStates)) {
            steps.push({
              action: fullAction,
              isFriend: false,
              states: [...newStates]
            });
            states = newStates;
            actionIndex++;
            failedAttempts = 0;
            continue;
          }
        }
      }

      // Если целевой разряд "застрял" - пробуем другой разряд (для трех+ значных)
      // УПРОЩЕННАЯ версия: пока не используем дополнительные разряды в fallback
      // Fallback генерирует только действия вида X*multiplier (один разряд меняется)
      if (this.config.digitCount > 2) {
        // Пока пропускаем сложную логику для трехзначных+
        // В будущем можно добавить работу с нецелевыми разрядами
      }

      // Последняя попытка: минимальное действие из simpleDigits если возможно
      const minSimpleDigit = Math.min(...this.config.simpleDigits);
      const minBaseAction = minSimpleDigit * multiplier;
      if (targetVal + minSimpleDigit <= 9 && this._canPlusDirect(targetVal, minSimpleDigit)) {
        const minFullAction = this._addRandomDigitsToAction(minBaseAction, states, false);
        const newStates = this._applyAction(states, { value: minFullAction, isFriend: false });

        if (newStates && this._isValidState(newStates)) {
          steps.push({
            action: minFullAction,
            isFriend: false,
            states: [...newStates]
          });
          states = newStates;
          actionIndex++;
          failedAttempts = 0;
          continue;
        }
      }

      // Не смогли добавить - пробуем другое действие
      actionIndex++;
      failedAttempts++;
    }

    // Если не хватает Friends, это критическая ошибка
    if (friendsAdded === 0) {
      this._warn(`❌ КРИТИЧНО: Fallback не смог сгенерировать ни одного Friends действия!`);
    }

    // Обрезаем или дополняем до точного количества
    const finalSteps = steps.slice(0, targetSteps);

    // Если не хватает шагов - дополняем минимальным действием из simpleDigits
    const minSimpleDigit = Math.min(...this.config.simpleDigits);
    while (finalSteps.length < targetSteps) {
      const firstVal = states[0] || 0;
      if (firstVal + minSimpleDigit <= 9) {
        const newStates = this._applyAction(states, { value: minSimpleDigit, isFriend: false });
        if (newStates && this._isValidState(newStates)) {
          finalSteps.push({
            action: minSimpleDigit,
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

    this._log(`📊 Fallback результат: ${finalSteps.length} шагов, ${friendsAdded} Friends`);

    return {
      start: Array(this.stateDigitCount).fill(0),
      steps: finalSteps,
      answer: finalSteps.length > 0 ? [...finalSteps[finalSteps.length - 1].states] : Array(this.stateDigitCount).fill(0)
    };
  }

  // ========== СЕКЦИЯ 5: ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  /**
   * Преобразовать состояние в число
   */
  stateToNumber(state) {
    if (!Array.isArray(state)) return 0;

    let result = 0;
    for (let i = 0; i < state.length; i++) {
      result += (state[i] || 0) * Math.pow(10, i);
    }

    return result;
  }

  /**
   * Формат для trainer_logic.js
   */
  toTrainerFormat(example) {
    const formattedSteps = [];

    for (const step of example.steps) {
      if (step.isFriend) {
        // Friends шаг - возвращаем объект с формулой
        const value = step.action;
        const sign = value >= 0 ? '+' : '';

        formattedSteps.push({
          step: `${sign}${value}`,
          isFriend: true,
          friendN: step.friendN,
          formula: step.formula
        });
      } else {
        // Простой шаг - возвращаем строку
        const value = step.action;
        const sign = value >= 0 ? '+' : '';
        formattedSteps.push(`${sign}${value}`);
      }
    }

    return {
      start: 0, // Всегда стартуем с 0
      steps: formattedSteps,
      answer: this.stateToNumber(example.answer)
    };
  }

  /**
   * Формат для отладки
   */
  _formatForDisplay(example) {
    const stepsStr = example.steps
      .map(s => {
        const val = s.action;
        const sign = val >= 0 ? '+' : '';
        const mark = s.isFriend ? '🤝' : '';
        return `${sign}${val}${mark}`;
      })
      .join(' ');

    return `${stepsStr} = ${this.stateToNumber(example.answer)}`;
  }

  /**
   * Сравнение двух массивов
   */
  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
