const STORAGE_KEY = "sistema-agua-bidones-v1";

const defaults = {
  config: {
    initialBottles: 349,
    initialCaps: 5500,
    initialLabels: 5700,
    initialSeals: 11000,
    priceDriver: 6,
    priceDirect7: 7,
    priceDirect8: 8,
    costCap: 0.37,
    costLabel: 0.40,
    costSeal: 0.15,
    gasolineLiterCost: 6.96,
    dieselLiterCost: 9.80,
    commission: 0.30,
    productionEmployee1Commission: 0.15,
    productionEmployee2Commission: 0.15,
    monthlyDepreciation: 1000,
    lostCharge: 30,
    lowStock: 500,
    drivers: ["Etenier", "Sebastian", "Freddy", "Chofer random"]
  },
  daily: [],
  purchases: [],
  expenses: [],
  debtPayments: [],
  liabilityDebts: [],
  liabilityPayments: []
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaults);
  try {
    const parsed = JSON.parse(saved);
    return normalizeState({
      ...structuredClone(defaults),
      ...parsed,
      config: { ...defaults.config, ...(parsed.config || {}) }
    });
  } catch {
    return structuredClone(defaults);
  }
}

function renameDriverKey(map, oldName, newName) {
  if (!map || !(oldName in map)) return map;
  map[newName] = Number(map[newName] || 0) + Number(map[oldName] || 0);
  delete map[oldName];
  return map;
}

