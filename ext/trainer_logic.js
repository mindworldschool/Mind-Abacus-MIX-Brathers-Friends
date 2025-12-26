// ext/trainer_logic.js — Trainer logic (патч B с исправлением навигации и retry)
// 🔥 ИСПРАВЛЕНО: Добавлена остановка пошагового показа при переходе между экранами
//
// Главное отличие от старой версии в репозитории:
// 1. Мы разделяем переходы:
//    - onExitTrainer() → вернуться в настройки
//    - onShowResultsScreen() → показать ГЛОБАЛЬНЫЙ экран результатов
// 2. Кнопка "⏹ Выйти" больше НЕ открывает экран результатов. Только настройки.
// 3. Режим "Исправить ошибки" запускается правильно: только ошибочные примеры,
//    никаких новых сгенерированных примеров и ровно столько, сколько было ошибок.
// 4. finishTraining() теперь НЕ рендерит локальный экран "Итоги сессии" прямо
//    в тренажёре. Он сохраняет результаты в state и вызывает onShowResultsScreen().
//    Внешний экран "Результаты" теперь единственный финальный экран.
// 5. ✅ НОВОЕ: Добавлена остановка анимации (exampleView.stopAnimation()) при:
//    - Переходе в настройки (кнопка "Выйти")
//    - Завершении тренировки (finishTraining)
//    - Начале нового примера (showNextExample)
//
// Всё остальное (session.mode, reviewQueue, renderResultsScreen и т.д.) мы
// сохраняем для совместимости, но теперь они не ломают UX.

import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { buildGeneratorSettingsFromSettings } from "./core/buildGeneratorSettings.js";
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, DEFAULTS } from "../core/utils/constants.js";
import { eventBus, EVENTS } from "../core/utils/events.js";
import toast from "../ui/components/Toast.js";
import { state, resetResults } from "../core/state.js";

const CONTEXT = "Trainer";

/* ---------------- Layout helpers ---------------- */

