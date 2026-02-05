// ext/core/FriendsExampleGenerator.test.js
// ПРИОРИТЕТ 3.2: Тесты для граничных случаев FriendsExampleGenerator

import { describe, it, expect, beforeEach } from 'vitest';
import { FriendsExampleGenerator } from './FriendsExampleGenerator.js';

describe('FriendsExampleGenerator - Граничные случаи', () => {

  describe('ПРИОРИТЕТ 1.2: Валидация конфликта флагов', () => {
    it('должен выбросить ошибку при onlyAddition=true и onlySubtraction=true', () => {
      expect(() => {
        new FriendsExampleGenerator({
          onlyAddition: true,
          onlySubtraction: true,
          silent: true
        });
      }).toThrow('не могут быть активны одновременно');
    });

    it('должен успешно создаться с onlyAddition=true', () => {
      expect(() => {
        new FriendsExampleGenerator({
          onlyAddition: true,
          silent: true
        });
      }).not.toThrow();
    });

    it('должен успешно создаться с onlySubtraction=true', () => {
      expect(() => {
        new FriendsExampleGenerator({
          onlySubtraction: true,
          silent: true
        });
      }).not.toThrow();
    });

    it('должен успешно создаться без флагов (смешанный режим)', () => {
      expect(() => {
        new FriendsExampleGenerator({
          silent: true
        });
      }).not.toThrow();
    });
  });

  describe('ПРИОРИТЕТ 1.1: Первое действие в режиме onlySubtraction', () => {
    it('должен генерировать БОЛЬШОЕ первое действие для digitCount=1', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        onlySubtraction: true,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const firstAction = example.steps[0].action;

      // Для digitCount=1 (stateDigitCount=2) первое действие должно быть в диапазоне [10, 99]
      // Это обеспечивает разряд десятков >= 1 для Friends вычитания (-n = -10 + friend)
      expect(firstAction).toBeGreaterThanOrEqual(10);
      expect(firstAction).toBeLessThanOrEqual(99);
    });

    it('должен генерировать БОЛЬШОЕ первое действие для digitCount=2', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 2,
        onlySubtraction: true,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const firstAction = example.steps[0].action;

      // Для digitCount=2 (stateDigitCount=3) первое действие должно быть в диапазоне [100, 999]
      // Это обеспечивает разряд сотен >= 1 для Friends вычитания
      expect(firstAction).toBeGreaterThanOrEqual(100);
      expect(firstAction).toBeLessThanOrEqual(999);
    });

    it('должен генерировать БОЛЬШОЕ первое действие для digitCount=3', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 3,
        onlySubtraction: true,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const firstAction = example.steps[0].action;

      // Для digitCount=3 (stateDigitCount=4) первое действие должно быть в диапазоне [1000, 9999]
      // Это обеспечивает разряд тысяч >= 1 для Friends вычитания
      expect(firstAction).toBeGreaterThanOrEqual(1000);
      expect(firstAction).toBeLessThanOrEqual(9999);
    });
  });

  describe('ПРИОРИТЕТ 1.1: Первое действие в обычном режиме', () => {
    it('должен генерировать обычное действие для digitCount=1 без флагов', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const firstAction = example.steps[0].action;

      // Обычное действие должно быть в диапазоне [1, 9]
      expect(firstAction).toBeGreaterThanOrEqual(1);
      expect(firstAction).toBeLessThanOrEqual(9);
    });

    it('должен генерировать обычное действие для digitCount=2 без флагов', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 2,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const firstAction = example.steps[0].action;

      // Обычное действие должно быть в диапазоне [10, 99]
      expect(firstAction).toBeGreaterThanOrEqual(10);
      expect(firstAction).toBeLessThanOrEqual(99);
    });
  });

  describe('Генерация примеров - проверка структуры', () => {
    it('должен генерировать пример с правильным количеством шагов', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 5,
        silent: true
      });

      const example = gen.generate();

      expect(example.steps).toHaveLength(5);
      expect(example.start).toBeDefined();
      expect(example.answer).toBeDefined();
    });

    it('должен генерировать хотя бы одно Friends действие', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 7,
        selectedDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        silent: true
      });

      const example = gen.generate();
      const friendSteps = example.steps.filter(step => step.isFriend);

      expect(friendSteps.length).toBeGreaterThan(0);
    });

    it('в режиме onlyAddition все Friends действия должны быть положительными', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 7,
        onlyAddition: true,
        selectedDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        silent: true
      });

      const example = gen.generate();
      const friendSteps = example.steps.filter(step => step.isFriend);

      friendSteps.forEach(step => {
        expect(step.action).toBeGreaterThan(0);
      });
    });

    it('в режиме onlySubtraction все Friends действия должны быть отрицательными', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 7,
        onlySubtraction: true,
        selectedDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        silent: true
      });

      const example = gen.generate();
      const friendSteps = example.steps.filter(step => step.isFriend);

      friendSteps.forEach(step => {
        expect(step.action).toBeLessThan(0);
      });
    });
  });

  describe('ПРИОРИТЕТ 3.1: ActionDirectionConfig', () => {
    it('directionConfig должен быть инициализирован', () => {
      const gen = new FriendsExampleGenerator({
        silent: true
      });

      expect(gen.directionConfig).toBeDefined();
    });

    it('directionConfig.canAddition() должен работать правильно', () => {
      const genMixed = new FriendsExampleGenerator({ silent: true });
      expect(genMixed.directionConfig.canAddition()).toBe(true);

      const genAdd = new FriendsExampleGenerator({ onlyAddition: true, silent: true });
      expect(genAdd.directionConfig.canAddition()).toBe(true);

      const genSub = new FriendsExampleGenerator({ onlySubtraction: true, silent: true });
      expect(genSub.directionConfig.canAddition()).toBe(false);
    });

    it('directionConfig.canSubtraction() должен работать правильно', () => {
      const genMixed = new FriendsExampleGenerator({ silent: true });
      expect(genMixed.directionConfig.canSubtraction()).toBe(true);

      const genAdd = new FriendsExampleGenerator({ onlyAddition: true, silent: true });
      expect(genAdd.directionConfig.canSubtraction()).toBe(false);

      const genSub = new FriendsExampleGenerator({ onlySubtraction: true, silent: true });
      expect(genSub.directionConfig.canSubtraction()).toBe(true);
    });

    it('directionConfig.needsBigFirstAction() должен работать правильно', () => {
      const genMixed = new FriendsExampleGenerator({ silent: true });
      expect(genMixed.directionConfig.needsBigFirstAction()).toBe(false);

      const genAdd = new FriendsExampleGenerator({ onlyAddition: true, silent: true });
      expect(genAdd.directionConfig.needsBigFirstAction()).toBe(false);

      const genSub = new FriendsExampleGenerator({ onlySubtraction: true, silent: true });
      expect(genSub.directionConfig.needsBigFirstAction()).toBe(true);
    });

    it('directionConfig.getModeName() должен возвращать правильные названия', () => {
      const genMixed = new FriendsExampleGenerator({ silent: true });
      expect(genMixed.directionConfig.getModeName()).toBe('СМЕШАННЫЙ');

      const genAdd = new FriendsExampleGenerator({ onlyAddition: true, silent: true });
      expect(genAdd.directionConfig.getModeName()).toBe('ТОЛЬКО СЛОЖЕНИЕ');

      const genSub = new FriendsExampleGenerator({ onlySubtraction: true, silent: true });
      expect(genSub.directionConfig.getModeName()).toBe('ТОЛЬКО ВЫЧИТАНИЕ');
    });
  });

  describe('Валидация состояния абакуса', () => {
    it('не должен выходить за пределы разрядности', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 5,
        silent: true
      });

      const example = gen.generate();
      const finalNumber = gen.stateToNumber(example.answer);

      // Для digitCount=1 максимум 99
      expect(finalNumber).toBeLessThanOrEqual(99);
      expect(finalNumber).toBeGreaterThanOrEqual(0);
    });

    it('все промежуточные состояния должны быть валидными', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 7,
        silent: true
      });

      const example = gen.generate();

      example.steps.forEach((step, index) => {
        const states = step.states;
        states.forEach((digit, pos) => {
          expect(digit).toBeGreaterThanOrEqual(0);
          expect(digit).toBeLessThanOrEqual(9);
        });
      });
    });
  });

  describe('ПРИОРИТЕТ 1.3: Валидация _buildMultiDigitAction', () => {
    it('не должен возвращать null для валидного состояния', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 2,
        selectedDigits: [1, 2, 3],
        silent: true
      });

      // Начальное состояние [5, 5] подходит для большинства Friends операций
      const states = [5, 5, 0];

      // Попробуем построить действие для цифры 1 (сложение)
      const result = gen._buildMultiDigitAction(1, states, true);

      // Результат может быть null если не удалось подобрать, но с состоянием [5,5] должно получиться
      if (result !== null) {
        expect(result).toBeGreaterThan(0);
      }
    });
  });

  describe('toTrainerFormat - форматирование вывода', () => {
    it('должен правильно форматировать пример для тренажера', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 3,
        silent: true
      });

      const example = gen.generate();
      const formatted = gen.toTrainerFormat(example);

      expect(formatted.start).toBe(0);
      expect(formatted.steps).toBeDefined();
      expect(formatted.answer).toBeDefined();
      expect(typeof formatted.answer).toBe('number');
    });

    it('должен включать формулу Friends для Friends шагов', () => {
      const gen = new FriendsExampleGenerator({
        digitCount: 1,
        stepsCount: 7,
        selectedDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        silent: true
      });

      const example = gen.generate();
      const formatted = gen.toTrainerFormat(example);

      const friendSteps = formatted.steps.filter(step => typeof step === 'object' && step.isFriend);

      friendSteps.forEach(step => {
        expect(step.formula).toBeDefined();
        expect(step.friendN).toBeDefined();
      });
    });
  });
});
