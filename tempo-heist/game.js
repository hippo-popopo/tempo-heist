const timer = document.getElementById("timer");
const actionButton = document.getElementById("actionButton");
const buttonText = document.getElementById("buttonText");
const buttonIcon = document.getElementById("buttonIcon");
const statusLabel = document.getElementById("statusLabel");
const consoleCopy = document.getElementById("consoleCopy");
const consolePanel = document.getElementById("console");
const resultPanel = document.getElementById("resultPanel");
const resultGrid = document.getElementById("resultGrid");
const precision = document.getElementById("precision");
const loot = document.getElementById("loot");
const sidebarLoot = document.getElementById("sidebarLoot");
const resultTitle = document.getElementById("resultTitle");
const resultEyebrow = document.getElementById("resultEyebrow");
const nextButton = document.getElementById("nextButton");
const roundDisplay = document.getElementById("round");
const streakDisplay = document.getElementById("streak");
const bestStreakDisplay = document.getElementById("bestStreak");
const signalLight = document.getElementById("signalLight");
const estimateBox = document.getElementById("estimateBox");
const estimateInput = document.getElementById("estimateInput");
const alertBars = [...document.querySelectorAll("#alertBars i")];
const modeButtons = [...document.querySelectorAll(".mode-button")];

let selectedMode = "mixed";
let challenge = "reproduce";
let state = "ready";
let target = 0;
let startedAt = 0;
let signalTimeout;
let round = 1;
let streak = 0;
let bestStreak = 0;
let alerts = 0;
let totalLoot = 0;
let result = null;

function randomTarget() {
  return Math.round((2.25 + Math.random() * 6.5) * 100) / 100;
}

function formatSeconds(value) {
  return value.toFixed(2).replace(".", ",");
}

function formatLoot(value) {
  return `€ ${value.toLocaleString("fr-FR")}`;
}

function renderTime(value) {
  const [seconds, centis] = value.toFixed(2).split(".");
  timer.innerHTML = `<span>00</span><i>:</i><span>${seconds}</span><i>.</i><small>${centis}</small>`;
}

function renderHidden() {
  timer.innerHTML = "<span>••</span><i>:</i><span>••</span><i>.</i><small>••</small>";
  timer.classList.add("blind");
}

function updateStats() {
  roundDisplay.textContent = round.toString().padStart(2, "0");
  streakDisplay.textContent = ` / SÉRIE ${streak.toString().padStart(2, "0")}`;
  bestStreakDisplay.textContent = bestStreak.toString().padStart(2, "0");
  loot.textContent = formatLoot(totalLoot);
  sidebarLoot.textContent = formatLoot(totalLoot);
  alertBars.forEach((bar, index) => bar.classList.toggle("active", index < alerts));
}

function setButton(text, icon = "◆", running = false) {
  buttonText.textContent = text;
  buttonIcon.textContent = icon;
  actionButton.classList.toggle("running", running);
}

function newRound() {
  clearTimeout(signalTimeout);
  challenge = selectedMode === "mixed" ? (Math.random() < .5 ? "reproduce" : "estimate") : selectedMode;
  target = randomTarget();
  state = "ready";
  result = null;
  signalLight.classList.remove("on");
  estimateBox.classList.add("hidden");
  estimateInput.value = "";
  timer.classList.remove("blind", "target-time");
  resultPanel.classList.add("hidden");
  consolePanel.classList.remove("hidden");
  updateStats();

  if (challenge === "reproduce") {
    statusLabel.textContent = "PROTOCOLE / REPRODUIRE";
    renderTime(target);
    timer.classList.add("target-time");
    consoleCopy.textContent = "Mémorise la cible. Quand tu es prêt, lance le chrono invisible et arrête-le au moment exact.";
    setButton("LANCER LE CHRONO INVISIBLE", "⌖");
  } else {
    statusLabel.textContent = "PROTOCOLE / ESTIMER";
    renderHidden();
    consoleCopy.textContent = "Quand tu es prêt, active le signal. Observe sa durée puis saisis ton estimation.";
    setButton("ACTIVER LE SIGNAL", "✦");
  }
}

function startReproduction() {
  state = "reproducing";
  startedAt = performance.now();
  renderHidden();
  statusLabel.textContent = "CHRONO INVISIBLE / EN COURS";
  consoleCopy.textContent = "Coupe le verrou lorsque tu penses avoir atteint la cible.";
  setButton("COUPER LE VERROU", "✦", true);
}

function finishReproduction() {
  const guessed = (performance.now() - startedAt) / 1000;
  completeRound(guessed);
}

