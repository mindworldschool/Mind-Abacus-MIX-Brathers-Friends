/**
 * speech.js - Модуль для озвучивания чисел (режим Диктант)
 *
 * ИСПОЛЬЗОВАНИЕ:
 * import { speakNumber, initSpeech, isSpeechSupported } from './utils/speech.js';
 *
 * if (isSpeechSupported()) {
 *   initSpeech(); // вызвать один раз при загрузке
 *   speakNumber('+25'); // озвучить число
 * }
 */

// Проверка поддержки Web Speech API
export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}

// Хранилище настроек
let speechSettings = {
  lang: 'ru-RU',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: null
};

// Флаг инициализации
let initialized = false;

/**
 * Инициализация модуля речи
 * Вызывать один раз при загрузке приложения
 */
export function initSpeech() {
  if (!isSpeechSupported()) {
    console.warn('⚠️ Web Speech API не поддерживается в этом браузере');
    return false;
  }

  // Ждем загрузки голосов
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', selectVoice);
  } else {
    selectVoice();
  }

  initialized = true;
  console.log('✅ Модуль речи инициализирован');
  return true;
}

/**
 * Выбор подходящего голоса (предпочтительно русский)
 */
function selectVoice() {
  const voices = speechSynthesis.getVoices();

  // Ищем русский голос
  let russianVoice = voices.find(v => v.lang.startsWith('ru'));

  // Если нет русского, берем первый доступный
  if (!russianVoice && voices.length > 0) {
    russianVoice = voices[0];
    console.log('⚠️ Русский голос не найден, используется:', russianVoice.name);
  }

  if (russianVoice) {
    speechSettings.voice = russianVoice;
    speechSettings.lang = russianVoice.lang;
    console.log('🗣️ Выбран голос:', russianVoice.name, russianVoice.lang);
  }
}

/**
 * Преобразование числа в текст для озвучивания
 * @param {string|number} step - Шаг примера (например, "+25", "-10", "123")
 * @returns {string} Текст для озвучивания
 */
function numberToSpeechText(step) {
  const str = String(step).trim();

  // Извлекаем знак и число
  let sign = '';
  let numStr = str;

  if (str.startsWith('+')) {
    sign = 'плюс ';
    numStr = str.slice(1);
  } else if (str.startsWith('-')) {
    sign = 'минус ';
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
