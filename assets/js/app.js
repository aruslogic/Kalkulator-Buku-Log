(() => {
  "use strict";

  const STORAGE_KEY = "bukuLogCalculatorV1";

  const initialState = {
    meta: null,
    sheets: [],
    workingDraft: null,
    currentResult: null,
    finished: false
  };

  let state = loadState();

  const $ = id => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  function cloneInitialState() {
    return JSON.parse(JSON.stringify(initialState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneInitialState();
      const saved = JSON.parse(raw);
      return {
        ...cloneInitialState(),
        ...saved,
        workingDraft: saved.workingDraft || null,
        finished: Boolean(saved.finished)
      };
    } catch {
      return cloneInitialState();
    }
  }

  function saveState(message = "Disimpan") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveStatus(message);
    refreshHome();
  }

  function setSaveStatus(message) {
    const el = $("saveStatus");
    if (!el) return;
    const label = el.querySelector("span:last-child");
    if (label) label.textContent = message;
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

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function roundNearest(value) {
    return Number.isFinite(value) ? Math.round(value + Number.EPSILON) : 0;
  }

  function rm(value) {
    return `RM${number(value).toFixed(2)}`;
  }

  function formatMonth(value) {
    if (!value) return "-";
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return new Intl.DateTimeFormat("ms-MY", { month: "long", year: "numeric" }).format(date);
  }

  function refreshHome() {
    const hasProgress = Boolean(state.meta);
    $("btnResume").hidden = !hasProgress;
    $("resumeCard").hidden = !hasProgress;

    if (!hasProgress) return;

    $("resumeTitle").textContent = formatMonth(state.meta.month);
    const count = state.sheets.length;
    if (state.finished) {
      $("resumeDetail").textContent = `${count} helaian telah dikira • Pengiraan selesai`;
      $("btnResume").textContent = "Lihat Ringkasan";
      $("btnResumeCard").textContent = "Lihat Ringkasan";
    } else if (state.currentResult) {
      $("resumeDetail").textContent = `Helaian ${state.currentResult.index + 1} telah dikira dan menunggu tindakan seterusnya.`;
      $("btnResume").textContent = "Sambung Pengiraan";
      $("btnResumeCard").textContent = "Sambung";
    } else {
      const next = count + 1;
      $("resumeDetail").textContent = `${count} helaian selesai • Seterusnya Helaian ${next}`;
      $("btnResume").textContent = "Sambung Pengiraan";
      $("btnResumeCard").textContent = "Sambung";
    }
  }

  function navigateHome() {
    refreshHome();
    showView("Home");
  }

  function startNew() {
    if (state.meta) {
      const ok = confirm("Mulakan pengiraan baharu? Pengiraan semasa pada peranti ini akan digantikan.");
      if (!ok) return;
      resetState();
    }
    $("setupForm").reset();
    $("standardRate").value = "7";
    showView("Setup");
  }

  function resume() {
    if (!state.meta) return startNew();
    if (state.finished && state.sheets.length) {
      renderSummary();
      showView("Summary");
      return;
    }
    if (state.currentResult) {
      renderResult(state.currentResult);
      showView("Result");
      return;
    }
    openNewSheet(true);
  }

  function setupSubmit(event) {
    event.preventDefault();

    const month = $("month").value;
    const tankCapacity = number($("tankCapacity").value);
    const standardRate = number($("standardRate").value);
    const openingFuel = number($("openingFuel").value);
    const openingOdo = number($("openingOdo").value);

    if (!month) return alert("Sila pilih bulan pengiraan.");
    if (tankCapacity <= 0) return alert("Kapasiti tangki mesti lebih daripada 0 liter.");
    if (standardRate <= 0) return alert("Kadar standard mesti lebih daripada 0 km/L.");
    if (openingFuel < 0) return alert("Baki bahan api tidak boleh negatif.");
    if (openingFuel > tankCapacity) return alert("Baki bahan api bulan lepas tidak boleh melebihi kapasiti tangki.");
    if (openingOdo < 0) return alert("Bacaan odometer awal tidak sah.");

    state = cloneInitialState();
    state.meta = { month, tankCapacity, standardRate, openingFuel, openingOdo };
    saveState("Maklumat disimpan");
    openNewSheet(false);
  }

  function renderSheetHeader(index, startOdo) {
    $("sheetEyebrow").textContent = `HELAIAN ${index + 1}`;
    $("sheetProgressText").textContent = state.sheets.length
      ? `${state.sheets.length} helaian telah dikira.`
      : "Belum ada helaian dikira.";
    $("summaryMonth").textContent = formatMonth(state.meta.month);
    $("summaryTank").textContent = `${state.meta.tankCapacity} L`;
    $("summaryRate").textContent = `${state.meta.standardRate} km/L`;
    $("sheetStartOdo").value = startOdo;
  }

  function getDefaultStartOdo() {
    return state.sheets.length
      ? state.sheets[state.sheets.length - 1].endOdo
      : state.meta.openingOdo;
  }

  function clearFuelEntries() {
    $("fuelEntries").innerHTML = "";
  }

  function relabelFuelEntries() {
    [...$("fuelEntries").querySelectorAll(".fuel-entry")].forEach((entry, i) => {
      entry.querySelector(".fuel-label").textContent = `Rekod #${i + 1}`;
    });
  }

  function addFuelEntry(data = {}, shouldSave = true) {
    const tpl = $("fuelEntryTemplate").content.cloneNode(true);
    const wrapper = tpl.querySelector(".fuel-entry");
    wrapper.querySelector(".fuel-odo").value = data.odo ?? "";
    wrapper.querySelector(".fuel-liters").value = data.liters ?? "";
    wrapper.querySelector(".fuel-amount").value = data.amount ?? "";

    wrapper.querySelector(".remove-fuel").addEventListener("click", () => {
      wrapper.remove();
      relabelFuelEntries();
      if (!$("fuelEntries").children.length) setFuelChoice("no");
      persistWorkingDraft();
    });

    wrapper.querySelectorAll("input").forEach(input => input.addEventListener("input", persistWorkingDraft));
    $("fuelEntries").appendChild(tpl);
    relabelFuelEntries();
    if (shouldSave) persistWorkingDraft();
  }

  function getFuelEntries({ includeIncomplete = false } = {}) {
    return [...$("fuelEntries").querySelectorAll(".fuel-entry")].map(entry => {
      const odoRaw = entry.querySelector(".fuel-odo").value;
      const litersRaw = entry.querySelector(".fuel-liters").value;
      const amountRaw = entry.querySelector(".fuel-amount").value;
      return {
        odo: includeIncomplete && odoRaw === "" ? "" : number(odoRaw),
        liters: includeIncomplete && litersRaw === "" ? "" : number(litersRaw),
        amount: includeIncomplete && amountRaw === "" ? "" : number(amountRaw)
      };
    });
  }

  function fuelChoice() {
    return $("fuelYes").classList.contains("active") ? "yes" : "no";
  }

  function setFuelChoice(value, shouldSave = true) {
    const yes = value === "yes";
    $("fuelYes").classList.toggle("active", yes);
    $("fuelNo").classList.toggle("active", !yes);
    $("fuelSection").hidden = !yes;

    if (yes && !$("fuelEntries").children.length) addFuelEntry({}, false);
    if (!yes) clearFuelEntries();
    if (shouldSave) persistWorkingDraft();
  }

  function updateLiveDistance() {
    const start = number($("sheetStartOdo").value);
    const endRaw = $("sheetEndOdo").value;
    if (endRaw === "") {
      $("liveDistance").textContent = "0 km";
      return;
    }
    const end = number(endRaw);
    const distance = Math.max(0, end - start);
    $("liveDistance").textContent = `${distance.toLocaleString("ms-MY")} km`;
  }

  function persistWorkingDraft() {
    if (!state.meta || !$("viewSheet").classList.contains("active")) return;
    state.workingDraft = {
      index: state.sheets.length,
      startOdo: number($("sheetStartOdo").value),
      endOdo: $("sheetEndOdo").value,
      hasFuel: fuelChoice() === "yes",
      fuels: fuelChoice() === "yes" ? getFuelEntries({ includeIncomplete: true }) : []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveStatus("Autosave aktif");
    updateLiveDistance();
    refreshHome();
  }

  function renderWorkingDraft(draft) {
    const startOdo = draft?.startOdo ?? getDefaultStartOdo();
    renderSheetHeader(state.sheets.length, startOdo);
    $("sheetEndOdo").value = draft?.endOdo ?? "";
    clearFuelEntries();
    const hasFuel = Boolean(draft?.hasFuel);
    setFuelChoice(hasFuel ? "yes" : "no", false);
    if (hasFuel) {
      clearFuelEntries();
      const fuels = draft.fuels?.length ? draft.fuels : [{}];
      fuels.forEach(f => addFuelEntry(f, false));
    }
    updateLiveDistance();
  }

  function openNewSheet(resumeDraft = false) {
    if (!state.meta) return showView("Setup");
    state.finished = false;
    state.currentResult = null;

    if (!resumeDraft || !state.workingDraft || state.workingDraft.index !== state.sheets.length) {
      state.workingDraft = {
        index: state.sheets.length,
        startOdo: getDefaultStartOdo(),
        endOdo: "",
        hasFuel: false,
        fuels: []
      };
    }

    $("sheetForm").reset();
    clearFuelEntries();
    showSheetError("");
    renderWorkingDraft(state.workingDraft);
    saveState("Autosave aktif");
    showView("Sheet");
  }

  function validateSheet(startOdo, endOdo, fuels, hasFuel) {
    if (!$("sheetEndOdo").value) return "Masukkan odometer akhir helaian.";
    if (endOdo <= startOdo) {
      return `Semak bacaan odometer. Odometer akhir mesti lebih tinggi daripada ${startOdo.toLocaleString("ms-MY")} km.`;
    }

    if (!hasFuel) return "";
    if (!fuels.length) return "Tambah sekurang-kurangnya satu rekod isi minyak atau pilih ‘Tidak’.";

    for (let i = 0; i < fuels.length; i++) {
      const entry = $("fuelEntries").children[i];
      const odoRaw = entry.querySelector(".fuel-odo").value;
      const litersRaw = entry.querySelector(".fuel-liters").value;
      const amountRaw = entry.querySelector(".fuel-amount").value;
      if (!odoRaw || !litersRaw || amountRaw === "") return `Lengkapkan semua maklumat bagi Rekod Isi Minyak #${i + 1}.`;

      const f = fuels[i];
      if (f.odo < startOdo || f.odo > endOdo) {
        return `Odometer Isi Minyak #${i + 1} mesti berada antara ${startOdo.toLocaleString("ms-MY")} hingga ${endOdo.toLocaleString("ms-MY")} km.`;
      }
      if (f.liters <= 0) return `Jumlah liter bagi Rekod Isi Minyak #${i + 1} mesti lebih daripada 0.`;
      if (f.amount < 0) return `Nilai pembelian bagi Rekod Isi Minyak #${i + 1} tidak sah.`;
      if (i > 0 && f.odo < fuels[i - 1].odo) return "Susun rekod isi minyak mengikut urutan odometer menaik.";
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
    const historical = state.sheets.flatMap(sheet => sheet.fuels);
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
    if (message) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function sheetSubmit(event) {
    event.preventDefault();
    showSheetError("");

    const startOdo = number($("sheetStartOdo").value);
    const endOdo = number($("sheetEndOdo").value);
    const hasFuel = fuelChoice() === "yes";
    const fuels = hasFuel ? getFuelEntries() : [];

    const error = validateSheet(startOdo, endOdo, fuels, hasFuel);
    if (error) return showSheetError(error);

    const result = calculateSheet(startOdo, endOdo, fuels);
    if (result.endingFuel < 0) {
      return showSheetError("Baki bahan api menjadi negatif. Semak kapasiti tangki, kadar standard, odometer dan rekod isi minyak.");
    }

    state.currentResult = result;
    state.workingDraft = {
      index: result.index,
      startOdo: result.startOdo,
      endOdo: String(result.endOdo),
      hasFuel: result.fuels.length > 0,
      fuels: result.fuels
    };
    saveState("Helaian dikira");
    renderResult(result);
    showView("Result");
  }

  function renderResult(result) {
    $("resultEyebrow").textContent = `HELAIAN ${result.index + 1} SELESAI`;
    $("resultSuccessTitle").textContent = `Helaian ${result.index + 1} berjaya dikira`;
    $("resDistance").textContent = `${result.cumulativeDistance.toLocaleString("ms-MY")} KM`;
    $("resUsage").textContent = `${result.usage.toLocaleString("ms-MY")} L`;
    $("resAmount").textContent = rm(result.cumulativeAmount);
    $("resRate").textContent = `${result.rate.toLocaleString("ms-MY")} KM/L`;
    $("resEndingFuel").textContent = `${result.endingFuel.toLocaleString("ms-MY")} L`;
    $("resLastFuelOdo").textContent = result.lastFuelOdo
      ? `${result.lastFuelOdo.toLocaleString("ms-MY")} km`
      : "Tiada isi minyak bulan ini";
  }

  function commitCurrentResult() {
    if (!state.currentResult) return;
    const r = state.currentResult;
    state.sheets.push({
      startOdo: r.startOdo,
      endOdo: r.endOdo,
      distance: r.distance,
      fuels: r.fuels,
      cumulativeDistance: r.cumulativeDistance,
      cumulativeLiters: r.cumulativeLiters,
      cumulativeAmount: r.cumulativeAmount,
      endingFuel: r.endingFuel,
      usage: r.usage,
      rate: r.rate,
      lastFuelOdo: r.lastFuelOdo
    });
    state.currentResult = null;
    state.workingDraft = null;
  }

  function nextSheet() {
    commitCurrentResult();
    saveState("Helaian disimpan");
    openNewSheet(false);
  }

  function finishMonth() {
    commitCurrentResult();
    if (!state.sheets.length) return;
    state.finished = true;
    state.workingDraft = null;
    saveState("Pengiraan selesai");
    renderSummary();
    showView("Summary");
  }

  function renderSummary() {
    if (!state.sheets.length) return;
    const last = state.sheets[state.sheets.length - 1];
    $("finalMonthTitle").textContent = formatMonth(state.meta.month);
    $("finalSheetCount").textContent = `${state.sheets.length} helaian telah dikira.`;
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
        <div class="history-title"><span>HELAIAN</span><strong>${i + 1}</strong></div>
        <div><span>Jarak</span><strong>${sheet.cumulativeDistance.toLocaleString("ms-MY")} km</strong></div>
        <div><span>Penggunaan</span><strong>${sheet.usage.toLocaleString("ms-MY")} L</strong></div>
        <div><span>Pembelian</span><strong>${rm(sheet.cumulativeAmount)}</strong></div>
        <div><span>Kadar</span><strong>${sheet.rate.toLocaleString("ms-MY")} km/L</strong></div>
      `;
      $("sheetHistory").appendChild(item);
    });
  }

  function editCurrent() {
    const r = state.currentResult;
    if (!r) return openNewSheet(true);
    state.workingDraft = {
      index: r.index,
      startOdo: r.startOdo,
      endOdo: String(r.endOdo),
      hasFuel: r.fuels.length > 0,
      fuels: r.fuels
    };
    state.currentResult = null;
    saveState("Edit helaian");
    renderWorkingDraft(state.workingDraft);
    showSheetError("");
    showView("Sheet");
  }

  function editLastCommitted() {
    if (!state.sheets.length) return;
    const last = state.sheets.pop();
    state.finished = false;
    state.currentResult = null;
    state.workingDraft = {
      index: state.sheets.length,
      startOdo: last.startOdo,
      endOdo: String(last.endOdo),
      hasFuel: last.fuels.length > 0,
      fuels: last.fuels
    };
    saveState("Edit helaian");
    $("sheetForm").reset();
    renderWorkingDraft(state.workingDraft);
    showSheetError("");
    showView("Sheet");
  }

  function continueAfterSummary() {
    state.finished = false;
    state.currentResult = null;
    state.workingDraft = null;
    saveState("Pengiraan disambung");
    openNewSheet(false);
  }

  function resetMonth() {
    const ok = confirm("Mulakan bulan baharu? Pengiraan semasa akan dipadam daripada peranti ini.");
    if (!ok) return;
    resetState();
    $("setupForm").reset();
    $("standardRate").value = "7";
    showView("Setup");
  }

  document.querySelectorAll("[data-go='home']").forEach(btn => btn.addEventListener("click", navigateHome));
  $("brandHome").addEventListener("click", navigateHome);
  $("btnNew").addEventListener("click", startNew);
  $("btnResume").addEventListener("click", resume);
  $("btnResumeCard").addEventListener("click", resume);
  $("setupForm").addEventListener("submit", setupSubmit);
  $("fuelNo").addEventListener("click", () => setFuelChoice("no"));
  $("fuelYes").addEventListener("click", () => setFuelChoice("yes"));
  $("btnAddFuel").addEventListener("click", () => addFuelEntry());
  $("sheetEndOdo").addEventListener("input", persistWorkingDraft);
  $("sheetForm").addEventListener("submit", sheetSubmit);
  $("btnBackToEdit").addEventListener("click", editCurrent);
  $("btnEditCurrent").addEventListener("click", editCurrent);
  $("btnNextSheet").addEventListener("click", nextSheet);
  $("btnFinish").addEventListener("click", finishMonth);
  $("btnContinueAfterSummary").addEventListener("click", continueAfterSummary);
  $("btnEditLast").addEventListener("click", editLastCommitted);
  $("btnReset").addEventListener("click", resetMonth);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).catch(() => {});
    });
  }

  refreshHome();
})();