function createTrainerLayout(displayMode, exampleCount, t) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  // MAIN COLUMN (пример + ответ)
  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  // ПРАВАЯ ПАНЕЛЬ
  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";
  panelControls.className = "panel-controls";

  // Блок ответа в правой панели (первым элементом)
  const answerSection = document.createElement("div");
  answerSection.className = "answer-section-panel";

  const answerLabel = document.createElement("div");
  answerLabel.className = "answer-label";
  answerLabel.textContent = t?.("trainer.answerLabel") || "Ответ:";

  const answerInput = document.createElement("input");
  answerInput.type = "number";
  answerInput.id = "answer-input";
  answerInput.placeholder = "";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.id = "btn-submit";
  submitBtn.textContent =
    t?.("trainer.submitButton") || "Ответить";

  answerSection.append(answerLabel, answerInput, submitBtn);

  // --- Карточка Статистика (results-capsule-extended)
  const statsCard = document.createElement("div");
  statsCard.className = "results-capsule-extended";

  const statsHeader = document.createElement("div");
  statsHeader.className = "results-capsule-extended__header";

  const statsLabel = document.createElement("div");
  statsLabel.className = "results-capsule-extended__label";
  statsLabel.textContent = t?.("trainer.stats.actions") || "Количество действий";

  const statsCounter = document.createElement("div");
  statsCounter.className = "results-capsule-extended__counter";
  statsCounter.innerHTML = '<span id="stats-completed">0</span> / <span id="stats-total">' + exampleCount + '</span>';

  statsHeader.append(statsLabel, statsCounter);

  const resultsCapsule = document.createElement("div");
  resultsCapsule.className = "results-capsule";

  const correctSide = document.createElement("div");
  correctSide.className = "results-capsule__side results-capsule__side--correct";
  correctSide.innerHTML = `
    <div class="results-capsule__icon">✓</div>
    <div class="results-capsule__value" id="stats-correct">0</div>
  `;

  const incorrectSide = document.createElement("div");
  incorrectSide.className = "results-capsule__side results-capsule__side--incorrect";
  incorrectSide.innerHTML = `
    <div class="results-capsule__icon">✗</div>
    <div class="results-capsule__value" id="stats-incorrect">0</div>
  `;

  resultsCapsule.append(correctSide, incorrectSide);
  statsCard.append(statsHeader, resultsCapsule);

  // --- Карточка Прогресс (компактная)
  const progressCard = document.createElement("div");
  progressCard.className = "progress-container";

  const progressTitle = document.createElement("div");
  progressTitle.className = "progress-container__title";
  progressTitle.textContent =
    t?.("trainer.progress.title") || "Прогресс";

  const progressLabels = document.createElement("div");
  progressLabels.className = "progress-container__labels";

  const correctLabel = document.createElement("span");
  correctLabel.className = "progress-label__correct";
  correctLabel.innerHTML = `${t?.("trainer.correctLabel") || "Правильно:"} <strong id="percent-correct">0%</strong>`;

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.innerHTML = `${t?.("trainer.incorrectLabel") || "Ошибки:"} <strong id="percent-incorrect">0%</strong>`;

  progressLabels.append(correctLabel, incorrectLabel);
  progressCard.append(progressTitle, progressLabels);

  // --- Карточка Таймер
  const timerCard = document.createElement("div");
  timerCard.className = "panel-card panel-card--timer";

  const timerTitle = document.createElement("div");
  timerTitle.className = "panel-card__title";
  timerTitle.textContent =
    t?.("trainer.timer.title") || "Таймер";

  const timerBody = document.createElement("div");
  timerBody.className = "panel-card__body panel-card__body--timer";

  const timerContainer = document.createElement("div");
  timerContainer.id = "answer-timer";
  const timerBar = document.createElement("div");
  timerBar.className = "bar";
  timerContainer.appendChild(timerBar);

  const timerText = document.createElement("div");
  timerText.id = "answerTimerText";
  timerText.className = "answer-timer__text";

  timerBody.append(timerContainer, timerText);
  timerCard.append(timerTitle, timerBody);

  // --- Кнопка Абакус
  const abacusCard = document.createElement("div");
  abacusCard.className = "panel-card panel-card--compact";

  const abacusBtn = document.createElement("button");
  abacusBtn.className = "btn btn--secondary btn--fullwidth";
  abacusBtn.id = "btn-show-abacus";
  abacusBtn.textContent =
    t?.("trainer.showAbacus") || "🧮 Показать абакус";

  abacusCard.appendChild(abacusBtn);

  // --- Кнопка Выход
  const exitCard = document.createElement("div");
  exitCard.className = "panel-card panel-card--compact";

  const exitBtn = document.createElement("button");
  exitBtn.id = "btn-exit-trainer";
  exitBtn.className =
    "btn btn--secondary btn--fullwidth btn--danger";
  exitBtn.textContent =
    t?.("trainer.exitButton") || "⏹ Выйти";

  exitCard.appendChild(exitBtn);

  // Собираем правую панель
  panelControls.append(
    answerSection,
    statsCard,
    progressCard,
    timerCard,
    abacusCard,
    exitCard
  );

  // Общий layout
  layout.append(trainerMain, panelControls);

  return layout;
}

/* ---------------- Abacus wrapper ---------------- */

function createAbacusWrapper() {
  const wrapper = document.createElement("div");
  wrapper.id = "abacus-wrapper";
  wrapper.className = "abacus-wrapper";

  const closeBtn = document.createElement("button");
  closeBtn.id = "abacus-close";
  closeBtn.className = "abacus-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.setAttribute("aria-label", "Close abacus");
  closeBtn.type = "button";

  const abacusContainer = document.createElement("div");
  abacusContainer.id = "floating-abacus-container";
  abacusContainer.className = "abacus-container";

  wrapper.append(closeBtn, abacusContainer);

  return wrapper;
}

/* ---------------- Trainer mounting ---------------- */