function normalizeState(data) {
  data.config.drivers = (data.config.drivers || defaults.config.drivers).map((driver) =>
    driver === "Chofer 4" ? "Chofer random" : driver
  );
  if (data.config.productionEmployee1Commission == null) data.config.productionEmployee1Commission = 0.15;
  if (data.config.productionEmployee2Commission == null) data.config.productionEmployee2Commission = 0.15;
  if (data.config.gasolineLiterCost == null) data.config.gasolineLiterCost = 6.96;
  if (data.config.dieselLiterCost == null) data.config.dieselLiterCost = 9.80;
  if (data.config.monthlyDepreciation == null) data.config.monthlyDepreciation = 1000;
  data.config.commission = Number(data.config.productionEmployee1Commission || 0) + Number(data.config.productionEmployee2Commission || 0);
  data.daily = data.daily || [];
  data.daily.forEach((day) => {
    renameDriverKey(day.drivers, "Chofer 4", "Chofer random");
    renameDriverKey(day.gasByDriver, "Chofer 4", "Chofer random");
    renameDriverKey(day.dieselByDriver, "Chofer 4", "Chofer random");
    if (day.brokenDriver === "Chofer 4") day.brokenDriver = "Chofer random";
    if (day.lostDriver === "Chofer 4") day.lostDriver = "Chofer random";
  });
  data.debtPayments = data.debtPayments || [];
  data.debtPayments.forEach((payment) => {
    if (payment.driver === "Chofer 4") payment.driver = "Chofer random";
  });
  data.liabilityDebts = data.liabilityDebts || [];
  data.liabilityPayments = data.liabilityPayments || [];
  return data;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} Bs`;
}

function number(value) {
  return Number(value || 0).toLocaleString("es-BO");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayName(dateIso) {
  if (!dateIso) return "";
  const date = new Date(`${dateIso}T12:00:00`);
  return date.toLocaleDateString("es-BO", { weekday: "long" });
}

function isSunday(dateIso) {
  return new Date(`${dateIso}T12:00:00`).getDay() === 0;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateInRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function dashboardRange() {
  return {
    from: document.getElementById("dashFrom")?.value || "",
    to: document.getElementById("dashTo")?.value || ""
  };
}

function dashboardDays() {
  const { from, to } = dashboardRange();
  return state.daily.filter((day) => dateInRange(day.date, from, to));
}

function dashboardExpenses() {
  const { from, to } = dashboardRange();
  return state.expenses.filter((item) => dateInRange(item.date, from, to));
}

function totalsForDay(day) {
  const driverQty = Object.values(day.drivers || {}).reduce((sum, val) => sum + Number(val || 0), 0);
  const direct7 = Number(day.direct7 || 0);
  const direct8 = Number(day.direct8 || 0);
  const physicalBottlesSold = Number(day.physicalBottlesSold || 0);
  const physicalBottleUnitPrice = Number(day.physicalBottleUnitPrice || 0);
  const sold = driverQty + direct7 + direct8;
  const driverIncome = driverQty * state.config.priceDriver;
  const directIncome = direct7 * state.config.priceDirect7 + direct8 * state.config.priceDirect8;
  const physicalBottleIncome = physicalBottlesSold * physicalBottleUnitPrice;
  const income = driverIncome + directIncome + physicalBottleIncome;
  const supplyCost =
    Number(day.capsUsed || 0) * state.config.costCap +
    Number(day.labelsUsed || 0) * state.config.costLabel +
    Number(day.sealsUsed || 0) * state.config.costSeal;
  const productionEmployee1CommissionCost = sold * Number(state.config.productionEmployee1Commission || 0);
  const productionEmployee2CommissionCost = sold * Number(state.config.productionEmployee2Commission || 0);
  const productionCommissionCost = productionEmployee1CommissionCost + productionEmployee2CommissionCost;
  const fuelCost = gasCostForDay(day) + dieselCostForDay(day);
  const variableCost = supplyCost + productionCommissionCost + fuelCost;
  const lossCharge = (Number(day.broken || 0) + Number(day.lost || 0)) * state.config.lostCharge;
  const leftover = Number(day.produced || 0) - sold;
  return { driverQty, direct7, direct8, physicalBottlesSold, physicalBottleUnitPrice, sold, income, physicalBottleIncome, supplyCost, productionEmployee1CommissionCost, productionEmployee2CommissionCost, productionCommissionCost, fuelCost, variableCost, lossCharge, leftover };
}

function gasForDay(day) {
  const byDriver = Object.values(day.gasByDriver || {}).reduce((sum, val) => sum + Number(val || 0), 0);
  return byDriver || Number(day.gasLiters || 0);
}

function dieselForDay(day) {
  const byDriver = Object.values(day.dieselByDriver || {}).reduce((sum, val) => sum + Number(val || 0), 0);
  return byDriver || Number(day.dieselLiters || 0);
}

function gasCostForDay(day) {
  return Number(day.gasCost || 0) || gasForDay(day) * Number(state.config.gasolineLiterCost || 0);
}

function dieselCostForDay(day) {
  return Number(day.dieselCost || 0) || dieselForDay(day) * Number(state.config.dieselLiterCost || 0);
}

function monthKey(date) {
  return date ? date.slice(0, 7) : "";
}

function automaticDepreciationFor(days, expenses) {
  const months = new Set();
  days.forEach((day) => months.add(monthKey(day.date)));
  expenses.forEach((item) => months.add(monthKey(item.date)));
  months.delete("");
  return months.size * Number(state.config.monthlyDepreciation || 0);
}

function aggregateActivity(days, expenses) {
  const dailyTotals = days.map((day) => ({ day, ...totalsForDay(day) }));
  const used = days.reduce((acc, day) => {
    acc.capsDelivered += Number(day.capsDelivered || 0);
    acc.labelsDelivered += Number(day.labelsDelivered || 0);
    acc.sealsDelivered += Number(day.sealsDelivered || 0);
    acc.caps += Number(day.capsUsed || 0);
    acc.labels += Number(day.labelsUsed || 0);
    acc.seals += Number(day.sealsUsed || 0);
    acc.broken += Number(day.broken || 0);
    acc.lost += Number(day.lost || 0);
    acc.physicalBottlesSold += Number(day.physicalBottlesSold || 0);
    acc.produced += Number(day.produced || 0);
    acc.gasLiters += gasForDay(day);
    acc.dieselLiters += dieselForDay(day);
    return acc;
  }, { capsDelivered: 0, labelsDelivered: 0, sealsDelivered: 0, caps: 0, labels: 0, seals: 0, broken: 0, lost: 0, physicalBottlesSold: 0, produced: 0, gasLiters: 0, dieselLiters: 0 });

  const sold = dailyTotals.reduce((sum, row) => sum + row.sold, 0);
  const income = dailyTotals.reduce((sum, row) => sum + row.income, 0);
  const supplyCost = dailyTotals.reduce((sum, row) => sum + row.supplyCost, 0);
  const productionEmployee1CommissionCost = dailyTotals.reduce((sum, row) => sum + row.productionEmployee1CommissionCost, 0);
  const productionEmployee2CommissionCost = dailyTotals.reduce((sum, row) => sum + row.productionEmployee2CommissionCost, 0);
  const productionCommissionCost = dailyTotals.reduce((sum, row) => sum + row.productionCommissionCost, 0);
  const fuelCost = dailyTotals.reduce((sum, row) => sum + row.fuelCost, 0);
  const variableCost = dailyTotals.reduce((sum, row) => sum + row.variableCost, 0);
  const lossCharge = dailyTotals.reduce((sum, row) => sum + row.lossCharge, 0);
  const automaticDepreciation = automaticDepreciationFor(days, expenses);
  const fixedExpenses = expenses.filter((item) => item.type === "Mensual").reduce((sum, item) => sum + Number(item.amount || 0), 0) + automaticDepreciation;
  const dailyExpenses = expenses.filter((item) => item.type !== "Mensual").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = fixedExpenses + dailyExpenses;
  const totalVariableCost = variableCost + dailyExpenses;
  const totalCost = totalVariableCost + fixedExpenses;
  return {
    dailyTotals,
    used,
    sold,
    income,
    supplyCost,
    productionEmployee1CommissionCost,
    productionEmployee2CommissionCost,
    productionCommissionCost,
    fuelCost,
    variableCost,
    lossCharge,
    expenses: expenseTotal,
    automaticDepreciation,
    fixedExpenses,
    dailyExpenses,
    totalVariableCost,
    totalCost,
    net: income + lossCharge - variableCost - expenseTotal
  };
}

function costPerBottleMetrics(data) {
  const soldBase = data.sold || 0;
  const producedBase = data.used.produced || 0;
  return {
    variablePerSold: soldBase ? data.totalVariableCost / soldBase : 0,
    fixedPerSold: soldBase ? data.fixedExpenses / soldBase : 0,
    totalPerSold: soldBase ? data.totalCost / soldBase : 0,
    totalPerProduced: producedBase ? data.totalCost / producedBase : 0
  };
}

function calculateDriverDebts() {
  const debts = {};
  state.config.drivers.forEach((driver) => {
    debts[driver] = { broken: 0, lost: 0, charged: 0, paid: 0, balance: 0 };
  });

  state.daily.forEach((day) => {
    const broken = Number(day.broken || 0);
    const lost = Number(day.lost || 0);
    if (broken > 0 && day.brokenDriver) {
      if (!debts[day.brokenDriver]) debts[day.brokenDriver] = { broken: 0, lost: 0, charged: 0, paid: 0, balance: 0 };
      debts[day.brokenDriver].broken += broken;
      debts[day.brokenDriver].charged += broken * state.config.lostCharge;
    }
    if (lost > 0 && day.lostDriver) {
      if (!debts[day.lostDriver]) debts[day.lostDriver] = { broken: 0, lost: 0, charged: 0, paid: 0, balance: 0 };
      debts[day.lostDriver].lost += lost;
      debts[day.lostDriver].charged += lost * state.config.lostCharge;
    }
  });

  (state.debtPayments || []).forEach((payment) => {
    if (!debts[payment.driver]) debts[payment.driver] = { broken: 0, lost: 0, charged: 0, paid: 0, balance: 0 };
    debts[payment.driver].paid += Number(payment.amount || 0);
  });

  Object.values(debts).forEach((row) => {
    row.balance = row.charged - row.paid;
  });

  return debts;
}

function liabilityDebtSummary() {
  return (state.liabilityDebts || []).map((debt) => {
    const paid = (state.liabilityPayments || [])
      .filter((payment) => payment.debtId === debt.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const amount = Number(debt.amount || 0);
    return { ...debt, amount, paid, balance: amount - paid };
  });
}

function calculateAll() {
  const activity = aggregateActivity(state.daily, state.expenses);
  const dailyTotals = activity.dailyTotals;
  const purchases = state.purchases.reduce((acc, item) => {
    acc[item.item] = (acc[item.item] || 0) + Number(item.qty || 0);
    acc.cost += Number(item.cost || 0);
    return acc;
  }, { caps: 0, labels: 0, seals: 0, bottles: 0, gasoline: 0, diesel: 0, cost: 0 });

  const used = activity.used;

  const stock = {
    bottles: state.config.initialBottles + purchases.bottles - used.broken - used.lost - used.physicalBottlesSold,
    caps: state.config.initialCaps + purchases.caps - used.caps,
    labels: state.config.initialLabels + purchases.labels - used.labels,
    seals: state.config.initialSeals + purchases.seals - used.seals,
    gasoline: purchases.gasoline - used.gasLiters,
    diesel: purchases.diesel - used.dieselLiters,
    ready: dailyTotals.reduce((sum, row) => sum + row.leftover, 0)
  };

  return {
    dailyTotals,
    purchases,
    used,
    sold: activity.sold,
    income: activity.income,
    variableCost: activity.variableCost,
    lossCharge: activity.lossCharge,
    expenses: activity.expenses,
    net: activity.net,
    stock,
    driverDebts: calculateDriverDebts()
  };
}

function setDefaultDates() {
  ["date", "purchaseDate", "dailyExpenseDate", "monthlyExpenseDate", "debtPaymentDate", "dailySpendDate", "debtDate", "debtInstallmentDate"].forEach((id) => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = todayIso();
  });
}

function renderKpis() {
  const all = calculateAll();
  const data = aggregateActivity(dashboardDays(), dashboardExpenses());
  const driverDebtBalance = Object.values(all.driverDebts).reduce((sum, row) => sum + row.balance, 0);
  const { from, to } = dashboardRange();
  const period = from || to ? `Filtro: ${from || "inicio"} a ${to || "hoy"}` : "Todos los registros";
  const kpis = [
    ["Ingresos", money(data.income), period],
    ["Ganancia neta", money(data.net), "Del período filtrado"],
    ["Bidones vendidos", number(data.sold), "Del período filtrado"],
    ["Bidones producidos", number(data.used.produced), "Del período filtrado"],
    ["Bidones físicos vendidos", number(data.used.physicalBottlesSold), `${money(data.dailyTotals.reduce((sum, row) => sum + row.physicalBottleIncome, 0))} en envases`],
    ["Gasolina entregada", `${number(data.used.gasLiters)} L`, "Del período filtrado"],
    ["Diésel entregado", `${number(data.used.dieselLiters)} L`, "Del período filtrado"],
    ["Tapas disponibles", number(all.stock.caps), stockStatus(all.stock.caps)],
    ["Etiquetas disponibles", number(all.stock.labels), stockStatus(all.stock.labels)],
    ["Sellos disponibles", number(all.stock.seals), stockStatus(all.stock.seals)],
    ["Rotos/perdidos", number(data.used.broken + data.used.lost), `${money(data.lossCharge)} generado`],
    ["Deuda choferes", money(driverDebtBalance), "Saldo pendiente"]
  ];
  document.getElementById("kpis").innerHTML = kpis.map(kpiHtml).join("");
}

function kpiHtml([label, value, note]) {
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function stockStatus(value) {
  return value <= state.config.lowStock ? "Stock bajo" : "Stock correcto";
}

function renderStock() {
  const { stock } = calculateAll();
  const rows = [
    ["Bidones físicos activos", stock.bottles],
    ["Bidones llenos sobrantes", stock.ready],
    ["Tapas", stock.caps],
    ["Etiquetas", stock.labels],
    ["Sellos", stock.seals],
    ["Gasolina saldo", `${number(stock.gasoline)} L`],
    ["Diésel saldo", `${number(stock.diesel)} L`]
  ];
  const html = rows.map(([label, value]) => {
    const numericValue = typeof value === "number" ? value : Number.parseFloat(value) || 0;
    const isFuel = label.includes("Gasolina") || label.includes("Diésel");
    const cls = numericValue <= state.config.lowStock && !label.includes("Bidones") && !isFuel ? "low" : "ok";
    return `<div class="stock-row"><span>${label}</span><strong class="${cls}">${typeof value === "number" ? number(value) : value}</strong></div>`;
  }).join("");
  document.getElementById("stockList").innerHTML = html;
  document.getElementById("inventoryDetail").innerHTML = html;
}

function renderDriverInputs() {
  const wrap = document.getElementById("driverInputs");
  wrap.innerHTML = state.config.drivers.map((driver) => `
    <label>${driver} vendidos
      <input class="driverSale" data-driver="${driver}" type="number" min="0" value="0">
    </label>
    <label>${driver} gasolina (litros)
      <input class="driverGas" data-driver="${driver}" type="number" min="0" step="0.01" value="0">
    </label>
    <label>${driver} diésel (litros)
      <input class="driverDiesel" data-driver="${driver}" type="number" min="0" step="0.01" value="0">
    </label>
  `).join("");
}

function driverOptions(selected = "") {
  return `<option value="">Elegir chofer</option>` + state.config.drivers.map((driver) => {
    const isSelected = driver === selected ? " selected" : "";
    return `<option${isSelected}>${driver}</option>`;
  }).join("");
}

function renderDriverSelects() {
  ["brokenDriver", "lostDriver", "debtPaymentDriver"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = select.value;
    select.innerHTML = driverOptions(selected);
  });
}

function renderDriverSummary() {
  const days = dashboardDays();
  const rows = state.config.drivers.map((driver) => {
    const qty = days.reduce((sum, day) => sum + Number((day.drivers || {})[driver] || 0), 0);
    const gas = days.reduce((sum, day) => sum + Number((day.gasByDriver || {})[driver] || 0), 0);
    const diesel = days.reduce((sum, day) => sum + Number((day.dieselByDriver || {})[driver] || 0), 0);
    return `<div class="mini-row"><span>${driver}</span><strong>${number(qty)} bidones | G:${number(gas)} L | D:${number(diesel)} L</strong></div>`;
  }).join("");
  document.getElementById("driverSummary").innerHTML = rows || "<p>No hay choferes cargados.</p>";
}

function renderDriverDebts() {
  const debts = calculateDriverDebts();
  const rows = Object.entries(debts).map(([driver, row]) => {
    const cls = row.balance > 0 ? "low" : "ok";
    return `<div class="stock-row">
      <span>${driver}<br><small>${number(row.broken)} rotos, ${number(row.lost)} perdidos, pagó ${money(row.paid)}</small></span>
      <strong class="${cls}">${money(row.balance)}</strong>
    </div>`;
  }).join("");
  const empty = "<p>No hay deudas cargadas.</p>";
  document.getElementById("driverDebtSummary").innerHTML = rows || empty;
  document.getElementById("driverDebtDetail").innerHTML = rows || empty;
}

function renderProductionSupplySummary() {
  const data = aggregateActivity(dashboardDays(), dashboardExpenses());
  const rows = [
    ["Tapas entregadas", data.used.capsDelivered],
    ["Etiquetas entregadas", data.used.labelsDelivered],
    ["Sellos entregados", data.used.sealsDelivered],
    ["Tapas usadas", data.used.caps],
    ["Etiquetas usadas", data.used.labels],
    ["Sellos usados", data.used.seals]
  ].map(([label, value]) => `
    <div class="stock-row"><span>${label}</span><strong>${number(value)}</strong></div>
  `).join("");
  document.getElementById("productionSupplySummary").innerHTML = rows;
}

function renderCostPerBottleSummary() {
  const data = aggregateActivity(dashboardDays(), dashboardExpenses());
  const metrics = costPerBottleMetrics(data);
  const rows = [
    ["Insumos usados", money(data.supplyCost), "Tapas, etiquetas y sellos"],
    ["Comisión empleado 1", money(data.productionEmployee1CommissionCost), `${money(state.config.productionEmployee1Commission)} por bidón vendido`],
    ["Comisión empleado 2", money(data.productionEmployee2CommissionCost), `${money(state.config.productionEmployee2Commission)} por bidón vendido`],
    ["Comisión producción total", money(data.productionCommissionCost), `${money(state.config.commission)} por bidón vendido entre ambos`],
    ["Combustible", money(data.fuelCost), "Gasolina y diésel del período"],
    ["Gastos diarios", money(data.dailyExpenses), "Variables cargados en gastos diarios"],
    ["Costos variables", money(data.totalVariableCost), "Insumos + comisión + combustible + gastos diarios"],
    ["Depreciación automática", money(data.automaticDepreciation), `${money(state.config.monthlyDepreciation)} por mes con movimiento`],
    ["Costos fijos", money(data.fixedExpenses), "Gastos mensuales del período"],
    ["Costo total", money(data.totalCost), "Variable + fijo"],
    ["Costo por bidón vendido", money(metrics.totalPerSold), `${number(data.sold)} bidones vendidos`],
    ["Costo por bidón producido", money(metrics.totalPerProduced), `${number(data.used.produced)} bidones producidos`],
    ["Solo variable por vendido", money(metrics.variablePerSold), "Sin gastos fijos"]
  ].map(([label, value, note]) => `
    <div class="stock-row"><span>${label}<br><small>${note}</small></span><strong>${value}</strong></div>
  `).join("");
  document.getElementById("costPerBottleSummary").innerHTML = rows;
}

function deliveredSummary(day) {
  return `T:${number(day.capsDelivered || 0)} E:${number(day.labelsDelivered || 0)} S:${number(day.sealsDelivered || 0)}`;
}

function renderDailyRows() {
  const rows = [...state.daily].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  document.getElementById("dailyRows").innerHTML = rows.map((day) => {
    const t = totalsForDay(day);
    const sunday = isSunday(day.date) ? " <span class='warn'>(No se trabaja)</span>" : "";
    return `<tr>
      <td>${day.date}</td>
      <td>${dayName(day.date)}${sunday}</td>
      <td>${number(day.produced)}</td>
      <td>${number(t.sold)}</td>
      <td>${number(t.physicalBottlesSold)}</td>
      <td>${deliveredSummary(day)}</td>
      <td>${money(t.income)}</td>
      <td>${number(t.leftover)}</td>
      <td><button class="ghost" data-edit-day="${day.id}">Editar</button><button class="danger" data-delete-day="${day.id}">Borrar</button></td>
    </tr>`;
  }).join("");
}

function renderDebtPayments() {
  document.getElementById("debtPaymentRows").innerHTML = [...(state.debtPayments || [])].sort((a, b) => b.date.localeCompare(a.date)).map((item) => `
    <tr><td>${item.date}</td><td>${item.driver}</td><td>${money(item.amount)}</td><td>${item.note || ""}</td><td><button class="danger" data-delete-debt-payment="${item.id}">Borrar</button></td></tr>
  `).join("");
}

function renderLiabilities() {
  const summaries = liabilityDebtSummary().sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("liabilityDebtRows").innerHTML = summaries.map((debt) => `
    <tr>
      <td>${debt.date}</td><td>${debt.name}</td><td>${money(debt.amount)}</td><td>${money(debt.paid)}</td>
      <td>${money(debt.balance)}</td><td><button class="danger" data-delete-liability-debt="${debt.id}">Borrar</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6">No hay deudas cargadas.</td></tr>`;

  document.getElementById("liabilityPaymentRows").innerHTML = [...(state.liabilityPayments || [])].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => {
    const debt = (state.liabilityDebts || []).find((item) => item.id === payment.debtId);
    return `<tr><td>${payment.date}</td><td>${debt?.name || "Deuda borrada"}</td><td>${money(payment.amount)}</td><td>${payment.note || ""}</td><td><button class="danger" data-delete-liability-payment="${payment.id}">Borrar</button></td></tr>`;
  }).join("") || `<tr><td colspan="5">No hay pagos cargados.</td></tr>`;

  const active = summaries.filter((debt) => debt.balance > 0);
  document.getElementById("debtInstallmentDebt").innerHTML = active.map((debt) => `
    <option value="${debt.id}">${debt.name} - saldo ${money(debt.balance)}</option>
  `).join("") || `<option value="">No hay deudas pendientes</option>`;
}

