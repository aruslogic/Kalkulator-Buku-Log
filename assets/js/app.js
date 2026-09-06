(() => {
  "use strict";

  const STORAGE_KEY = "bukuLogCalculatorV1";
  const initialState = { meta: null, sheets: [], workingDraft: null, currentResult: null, finished: false, editingIndex: null };
  let state = loadState();
  const $ = id => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  function cloneInitialState(){ return JSON.parse(JSON.stringify(initialState)); }
  function loadState(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved ? { ...cloneInitialState(), ...saved, editingIndex: null } : cloneInitialState();
    } catch { return cloneInitialState(); }
  }
  function saveState(message="Disimpan"){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveStatus(message); refreshHome();
  }
  function setSaveStatus(message){ const el=$("saveStatus"); const label=el?.querySelector("span:last-child"); if(label) label.textContent=message; }
  function resetState(){ state=cloneInitialState(); localStorage.removeItem(STORAGE_KEY); refreshHome(); }
  function showView(name){ views.forEach(v=>v.classList.toggle("active",v.id===`view${name}`)); document.body.classList.toggle("is-splash",name==="Home"); window.scrollTo({top:0,behavior:"smooth"}); }
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  const roundNearest=v=>Number.isFinite(v)?Math.round(v+Number.EPSILON):0;
  const rm=v=>`RM${number(v).toFixed(2)}`;
  function formatMonth(value){ if(!value)return"-"; const [y,m]=value.split("-"); return new Intl.DateTimeFormat("ms-MY",{month:"long",year:"numeric"}).format(new Date(+y,+m-1,1)); }

  function refreshHome(){
    const has=Boolean(state.meta); $("btnResume").hidden=!has; if(!has)return;
    const count=state.sheets.length, detail=$("splashResumeDetail"), span=$("btnResume").querySelector("span");
    if(state.finished){ span.textContent="Lihat Ringkasan"; if(detail)detail.textContent=`${formatMonth(state.meta.month)} • ${count} helaian selesai`; }
    else if(state.currentResult){ span.textContent="Sambung Pengiraan"; if(detail)detail.textContent=`${formatMonth(state.meta.month)} • Helaian ${state.currentResult.index+1} telah dikira`; }
    else { span.textContent="Sambung Pengiraan"; if(detail)detail.textContent=`${formatMonth(state.meta.month)} • Seterusnya Helaian ${count+1}`; }
  }
  function navigateHome(){ persistWorkingDraft(); refreshHome(); showView("Home"); }
  function startNew(){ if(state.meta && !confirm("Mulakan pengiraan baharu? Pengiraan semasa pada peranti ini akan digantikan."))return; resetState(); $("setupForm").reset(); $("standardRate").value="7"; showView("Setup"); }
  function resume(){
    if(!state.meta)return startNew();
    if(state.finished&&state.sheets.length){renderSummary();showView("Summary");return;}
    if(state.currentResult){renderResult(state.currentResult);showView("Result");return;}
    openSheet(state.workingDraft?.index ?? state.sheets.length, true);
  }

  function setupSubmit(e){
    e.preventDefault(); const month=$("month").value, tankCapacity=number($("tankCapacity").value), standardRate=number($("standardRate").value), openingFuel=number($("openingFuel").value), openingOdo=number($("openingOdo").value);
    if(!month)return alert("Sila pilih bulan pengiraan."); if(tankCapacity<=0)return alert("Kapasiti tangki mesti lebih daripada 0 liter."); if(standardRate<=0)return alert("Kadar standard mesti lebih daripada 0 km/L."); if(openingFuel<0)return alert("Baki bahan api tidak boleh negatif."); if(openingFuel>tankCapacity)return alert("Baki bahan api bulan lepas tidak boleh melebihi kapasiti tangki."); if(openingOdo<0)return alert("Bacaan odometer awal tidak sah.");
    state=cloneInitialState(); state.meta={month,tankCapacity,standardRate,openingFuel,openingOdo}; saveState("Maklumat disimpan"); openSheet(0,false);
  }

  function renderSheetHeader(index,startOdo){
    $("sheetEyebrow").textContent=`HELAIAN ${index+1}`;
    $("sheetProgressText").textContent=state.sheets.length?`${state.sheets.length} helaian telah dikira.`:"Belum ada helaian dikira.";
    $("summaryMonth").textContent=formatMonth(state.meta.month); $("summaryTank").textContent=`${state.meta.tankCapacity} L`; $("summaryRate").textContent=`${state.meta.standardRate} km/L`; $("sheetStartOdo").value=startOdo;
  }
  function startOdoFor(index){ return index===0?state.meta.openingOdo:state.sheets[index-1]?.endOdo ?? state.meta.openingOdo; }
  function clearFuelEntries(){ $("fuelEntries").innerHTML=""; }
  function relabelFuelEntries(){ [...$("fuelEntries").querySelectorAll(".fuel-entry")].forEach((e,i)=>e.querySelector(".fuel-label").textContent=`Rekod #${i+1}`); }
  function addFuelEntry(data={},shouldSave=true){
    const tpl=$("fuelEntryTemplate").content.cloneNode(true), w=tpl.querySelector(".fuel-entry");
    w.querySelector(".fuel-odo").value=data.odo??""; w.querySelector(".fuel-liters").value=data.liters??""; w.querySelector(".fuel-amount").value=data.amount??"";
    w.querySelector(".remove-fuel").addEventListener("click",()=>{w.remove();relabelFuelEntries();if(!$("fuelEntries").children.length)setFuelChoice("no");persistWorkingDraft();});
    w.querySelectorAll("input").forEach(i=>i.addEventListener("input",persistWorkingDraft)); $("fuelEntries").appendChild(tpl); relabelFuelEntries(); if(shouldSave)persistWorkingDraft();
  }
  function getFuelEntries({includeIncomplete=false}={}){ return [...$("fuelEntries").querySelectorAll(".fuel-entry")].map(e=>{const o=e.querySelector(".fuel-odo").value,l=e.querySelector(".fuel-liters").value,a=e.querySelector(".fuel-amount").value;return{odo:includeIncomplete&&o===""?"":number(o),liters:includeIncomplete&&l===""?"":number(l),amount:includeIncomplete&&a===""?"":number(a)}}); }
  const fuelChoice=()=>$("fuelYes").classList.contains("active")?"yes":"no";
  function setFuelChoice(v,save=true){const yes=v==="yes";$("fuelYes").classList.toggle("active",yes);$("fuelNo").classList.toggle("active",!yes);$("fuelSection").hidden=!yes;if(yes&&!$("fuelEntries").children.length)addFuelEntry({},false);if(!yes)clearFuelEntries();if(save)persistWorkingDraft();}
  function updateLiveDistance(){const s=number($("sheetStartOdo").value),raw=$("sheetEndOdo").value;if(raw==="")return $("liveDistance").textContent="0 km";$("liveDistance").textContent=`${Math.max(0,number(raw)-s).toLocaleString("ms-MY")} km`;}
  function persistWorkingDraft(){
    if(!state.meta||!$("viewSheet").classList.contains("active"))return;
    const index=state.editingIndex ?? state.sheets.length;
    state.workingDraft={index,startOdo:number($("sheetStartOdo").value),endOdo:$("sheetEndOdo").value,hasFuel:fuelChoice()==="yes",fuels:fuelChoice()==="yes"?getFuelEntries({includeIncomplete:true}):[]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setSaveStatus("Autosave aktif");updateLiveDistance();refreshHome();
  }
  function rawFromSheet(sheet,index){return{index,startOdo:sheet.startOdo,endOdo:String(sheet.endOdo),hasFuel:sheet.fuels.length>0,fuels:sheet.fuels};}
  function renderWorkingDraft(d){const index=d.index??state.sheets.length,start=d.startOdo??startOdoFor(index);renderSheetHeader(index,start);$("sheetEndOdo").value=d.endOdo??"";clearFuelEntries();const hf=Boolean(d.hasFuel);setFuelChoice(hf?"yes":"no",false);if(hf){clearFuelEntries();(d.fuels?.length?d.fuels:[{}]).forEach(f=>addFuelEntry(f,false));}updateLiveDistance();}
  function openSheet(index,resumeDraft=false){
    if(!state.meta)return showView("Setup"); state.finished=false;state.currentResult=null;state.editingIndex=index;
    let draft=null;
    if(resumeDraft&&state.workingDraft?.index===index)draft=state.workingDraft;
    else if(index<state.sheets.length)draft=rawFromSheet(state.sheets[index],index);
    else draft={index,startOdo:startOdoFor(index),endOdo:"",hasFuel:false,fuels:[]};
    state.workingDraft=draft; $("sheetForm").reset();clearFuelEntries();showSheetError("");renderWorkingDraft(draft);saveState("Autosave aktif");showView("Sheet");
  }

  function validateSheet(start,end,fuels,hasFuel){
    if(!$("sheetEndOdo").value)return"Masukkan odometer akhir helaian."; if(end<=start)return`Semak bacaan odometer. Odometer akhir mesti lebih tinggi daripada ${start.toLocaleString("ms-MY")} km.`; if(!hasFuel)return""; if(!fuels.length)return"Tambah sekurang-kurangnya satu rekod isi minyak.";
    for(let i=0;i<fuels.length;i++){const e=$("fuelEntries").children[i],o=e.querySelector(".fuel-odo").value,l=e.querySelector(".fuel-liters").value,a=e.querySelector(".fuel-amount").value;if(!o||!l||a==="")return`Lengkapkan semua maklumat bagi Rekod Isi Minyak #${i+1}.`;const f=fuels[i];if(f.odo<start||f.odo>end)return`Odometer Isi Minyak #${i+1} mesti berada antara ${start.toLocaleString("ms-MY")} hingga ${end.toLocaleString("ms-MY")} km.`;if(f.liters<=0)return`Jumlah liter bagi Rekod Isi Minyak #${i+1} mesti lebih daripada 0.`;if(f.amount<0)return`Nilai pembelian bagi Rekod Isi Minyak #${i+1} tidak sah.`;if(i>0&&f.odo<fuels[i-1].odo)return"Susun rekod isi minyak mengikut urutan odometer menaik.";}return"";
  }

  function recalculateAll(rawSheets){
    let cumulativeDistance=0,cumulativeLiters=0,cumulativeAmount=0; const allFuels=[]; const out=[];
    rawSheets.forEach((raw,index)=>{
      const startOdo=index===0?state.meta.openingOdo:out[index-1].endOdo;
      const endOdo=number(raw.endOdo), fuels=(raw.fuels||[]).map(f=>({odo:number(f.odo),liters:number(f.liters),amount:number(f.amount)}));
      const distance=endOdo-startOdo; cumulativeDistance+=distance; cumulativeLiters+=fuels.reduce((s,f)=>s+f.liters,0); cumulativeAmount+=fuels.reduce((s,f)=>s+f.amount,0); allFuels.push(...fuels); allFuels.sort((a,b)=>a.odo-b.odo);
      const lastFuel=allFuels.length?allFuels[allFuels.length-1]:null; let endingFuelRaw,lastFuelOdo=null;
      if(lastFuel){lastFuelOdo=lastFuel.odo;endingFuelRaw=state.meta.tankCapacity-((endOdo-lastFuelOdo)/state.meta.standardRate);}else endingFuelRaw=state.meta.openingFuel-(cumulativeDistance/state.meta.standardRate);
      const endingFuel=roundNearest(endingFuelRaw),usageRaw=state.meta.openingFuel+cumulativeLiters-endingFuel,usage=roundNearest(usageRaw),rateRaw=usage>0?cumulativeDistance/usage:0,rate=roundNearest(rateRaw);
      out.push({index,startOdo,endOdo,distance,fuels,cumulativeDistance,cumulativeLiters,cumulativeAmount,endingFuelRaw,endingFuel,usageRaw,usage,rateRaw,rate,lastFuelOdo});
    }); return out;
  }
  function showSheetError(m){const b=$("sheetError");b.textContent=m;b.hidden=!m;if(m)b.scrollIntoView({behavior:"smooth",block:"center"});}
  function sheetSubmit(e){
    e.preventDefault();showSheetError("");const index=state.editingIndex??state.sheets.length,start=number($("sheetStartOdo").value),end=number($("sheetEndOdo").value),has=fuelChoice()==="yes",fuels=has?getFuelEntries():[];const err=validateSheet(start,end,fuels,has);if(err)return showSheetError(err);
    const raw=state.sheets.map((s,i)=>rawFromSheet(s,i)); const entry={endOdo:end,fuels}; if(index<raw.length)raw[index]=entry;else raw.push(entry);
    const recalculated=recalculateAll(raw); if(recalculated.some(r=>r.endingFuel<0))return showSheetError("Baki bahan api menjadi negatif. Semak kapasiti tangki, kadar standard, odometer dan rekod isi minyak.");
    state.sheets=recalculated.map(r=>({...r})); state.currentResult=state.sheets[index]; state.workingDraft=null; state.editingIndex=index; saveState(index<raw.length-1?"Helaian dan kiraan seterusnya dikemas kini":"Helaian dikira");renderResult(state.currentResult);showView("Result");
  }
  function renderResult(r){$("resultEyebrow").textContent=`HELAIAN ${r.index+1} SELESAI`;$("resultSuccessTitle").textContent=`Helaian ${r.index+1} berjaya dikira`;$("resDistance").textContent=`${r.cumulativeDistance.toLocaleString("ms-MY")} KM`;$("resUsage").textContent=`${r.usage.toLocaleString("ms-MY")} L`;$("resAmount").textContent=rm(r.cumulativeAmount);$("resRate").textContent=`${r.rate.toLocaleString("ms-MY")} KM/L`;$("resEndingFuel").textContent=`${r.endingFuel.toLocaleString("ms-MY")} L`;$("resLastFuelOdo").textContent=r.lastFuelOdo?`${r.lastFuelOdo.toLocaleString("ms-MY")} km`:"Tiada isi minyak bulan ini";}
  function editCurrent(){const i=state.currentResult?.index??state.editingIndex??state.sheets.length;state.currentResult=null;openSheet(i,false);}
  function nextSheet(){const i=state.currentResult?.index??state.editingIndex??state.sheets.length;state.currentResult=null;state.workingDraft=null;state.editingIndex=null;saveState("Helaian disimpan");openSheet(i+1,false);}
  function finishMonth(){state.currentResult=null;state.workingDraft=null;state.editingIndex=null;if(!state.sheets.length)return;state.finished=true;saveState("Pengiraan selesai");renderSummary();showView("Summary");}
  function renderSummary(){if(!state.sheets.length)return;const last=state.sheets.at(-1);$("finalMonthTitle").textContent=formatMonth(state.meta.month);$("finalSheetCount").textContent=`${state.sheets.length} helaian telah dikira.`;$("finalRate").textContent=`${last.rate.toLocaleString("ms-MY")} KM/L`;$("finalDistance").textContent=`${last.cumulativeDistance.toLocaleString("ms-MY")} KM`;$("finalUsage").textContent=`${last.usage.toLocaleString("ms-MY")} L`;$("finalAmount").textContent=rm(last.cumulativeAmount);$("finalEndingFuel").textContent=`${last.endingFuel.toLocaleString("ms-MY")} L`;$("sheetHistory").innerHTML="";state.sheets.forEach((s,i)=>{const item=document.createElement("div");item.className="history-item";item.innerHTML=`<div class="history-title"><span>HELAIAN</span><strong>${i+1}</strong></div><div><span>Jarak</span><strong>${s.cumulativeDistance.toLocaleString("ms-MY")} km</strong></div><div><span>Penggunaan</span><strong>${s.usage.toLocaleString("ms-MY")} L</strong></div><div><span>Pembelian</span><strong>${rm(s.cumulativeAmount)}</strong></div><div><span>Kadar</span><strong>${s.rate.toLocaleString("ms-MY")} km/L</strong></div>`;item.addEventListener("click",()=>openSheet(i,false));item.title=`Edit Helaian ${i+1}`;$("sheetHistory").appendChild(item);});}
  function editLastCommitted(){if(state.sheets.length)openSheet(state.sheets.length-1,false);}
  function continueAfterSummary(){state.finished=false;state.currentResult=null;state.workingDraft=null;state.editingIndex=null;saveState("Pengiraan disambung");openSheet(state.sheets.length,false);}
  function resetMonth(){if(!confirm("Mulakan bulan baharu? Pengiraan semasa akan dipadam daripada peranti ini."))return;resetState();$("setupForm").reset();$("standardRate").value="7";showView("Setup");}

  function backFromSetup(){navigateHome();}
  function backFromSheet(){
    persistWorkingDraft(); const i=state.editingIndex??state.workingDraft?.index??state.sheets.length;
    if(i>0){ state.currentResult=null; openSheet(i-1,false); }
    else { $("month").value=state.meta.month;$("tankCapacity").value=state.meta.tankCapacity;$("standardRate").value=state.meta.standardRate;$("openingFuel").value=state.meta.openingFuel;$("openingOdo").value=state.meta.openingOdo;showView("Setup"); }
  }
  function backFromSummary(){ if(state.sheets.length)openSheet(state.sheets.length-1,false); else navigateHome(); }

  const setupBack=document.querySelector("#viewSetup [data-go='home']"); if(setupBack){setupBack.removeAttribute("data-go");setupBack.addEventListener("click",backFromSetup);}
  const sheetBack=document.querySelector("#viewSheet [data-go='home']"); if(sheetBack){sheetBack.removeAttribute("data-go");sheetBack.addEventListener("click",backFromSheet);}
  const summaryBack=document.querySelector("#viewSummary [data-go='home']"); if(summaryBack){summaryBack.removeAttribute("data-go");summaryBack.addEventListener("click",backFromSummary);}
  document.querySelectorAll("[data-go='home']").forEach(b=>b.addEventListener("click",navigateHome));
  $("brandHome").addEventListener("click",navigateHome);$("btnNew").addEventListener("click",startNew);$("btnResume").addEventListener("click",resume);$("setupForm").addEventListener("submit",setupSubmit);$("fuelNo").addEventListener("click",()=>setFuelChoice("no"));$("fuelYes").addEventListener("click",()=>setFuelChoice("yes"));$("btnAddFuel").addEventListener("click",()=>addFuelEntry());$("sheetEndOdo").addEventListener("input",persistWorkingDraft);$("sheetForm").addEventListener("submit",sheetSubmit);$("btnBackToEdit").addEventListener("click",editCurrent);$("btnEditCurrent").addEventListener("click",editCurrent);$("btnNextSheet").addEventListener("click",nextSheet);$("btnFinish").addEventListener("click",finishMonth);$("btnContinueAfterSummary").addEventListener("click",continueAfterSummary);$("btnEditLast").addEventListener("click",editLastCommitted);$("btnReset").addEventListener("click",resetMonth);
  if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(()=>{}));
  refreshHome();showView("Home");
})();
