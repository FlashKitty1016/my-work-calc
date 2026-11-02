/* Calculations only: usable in both the browser and Node.js tests. */
(() => {
  'use strict';

  const PAYROLL_RULES = Object.freeze({
    lunchMinutes: 30,
    lunchCents: 1000,
    dinnerCents: 1500,
    transportCents: 1000,
    roundingMinutes: 10,
  });
  const MAX_RANDOM_COUNT = 10000;

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours} 小时${remainder ? ` ${remainder} 分钟` : ''}` : `${remainder} 分钟`;
  }

  function timeToMinutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error('请输入有效的上下班时间');
    }
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function payrollTimeWarning(start, end) {
    if (start >= 720 || end >= start) return '';
    const afternoon = `${String(Math.floor(end / 60) + 12).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    return `下班是否为 ${afternoon}？当前按次日计算，请核对。`;
  }

  function payrollAmounts({ start, end, rateCents, addLunch = false, roundToTen = false, addDinner = false, addTransport = false }) {
    const endMinute = end < start ? end + 1440 : end;
    const elapsed = endMinute - start;
    if (addLunch && elapsed < PAYROLL_RULES.lunchMinutes) {
      throw new Error('上班时长不足 30 分钟，请检查时间或关闭“加午餐”');
    }
    const breakMinutes = addLunch ? PAYROLL_RULES.lunchMinutes : 0;
    const lunchAllowanceCents = addLunch ? PAYROLL_RULES.lunchCents : 0;
    const dinnerAllowanceCents = addDinner ? PAYROLL_RULES.dinnerCents : 0;
    const transportAllowanceCents = addTransport ? PAYROLL_RULES.transportCents : 0;
    const worked = elapsed - breakMinutes;
    const step = PAYROLL_RULES.roundingMinutes;
    const paid = roundToTen ? Math.round(worked / step) * step : worked;
    // Calculate in cents and round only the final wage.
    const wageCents = Math.round(paid * rateCents / 60);
    const allowanceCents = lunchAllowanceCents + dinnerAllowanceCents + transportAllowanceCents;
    return { elapsed, breakMinutes, worked, paid, wageCents, lunchAllowanceCents, dinnerAllowanceCents, transportAllowanceCents, allowanceCents };
  }

  function cylinderVolume(diameter, innerDiameter, length) {
    if (diameter <= 0 || length <= 0) return 0;
    if (innerDiameter < 0 || innerDiameter >= diameter) return NaN;
    const outerRadius = diameter / 20;
    const innerRadius = innerDiameter / 20;
    return Math.PI * (outerRadius ** 2 - innerRadius ** 2) * (length / 10);
  }

  function readNumber(value, name) {
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw new Error(`${name} 请输入有效数字`);
    }
    return Number(value);
  }

  function readInteger(value, name) {
    const number = readNumber(value, name);
    if (!Number.isSafeInteger(number)) throw new Error(`${name} 必须是有效整数`);
    return number;
  }

  function randomInteger(min, max, random) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function uniqueIntegers(min, capacity, count, random) {
    // Partial shuffle: exactly one draw per result, even when the range is full.
    const swaps = new Map();
    const result = [];
    for (let remaining = capacity; result.length < count; remaining -= 1) {
      const index = randomInteger(0, remaining - 1, random);
      result.push(min + (swaps.get(index) ?? index));
      swaps.set(index, swaps.get(remaining - 1) ?? remaining - 1);
      swaps.delete(remaining - 1);
    }
    return result;
  }

  function scaledBound(value, factor, round) {
    const scaled = value * factor;
    // Account for representations such as 0.07 * 100 = 7.000000000000001.
    const tolerance = Math.min(1e-7, Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4);
    return round === Math.ceil ? Math.ceil(scaled - tolerance) : Math.floor(scaled + tolerance);
  }

  function generateRandomNumbers({ type, unique = false, places = 2, count, base, positiveOffset, negativeOffset }, random = Math.random) {
    count = readInteger(count, '生成数量');
    base = readNumber(base, '基准值');
    positiveOffset = readNumber(positiveOffset, '正偏移');
    negativeOffset = readNumber(negativeOffset, '负偏移');
    if (count < 1 || count > MAX_RANDOM_COUNT) {
      throw new Error(`生成数量须在 1–${MAX_RANDOM_COUNT} 之间`);
    }
    if (positiveOffset < 0 || negativeOffset < 0) throw new Error('偏移值不能小于 0');
    if (!['integer', 'float'].includes(type)) throw new Error('请选择数值类型');
    const min = base - negativeOffset;
    const max = base + positiveOffset;
    if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('数值范围过大');

    const isInteger = type === 'integer';
    if (!isInteger) {
      places = readInteger(places, '小数点位数');
      if (places < 0 || places > 12) throw new Error('小数点位数必须在 0 到 12 之间');
    }
    const factor = isInteger ? 1 : 10 ** places;
    const scaledMin = isInteger ? Math.ceil(min) : scaledBound(min, factor, Math.ceil);
    const scaledMax = isInteger ? Math.floor(max) : scaledBound(max, factor, Math.floor);
    const capacity = scaledMax - scaledMin + 1;
    if (capacity <= 0) throw new Error(`当前范围内没有可生成的${isInteger ? '整数' : '浮点数'}`);
    if (![scaledMin, scaledMax, capacity].every(Number.isSafeInteger)) {
      throw new Error('数值范围或小数位数过大，请缩小后重试');
    }
    if (unique && count > capacity) {
      throw new Error(`唯一${isInteger ? '整数' : '浮点数'}最多只能生成 ${capacity} 个`);
    }

    if (unique) {
      return uniqueIntegers(scaledMin, capacity, count, random)
        .map((value) => isInteger ? String(value) : (value / factor).toFixed(places));
    }
    return Array.from({ length: count }, () => {
      if (isInteger) return String(randomInteger(scaledMin, scaledMax, random));
      const value = Math.round((random() * (max - min) + min) * factor);
      return (Math.max(scaledMin, Math.min(scaledMax, value)) / factor).toFixed(places);
    });
  }

  const api = { PAYROLL_RULES, MAX_RANDOM_COUNT, formatDuration, timeToMinutes, payrollTimeWarning, payrollAmounts, cylinderVolume, readNumber, readInteger, generateRandomNumbers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.QuickCalcCore = api;
})();
