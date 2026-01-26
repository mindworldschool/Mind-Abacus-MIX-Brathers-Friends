/**
 * speech.js - Модуль для озвучивания чисел (режим Диктант)
 *
 * ИСПОЛЬЗОВАНИЕ:
 * import { speakNumber, initSpeech, isSpeechSupported } from './utils/speech.js';
 *
 * if (isSpeechSupported()) {
 *   initSpeech('ru'); // вызвать один раз при загрузке с кодом языка
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

// Локализация слов "плюс" и "минус"
const SPEECH_WORDS = {
  'ua': { plus: 'плюс', minus: 'мінус' },
  'ru': { plus: 'плюс', minus: 'минус' },
  'en': { plus: 'plus', minus: 'minus' },
  'es': { plus: 'más', minus: 'menos' }
};

// Хранилище настроек
let speechSettings = {
  lang: 'ru-RU',
  appLang: 'ru',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: null
};

// Флаг инициализации
let initialized = false;

/**
 * Инициализация модуля речи
 * @param {string} [appLanguage='ru'] - Код языка приложения (ua, ru, en, es)
 * @returns {boolean} Успех инициализации
 */
export function initSpeech(appLanguage = 'ru') {
  if (!isSpeechSupported()) {
    console.warn('⚠️ Web Speech API не поддерживается в этом браузере');
    return false;
  }

  // Сохраняем язык приложения
  speechSettings.appLang = appLanguage;
  speechSettings.lang = LANG_MAP[appLanguage] || 'ru-RU';

  // Ждем загрузки голосов
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => selectVoice(appLanguage));
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
  speechSettings.lang = LANG_MAP[appLanguage] || 'ru-RU';
  selectVoice(appLanguage);

  console.log(`🗣️ Язык озвучки изменён на: ${appLanguage} (${speechSettings.lang})`);
}

/**
 * Выбор подходящего голоса для указанного языка
 * @param {string} appLanguage - Код языка приложения
 */
function selectVoice(appLanguage) {
  const voices = speechSynthesis.getVoices();
  const targetLang = LANG_MAP[appLanguage] || 'ru-RU';
  const langPrefix = targetLang.split('-')[0]; // 'uk', 'ru', 'en', 'es'

  // Ищем голос для нужного языка
  let selectedVoice = voices.find(v => v.lang === targetLang);

  // Если точного совпадения нет, ищем по префиксу
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.startsWith(langPrefix));
  }

  // Если всё ещё нет, берем первый доступный
  if (!selectedVoice && voices.length > 0) {
    selectedVoice = voices[0];
    console.log(`⚠️ Голос для ${appLanguage} не найден, используется: ${selectedVoice.name}`);
  }

  if (selectedVoice) {
    speechSettings.voice = selectedVoice;
    speechSettings.lang = selectedVoice.lang;
    console.log(`🗣️ Выбран голос: ${selectedVoice.name} (${selectedVoice.lang})`);
  }
}

/**
 * Преобразование числа в текст для озвучивания
 * @param {string|number} step - Шаг примера (например, "+25", "-10", "123")
 * @returns {string} Текст для озвучивания
 */
function numberToSpeechText(step) {
  const str = String(step).trim();
  const words = SPEECH_WORDS[speechSettings.appLang] || SPEECH_WORDS['ru'];

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

    // Применяем настройки
    utterance.lang = speechSettings.lang;
    utterance.rate = options.rate ?? speechSettings.rate;
    utterance.pitch = speechSettings.pitch;
    utterance.volume = options.volume ?? speechSettings.volume;

    if (speechSettings.voice) {
      utterance.voice = speechSettings.voice;
    }

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
