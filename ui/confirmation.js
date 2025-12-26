import {
  createScreenShell,
  createButton,
  createStepIndicator,
  formatOptionLabel
} from "./helper.js";
import { generateWorksheet } from "../ext/print/worksheetGenerator.js";
import { openWorksheetPrintWindow } from "../ext/print/worksheetPrintWindow.js";

export function renderConfirmation(container, { t, state, navigate }) {
  const { section, body, heading, paragraph } = createScreenShell({
    title: t("confirmation.title"),
    description: t("confirmation.description"),
    className: "confirmation-screen"
  });

  const indicator = createStepIndicator("confirmation", t);
  section.insertBefore(indicator, section.firstChild);

  heading.textContent = t("confirmation.title");
  paragraph.textContent = t("confirmation.description");

  const summaryCard = document.createElement("div");
  summaryCard.className = "summary-card";

  const list = document.createElement("dl");
  list.className = "summary-card__list";

  const labels = t("confirmation.list");
  const settings = state.settings || {};

  const booleanText = t("confirmation.boolean");
  const counterText = t("confirmation.counter");

  const mode = formatOptionLabel(t("settings.modeOptions"), settings.mode);
  const digits = formatOptionLabel(t("settings.digitsOptions"), settings.digits);
  const combine = settings.combineLevels ? booleanText.yes : booleanText.no;
  const actionCount = settings.actions?.infinite
    ? counterText.infinity
    : String(settings.actions?.count ?? 0);
  const examples = settings.examples?.infinite
    ? counterText.infinity
    : String(settings.examples?.count ?? 0);
  const time = formatOptionLabel(t("settings.timeOptions"), settings.timeLimit);
  const speed = formatOptionLabel(t("settings.speedOptions"), settings.speed);
  const transition = formatOptionLabel(
    t("settings.transitionOptions"),
    settings.transition
  );
  const inline = settings.inline ? booleanText.yes : booleanText.no;

  const entries = [
    { label: labels.mode, value: mode },
    { label: labels.digits, value: digits },
    { label: labels.combine, value: combine },
    { label: labels.actions, value: actionCount },
    { label: labels.examples, value: examples },
    { label: labels.time, value: time },
    { label: labels.speed, value: speed },
    { label: labels.transition, value: transition },
    { label: labels.inline, value: inline }
  ];

  const featuresText = t("confirmation.features");
  const toggleLabels = t("settings.toggles");
  const featureSeparator = featuresText.separator || ", ";
  const enabledToggles = Object.entries(settings.toggles || {})
    .filter(([, active]) => active)
    .map(([key]) => toggleLabels[key])
    .filter(Boolean);
  const featuresValue = enabledToggles.length
    ? enabledToggles.join(featureSeparator)
    : featuresText.none;
  entries.push({ label: featuresText.label, value: featuresValue });

  const blockText = t("confirmation.blocks");
  const blockLabels = blockText.labels || {};
  const blockSeparator = blockText.separator || ", ";
  const blockOrder = ["simple", "brothers", "friends", "mix"];

  blockOrder.forEach((key) => {
    const blockState = settings.blocks?.[key];
    if (!blockState) return;

    const digitsValue = blockState.digits.length
      ? blockState.digits.join(blockSeparator)
      : blockText.none;
    const extras = [];
    if (blockState.onlyAddition) extras.push(blockText.additionOnly);
    if (blockState.onlySubtraction) extras.push(blockText.subtractionOnly);

    const value = extras.length
      ? `${digitsValue} (${extras.join(blockSeparator)})`
      : digitsValue;

    entries.push({ label: blockLabels[key] || key, value });
  });

  entries.forEach(({ label, value }) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  });

  summaryCard.appendChild(list);

  const actions = document.createElement("div");
  actions.className = "form__actions";

  const backButton = createButton({
    label: t("buttons.back"),
    variant: "secondary",
    onClick: () => navigate("settings")
  });

  // Локализованный текст для кнопки превью
  const previewLabels = {
    ua: "Попередній перегляд листа",
    ru: "Предпросмотр листа",
    en: "Preview worksheet",
    es: "Vista previa de la hoja"
  };
  const previewLabel =
    previewLabels[state.language] || previewLabels.en;

  // Один общий хелпер: сгенерировать лист и открыть окно
  function generateAndOpen(autoPrint) {
    const s = state.settings || {};

    const rawExamplesCount =
      s.print?.examplesCount ?? s.examples?.count ?? 10;

    const rawNumber = Number(rawExamplesCount);
    const examplesCount =
      Number.isFinite(rawNumber) && rawNumber > 0 ? rawNumber : 10;

    const showAnswers =
      typeof s.print?.showAnswers === "boolean"
        ? s.print.showAnswers
        : false;

    const worksheet = generateWorksheet({
      examplesCount,
      showAnswers
    });

    if (worksheet) {
      openWorksheetPrintWindow({ autoPrint });
    }
  }

  // Кнопка ПРЕДПРОСМОТР (без автоматической печати)
  const previewButton = createButton({
    label: previewLabel,
    variant: "secondary",
    onClick: () => generateAndOpen(false)
  });

  // Кнопка ПЕЧАТЬ (сразу вызвать print())
  const printButton = createButton({
    label: t("confirmation.printButton"),
    variant: "secondary",
    onClick: () => generateAndOpen(true)
  });

  const continueButton = createButton({
    label: t("buttons.continue"),
    onClick: () => navigate("game")
  });

  // 4 кнопки: Назад / Превью / Печать / Продолжить
  actions.append(backButton, previewButton, printButton, continueButton);

  body.append(summaryCard, actions);
  container.appendChild(section);
}
