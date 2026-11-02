const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatDuration, timeToMinutes, payrollTimeWarning, payrollAmounts } = require('../assets/core.js');

const cases = [
  ['全天班加午餐扣半小时', '08:00', '18:00', 1500, true, false, [600, 30, 570, 570, 14250]],
  ['全天班未加午餐不扣时', '08:00', '18:00', 1500, false, false, [600, 0, 600, 600, 15000]],
  ['11点40上班默认不扣时', '11:40', '13:00', 1500, false, false, [80, 0, 80, 80, 2000]],
  ['午餐由手动选择决定', '13:00', '17:00', 1500, true, false, [240, 30, 210, 210, 5250]],
  ['关闭取整精确到分钟', '08:00', '09:16', 1500, false, false, [76, 0, 76, 76, 1900]],
  ['取整向上', '08:00', '09:16', 1500, false, true, [76, 0, 76, 80, 2000]],
  ['取整向下', '08:00', '09:14', 1500, false, true, [74, 0, 74, 70, 1750]],
  ['恰好五分钟向上', '08:00', '09:15', 1500, false, true, [75, 0, 75, 80, 2000]],
  ['先扣午餐再取整', '11:20', '13:06', 1500, true, true, [106, 30, 76, 80, 2000]],
  ['跨小时进位', '08:00', '08:56', 1500, false, true, [56, 0, 56, 60, 1500]],
  ['不足五分钟', '08:00', '08:04', 1500, false, true, [4, 0, 4, 0, 0]],
  ['小数时薪最终金额舍入', '08:00', '08:01', 1550, false, false, [1, 0, 1, 1, 26]],
  ['允许零时薪', '08:00', '09:00', 0, false, false, [60, 0, 60, 60, 0]],
  ['同一时刻为零工时', '11:45', '11:45', 1500, false, true, [0, 0, 0, 0, 0]],
  ['跨夜不自动扣午餐', '22:00', '06:00', 1500, false, false, [480, 0, 480, 480, 12000]],
  ['跨夜手动加午餐只扣一次', '23:00', '12:00', 1500, true, false, [780, 30, 750, 750, 18750]],
  ['恰好半小时加午餐后工时为零', '11:00', '11:30', 1500, true, false, [30, 30, 0, 0, 0]],
];

for (const [name, start, end, rate, lunch, round, expected] of cases) {
  test(name, () => {
    const result = payrollAmounts({ start: timeToMinutes(start), end: timeToMinutes(end), rateCents: rate, addLunch: lunch, roundToTen: round });
    assert.deepEqual([result.elapsed, result.breakMinutes, result.worked, result.paid, result.wageCents], expected);
  });
}

for (const [name, lunch, dinner, expectedWage, expectedAllowance] of [
  ['两项均不选', false, false, 16500, 0],
  ['只加午餐', true, false, 15750, 1000],
  ['只加晚餐且不扣时间', false, true, 16500, 1500],
  ['午餐晚餐都加', true, true, 15750, 2500],
]) {
  test(name, () => {
    const result = payrollAmounts({ start: timeToMinutes('08:00'), end: timeToMinutes('19:00'), rateCents: 1500, addLunch: lunch, roundToTen: false, addDinner: dinner });
    assert.equal(result.wageCents, expectedWage, '工资不含餐补');
    assert.equal(result.allowanceCents, expectedAllowance);
  });
}

test('晚餐由手动选择决定，任何时段均不扣工时', () => {
  for (const [start, end, lunch] of [['08:00', '10:00', false], ['20:00', '22:00', true], ['23:00', '06:00', true]]) {
    const withoutDinner = payrollAmounts({ start: timeToMinutes(start), end: timeToMinutes(end), rateCents: 1500, addLunch: lunch, roundToTen: true, addDinner: false });
    const withDinner = payrollAmounts({ start: timeToMinutes(start), end: timeToMinutes(end), rateCents: 1500, addLunch: lunch, roundToTen: true, addDinner: true });
    for (const key of ['elapsed', 'breakMinutes', 'worked', 'paid', 'wageCents']) {
      assert.equal(withDinner[key], withoutDinner[key]);
    }
    assert.equal(withDinner.allowanceCents - withoutDinner.allowanceCents, 1500);
    assert.equal(withoutDinner.dinnerAllowanceCents, 0);
  }
});

test('不足半小时选择午餐时提示检查，避免负工时', () => {
  assert.throws(() => payrollAmounts({ start: 480, end: 509, rateCents: 1500, addLunch: true, roundToTen: false }), /不足 30 分钟/);
});

test('交通费独立加10元，不影响工时工资，支持所有补贴组合', () => {
  for (const lunch of [false, true]) {
    for (const dinner of [false, true]) {
      const withoutTransport = payrollAmounts({ start: 480, end: 1140, rateCents: 1500, addLunch: lunch, roundToTen: false, addDinner: dinner, addTransport: false });
      const withTransport = payrollAmounts({ start: 480, end: 1140, rateCents: 1500, addLunch: lunch, roundToTen: false, addDinner: dinner, addTransport: true });
      assert.equal(withTransport.wageCents, withoutTransport.wageCents);
      assert.equal(withTransport.worked, withoutTransport.worked);
      assert.equal(withTransport.transportAllowanceCents, 1000);
      assert.equal(withTransport.allowanceCents - withoutTransport.allowanceCents, 1000);
    }
  }
  assert.equal(payrollAmounts({ start: 480, end: 1140, rateCents: 1500, addLunch: true, roundToTen: false, addDinner: true, addTransport: true }).allowanceCents, 3500);
});

test('只接受合法的分钟精度时间', () => {
  for (const value of ['', '24:00', '12:60', '9:00', 'NaN', '08:00:30']) {
    assert.throws(() => timeToMinutes(value), /有效/);
  }
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('工时按中文小时和分钟展示', () => {
  assert.equal(formatDuration(0), '0 分钟');
  assert.equal(formatDuration(30), '30 分钟');
  assert.equal(formatDuration(60), '1 小时');
  assert.equal(formatDuration(80), '1 小时 20 分钟');
});

test('上午上班且下班时间更早时提醒核对下午时间', () => {
  assert.match(payrollTimeWarning(480, 60), /13:00/);
  assert.match(payrollTimeWarning(480, 90), /13:30/);
  assert.match(payrollTimeWarning(480, 0), /12:00/);
  assert.equal(payrollAmounts({ start: 480, end: 60, rateCents: 1500, addLunch: false, roundToTen: false }).elapsed, 1020, '只提醒，不自动修改时间');
});

test('正常上午班、下午班和晚班跨夜不提醒', () => {
  for (const [start, end] of [[480, 660], [480, 780], [480, 480], [1200, 60], [1200, 240], [780, 60]]) {
    assert.equal(payrollTimeWarning(start, end), '');
  }
  assert.equal(payrollAmounts({ start: 1200, end: 60, rateCents: 1500, addLunch: false, roundToTen: false }).elapsed, 300);
  assert.equal(payrollAmounts({ start: 1200, end: 240, rateCents: 1500, addLunch: false, roundToTen: false }).elapsed, 480);
});