export function mountTrainerUI(container, {
  t,
  state: stateFromCaller,
  retryMode,
  onExitTrainer,
  onShowResultsScreen
}) {
  try {
    logger.info(CONTEXT, "Mounting trainer UI...");
    logger.debug(CONTEXT, "Settings:", stateFromCaller?.settings);

    const st = stateFromCaller?.settings ?? {};
    const actionsCfg = st.actions ?? {};
    const examplesCfg = st.examples ?? {};
    const blockSimpleDigits = Array.isArray(st?.blocks?.simple?.digits)
      ? st.blocks.simple.digits
      : [];

    const digits = parseInt(st.digits, 10) || 1;
    const abacusColumns = digits + 1;
    const displayMode = st.inline ? "inline" : "column";

    // ====== РЕЖИМ ЗАПУСКА: обычный или retry после "Исправить ошибки"
    const isRetryStartup =
      retryMode?.enabled && Array.isArray(retryMode.examples);

    const baseExampleCount = getExampleCount(examplesCfg);

    const totalForThisRun = isRetryStartup
      ? retryMode.examples.length
      : baseExampleCount;

    const session = {
      currentExample: null,

      stats: {
        correct: 0,
        incorrect: 0,
        total: totalForThisRun
      },

      completed: 0,
      incorrectExamples: [],
      reviewQueue: isRetryStartup
        ? retryMode.examples.map((e) => ({
            ...e,
            question: e.question,
            correctAnswer: e.correctAnswer,
            userAnswer: e.userAnswer,
            answer: e.answer
          }))
        : [],
      reviewIndex: 0
    };

    const layout = createTrainerLayout(displayMode, totalForThisRun, t);
    container.innerHTML = "";
    container.appendChild(layout);

    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

    const abacusWrapper = createAbacusWrapper();
    document.body.appendChild(abacusWrapper);

    const exampleView = new ExampleView(
      document.getElementById("area-example")
    );
    exampleView.setDisplayMode(displayMode);

    const abacus = new Abacus(
      document.getElementById("floating-abacus-container"),
      { digitCount: abacusColumns }
    );

    const overlayColor =
      getComputedStyle(document.documentElement).getPropertyValue(
        "--leo-orange"
      ) || "#EC8D00";

    const overlay = new BigStepOverlay(
      document.getElementById("area-example"),
      overlayColor.trim() || "#EC8D00"
    );

    if (st.mode === "abacus") {
      abacusWrapper.classList.add("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) {
        btn.textContent =
          t?.("trainer.hideAbacus") || "🧮 Скрыть абакус";
      }
    }

    let isShowing = false;
    let showAbort = false;

    function adaptExampleFontSize(actionsCount, maxDigitsInOneStep) {
      const exampleLines = document.querySelectorAll(
        "#area-example .example__line"
      );

      if (!exampleLines.length) return;

      const actionsFactor = Math.min(actionsCount, 12) / 12;
      const digitsFactor = Math.min(maxDigitsInOneStep, 9) / 9;
      const complexityFactor = (actionsFactor + digitsFactor) / 2;

      const minFontSize = 24;
      const maxFontSize = 96;
      const fontSize =
        maxFontSize -
        complexityFactor * (maxFontSize - minFontSize);

      exampleLines.forEach((line) => {
        line.style.setProperty(
          "font-size",
          `${Math.round(fontSize)}px`,
          "important"
        );
        line.style.setProperty("line-height", "1.2", "important");
      });
    }

    function buildGeneratorSettings() {
      // Wrapper that delegates to shared helper in ext/core/buildGeneratorSettings.js
      // Uses current settings object `st` from mountTrainerUI scope.
      return buildGeneratorSettingsFromSettings(st);
    }

    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    function formatStep(step) {
      return String(step);
    }

    async function playSequential(
      steps,
      intervalMs,
      { beepOnStep = false } = {}
    ) {
      try {
        for (let i = 0; i < steps.length; i++) {
          if (showAbort) break;

          const stepStr = formatStep(steps[i]);
          const isOdd = i % 2 === 0;
          const color = isOdd ? "#EC8D00" : "#6db45c";

          overlay.show(stepStr, color);
          if (beepOnStep) playSound("tick");
          await delay(intervalMs);
          overlay.hide();
          await delay(UI.DELAY_BETWEEN_STEPS_MS);
        }
      } finally {
        overlay.clear();
      }
    }

    function updateStatsUI() {
      const { correct, incorrect, total } = session.stats;
      const completed = session.completed;
      const el = (id) => document.getElementById(id);

      if (el("stats-completed"))
        el("stats-completed").textContent = String(completed);
      if (el("stats-correct"))
        el("stats-correct").textContent = String(correct);
      if (el("stats-incorrect"))
        el("stats-incorrect").textContent = String(incorrect);

      const percentCorrect =
        completed > 0
          ? Math.round((correct / completed) * 100)
          : 0;
      const percentIncorrect =
        completed > 0
          ? Math.round((incorrect / completed) * 100)
          : 0;

      if (el("progress-correct"))
        el("progress-correct").style.width =
          percentCorrect + "%";
      if (el("progress-incorrect"))
        el("progress-incorrect").style.width =
          percentIncorrect + "%";

      if (el("percent-correct"))
        el("percent-correct").textContent =
          percentCorrect + "%";
      if (el("percent-incorrect"))
        el("percent-incorrect").textContent =
          percentIncorrect + "%";
    }

    function getNextExample() {
      if (session.reviewQueue.length > 0) {
        if (session.reviewIndex >= session.reviewQueue.length) {
          finishTraining();
          return null;
        }
        return session.reviewQueue[session.reviewIndex];
      }

      return generateExample(buildGeneratorSettings());
    }

    async function showNextExample() {
      exampleView.stopAnimation();
      overlay.clear();
      showAbort = true;
      isShowing = false;

      if (session.completed >= session.stats.total) {
        finishTraining();
        return;
      }

      const ex = getNextExample();
      if (!ex || !Array.isArray(ex.steps)) {
        logger.error(CONTEXT, "Некорректный пример:", ex);
        toast.error(
          t?.("errors.invalidExample") ||
            "Не удалось сгенерировать пример. Попробуйте ещё раз."
        );
        finishTraining();
        return;
      }

      session.currentExample = ex;

      const steps = ex.steps || [];
      const actionsLen = steps.length;

      let maxDigitsInStep = 1;
      for (const step of steps) {
        const numericPart = String(step).replace(/[^\d-]/g, "");
        const num = parseInt(numericPart, 10);
        if (!isNaN(num)) {
          const lenAbs = Math.abs(num).toString().length;
          if (lenAbs > maxDigitsInStep) {
            maxDigitsInStep = lenAbs;
          }
        }
      }

      const input = document.getElementById("answer-input");
      if (input) input.value = "";

      const shouldUseDictation = actionsLen > 12;
      const effectiveShowSpeed = shouldUseDictation
        ? 2000
        : (st.showSpeedMs || 0);
      const showSpeedActive =
        st.showSpeedEnabled && effectiveShowSpeed > 0;

      const displaySteps = ex.steps.map(step => {
        if (typeof step === "string") return step;
        if (step.step) return step.step;
        return String(step);
      });

      if (showSpeedActive || shouldUseDictation) {
        const area = document.getElementById("area-example");
        if (area) area.innerHTML = "";
      } else {
        exampleView.render(displaySteps, displayMode);
        requestAnimationFrame(() => {
          adaptExampleFontSize(actionsLen, maxDigitsInStep);
        });
      }

      const lockDuringShow = st.lockInputDuringShow !== false;
      if (input) input.disabled = lockDuringShow;

      if (showSpeedActive || shouldUseDictation) {
        isShowing = true;
        showAbort = false;
        await playSequential(
          displaySteps,
          effectiveShowSpeed,
          { beepOnStep: !!st.beepOnStep }
        );
        if (showAbort) return;
        await delay(
          st.showSpeedPauseAfterChainMs ??
            UI.PAUSE_AFTER_CHAIN_MS
        );
        isShowing = false;
        if (lockDuringShow && input) {
          input.disabled = false;
          input.focus();
        }
      } else {
        if (input) {
          input.disabled = false;
          input.focus();
        }
      }

      logger.debug(
        CONTEXT,
        "Next example:",
        ex.steps,
        "Correct answer:",
        ex.answer,
        "mode:",
        session.mode
      );
    }

    function checkAnswer() {
      const input = document.getElementById("answer-input");
      if (!input) return;

      if (isShowing && st.lockInputDuringShow !== false) return;

      const userAnswer = parseInt(input.value ?? "", 10);
      if (Number.isNaN(userAnswer)) {
        toast.info(
          t?.("trainer.enterAnswer") || "Введите ответ, пожалуйста."
        );
        input.focus();
        return;
      }

      const ex = session.currentExample;
      if (!ex) return;

      const isCorrect = userAnswer === ex.answer;

      session.completed += 1;

      if (isCorrect) {
        session.stats.correct += 1;
        playSound("correct");
      } else {
        session.stats.incorrect += 1;
        session.incorrectExamples.push({
          ...ex,
          userAnswer
        });
        playSound("wrong");
      }

      updateStatsUI();

      if (session.reviewQueue.length > 0) {
        session.reviewIndex += 1;
      }

      if (session.completed >= session.stats.total) {
        finishTraining();
      } else {
        showNextExample();
      }
    }

    function handleTimeExpired() {
      const ex = session.currentExample;
      if (!ex) return;

      session.completed += 1;
      session.stats.incorrect += 1;

      session.incorrectExamples.push({
        ...ex,
        userAnswer: null,
        timedOut: true
      });

      updateStatsUI();

      if (session.completed >= session.stats.total) {
        finishTraining();
      } else {
        showNextExample();
      }
    }

    function finishTraining() {
      exampleView.stopAnimation();
      stopAnswerTimer();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      abacusWrapper.classList.remove("visible");

      logger.info(
        CONTEXT,
        "Training finished:",
        {
          stats: session.stats,
          incorrectExamples: session.incorrectExamples,
          mode: session.mode
        }
      );

      state.results = {
        total: session.stats.total,
        success: session.stats.correct,
        wrongExamples: session.incorrectExamples
      };

      eventBus.emit(EVENTS.TRAINING_FINISH, {
        phase: "done",
        correct: session.stats.correct,
        total: session.stats.total,
        wrongExamples: session.incorrectExamples
      });

      onShowResultsScreen?.();
    }

    function attachListeners() {
      const input = document.getElementById("answer-input");
      const btnShowAbacus =
        document.getElementById("btn-show-abacus");
      const btnExitTrainer =
        document.getElementById("btn-exit-trainer");
      const abacusCloseBtn =
        document.getElementById("abacus-close");
      const btnSubmit =
        document.getElementById("btn-submit");

      if (input) {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            checkAnswer();
          }
        });
      }

      if (btnSubmit) {
        btnSubmit.addEventListener("click", () => {
          checkAnswer();
        });
      }

      if (btnShowAbacus) {
        btnShowAbacus.addEventListener("click", () => {
          const isVisible =
            abacusWrapper.classList.toggle("visible");
          btnShowAbacus.textContent = isVisible
            ? (t?.("trainer.hideAbacus") || "🧮 Скрыть абакус")
            : (t?.("trainer.showAbacus") || "🧮 Показать абакус");
        });
      }

      if (btnExitTrainer) {
        btnExitTrainer.addEventListener("click", () => {
          logger.info(CONTEXT, "Exit trainer clicked");

          exampleView.stopAnimation();
          showAbort = true;
          isShowing = false;
          overlay.clear();
          stopAnswerTimer();

          onExitTrainer?.();
        });
      }

      if (abacusCloseBtn) {
        abacusCloseBtn.addEventListener("click", () => {
          abacusWrapper.classList.remove("visible");
          const btn =
            document.getElementById("btn-show-abacus");
          if (btn) {
            btn.textContent =
              t?.("trainer.showAbacus") || "🧮 Показать абакус";
          }
        });
      }
    }

    attachListeners();

    if (st.timeLimitEnabled && st.timePerExampleMs > 0) {
      startAnswerTimer(st.timePerExampleMs, {
        onExpire: () => {
          logger.warn(CONTEXT, "Series time expired!");
          finishTraining();
        },
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar"
      });
    }

    if (st.perExampleTimerEnabled && st.perExampleTimeMs > 0) {
      startAnswerTimer(st.perExampleTimeMs, {
        onExpire: () => handleTimeExpired(),
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar"
      });
    }

    showNextExample();
    logger.info(
      CONTEXT,
      "Trainer mounted successfully."
    );
  } catch (error) {
    logger.error(CONTEXT, "Error mounting trainer:", error);
    showFatalError(container, error);
  }
}

function showFatalError(host, error) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "trainer-error";

  const title = document.createElement("strong");
  title.textContent = "Ошибка тренажёра";

  const msg =
    error && error.message
      ? error.message
      : "Не удалось инициализировать тренажёр. Попробуйте обновить страницу.";

  const br = document.createElement("br");

  const message = document.createTextNode(msg);

  errorDiv.append(title, br, message);
  host.insertBefore(errorDiv, host.firstChild);
}

function getExampleCount(examplesCfg) {
  if (!examplesCfg) return DEFAULTS.EXAMPLES_COUNT;
  return examplesCfg.infinite
    ? DEFAULTS.EXAMPLES_COUNT
    : (examplesCfg.count ?? DEFAULTS.EXAMPLES_COUNT);
}