function purchaseName(item) {
  const names = { caps: "Tapas", labels: "Etiquetas", seals: "Sellos", bottles: "Bidones nuevos", gasoline: "Gasolina", diesel: "Diésel" };
  return names[item] || item;
}

function renderPurchases() {
  const names = { caps: "Tapas", labels: "Etiquetas", seals: "Sellos", bottles: "Bidones nuevos", gasoline: "Gasolina", diesel: "Diésel" };
  document.getElementById("purchaseRows").innerHTML = [...state.purchases].sort((a, b) => b.date.localeCompare(a.date)).map((item) => `
    <tr><td>${item.date}</td><td>${purchaseName(item.item)}</td><td>${number(item.qty)}</td><td>${money(item.cost)}</td><td><button class="danger" data-delete-purchase="${item.id}">Borrar</button></td></tr>
  `).join("");
}

function renderExpenses() {
  const sorted = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const rowHtml = (item) => `
    <tr><td>${item.date}</td><td>${item.category}</td><td>${money(item.amount)}</td><td>${item.note || ""}</td><td><button class="danger" data-delete-expense="${item.id}">Borrar</button></td></tr>
  `;
  document.getElementById("dailyExpenseRows").innerHTML = sorted.filter((item) => item.type === "Diario" || item.type === "Extraordinario").map(rowHtml).join("");
  const months = new Set([monthKey(todayIso())]);
  state.daily.forEach((day) => months.add(monthKey(day.date)));
  state.expenses.forEach((item) => months.add(monthKey(item.date)));
  state.purchases.forEach((item) => months.add(monthKey(item.date)));
  months.delete("");
  const depreciationRows = [...months].sort().reverse().map((month) => `
    <tr><td>${month}</td><td>Depreciación automática</td><td>${money(state.config.monthlyDepreciation)}</td><td>Gasto fijo automático mensual</td><td>Automático</td></tr>
  `);
  document.getElementById("monthlyExpenseRows").innerHTML = [
    ...depreciationRows,
    ...sorted.filter((item) => item.type === "Mensual").map(rowHtml)
  ].join("");
}

