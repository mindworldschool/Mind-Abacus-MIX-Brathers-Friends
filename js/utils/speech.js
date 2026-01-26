/**
 * speech.js - Модуль для озвучивания чисел (режим Диктант)
 *
 * ИСПОЛЬЗОВАНИЕ:
 * import { speakNumber, initSpeech, isSpeechSupported } from './utils/speech.js';
 *
 * if (isSpeechSupported()) {
 *   initSpeech('ua'); // вызвать один раз при загрузке с кодом языка
 *   speakNumber('+25'); // озвучить число
 * }
 */

// Проверка поддержки Web Speech API
export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}

// Маппинг кодов языков приложения на коды Speech API
const LANG_MAP = {
  'ua': 'uk-UA',  // Украинский
  'ru': 'ru-RU',  // Русский
  'en': 'en-US',  // Английский
  'es': 'es-ES'   // Испанский
};

// Альтернативные коды языков для поиска голоса
const LANG_ALTERNATIVES = {
  'ua': ['uk-UA', 'uk_UA', 'uk'],
  'ru': ['ru-RU', 'ru_RU', 'ru'],
  'en': ['en-US', 'en-GB', 'en_US', 'en'],
  'es': ['es-ES', 'es-MX', 'es_ES', 'es']
};

// Локализация слов "плюс" и "минус"
const SPEECH_WORDS = {
  'ua': { plus: 'плюс', minus: 'мінус' },
  'ru': { plus: 'плюс', minus: 'минус' },
  'en': { plus: 'plus', minus: 'minus' },
  'es': { plus: 'más', minus: 'menos' }
};

// Хранилище настроек
let speechSettings = {
  lang: 'uk-UA',
  appLang: 'ua',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: null,
  forceLanguage: true // Принудительно использовать язык, даже без голоса
};

// Флаг инициализации
let initialized = false;

/**
 * Инициализация модуля речи
 * @param {string} [appLanguage='ua'] - Код языка приложения (ua, ru, en, es)
 * @returns {boolean} Успех инициализации
 */
export function initSpeech(appLanguage = 'ua') {
  if (!isSpeechSupported()) {
    console.warn('⚠️ Web Speech API не поддерживается в этом браузере');
    return false;
  }

  // Сохраняем язык приложения
  speechSettings.appLang = appLanguage;
  speechSettings.lang = LANG_MAP[appLanguage] || 'uk-UA';

  // Ждем загрузки голосов
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => selectVoice(appLanguage), { once: true });
  } else {
    selectVoice(appLanguage);
  }

  initialized = true;
  console.log(`✅ Модуль речи инициализирован для языка: ${appLanguage} (${speechSettings.lang})`);
  return true;
}

/**
 * Смена языка озвучки
 * @param {string} appLanguage - Код языка приложения (ua, ru, en, es)
 */
export function setSpeechLanguage(appLanguage) {
  if (!isSpeechSupported()) return;

  speechSettings.appLang = appLanguage;
  speechSettings.lang = LANG_MAP[appLanguage] || 'uk-UA';
  selectVoice(appLanguage);

  console.log(`🗣️ Язык озвучки изменён на: ${appLanguage} (${speechSettings.lang})`);
}

/**
 * Выбор подходящего голоса для указанного языка
 * @param {string} appLanguage - Код языка приложения
 */
