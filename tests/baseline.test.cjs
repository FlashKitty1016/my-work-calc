const { test } = require('node:test');
const assert = require('node:assert/strict');
const baseline = require('./fixtures/calculation-baseline.json');
const { payrollAmounts, payrollTimeWarning, cylinderVolume, generateRandomNumbers } = require('../assets/core.js');

function seeded(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

test(`${baseline.payroll.length} 组工资输入与整理前逐项一致`, () => {
  for (const { input, expected, warning } of baseline.payroll) {
    assert.deepEqual(payrollAmounts(input), expected, JSON.stringify(input));
    assert.equal(payrollTimeWarning(input.start, input.end), warning);
  }
});

test(`${baseline.geometry.length} 组体积、重量和密度与 GitHub 原版一致`, () => {
  for (const record of baseline.geometry) {
    const volume = cylinderVolume(...record.input);
    assert.equal(volume, record.volume);
    assert.equal(volume * record.density, record.expectedWeight);
    assert.equal(record.weight / volume, record.expectedDensity);
  }
});

test(`${baseline.random.length} 组随机设置的范围、数量、唯一性和格式保持一致`, () => {
  for (const { input, seed, expected } of baseline.random) {
    const result = generateRandomNumbers(input, seeded(seed));
    assert.equal(result.length, expected.length);
    if (!input.unique) assert.deepEqual(result, expected, '相同随机种子下，普通生成结果应保持一致');
    else assert.equal(new Set(result).size, expected.length);
    for (const value of result) {
      assert.ok(Number(value) >= input.base - input.negativeOffset);
      assert.ok(Number(value) <= input.base + input.positiveOffset);
      if (input.type === 'integer') assert.ok(Number.isInteger(Number(value)));
      else assert.equal(value.split('.')[1].length, input.places);
    }
  }
});