function renderDailySpendSummary() {
  const date = document.getElementById("dailySpendDate").value || todayIso();
  const dailyExpenses = state.expenses.filter((item) => item.date === date && item.type !== "Mensual");
  const purchases = state.purchases.filter((item) => item.date === date);
  const liabilityPayments = (state.liabilityPayments || []).filter((item) => item.date === date);
  const dayRecords = state.daily.filter((item) => item.date === date);
  const expenseTotal = dailyExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const purchaseTotal = purchases.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const liabilityPaymentTotal = liabilityPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const variableRows = [];
  const addVariableRow = (category, qty, unitCost, note) => {
    const amount = Number(qty || 0) * Number(unitCost || 0);
    if (amount > 0) variableRows.push({ category, note, amount });
  };

  const totals = dayRecords.reduce((acc, day) => {
    const t = totalsForDay(day);
    acc.caps += Number(day.capsUsed || 0);
    acc.labels += Number(day.labelsUsed || 0);
    acc.seals += Number(day.sealsUsed || 0);
    acc.sold += t.sold;
    acc.employee1 += t.productionEmployee1CommissionCost;
    acc.employee2 += t.productionEmployee2CommissionCost;
    acc.gas += gasCostForDay(day);
    acc.diesel += dieselCostForDay(day);
    return acc;
  }, { caps: 0, labels: 0, seals: 0, sold: 0, employee1: 0, employee2: 0, gas: 0, diesel: 0 });

  addVariableRow("Tapas usadas", totals.caps, state.config.costCap, `${number(totals.caps)} unidades`);
  addVariableRow("Etiquetas usadas", totals.labels, state.config.costLabel, `${number(totals.labels)} unidades`);
  addVariableRow("Sellos usados", totals.seals, state.config.costSeal, `${number(totals.seals)} unidades`);
  if (totals.employee1 > 0) variableRows.push({ category: "Comisión empleado 1", note: `${number(totals.sold)} bidones vendidos`, amount: totals.employee1 });
  if (totals.employee2 > 0) variableRows.push({ category: "Comisión empleado 2", note: `${number(totals.sold)} bidones vendidos`, amount: totals.employee2 });
  if (totals.gas > 0) variableRows.push({ category: "Gasolina usada", note: `${money(state.config.gasolineLiterCost)} por litro si no hay costo manual`, amount: totals.gas });
  if (totals.diesel > 0) variableRows.push({ category: "Diésel usado", note: `${money(state.config.dieselLiterCost)} por litro si no hay costo manual`, amount: totals.diesel });

  const variableTotal = variableRows.reduce((sum, item) => sum + item.amount, 0);
  const total = expenseTotal + purchaseTotal + variableTotal + liabilityPaymentTotal;

  document.getElementById("dailySpendKpis").innerHTML = [
    ["Gastos diarios", money(expenseTotal), "Cargados en gastos"],
    ["Compras", money(purchaseTotal), "Tapas, etiquetas, sellos, combustible, etc."],
    ["Variables producción", money(variableTotal), "Tapas, etiquetas, sellos, comisión y combustible usado"],
    ["Pagos de deuda", money(liabilityPaymentTotal), "Cuotas o pagos de préstamos"],
    ["Total del día", money(total), date]
  ].map(kpiHtml).join("");

  const expenseRows = dailyExpenses.map((item) => `
    <tr><td>Gasto diario</td><td>${item.category}</td><td>${item.note || ""}</td><td>${money(item.amount)}</td></tr>
  `);
  const purchaseRows = purchases.map((item) => {
    const unit = item.item === "gasoline" || item.item === "diesel" ? "L" : "unid.";
    return `<tr><td>Compra</td><td>${purchaseName(item.item)}</td><td>${number(item.qty)} ${unit}</td><td>${money(item.cost)}</td></tr>`;
  });
  const productionRows = variableRows.map((item) => `
    <tr><td>Variable producción</td><td>${item.category}</td><td>${item.note}</td><td>${money(item.amount)}</td></tr>
  `);
  const liabilityRows = liabilityPayments.map((payment) => {
    const debt = (state.liabilityDebts || []).find((item) => item.id === payment.debtId);
    return `<tr><td>Pago deuda</td><td>${debt?.name || "Deuda borrada"}</td><td>${payment.note || ""}</td><td>${money(payment.amount)}</td></tr>`;
  });

  document.getElementById("dailySpendRows").innerHTML = [...expenseRows, ...purchaseRows, ...productionRows, ...liabilityRows].join("") || `
    <tr><td colspan="4">No hay gastos ni compras cargadas para esta fecha.</td></tr>
  `;
}

