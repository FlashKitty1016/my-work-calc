(() => {
  'use strict';

  const core = window.QuickCalcCore;
  const { createStateStore, restoreControls } = window.QuickCalcState;
  const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));
  const tabs = [...document.querySelectorAll('.tab-button')];
  const panels = [...document.querySelectorAll('.panel')];
  const stateControls = [...document.querySelectorAll('input, select')];
  const store = createStateStore(() => window.localStorage, 'quickCalcJustForWork');
  let payrollSummary = null;

  function setText(id, text) {
    elements[id].textContent = text;
  }

  function setWarning(text) {
    setText('payrollWarning', text);
    elements.payrollWarning.hidden = !text;
  }

  function money(cents) {
    return `¥${(cents / 100).toFixed(2)}`;
  }

  // Weight and density share geometry, validation, and result formatting.
  function materialNumber(id, name) {
    const raw = elements[id].value;
    const value = raw === '' ? 0 : core.readNumber(raw, name);
    if (value < 0) throw new Error(`${name}不能小于 0`);
    return value;
  }

  function renderMaterial(kind) {
    const isWeight = kind === 'weight';
    const title = isWeight ? '重量' : '密度';
    const unit = isWeight ? 'g' : 'g/cm³';
    setText(`${kind}Result`, `${title}：0.0000 ${unit}`);
    setText(`${kind}Error`, '');
    try {
      const diameter = materialNumber(`${kind}Diameter`, '外径');
      const innerDiameter = materialNumber(`${kind}InnerDiameter`, '内径');
      const length = materialNumber(`${kind}Length`, '长度');
      const volume = core.cylinderVolume(diameter, innerDiameter, length);
      if (Number.isNaN(volume)) throw new Error('内径必须小于外径');
      if (!Number.isFinite(volume)) throw new Error('尺寸过大，请检查输入');

      let amount = 0;
      if (isWeight) {
        const integer = elements.weightDensityInteger.value || '0';
        const decimal = elements.weightDensityDecimal.value || '0';
        if (!/^\d+$/.test(integer) || !/^\d+$/.test(decimal)) {
          throw new Error('密度的整数和小数部分均须填写非负整数');
        }
        const density = Number(integer) + Number(`0.${decimal}`);
        amount = volume * density;
      } else {
        const weight = materialNumber('densityWeight', '重量');
        amount = volume > 0 ? weight / volume : 0;
      }
      if (!Number.isFinite(amount)) throw new Error('数值过大，请检查输入');
      setText(`${kind}Result`, `${title}：${amount.toFixed(4)} ${unit}`);
    } catch (error) {
      setText(`${kind}Error`, error.message);
    }
  }

  // Payroll reads the form, runs the calculation, then renders one shared summary.
  const payrollFields = {
    period: 'payrollPeriod',
    elapsed: 'payrollElapsed',
    breakMinutes: 'payrollBreak',
    paid: 'payrollPaid',
    wage: 'payrollTotal',
    allowance: 'payrollAllowance',
    formula: 'payrollFormula',
    allowanceDetails: 'payrollMealDetails',
  };

  function clearPayroll() {
    payrollSummary = null;
    for (const id of ['payrollPeriod', 'payrollElapsed', 'payrollBreak', 'payrollPaid', 'payrollTotal']) setText(id, '—');
    setText('payrollFormula', '请先输入上下班时间');
    setText('payrollAllowance', '');
    setText('payrollMealDetails', '');
    setText('payrollError', '');
    setWarning('');
    elements.payrollAllowance.hidden = true;
    elements.payrollCopy.disabled = true;
  }

  function renderPayroll() {
    clearPayroll();
    const startValue = elements.payrollStart.value;
    const endValue = elements.payrollEnd.value;
    if (!startValue || !endValue) return;

    try {
      const start = core.timeToMinutes(startValue);
      const end = core.timeToMinutes(endValue);
      setWarning(core.payrollTimeWarning(start, end));
      const rateInput = elements.payrollRate;
      const rate = Number(rateInput.value);
      if (rateInput.value.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 1000000 || !rateInput.validity.valid) {
        throw new Error('时薪请输入 0–1000000 之间的金额，最多保留两位小数');
      }
      const rateCents = Math.round(rate * 100);
      const roundToTen = elements.payrollRound.checked;
      const result = core.payrollAmounts({
        start, end, rateCents, roundToTen,
        addLunch: elements.payrollAddLunch.checked,
        addDinner: elements.payrollAddDinner.checked,
        addTransport: elements.payrollAddTransport.checked,
      });
      const allowances = [];
      if (result.lunchAllowanceCents) allowances.push(`午餐 ${result.lunchAllowanceCents / 100} 元`);
      if (result.dinnerAllowanceCents) allowances.push(`晚餐 ${result.dinnerAllowanceCents / 100} 元`);
      if (result.transportAllowanceCents) allowances.push(`交通费 ${result.transportAllowanceCents / 100} 元`);
      payrollSummary = {
        period: `${startValue} – ${end < start ? '次日 ' : ''}${endValue}`,
        elapsed: core.formatDuration(result.elapsed),
        breakMinutes: core.formatDuration(result.breakMinutes),
        paid: `${core.formatDuration(result.paid)}（${roundToTen ? '按 10 分钟四舍五入' : '精确到分钟'}）`,
        wage: money(result.wageCents),
        allowance: result.allowanceCents ? `+ ${money(result.allowanceCents)} 补贴` : '',
        formula: `${core.formatDuration(result.paid)} × ${(rateCents / 100).toFixed(2)} 元/小时`,
        allowanceDetails: allowances.join(' + '),
      };
      for (const [key, id] of Object.entries(payrollFields)) setText(id, payrollSummary[key]);
      elements.payrollAllowance.hidden = result.allowanceCents === 0;
      elements.payrollCopy.disabled = false;
    } catch (error) {
      setText('payrollFormula', '请检查输入');
      setText('payrollError', error.message);
    }
  }

  function copyPayroll() {
    if (!payrollSummary) return;
    const summary = payrollSummary;
    copyText([
      '工时工资',
      `上班时段：${summary.period}`,
      `上班时长：${summary.elapsed}`,
      `午餐扣时：${summary.breakMinutes}`,
      `计薪工时：${summary.paid}`,
      summary.formula,
      `工资：${summary.wage}${summary.allowance ? ` ${summary.allowance}` : ''}`,
      summary.allowanceDetails,
    ].filter(Boolean).join('\n'));
  }

  // Random generation is explicit; changing its settings never regenerates output.
  function syncRandomControls() {
    elements.randomDecimalPlaces.disabled = elements.randomNumberType.value === 'integer';
    elements.randomNegativeOffset.disabled = elements.randomSameOffset.checked;
    if (elements.randomSameOffset.checked) elements.randomNegativeOffset.value = elements.randomPositiveOffset.value;
  }

  function generateRandomNumbers() {
    setText('randomError', '');
    elements.randomOutput.value = '';
    try {
      const values = core.generateRandomNumbers({
        type: elements.randomNumberType.value,
        unique: elements.randomUnique.checked,
        places: elements.randomDecimalPlaces.value,
        count: elements.randomCount.value,
        base: elements.randomBaseValue.value,
        positiveOffset: elements.randomPositiveOffset.value,
        negativeOffset: elements.randomSameOffset.checked ? elements.randomPositiveOffset.value : elements.randomNegativeOffset.value,
      });
      elements.randomOutput.value = values.join(elements.randomOutputDirection.value === 'row' ? '\t' : '\n');
    } catch (error) {
      setText('randomError', error.message);
    }
  }

  // Navigation and persistence do not run calculations in unrelated panels.
  function saveState() {
    const data = Object.fromEntries(stateControls.map((control) => [control.id, control.type === 'checkbox' ? control.checked : control.value]));
    const activeTab = tabs.find((button) => button.classList.contains('active'))?.dataset.tab || 'weight';
    store.write({ ...data, activeTab });
  }

  function switchTab(tabName, persist = true) {
    const validName = panels.some((panel) => panel.id === tabName) ? tabName : 'weight';
    for (const button of tabs) {
      const active = button.dataset.tab === validName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    for (const panel of panels) panel.classList.toggle('active', panel.id === validName);
    if (persist) saveState();
  }

  const renderers = {
    weight: () => renderMaterial('weight'),
    density: () => renderMaterial('density'),
    payroll: renderPayroll,
    random: syncRandomControls,
  };

  function resetPanel(panelName) {
    for (const input of elements[panelName].querySelectorAll('input')) {
      if (input.type === 'checkbox') input.checked = input.defaultChecked;
      else input.value = input.defaultValue;
    }
    renderers[panelName]();
    saveState();
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        textarea.remove();
      }
    }
  }

  // Each panel handles its own inputs; restore saved values before the first render.
  for (const button of tabs) button.addEventListener('click', () => switchTab(button.dataset.tab));
  for (const panel of panels) {
    panel.addEventListener('input', (event) => {
      if (!event.target.matches('input, select')) return;
      renderers[panel.id]();
      saveState();
    });
  }
  for (const button of document.querySelectorAll('[data-reset]')) button.addEventListener('click', () => resetPanel(button.dataset.reset));
  for (const button of document.querySelectorAll('[data-copy-result]')) {
    button.addEventListener('click', () => copyText(elements[button.dataset.copyResult].textContent.replace(/^[^：]+：/, '').trim()));
  }
  elements.payrollCopy.addEventListener('click', copyPayroll);
  elements.randomGenerate.addEventListener('click', generateRandomNumbers);
  elements.randomCopy.addEventListener('click', () => copyText(elements.randomOutput.value));
  elements.randomClear.addEventListener('click', () => {
    elements.randomOutput.value = '';
    setText('randomError', '');
  });

  const saved = store.read();
  restoreControls(stateControls, saved);
  switchTab(saved.activeTab, false);
  for (const render of Object.values(renderers)) render();
})();
