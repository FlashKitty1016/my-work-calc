const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateRandomNumbers } = require('../assets/core.js');

const defaults = { type: 'integer', count: 10, base: 100, positiveOffset: 10, negativeOffset: 10 };

test('唯一结果覆盖整个范围时也能结束，不靠重复碰运气', () => {
  let draws = 0;
  const result = generateRandomNumbers({ ...defaults, count: 10000, base: 5000, positiveOffset: 4999, negativeOffset: 5000, unique: true }, () => {
    draws += 1;
    return 0;
  });
  assert.equal(draws, 10000);
  assert.equal(new Set(result).size, 10000);
  assert.equal(Math.min(...result.map(Number)), 0);
  assert.equal(Math.max(...result.map(Number)), 9999);
});

test('浮点数取整后仍须处于指定范围', () => {
  const input = { ...defaults, type: 'float', places: 2, count: 2, base: 0.01, positiveOffset: 0.009, negativeOffset: 0.009 };
  assert.deepEqual(generateRandomNumbers(input, () => 0), ['0.01', '0.01']);
  assert.deepEqual(generateRandomNumbers(input, () => 0.999999), ['0.01', '0.01']);
});

test('浮点数边界不会因二进制误差丢失唯一可用值', () => {
  const input = { ...defaults, type: 'float', places: 2, count: 1, base: 0.07, positiveOffset: 0, negativeOffset: 0, unique: true };
  assert.deepEqual(generateRandomNumbers(input), ['0.07']);
});

test('空值、非整数数量和过大的生成数量均提示错误', () => {
  for (const count of ['', 0, -1, 1.5, 10001, Infinity]) {
    assert.throws(() => generateRandomNumbers({ ...defaults, count }));
  }
  assert.throws(() => generateRandomNumbers({ ...defaults, base: '' }), /基准值/);
  assert.throws(() => generateRandomNumbers({ ...defaults, positiveOffset: -1 }), /不能小于/);
});

test('不可能的唯一数量、精度和数值范围不会进入生成循环', () => {
  assert.throws(() => generateRandomNumbers({ ...defaults, count: 22, unique: true }), /最多只能生成 21/);
  assert.throws(() => generateRandomNumbers({ ...defaults, type: 'float', places: 13 }), /0 到 12/);
  assert.throws(() => generateRandomNumbers({ ...defaults, base: 1e16 }), /数值范围/);
  assert.throws(() => generateRandomNumbers({ ...defaults, base: 1e308, positiveOffset: 1e308 }), /范围过大/);
});

test('所有唯一浮点结果都不重复且保留指定位数', () => {
  const result = generateRandomNumbers({ ...defaults, type: 'float', places: 2, count: 5, base: 0.02, positiveOffset: 0.02, negativeOffset: 0.02, unique: true }, () => 0);
  assert.deepEqual([...result].sort(), ['0.00', '0.01', '0.02', '0.03', '0.04']);
});
