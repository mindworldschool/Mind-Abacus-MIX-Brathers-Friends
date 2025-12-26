// ext/core/generator.js
//
// Генератор примеров для тренажёра.
// Отвечает за:
//  - чтение настроек из UI,
//  - подготовку конфигурации правила,
//  - вызов ExampleGenerator,
//  - адаптацию результата под формат тренажёра.
//
// Поддерживаемые правила:
//  - UnifiedSimpleRule — "Просто" (без формул)
//  - BrothersRule — "Братья" (формулы через 5)
//  - FriendsExampleGenerator — "Друзья" (формулы через 10, специализированный генератор)
//
// Зависимости:
//  - UnifiedSimpleRule — описывает допустимые шаги (+N / -N), физику абакуса,
//    учитывает includeFive (Просто 4 / Просто 5), запрет первого минуса и т.д.
//  - BrothersRule — переходы через 5 (+n = +5 - brother)
//  - FriendsExampleGenerator — специализированный генератор для Друзья (+n = +10 - friend)
//  - ExampleGenerator — строит саму цепочку шагов, опираясь на правило
//  - MultiDigitGenerator — обёртка для многозначных чисел

import { UnifiedSimpleRule } from "./rules/UnifiedSimpleRule.js";
import { ExampleGenerator } from "./ExampleGenerator.js";
import { BrothersRule } from "./rules/BrothersRule.js";
import { FriendsExampleGenerator } from "./FriendsExampleGenerator.js";
import { MultiDigitGenerator } from "./MultiDigitGenerator.js";

/**
 * Основная внешняя функция.
 * Вызывается из trainer_logic.js при показе каждого нового примера.
 *
 * @param {Object} settings - настройки из UI
 * @returns {{ start:number, steps:string[], answer:number }}
 *          Пример в готовом формате для тренажёра.
 */