function allExpenseLikeRows() {
  const expenseRows = (state.expenses || []).map((item) => ({
    date: item.date,
    type: item.type,
    category: item.category,
    note: item.note || "",
    amount: Number(item.amount || 0)
  }));
  const liabilityRows = (state.liabilityPayments || []).map((payment) => {
    const debt = (state.liabilityDebts || []).find((item) => item.id === payment.debtId);
    return {
      date: payment.date,
      type: "Pago deuda",
      category: debt?.name || "Deuda borrada",
      note: payment.note || "",
      amount: Number(payment.amount || 0)
    };
  });
  return [...expenseRows, ...liabilityRows].sort((a, b) => b.date.localeCompare(a.date));
}

function renderExpenseFilter() {
  const rows = allExpenseLikeRows();
  const categorySelect = document.getElementById("expenseFilterCategory");
  const selectedCategory = categorySelect.value;
  const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort();
  categorySelect.innerHTML = `<option value="">Todas</option>` + categories.map((category) => `<option>${category}</option>`).join("");
  categorySelect.value = categories.includes(selectedCategory) ? selectedCategory : "";

  const type = document.getElementById("expenseFilterType").value;
  const category = categorySelect.value;
  const from = document.getElementById("expenseFilterFrom").value;
  const to = document.getElementById("expenseFilterTo").value;
  const filtered = rows.filter((row) => {
    if (type && row.type !== type) return false;
    if (category && row.category !== category) return false;
    if (!dateInRange(row.date, from, to)) return false;
    return true;
  });
  const total = filtered.reduce((sum, row) => sum + row.amount, 0);
  document.getElementById("expenseFilterKpis").innerHTML = [
    ["Total filtrado", money(total), "Según filtros"],
    ["Cantidad registros", number(filtered.length), "Movimientos"],
    ["Tipos", number(new Set(filtered.map((row) => row.type)).size), "Tipos distintos"]
  ].map(kpiHtml).join("");
  document.getElementById("expenseFilterRows").innerHTML = filtered.map((row) => `
    <tr><td>${row.date}</td><td>${row.type}</td><td>${row.category}</td><td>${row.note}</td><td>${money(row.amount)}</td></tr>
  `).join("") || `<tr><td colspan="5">No hay gastos para esos filtros.</td></tr>`;
}

