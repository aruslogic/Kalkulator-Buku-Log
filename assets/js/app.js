(() => {
  "use strict";

  const STORAGE_KEY = "bukuLogCalculatorV1";

  const initialState = {
    meta: null,
    sheets: [],
    draftSheet: null,
    currentResult: null
  };

  let state = loadState();

  const $ = (id) => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  function cloneInitialState() {
    return JSON.parse(JSON.stringify(initialState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneInitialState();
      return { ...cloneInitialState(), ...JSON.parse(raw) };
    } catch {
      return cloneInitialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("saveStatus").textContent = "Disimpan pada peranti";
    refreshHome();
  }

  function resetState() {
    state = cloneInitialState();
    localStorage.removeItem(STORAGE_KEY);
    refreshHome();
  }

  function showView(name) {
    views.forEach(v => v.classList.toggle("active", v.id === `view${name}`));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function roundNearest(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value + Number.EPSILON);
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function rm(value) {
    return `RM${number(value).toFixed(2)}`;
  }

  function formatMonth(monthValue) {
    if (!monthValue) return "-";
    const [year, month] = monthValue.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return new Intl.DateTimeFormat("ms-MY", { month: "long", year: "numeric" }).format(date);
  }

  function refreshHome() {
    $("btnResume").hidden = !(state.meta && state.sheets.length >= 0);
  }

  function navigateHome() {
    refreshHome();
    showView("Home");
  }

  function startNew() {
    if (state.meta || state.sheets.length) {
      const ok = confirm("Mulakan pengiraan baharu? Data pengiraan semasa pada peranti ini akan digantikan.");
      if (!ok) return;
      resetState();
    }
    $("setupForm").reset();
    $("standardRate").value = "7";
    showView("Setup");
  }

  function resume() {
    if (!state.meta) return startNew();
    if (state.currentResult && state.sheets.length) {
      renderResult(state.currentResult);
      showView("Result");
    } else {
      openNewSheet();
    }
  }

  function setupSubmit(event) {
    event.preventDefault();

    const month = $("month").value;
    const tankCapacity = number($("tankCapacity").value);
    const standardRate = number($("standardRate").value);
    const openingFuel = number($("openingFuel").value);
    const openingOdo = number($("openingOdo").value);

    if (!month || tankCapacity <= 0 || standardRate <= 0 || openingFuel < 0 || openingOdo < 0) {
      alert("Sila lengkapkan semua maklumat dengan nilai yang sah.");
      return;
    }

    state = cloneInitialState();
    state.meta = { month, tankCapacity, standardRate, openingFuel, openingOdo };
    saveState();
    openNewSheet();
  }

  function renderSheetHeader(index, startOdo) {
    $("sheetEyebrow").textContent = `HELAIAN ${index + 1}`;
    $("sheetTitle").textContent = "Masukkan Bacaan Helaian";
    $("summaryMonth").textContent = formatMonth(state.meta.month);
    $("summaryTank").textContent = `${state.meta.tankCapacity} L`;
    $("summaryRate").textContent = `${state.meta.standardRate} km/L`;
    $("sheetStartOdo").value = startOdo;
  }

  function clearFuelEntries() {
    $("fuelEntries").innerHTML = "";
  }

  function addFuelEntry(data = {}) {
    const tpl = $("fuelEntryTemplate").content.cloneNode(true);
    const wrapper = tpl.querySelector(".fuel-entry");
    const index = $("fuelEntries").children.length + 1;
    wrapper.querySelector(".fuel-label").textContent = `Isi Minyak #${index}`;
    wrapper.querySelector(".fuel-odo").value = data.odo ?? "";
    wrapper.querySelector(".fuel-liters").value = data.liters ?? "";
    wrapper.querySelector(".fuel-amount").value = data.amount ?? "";
    wrapper.querySelector(".remove-fuel").addEventListener("click", () => {
      wrapper.remove();
      relabelFuelEntries();
    });
    $("fuelEntries").appendChild(tpl);
  }

  function relabelFuelEntries() {
    [...$("fuelEntries").querySelectorAll(".fuel-entry")].forEach((entry, i) => {
      entry.querySelector(".fuel-label").textContent = `Isi Minyak #${i + 1}`;
    });
  }

  function getFuelEntries() {
    return [...$("fuelEntries").querySelectorAll(".fuel-entry")].map(entry => ({
      odo: number(entry.querySelector(".fuel-odo").value),
      liters: number(entry.querySelector(".fuel-liters").value),
      amount: number(entry.querySelector(".fuel-amount").value)
    }));
  }

  function validateSheet(startOdo, endOdo, fuels) {
    if (!Number.isFinite(endOdo) || endOdo <= startOdo) {
      return "Odometer akhir mesti lebih besar daripada odometer awal.";
    }

    for (let i = 0; i < fuels.length; i++) {
      const f = fuels[i];
      if (f.odo < startOdo || f.odo > endOdo) {
        return `Odometer Isi Minyak #${i + 1} mesti berada antara odometer awal dan akhir helaian.`;
      }
      if (f.liters <= 0) {
        return `Liter bagi Isi Minyak #${i + 1} mesti lebih daripada 0.`;
      }
      if (f.amount < 0) {
        return `Nilai RM bagi Isi Minyak #${i + 1} tidak sah.`;
      }
      if (i > 0 && f.odo < fuels[i - 1].odo) {
        return "Susun rekod isi minyak mengikut urutan odometer menaik.";
      }
    }

    return "";
  }

  function cumulativeBeforeCurrent() {
    return state.sheets.reduce((acc, sheet) => {
      acc.distance += sheet.distance;
      acc.liters += sheet.fuels.reduce((sum, f) => sum + f.liters, 0);
      acc.amount += sheet.fuels.reduce((sum, f) => sum + f.amount, 0);
      return acc;
    }, { distance: 0, liters: 0, amount: 0 });
  }

  function allFuelEntriesIncluding(currentFuels) {
    const historical = state.sheets.flatMap(s => s.fuels);
    return [...historical, ...currentFuels].sort((a, b) => a.odo - b.odo);
  }

  function calculateSheet(startOdo, endOdo, fuels) {
    const prior = cumulativeBeforeCurrent();
    const distance = endOdo - startOdo;
    const cumulativeDistance = prior.distance + distance;

    const currentLiters = fuels.reduce((sum, f) => sum + f.liters, 0);
    const currentAmount = fuels.reduce((sum, f) => sum + f.amount, 0);
    const cumulativeLiters = prior.liters + currentLiters;
    const cumulativeAmount = prior.amount + currentAmount;

    const allFuels = allFuelEntriesIncluding(fuels);
    const lastFuel = allFuels.length ? allFuels[allFuels.length - 1] : null;

    let endingFuelRaw;
    let lastFuelOdo = null;

    if (lastFuel) {
      lastFuelOdo = lastFuel.odo;
      const distanceAfterLastFill = endOdo - lastFuelOdo;
      endingFuelRaw = state.meta.tankCapacity - (distanceAfterLastFill / state.meta.standardRate);
    } else {
      endingFuelRaw = state.meta.openingFuel - (cumulativeDistance / state.meta.standardRate);
    }

    const endingFuel = roundNearest(endingFuelRaw);
    const usageRaw = state.meta.openingFuel + cumulativeLiters - endingFuel;
    const usage = roundNearest(usageRaw);
    const rateRaw = usage > 0 ? cumulativeDistance / usage : 0;
    const rate = roundNearest(rateRaw);

    return {
      index: state.sheets.length,
      startOdo,
      endOdo,
      distance,
      fuels,
      cumulativeDistance,
      cumulativeLiters,
      cumulativeAmount,
      endingFuelRaw,
      endingFuel,
      usageRaw,
      usage,
      rateRaw,
      rate,
      lastFuelOdo
    };
  }

  function showSheetError(message) {
    const box = $("sheetError");
    box.textContent = message;
    box.hidden = !message;
  }

  function openNewSheet() {
    if (!state.meta) return showView("Setup");
    state.currentResult = null;
    state.draftSheet = null;
    saveState();

    $("sheetForm").reset();
    clearFuelEntries();
    showSheetError("");

    const startOdo = state.sheets.length
      ? state.sheets[state.sheets.length - 1].endOdo
      : state.meta.openingOdo;

    renderSheetHeader(state.sheets.length, startOdo);
    showView("Sheet");
  }

  function sheetSubmit(event) {
    event.preventDefault();
    showSheetError("");

    const startOdo = number($("sheetStartOdo").value);
    const endOdo = number($("sheetEndOdo").value);
    const fuels = getFuelEntries();

    const error = validateSheet(startOdo, endOdo, fuels);
    if (error) {
      showSheetError(error);
      return;
    }

    const result = calculateSheet(startOdo, endOdo, fuels);

    if (result.endingFuel < 0) {
      showSheetError("Baki bahan api menjadi negatif. Semak kapasiti tangki, kadar standard, odometer atau rekod isi minyak.");
      return;
    }

    state.draftSheet = result;
    state.currentResult = result;
    saveState();
    renderResult(result);
    showView("Result");
  }

  function renderResult(result) {
    $("resultEyebrow").textContent = `HELAIAN ${result.index + 1}`;
    $("resDistance").textContent = `${result.cumulativeDistance.toLocaleString("ms-MY")} KM`;
    $("resUsage").textContent = `${result.usage.toLocaleString("ms-MY")} L`;
    $("resAmount").textContent = rm(result.cumulativeAmount);
    $("resRate").textContent = `${result.rate.toLocaleString("ms-MY")} KM/L`;
    $("resEndingFuel").textContent = `${result.endingFuel.toLocaleString("ms-MY")} L`;
    $("resLastFuelOdo").textContent = result.lastFuelOdo ? result.lastFuelOdo.toLocaleString("ms-MY") : "Tiada isi minyak bulan ini";
  }

  function commitDraft() {
    if (!state.draftSheet) return;
    state.sheets.push({
      startOdo: state.draftSheet.startOdo,
      endOdo: state.draftSheet.endOdo,
      distance: state.draftSheet.distance,
      fuels: state.draftSheet.fuels,
      cumulativeDistance: state.draftSheet.cumulativeDistance,
      cumulativeLiters: state.draftSheet.cumulativeLiters,
      cumulativeAmount: state.draftSheet.cumulativeAmount,
      endingFuel: state.draftSheet.endingFuel,
      usage: state.draftSheet.usage,
      rate: state.draftSheet.rate,
      lastFuelOdo: state.draftSheet.lastFuelOdo
    });
    state.draftSheet = null;
    state.currentResult = null;
    saveState();
  }

  function nextSheet() {
    commitDraft();
    openNewSheet();
  }

  function finishMonth() {
    commitDraft();
    if (!state.sheets.length) return;
    renderSummary();
    showView("Summary");
  }

  function renderSummary() {
    const last = state.sheets[state.sheets.length - 1];
    $("finalMonthTitle").textContent = formatMonth(state.meta.month);
    $("finalRate").textContent = `${last.rate.toLocaleString("ms-MY")} KM/L`;
    $("finalDistance").textContent = `${last.cumulativeDistance.toLocaleString("ms-MY")} KM`;
    $("finalUsage").textContent = `${last.usage.toLocaleString("ms-MY")} L`;
    $("finalAmount").textContent = rm(last.cumulativeAmount);
    $("finalEndingFuel").textContent = `${last.endingFuel.toLocaleString("ms-MY")} L`;

    $("sheetHistory").innerHTML = "";
    state.sheets.forEach((sheet, i) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div><span>Helaian</span><strong>${i + 1}</strong></div>
        <div><span>Jarak</span><strong>${sheet.cumulativeDistance.toLocaleString("ms-MY")} km</strong></div>
        <div><span>Penggunaan</span><strong>${sheet.usage.toLocaleString("ms-MY")} L</strong></div>
        <div><span>Pembelian</span><strong>${rm(sheet.cumulativeAmount)}</strong></div>
        <div><span>Kadar</span><strong>${sheet.rate.toLocaleString("ms-MY")} km/L</strong></div>
      `;
      $("sheetHistory").appendChild(item);
    });
  }

  function editDraft() {
    const r = state.draftSheet || state.currentResult;
    if (!r) return openNewSheet();

    renderSheetHeader(r.index, r.startOdo);
    $("sheetEndOdo").value = r.endOdo;
    clearFuelEntries();
    r.fuels.forEach(addFuelEntry);
    state.currentResult = null;
    saveState();
    showView("Sheet");
  }

  function editLastCommitted() {
    if (!state.sheets.length) return;
    const last = state.sheets.pop();

    state.draftSheet = {
      ...last,
      index: state.sheets.length
    };
    state.currentResult = state.draftSheet;
    saveState();

    renderSheetHeader(state.draftSheet.index, state.draftSheet.startOdo);
    $("sheetEndOdo").value = state.draftSheet.endOdo;
    clearFuelEntries();
    state.draftSheet.fuels.forEach(addFuelEntry);
    showSheetError("");
    showView("Sheet");
  }

  function resetMonth() {
    const ok = confirm("Padam pengiraan bulan ini daripada peranti dan mulakan baharu?");
    if (!ok) return;
    resetState();
    $("setupForm").reset();
    $("standardRate").value = "7";
    showView("Setup");
  }

  document.querySelectorAll("[data-go='home']").forEach(btn => {
    btn.addEventListener("click", navigateHome);
  });

  $("btnNew").addEventListener("click", startNew);
  $("btnResume").addEventListener("click", resume);
  $("setupForm").addEventListener("submit", setupSubmit);
  $("btnAddFuel").addEventListener("click", () => addFuelEntry());
  $("sheetForm").addEventListener("submit", sheetSubmit);
  $("btnBackToEdit").addEventListener("click", editDraft);
  $("btnNextSheet").addEventListener("click", nextSheet);
  $("btnFinish").addEventListener("click", finishMonth);
  $("btnEditLast").addEventListener("click", editLastCommitted);
  $("btnReset").addEventListener("click", resetMonth);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  refreshHome();
})();