export function generateExample(settings = {}) {
  try {
if (!settings.silent)     console.log("🧠 [generator] входные настройки:", settings);
if (!settings.silent)     console.log("🔍 [generator] settings.blocks:", settings.blocks);
if (!settings.silent)     console.log("🔍 [generator] settings.blocks?.simple?.digits:", settings.blocks?.simple?.digits);
if (!settings.silent)     console.log("🔍 [generator] settings.actions:", settings.actions);

    //
    // 1. Разрядность
    //
    // digits = сколько столбцов абакуса мы тренируем одновременно.
    // Для классического "Просто" это 1.
    //
    const digitCountRaw = parseInt(settings.digits, 10);
    const digitCount =
      Number.isFinite(digitCountRaw) && digitCountRaw > 0
        ? digitCountRaw
        : 1;

    // combineLevels:
    // true  → один шаг двигает все разряды сразу (общий вектор),
    // false → более строго (каждый столбец сам по себе).
    const combineLevels = settings.combineLevels === true;

    //
    // 2. Длина примера (сколько шагов в последовательности)
    //
    // settings.actions управляет количеством шагов:
    //   - count: фиксированная длина
    //   - min / max: диапазон
    //   - infinite: "игра бесконечно", тогда мы просто берём разумный коридор
    //
    const actionsCfg = settings.actions || {};
if (!settings.silent)     console.log("🔍 [generator] actionsCfg:", actionsCfg);

    const minStepsRaw = actionsCfg.infinite
      ? 2
      : (actionsCfg.min ?? actionsCfg.count ?? 2);
    const maxStepsRaw = actionsCfg.infinite
      ? 12
      : (actionsCfg.max ?? actionsCfg.count ?? 4);

    let minSteps = minStepsRaw;
    let maxSteps = maxStepsRaw;

if (!settings.silent)     console.log("🔍 [generator] minSteps:", minSteps, "maxSteps:", maxSteps);

    //
    // 3. Какие цифры разрешены ребёнку в блоке "Просто"
    //
    // Это КЛЮЧЕВО.
    //
    // Мы больше НЕ раскладываем большие числа "7 = 5+2".
    // Сейчас каждое действие в примере — это сразу ±d,
    // и d должен В ПРЯМУЮ входить в выбранный список.
    //
    // Примеры:
    //   digits=[3]          → можно +3, -3
    //   digits=[2,5,7]      → можно +2,-2,+5,-5,+7,-7
    //   digits=[1..9]       → полная свобода
    //
    const blocks = settings.blocks || {};
    const originalDigits = Array.isArray(blocks?.simple?.digits)
      ? blocks.simple.digits
          .map(n => parseInt(n, 10))
          .filter(n => Number.isFinite(n))
      : [1, 2, 3, 4, 5, 6, 7, 8, 9]; // дефолт: все однозначные цифры

    // Уникализируем и сортируем для стабильности
    const selectedDigits = Array.from(new Set(originalDigits)).sort(
      (a, b) => a - b
    );

if (!settings.silent)     console.log("🔍 [generator] originalDigits:", originalDigits);
if (!settings.silent)     console.log("🔍 [generator] selectedDigits (для блока Просто):", selectedDigits);

    //
    // 4. includeFive — методический флаг.
    //
    // Если includeFive === false:
    //   - нельзя использовать верхнюю бусину,
    //   - стойка живёт в диапазоне 0..4,
    //   - мы не генерируем дельту ±5.
    //
    // Если includeFive === true:
    //   - можно использовать верхнюю бусину,
    //   - стойка живёт в диапазоне 0..9,
    //   - возможны ходы с верхней.
    //
    const includeFive =
      (blocks?.simple?.includeFive ??
        settings.includeFive ??
        selectedDigits.includes(5)) === true;

    //
    // 5. Ограничения направления:
    //    onlyAddition = "тренируем только сложение"
    //    onlySubtraction = "тренируем только вычитание"
    //
    const onlyAddition =
      (blocks?.simple?.onlyAddition ??
        settings.onlyAddition ??
        false) === true;
    const onlySubtraction =
      (blocks?.simple?.onlySubtraction ??
        settings.onlySubtraction ??
        false) === true;

    //
    // 6. Флаги будущих методик.
    // 🔥 ВАЖНО: Блок считается активным, если в нем выбраны цифры (digits.length > 0)
    // Поле "active" не используется в state.js, поэтому проверяем digits.
    //
    const brothersDigits = Array.isArray(blocks?.brothers?.digits)
      ? blocks.brothers.digits.filter(d => {
          const parsed = parseInt(d, 10);
          return !isNaN(parsed) && parsed >= 1 && parsed <= 4;
        })
      : [];
    
    // 🆕 ДРУЗЬЯ: цифры от 1 до 9
    const friendsDigits = Array.isArray(blocks?.friends?.digits)
      ? blocks.friends.digits.filter(d => {
          const parsed = parseInt(d, 10);
          return !isNaN(parsed) && parsed >= 1 && parsed <= 9;
        })
      : [];
    
    const mixDigits = Array.isArray(blocks?.mix?.digits)
      ? blocks.mix.digits.filter(d => d != null && d !== "")
      : [];

    const brothersActive = brothersDigits.length > 0;
    const friendsActive = friendsDigits.length > 0;
    const mixActive = mixDigits.length > 0;

if (!settings.silent)     console.log(`🔍 [generator] Проверка активации блоков:`, {
      brothersDigits,
      brothersActive,
      friendsDigits,
      friendsActive,
      mixDigits,
      mixActive,
      blocksFromSettings: blocks
    });

    //
    // 7. Собираем конфигурацию для правил.
    //
    // Эта конфигурация используется как для UnifiedSimpleRule, так и для других правил.
    //
    const ruleConfig = {
      // структура числа
      digitCount: digitCount,
      combineLevels: combineLevels,

      // желаемая длина примера
      minSteps: minSteps,
      maxSteps: maxSteps,

      // какие абсолютные шаги вообще можно давать ребёнку (+d / -d)
      selectedDigits: selectedDigits,

      // доступ к верхней бусине (формирует режим "Просто 4" vs "Просто 5")
      includeFive: includeFive,
      hasFive: includeFive, // совместимость со старым кодом,

      // ограничения направления
      onlyAddition: onlyAddition,
      onlySubtraction: onlySubtraction,

      // методическое правило блока "Просто":
      firstActionMustBePositive: true,

      // эти два поля сейчас не используются в "Просто",
      // но оставляем, чтобы внешний код не падал
      requireBlock: false,
      blockPlacement: "auto",

      // передаём исходный блок настроек целиком (UI),
      // чтобы правило при желании могло подсмотреть детали
      blocks: blocks,

      // флаг тихого режима для подавления логов
      silent: settings.silent || false
    };

if (!settings.silent)     console.log(
      "🧩 [generator] ruleConfig:",
      JSON.stringify(
        {
          digitCount: ruleConfig.digitCount,
          combineLevels: ruleConfig.combineLevels,
          minSteps: ruleConfig.minSteps,
          maxSteps: ruleConfig.maxSteps,
          selectedDigits: ruleConfig.selectedDigits,
          includeFive: ruleConfig.includeFive,
          onlyAddition: ruleConfig.onlyAddition,
          onlySubtraction: ruleConfig.onlySubtraction,
          brothersActive: brothersActive,
          brothersDigits: brothersDigits,
          friendsActive: friendsActive,
          friendsDigits: friendsDigits,
          mixActive: mixActive
        },
        null,
        2
      )
    );

    //
    // 8. Создаём правило.
    //
    // Логика выбора (ПРИОРИТЕТ):
    // 1. Если активен блок "Друзья" → FriendsRule
    // 2. Если активен блок "Братья" → BrothersRule
    // 3. Иначе → UnifiedSimpleRule (Просто)
    //
    // ВАЖНО: По ТЗ нельзя смешивать "Братья" и "Друзья" в одном примере!
    // Если оба активны — приоритет "Друзьям" (более сложное правило).
    // В будущем блок "Микс" будет обрабатывать комбинации.
    //
    let rule;
    let RuleClass;
    let ruleConfigForClass;

    // === ОПРЕДЕЛЯЕМ БАЗОВЫЙ КЛАСС ПРАВИЛА ===

    if (friendsActive === true) {
      // 🆕 ДРУЗЬЯ — используем специализированный генератор
if (!settings.silent)       console.log("🤝 [generator] Специализированный генератор: ДРУЗЬЯ");
if (!settings.silent)       console.log("   📌 Выбранные друзья:", friendsDigits);
if (!settings.silent)       console.log("   📌 Только сложение:", blocks?.friends?.onlyAddition);
if (!settings.silent)       console.log("   📌 Только вычитание:", blocks?.friends?.onlySubtraction);

      // Преобразуем строковые цифры в числа
      const selectedFriendsDigits = friendsDigits
        .map(d => parseInt(d, 10))
        .filter(n => n >= 1 && n <= 9);

      // FriendsExampleGenerator сам создаст дополнительный разряд для переноса
      // digitCount передаем оригинальный - это разрядность ДЕЙСТВИЙ:
      //   digitCount=1 → действия +1..+9 (однозначные), состояние 2 разряда
      //   digitCount=2 → действия +10..+99 (двузначные), состояние 3 разряда
      //   digitCount=3 → действия +100..+999 (трехзначные), состояние 4 разряда

      // Создаём специализированный генератор
      const friendsGenerator = new FriendsExampleGenerator({
        selectedDigits: selectedFriendsDigits.length > 0 ? selectedFriendsDigits : [1],
        digitCount: digitCount, // ← Передаем разрядность ДЕЙСТВИЙ (не состояния!)
        minSteps: minSteps,
        maxSteps: maxSteps,
        onlyAddition: blocks?.friends?.onlyAddition ?? false,
        onlySubtraction: blocks?.friends?.onlySubtraction ?? false,
        silent: settings.silent || false,  // Передаем флаг тихого режима
        blocks: blocks
      });

      // Генерируем пример
      const rawExample = friendsGenerator.generate();
      const formatted = friendsGenerator.toTrainerFormat(rawExample);

if (!settings.silent)       console.log(
        "✅ [generator] Friends пример готов:",
        JSON.stringify(formatted, null, 2)
      );

      return formatted;

    } else if (brothersActive === true) {
      // БРАТЬЯ — переходы через 5
if (!settings.silent)       console.log("👬 [generator] Базовое правило: БРАТЬЯ");
if (!settings.silent)       console.log("   📌 Выбранные братья:", brothersDigits);
if (!settings.silent)       console.log("   📌 Только сложение:", blocks?.brothers?.onlyAddition);
if (!settings.silent)       console.log("   📌 Только вычитание:", blocks?.brothers?.onlySubtraction);

      RuleClass = BrothersRule;

      // Преобразуем строковые цифры в числа
      const selectedBrothersDigits = brothersDigits
        .map(d => parseInt(d, 10))
        .filter(n => n >= 1 && n <= 4);

      ruleConfigForClass = {
        selectedDigits: selectedBrothersDigits.length > 0 ? selectedBrothersDigits : [4],
        onlyAddition: blocks?.brothers?.onlyAddition ?? false,
        onlySubtraction: blocks?.brothers?.onlySubtraction ?? false,
        minSteps: minSteps,
        maxSteps: maxSteps,
        digitCount: 1, // Базовое правило всегда для 1 разряда
        combineLevels: combineLevels,
        blocks: blocks,
        silent: settings.silent || false  // Флаг тихого режима
      };

    } else {
      // ПРОСТО — без формул
if (!settings.silent)       console.log("📘 [generator] Базовое правило: ПРОСТО");
      RuleClass = UnifiedSimpleRule;
      ruleConfigForClass = {
        ...ruleConfig,
        digitCount: 1 // Базовое правило всегда для 1 разряда
      };
    }

    // === ВЫБИРАЕМ ОДНОРАЗРЯДНОЕ ИЛИ МНОГОРАЗРЯДНОЕ ===

    // 🔴 СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ДРУЗЕЙ:
    // Правило Друзья ВСЕГДА требует минимум 2 разряда для СОСТОЯНИЯ абакуса,
    // потому что формула +n = +10 - friend использует следующий разряд.
    //
    // НО: digitCount из UI определяет какие ДЕЙСТВИЯ генерировать:
    // - digitCount=1 → действия +1, +2, +3 (однозначные)
    // - digitCount=2 → действия +1, +14, +23 (одно- и двузначные)
    //
    // Поэтому для Друзей:
    // - Внутренняя разрядность STATE = max(digitCount, 2)
    // - Разрядность ДЕЙСТВИЙ = digitCount (контролируется в MultiDigitGenerator)

    const effectiveDigitCount = (friendsActive && digitCount === 1) ? 2 : digitCount;

    if (effectiveDigitCount > 1 || friendsActive) {
      if (friendsActive && digitCount === 1) {
if (!settings.silent)         console.log(`🔢 [generator] Режим ОДНОРАЗРЯДНЫЕ ДЕЙСТВИЯ для Друзья`);
if (!settings.silent)         console.log(`   📌 Действия: однозначные (+1, +2, +3)`);
if (!settings.silent)         console.log(`   📌 Состояние абакуса: 2 разряда (для формулы +10-friend)`);
      } else {
if (!settings.silent)         console.log(`🔢 [generator] Режим МНОГОРАЗРЯДНЫЙ (${effectiveDigitCount} разрядов)`);
if (!settings.silent)         console.log(`   📌 Переменная разрядность: ${combineLevels}`);
      }

      // Многоразрядный режим - используем MultiDigitGenerator
      rule = new MultiDigitGenerator(RuleClass, effectiveDigitCount, {
        ...ruleConfigForClass,
        variableDigitCounts: combineLevels, // Переключатель из UI
        minSteps: minSteps,
        maxSteps: maxSteps,
        originalDigitCount: digitCount // Сохраняем оригинальную разрядность для контроля действий
      });
    } else {
if (!settings.silent)       console.log("🔤 [generator] Режим ОДНОРАЗРЯДНЫЙ");

      // Одноразрядный режим - используем правило напрямую
      rule = new RuleClass(ruleConfigForClass);
    }

    //
    // 9. Генерируем пример.
    //
    const gen = new ExampleGenerator(rule);
    const rawExample = gen.generate(); // { start, steps:[{action,fromState,toState}], answer }

    //
    // 10. Преобразуем к формату, который ждёт UI/trainer_logic:
    // {
    //    start: 0,
    //    steps: ["+3","+1","-4", ...],
    //    answer: 0
    // }
    //
    const formatted = gen.toTrainerFormat(rawExample);

if (!settings.silent)     console.log(
      "✅ [generator] пример готов:",
      JSON.stringify(formatted, null, 2)
    );

    return formatted;
  } catch (error) {
    console.error("❌ [generator] Ошибка генерации примера:", error);
    console.error(error.stack);

    // Fallback: возвращаем простой пример
    console.warn("⚠️ [generator] Возвращаем fallback пример");
    return {
      start: 0,
      steps: ["+1", "+2", "-1"],
      answer: 2
    };
  }
}