function renderReports() {
  const driverSelect = document.getElementById("filterDriver");
  const current = driverSelect.value;
  driverSelect.innerHTML = `<option value="">Todos</option>` + state.config.drivers.map((d) => `<option>${d}</option>`).join("");
  driverSelect.value = current;

  const from = document.getElementById("filterFrom").value;
  const to = document.getElementById("filterTo").value;
  const driver = driverSelect.value;
  const rows = [];

  state.daily.forEach((day) => {
    if (from && day.date < from) return;
    if (to && day.date > to) return;
    const total = totalsForDay(day);
    if (driver) {
      const qty = Number((day.drivers || {})[driver] || 0);
      if (qty > 0) rows.push({ date: day.date, driver, qty, income: qty * state.config.priceDriver, total });
    } else {
      state.config.drivers.forEach((name) => {
        const qty = Number((day.drivers || {})[name] || 0);
        if (qty > 0) rows.push({ date: day.date, driver: name, qty, income: qty * state.config.priceDriver, total });
      });
      if (Number(day.direct7 || 0) + Number(day.direct8 || 0) > 0) {
        rows.push({ date: day.date, driver: "Venta directa", qty: Number(day.direct7 || 0) + Number(day.direct8 || 0), income: Number(day.direct7 || 0) * state.config.priceDirect7 + Number(day.direct8 || 0) * state.config.priceDirect8, total });
      }
    }
  });

  const sold = rows.reduce((sum, row) => sum + row.qty, 0);
  const income = rows.reduce((sum, row) => sum + row.income, 0);
  const all = calculateAll();
  document.getElementById("reportKpis").innerHTML = [
    ["Bidones", number(sold), "Resultado filtrado"],
    ["Ingresos", money(income), "Resultado filtrado"],
    ["Ganancia total", money(all.net), "Todos los datos"]
  ].map(kpiHtml).join("");

  document.getElementById("reportRows").innerHTML = rows.sort((a, b) => b.date.localeCompare(a.date)).map((row) => `
    <tr><td>${row.date}</td><td>${row.driver}</td><td>${number(row.qty)}</td><td>${money(row.income)}</td><td>${money(row.total.income)}</td><td>${money(row.total.income - row.total.variableCost)}</td></tr>
  `).join("");
}

