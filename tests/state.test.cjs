const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStateStore, restoreControls } = require('../assets/state.js');

test('浏览器拒绝存储访问时，读取和保存都不会中断页面', () => {
  const store = createStateStore(() => { throw new Error('Storage denied'); }, 'test');
  assert.deepEqual(store.read(), {});
  assert.doesNotThrow(() => store.write({ activeTab: 'payroll' }));
});

test('损坏或类型错误的旧数据回退到默认值', () => {
  for (const raw of [null, '{broken', 'null', '[]', '42', '"text"']) {
    const store = createStateStore(() => ({ getItem: () => raw }), 'test');
    assert.deepEqual(store.read(), {});
  }
});

test('写入失败不影响现有数据的读取', () => {
  const store = createStateStore(() => ({
    getItem: () => '{"payrollRate":"18.50","activeTab":"payroll"}',
    setItem: () => { throw new Error('Quota exceeded'); },
  }), 'test');
  assert.equal(store.read().payrollRate, '18.50');
  assert.doesNotThrow(() => store.write({}));
});

test('旧版保存格式仍能完整往返', () => {
  const memory = new Map();
  const store = createStateStore(() => ({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }), 'quickCalcJustForWork');
  const state = { activeTab: 'payroll', payrollStart: '20:00', payrollEnd: '04:00', payrollAddDinner: true, payrollAddTransport: false };
  store.write(state);
  assert.deepEqual(store.read(), state);
});

test('恢复控件时不把字符串 false 当成勾选，也不恢复无效选项', () => {
  const checkbox = { id: 'meal', type: 'checkbox', checked: false };
  const select = { id: 'type', tagName: 'SELECT', type: 'select-one', value: 'integer', options: [{ value: 'integer' }, { value: 'float' }] };
  const rate = { id: 'rate', tagName: 'INPUT', type: 'number', value: '15' };
  restoreControls([checkbox, select, rate], { meal: 'false', type: 'missing', rate: null });
  assert.equal(checkbox.checked, false);
  assert.equal(select.value, 'integer');
  assert.equal(rate.value, '15');
  restoreControls([checkbox, select, rate], { meal: true, type: 'float', rate: '18.50' });
  assert.equal(checkbox.checked, true);
  assert.equal(select.value, 'float');
  assert.equal(rate.value, '18.50');
});