function selectVoice(appLanguage) {
  const voices = speechSynthesis.getVoices();
  const targetLang = LANG_MAP[appLanguage] || 'uk-UA';
  const alternatives = LANG_ALTERNATIVES[appLanguage] || [targetLang];

  console.log(`🔍 Поиск голоса для ${appLanguage}, доступно голосов: ${voices.length}`);

  // Выводим все доступные голоса для отладки
  if (voices.length > 0) {
    console.log('📋 Доступные голоса:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
  }

  let selectedVoice = null;

  // Ищем голос по альтернативным кодам языка
  for (const langCode of alternatives) {
    selectedVoice = voices.find(v => v.lang === langCode);
    if (selectedVoice) break;

    // Поиск по началу кода (uk, ru, en, es)
    const prefix = langCode.split(/[-_]/)[0];
    selectedVoice = voices.find(v => v.lang.startsWith(prefix + '-') || v.lang.startsWith(prefix + '_') || v.lang === prefix);
    if (selectedVoice) break;
  }

  if (selectedVoice) {
    speechSettings.voice = selectedVoice;
    // НЕ меняем speechSettings.lang на язык найденного голоса!
    // Оставляем целевой язык, чтобы числа читались правильно
    console.log(`🗣️ Найден голос: ${selectedVoice.name} (${selectedVoice.lang})`);
  } else {
    // Голос не найден - НЕ используем fallback на другой язык!
    speechSettings.voice = null;
    console.log(`⚠️ Голос для ${appLanguage} не найден. Будет использован системный голос с языком ${targetLang}`);
  }

  // ВАЖНО: Всегда устанавливаем целевой язык, независимо от найденного голоса
  speechSettings.lang = targetLang;
}

/**
 * Преобразование числа в текст для озвучивания
 * @param {string|number} step - Шаг примера (например, "+25", "-10", "123")
 * @returns {string} Текст для озвучивания
 */
function numberToSpeechText(step) {
  const str = String(step).trim();
  const words = SPEECH_WORDS[speechSettings.appLang] || SPEECH_WORDS['ua'];

  // Извлекаем знак и число
  let sign = '';
  let numStr = str;

  if (str.startsWith('+')) {
    sign = words.plus + ' ';
    numStr = str.slice(1);
  } else if (str.startsWith('-')) {
    sign = words.minus + ' ';
    numStr = str.slice(1);
  }

  const num = parseInt(numStr, 10);

  if (isNaN(num)) {
    return str; // Возвращаем как есть, если не число
  }

  // Озвучиваем число
  return sign + num.toString();
}

/**
 * Озвучивание числа
 * @param {string|number} step - Шаг примера (например, "+25", "-10")
 * @param {Object} [options] - Дополнительные настройки
 * @param {number} [options.rate] - Скорость речи (0.1 - 10, по умолчанию 1.0)
 * @param {number} [options.volume] - Громкость (0 - 1, по умолчанию 1.0)
 * @param {Function} [options.onEnd] - Колбэк по окончании озвучивания
 * @returns {Promise<void>}
 */
export function speakNumber(step, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      console.warn('⚠️ Web Speech API не поддерживается');
      resolve();
      return;
    }

    // Отменяем предыдущую речь
    speechSynthesis.cancel();

    const text = numberToSpeechText(step);
    const utterance = new SpeechSynthesisUtterance(text);

    // ПРИНУДИТЕЛЬНО устанавливаем целевой язык!
    utterance.lang = speechSettings.lang;
    utterance.rate = options.rate ?? speechSettings.rate;
    utterance.pitch = speechSettings.pitch;
    utterance.volume = options.volume ?? speechSettings.volume;

    // НЕ устанавливаем voice - пусть браузер сам выберет по lang
    // Это заставит браузер искать голос для указанного языка
    // utterance.voice = speechSettings.voice; // ОТКЛЮЧЕНО

    console.log(`🔊 Озвучка: "${text}" язык: ${utterance.lang} (принудительно)`);

    // Обработчики событий
    utterance.onend = () => {
      if (options.onEnd) options.onEnd();
      resolve();
    };

    utterance.onerror = (event) => {
      console.error('❌ Ошибка озвучивания:', event.error);
      resolve(); // Не блокируем выполнение при ошибке
    };

    // Запускаем озвучивание
    speechSynthesis.speak(utterance);
  });
}

/**
 * Остановка текущего озвучивания
 */
export function stopSpeech() {
  if (isSpeechSupported()) {
    speechSynthesis.cancel();
  }
}

/**
 * Установка скорости речи
 * @param {number} rate - Скорость (0.5 - 2.0)
 */
export function setSpeechRate(rate) {
  speechSettings.rate = Math.max(0.5, Math.min(2.0, rate));
}

/**
 * Установка громкости речи
 * @param {number} volume - Громкость (0 - 1)
 */
export function setSpeechVolume(volume) {
  speechSettings.volume = Math.max(0, Math.min(1, volume));
}

/**
 * Проверка инициализации
 */
export function isSpeechInitialized() {
  return initialized && isSpeechSupported();
}

/**
 * Получение текущего языка озвучки
 */
export function getCurrentSpeechLanguage() {
  return speechSettings.appLang;
}