function startSignal() {
  state = "signal";
  signalLight.classList.add("on");
  statusLabel.textContent = "SIGNAL LUMINEUX / OBSERVE";
  consoleCopy.textContent = "La lumière s'éteindra seule. Ressens sa durée.";
  setButton("SIGNAL EN COURS", "✦", true);
  actionButton.disabled = true;
  signalTimeout = setTimeout(() => {
    state = "estimating";
    signalLight.classList.remove("on");
    actionButton.disabled = false;
    estimateBox.classList.remove("hidden");
    estimateInput.focus();
    statusLabel.textContent = "SIGNAL ÉTEINT / À TOI";
    consoleCopy.textContent = "Combien de temps la lumière est-elle restée allumée ?";
    setButton("VALIDER MON ESTIMATION", "✓");
  }, target * 1000);
}

function submitEstimate() {
  const normalized = estimateInput.value.trim().replace(",", ".");
  const guessed = Number.parseFloat(normalized);
  if (!Number.isFinite(guessed) || guessed <= 0 || guessed > 30) {
    estimateInput.focus();
    estimateInput.classList.add("invalid");
    setTimeout(() => estimateInput.classList.remove("invalid"), 350);
    return;
  }
  completeRound(guessed);
}

function grade(error) {
  if (error <= .1) return { title: "PARFAIT", gain: 1000, precision: 100 };
  if (error <= .25) return { title: "PROPRE", gain: 600, precision: 94 };
  if (error <= .5) return { title: "RISQUÉ", gain: 250, precision: 82 };
  return { title: "ALERTE", gain: 0, precision: Math.max(0, Math.round(75 - error * 12)) };
}

function completeRound(guessed) {
  const error = Math.abs(guessed - target);
  const verdict = grade(error);
  const delta = guessed - target;
  result = { guessed, error, verdict };
  state = "result";
  signalLight.classList.remove("on");
  totalLoot += verdict.gain;

  if (verdict.gain) {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
  } else {
    alerts += 1;
    streak = 0;
  }

  resultEyebrow.textContent = alerts >= 3 ? "MISSION TERMINÉE" : "VERROU ANALYSÉ";
  resultTitle.textContent = alerts >= 3 ? "INFILTRATION COMPROMISE" : verdict.title;
  precision.textContent = `${verdict.precision}%`;
  resultGrid.innerHTML = `
    <div class="result-item accent"><span>DURÉE RÉELLE</span><strong>${formatSeconds(target)} S</strong><b>${challenge === "estimate" ? "SIGNAL LUMINEUX" : "CIBLE AFFICHÉE"}</b></div>
    <div class="result-item"><span>TA RÉPONSE</span><strong>${formatSeconds(guessed)} S</strong><b>${challenge === "estimate" ? "ESTIMATION" : "ARRÊT À L'AVEUGLE"}</b></div>
    <div class="result-item ${error > .5 ? "danger" : ""}"><span>ÉCART</span><strong>${delta >= 0 ? "+" : ""}${formatSeconds(delta)} S</strong><b class="${error > .5 ? "off" : ""}">${verdict.title} · +${verdict.gain} €</b></div>`;
  nextButton.innerHTML = alerts >= 3 ? "RECOMMENCER <b>↻</b>" : "VERROU SUIVANT <b>→</b>";
  consolePanel.classList.add("hidden");
  resultPanel.classList.remove("hidden");
  updateStats();
}

function nextRound() {
  if (alerts >= 3) {
    round = 1;
    streak = 0;
    alerts = 0;
    totalLoot = 0;
  } else {
    round += 1;
  }
  newRound();
}

actionButton.addEventListener("click", () => {
  if (state === "ready") challenge === "reproduce" ? startReproduction() : startSignal();
  else if (state === "reproducing") finishReproduction();
  else if (state === "estimating") submitEstimate();
});

nextButton.addEventListener("click", nextRound);
modeButtons.forEach(button => button.addEventListener("click", () => {
  if (state !== "ready" && state !== "result") return;
  selectedMode = button.dataset.mode;
  modeButtons.forEach(candidate => candidate.classList.toggle("active", candidate === button));
  if (selectedMode === "online") {
    window.enterOnlineMode?.();
    return;
  }
  window.leaveOnlineMode?.();
  newRound();
}));
estimateInput.addEventListener("keydown", event => {
  if (event.key === "Enter") submitEstimate();
});
document.addEventListener("keydown", event => {
  if (selectedMode === "online" || event.code !== "Space" || event.repeat || document.activeElement === estimateInput) return;
  event.preventDefault();
  if (state === "result") nextRound();
  else actionButton.click();
});

newRound();