function loadConfigForm() {
  Object.entries(state.config).forEach(([key, value]) => {
    const input = document.getElementById(key);
    if (!input) return;
    input.value = Array.isArray(value) ? value.join(", ") : value;
  });
}

function renderAll() {
  renderDriverInputs();
  renderDriverSelects();
  renderKpis();
  renderStock();
  renderDriverSummary();
  renderDriverDebts();
  renderProductionSupplySummary();
  renderCostPerBottleSummary();
  renderDailyRows();
  renderPurchases();
  renderExpenses();
  renderDailySpendSummary();
  renderLiabilities();
  renderExpenseFilter();
  renderDebtPayments();
  renderReports();
  loadConfigForm();
  setDefaultDates();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .view").forEach((el) => el.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.view).classList.add("active");
    renderReports();
  });
});

document.getElementById("dailyForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.getElementById("dailyId").value || uid();
  const broken = Number(document.getElementById("broken").value || 0);
  const lost = Number(document.getElementById("lost").value || 0);
  const brokenDriver = document.getElementById("brokenDriver").value;
  const lostDriver = document.getElementById("lostDriver").value;
  if (broken > 0 && !brokenDriver) {
    alert("Elegí qué chofer fue responsable del bidón roto.");
    return;
  }
  if (lost > 0 && !lostDriver) {
    alert("Elegí qué chofer fue responsable del bidón perdido.");
    return;
  }
  const drivers = {};
  document.querySelectorAll(".driverSale").forEach((input) => {
    drivers[input.dataset.driver] = Number(input.value || 0);
  });
  const gasByDriver = {};
  document.querySelectorAll(".driverGas").forEach((input) => {
    gasByDriver[input.dataset.driver] = Number(input.value || 0);
  });
  const driverGasTotal = Object.values(gasByDriver).reduce((sum, val) => sum + Number(val || 0), 0);
  const dieselByDriver = {};
  document.querySelectorAll(".driverDiesel").forEach((input) => {
    dieselByDriver[input.dataset.driver] = Number(input.value || 0);
  });
  const driverDieselTotal = Object.values(dieselByDriver).reduce((sum, val) => sum + Number(val || 0), 0);
  const record = {
    id,
    date: document.getElementById("date").value,
    produced: Number(document.getElementById("produced").value || 0),
    capsDelivered: Number(document.getElementById("capsDelivered").value || 0),
    labelsDelivered: Number(document.getElementById("labelsDelivered").value || 0),
    sealsDelivered: Number(document.getElementById("sealsDelivered").value || 0),
    capsUsed: Number(document.getElementById("capsUsed").value || 0),
    labelsUsed: Number(document.getElementById("labelsUsed").value || 0),
    sealsUsed: Number(document.getElementById("sealsUsed").value || 0),
    direct7: Number(document.getElementById("direct7").value || 0),
    direct8: Number(document.getElementById("direct8").value || 0),
    physicalBottlesSold: Number(document.getElementById("physicalBottlesSold").value || 0),
    physicalBottleUnitPrice: Number(document.getElementById("physicalBottleUnitPrice").value || 0),
    cash: Number(document.getElementById("cash").value || 0),
    qr: Number(document.getElementById("qr").value || 0),
    broken,
    brokenDriver,
    lost,
    lostDriver,
    gasLiters: driverGasTotal || Number(document.getElementById("gasLiters").value || 0),
    gasByDriver,
    gasCost: Number(document.getElementById("gasCost").value || 0),
    dieselLiters: driverDieselTotal || Number(document.getElementById("dieselLiters").value || 0),
    dieselByDriver,
    dieselCost: Number(document.getElementById("dieselCost").value || 0),
    notes: document.getElementById("notes").value.trim(),
    drivers
  };
  state.daily = state.daily.filter((item) => item.id !== id);
  state.daily.push(record);
  saveState();
  event.target.reset();
  document.getElementById("dailyId").value = "";
  renderAll();
});

document.getElementById("clearDaily").addEventListener("click", () => {
  document.getElementById("dailyForm").reset();
  document.getElementById("dailyId").value = "";
  renderDriverInputs();
  renderDriverSelects();
  setDefaultDates();
});

document.getElementById("debtPaymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const driver = document.getElementById("debtPaymentDriver").value;
  const amount = Number(document.getElementById("debtPaymentAmount").value || 0);
  if (!driver) {
    alert("Elegí el chofer que pagó la deuda.");
    return;
  }
  if (amount <= 0) {
    alert("Poné el monto que pagó.");
    return;
  }
  state.debtPayments = state.debtPayments || [];
  state.debtPayments.push({
    id: uid(),
    date: document.getElementById("debtPaymentDate").value,
    driver,
    amount,
    note: document.getElementById("debtPaymentNote").value.trim()
  });
  saveState();
  event.target.reset();
  renderAll();
});

document.getElementById("purchaseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.purchases.push({
    id: uid(),
    date: document.getElementById("purchaseDate").value,
    item: document.getElementById("purchaseItem").value,
    qty: Number(document.getElementById("purchaseQty").value || 0),
    cost: Number(document.getElementById("purchaseCost").value || 0)
  });
  saveState();
  event.target.reset();
  renderAll();
});

function saveExpenseFromForm(form, type) {
  const prefix = type === "Mensual" ? "monthlyExpense" : "dailyExpense";
  state.expenses.push({
    id: uid(),
    date: document.getElementById(`${prefix}Date`).value,
    category: document.getElementById(`${prefix}Category`).value,
    amount: Number(document.getElementById(`${prefix}Amount`).value || 0),
    type,
    note: document.getElementById(`${prefix}Note`).value.trim()
  });
  saveState();
  form.reset();
  renderAll();
}

document.getElementById("dailyExpenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveExpenseFromForm(event.target, "Diario");
});

document.getElementById("monthlyExpenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveExpenseFromForm(event.target, "Mensual");
});

document.getElementById("debtForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.liabilityDebts = state.liabilityDebts || [];
  state.liabilityDebts.push({
    id: uid(),
    date: document.getElementById("debtDate").value,
    name: document.getElementById("debtName").value.trim(),
    amount: Number(document.getElementById("debtAmount").value || 0),
    note: document.getElementById("debtNote").value.trim()
  });
  saveState();
  event.target.reset();
  renderAll();
});

document.getElementById("debtInstallmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const debtId = document.getElementById("debtInstallmentDebt").value;
  const amount = Number(document.getElementById("debtInstallmentAmount").value || 0);
  if (!debtId) {
    alert("Elegí una deuda pendiente.");
    return;
  }
  if (amount <= 0) {
    alert("Poné el monto pagado.");
    return;
  }
  state.liabilityPayments = state.liabilityPayments || [];
  state.liabilityPayments.push({
    id: uid(),
    date: document.getElementById("debtInstallmentDate").value,
    debtId,
    amount,
    note: document.getElementById("debtInstallmentNote").value.trim()
  });
  saveState();
  event.target.reset();
  renderAll();
});

document.getElementById("configForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const numeric = ["initialBottles", "initialCaps", "initialLabels", "initialSeals", "priceDriver", "priceDirect7", "priceDirect8", "costCap", "costLabel", "costSeal", "gasolineLiterCost", "dieselLiterCost", "productionEmployee1Commission", "productionEmployee2Commission", "monthlyDepreciation", "lostCharge", "lowStock"];
  numeric.forEach((key) => {
    state.config[key] = Number(document.getElementById(key).value || 0);
  });
  state.config.commission = Number(state.config.productionEmployee1Commission || 0) + Number(state.config.productionEmployee2Commission || 0);
  state.config.drivers = document.getElementById("drivers").value.split(",").map((item) => item.trim()).filter(Boolean);
  saveState();
  renderAll();
  alert("Configuración guardada.");
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.deleteDay && confirm("¿Borrar este registro diario?")) {
    state.daily = state.daily.filter((item) => item.id !== target.dataset.deleteDay);
    saveState();
    renderAll();
  }
  if (target.dataset.editDay) {
    const day = state.daily.find((item) => item.id === target.dataset.editDay);
    if (!day) return;
    document.getElementById("dailyId").value = day.id;
    ["date", "produced", "capsDelivered", "labelsDelivered", "sealsDelivered", "capsUsed", "labelsUsed", "sealsUsed", "direct7", "direct8", "physicalBottlesSold", "physicalBottleUnitPrice", "cash", "qr", "broken", "lost", "gasLiters", "gasCost", "dieselLiters", "dieselCost", "notes"].forEach((id) => {
      document.getElementById(id).value = day[id] ?? "";
    });
    document.getElementById("brokenDriver").value = day.brokenDriver || "";
    document.getElementById("lostDriver").value = day.lostDriver || "";
    document.querySelectorAll(".driverSale").forEach((input) => {
      input.value = (day.drivers || {})[input.dataset.driver] || 0;
    });
    document.querySelectorAll(".driverGas").forEach((input) => {
      input.value = (day.gasByDriver || {})[input.dataset.driver] || 0;
    });
    document.querySelectorAll(".driverDiesel").forEach((input) => {
      input.value = (day.dieselByDriver || {})[input.dataset.driver] || 0;
    });
    document.querySelector('[data-view="registro"]').click();
  }
  if (target.dataset.deletePurchase && confirm("¿Borrar esta compra?")) {
    state.purchases = state.purchases.filter((item) => item.id !== target.dataset.deletePurchase);
    saveState();
    renderAll();
  }
  if (target.dataset.deleteExpense && confirm("¿Borrar este gasto?")) {
    state.expenses = state.expenses.filter((item) => item.id !== target.dataset.deleteExpense);
    saveState();
    renderAll();
  }
  if (target.dataset.deleteDebtPayment && confirm("¿Borrar este pago de deuda?")) {
    state.debtPayments = (state.debtPayments || []).filter((item) => item.id !== target.dataset.deleteDebtPayment);
    saveState();
    renderAll();
  }
  if (target.dataset.deleteLiabilityDebt && confirm("¿Borrar esta deuda y sus pagos?")) {
    state.liabilityDebts = (state.liabilityDebts || []).filter((item) => item.id !== target.dataset.deleteLiabilityDebt);
    state.liabilityPayments = (state.liabilityPayments || []).filter((item) => item.debtId !== target.dataset.deleteLiabilityDebt);
    saveState();
    renderAll();
  }
  if (target.dataset.deleteLiabilityPayment && confirm("¿Borrar este pago de deuda?")) {
    state.liabilityPayments = (state.liabilityPayments || []).filter((item) => item.id !== target.dataset.deleteLiabilityPayment);
    saveState();
    renderAll();
  }
});

["filterFrom", "filterTo", "filterDriver"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderReports);
});

["expenseFilterType", "expenseFilterCategory", "expenseFilterFrom", "expenseFilterTo"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderExpenseFilter);
});

document.getElementById("dailySpendDate").addEventListener("input", renderDailySpendSummary);

document.getElementById("todaySpendBtn").addEventListener("click", () => {
  document.getElementById("dailySpendDate").value = todayIso();
  renderDailySpendSummary();
});

["dashFrom", "dashTo"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    renderKpis();
    renderDriverSummary();
    renderProductionSupplySummary();
    renderCostPerBottleSummary();
  });
});

document.getElementById("clearDashFilter").addEventListener("click", () => {
  document.getElementById("dashFrom").value = "";
  document.getElementById("dashTo").value = "";
  renderKpis();
  renderDriverSummary();
  renderProductionSupplySummary();
  renderCostPerBottleSummary();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respaldo-sistema-agua-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    state = JSON.parse(text);
    saveState();
    renderAll();
    alert("Respaldo importado correctamente.");
  } catch {
    alert("No pude importar ese archivo. Revisá que sea un respaldo JSON.");
  }
});

document.getElementById("printBtn").addEventListener("click", () => window.print());

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Esto borra todos los registros guardados en este navegador. ¿Continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaults);
  renderAll();
});

renderAll();
