"use strict";

const $ = id => document.getElementById(id);

let plates = [];
let round = [];
let roundIndex = 0;
let current = null;
let status = "open";
let hinted = false;
let hintLength = 0;
let totals = { correct: 0, hinted: 0, revealed: 0 };

function normalize(value) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function matchesAnswer(input, current) {
  const value = normalize(input);

  const stripped = value
    .replace(/^stadt/, "")
    .replace(/^(landkreis|kreis)/, "")
    .trim();

  const label = normalize(current.label);
  const derivation = normalize(current.derivation);

  return (
    label === value ||
    label === stripped ||
    derivation === value ||
    derivation === stripped
  );
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function showScreen(id) {
  ["setup", "game", "finish"].forEach(screen => {
    $(screen).hidden = screen !== id;
  });
}

function setFeedback(message, success = false) {
  $("feedback").textContent = message;
  $("feedback").classList.toggle("success", success);
}

function getPool() {
  const region = $("region").value;
  return plates.filter(plate =>
    region === "all" || plate.region === region
  );
}

function updateAvailability() {
  const count = getPool().length;
  $("load-status").textContent = `${count} Kürzel verfügbar.`;
  $("start").disabled = count === 0;
}

async function loadPlates() {
  try {
    const response = await fetch("../data/kennzeichen.json");
    if (!response.ok) throw new Error(`kennzeichen.json konnte nicht geladen werden (${response.status}).`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Die JSON-Datei muss eine Liste enthalten.");

    plates = data.filter(plate =>
      typeof plate.code === "string" &&
      typeof plate.label === "string" &&
      typeof plate.derivation === "string" &&
      typeof plate.region === "string"
    );

    if (!plates.length) throw new Error("Keine gültigen Kürzel gefunden.");

    const regions = [...new Set(plates.map(p => p.region))]
      .filter(r => r !== "bundesweit")
      .sort((a, b) => a.localeCompare(b, "de"));

    regions.forEach(region => {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = region;
      $("region").append(option);
    });

    $("start").textContent = "Los geht’s →";
    updateAvailability();
  } catch (error) {
    $("start").textContent = "Daten konnten nicht geladen werden";
    $("load-status").textContent = error.message;
    console.error(error);
  }
}

function startRound() {
  const pool = getPool();
  if (!pool.length) return;

  const selection = $("round-size").value;
  const size = selection === "all" ? pool.length : Math.min(Number(selection), pool.length);

  round = shuffle(pool).slice(0, size);
  roundIndex = 0;

  totals = { correct: 0, hinted: 0, revealed: 0 };

  showScreen("game");
  renderPlate();
}

function renderPlate() {
  current = round[roundIndex];
  status = "open";
  hinted = false;
  hintLength = 0;

  $("plate-code").textContent = current.code;
  $("region-label").textContent = current.region;
  $("round-label").textContent = `Kürzel ${roundIndex + 1} von ${round.length}`;
  $("score-label").textContent = "";

  const percent = Math.round(roundIndex / round.length * 100);
  $("progress-fill").style.width = `${percent}%`;

  const input = $("answer-input");
  const container = input.parentElement;

  // Zustand des vorherigen Kürzels vollständig zurücksetzen
  container.classList.remove("correct", "revealed");
  container.querySelector(".answer-status")?.remove();

  input.value = "";
  input.readOnly = false;
  input.placeholder = "Stadt oder Kreis eingeben";
  input.removeAttribute("aria-label");

  $("hint").hidden = false;
  $("reveal").disabled = false;
  setFeedback("Tippe die Stadt oder den Kreis ein. Richtige Antworten werden automatisch erkannt.");

  input.focus();
}

function markCorrect() {
  totals[hinted ? "hinted" : "correct"]++;
  status = "correct";
  const input = $("answer-input");
  input.readOnly = true;
  input.parentElement.classList.add("correct");
  input.parentElement.querySelector(".answer-status")?.remove();
  const check = document.createElement("span");
  check.className = "answer-status";
  check.textContent = "✓";
  input.parentElement.append(check);
  $("hint").hidden = true;
  setFeedback(
    `✓ Richtig! ${current.label} – abgeleitet von ${current.derivation}.`,
    true
  );
  $("next").focus();
}

function tryAnswer() {
  if (status !== "open" || !$("answer-input").value.trim()) {
    return false;
  }

  if (matchesAnswer($("answer-input").value, current)) {
    markCorrect();
    return true;
  }

  return false;
}

$("answer-input").addEventListener("input", () => {
  if (status === "open") {
    tryAnswer();
  }
});

$("answer-form").addEventListener("submit", event => {
  event.preventDefault();

  if (!tryAnswer()) {
    setFeedback("Noch nicht richtig. Prüfe die Schreibweise oder nutze einen Hinweis.");
  }
});

function finishRound() {
  // Falls ein Kürzel noch offen ist, zählt es als nicht erraten
  if (status === "open") {
    totals.revealed++;
  }

  $("final-correct").textContent = totals.correct;
  $("final-hinted").textContent = totals.hinted;
  $("final-revealed").textContent = totals.revealed;

  $("finish-description").textContent =
    `Du hast ${round.length} Kürzel gespielt und ` +
    `${totals.correct + totals.hinted} von ${round.length} erraten.`;

  showScreen("finish");
  $("restart").focus();
}

$("start").addEventListener("click", startRound);
$("restart").addEventListener("click", startRound);
$("region").addEventListener("change", updateAvailability);
$("quit").addEventListener("click", () => {
  finishRound();
});
$("settings").addEventListener("click", () => {
  showScreen("setup");
  $("start").focus();
});

$("hint").addEventListener("click", () => {
  if (status !== "open") return;

  hinted = true;
  hintLength = Math.min(
    hintLength + 1,
    Math.max(1, current.derivation.length - 1)
  );

  const prefix = current.derivation.slice(0, hintLength);
  $("answer-input").placeholder = `Hinweis: ${prefix}…`;
  setFeedback(`Der Ort beginnt mit „${prefix}…“.`);
  $("answer-input").focus();
});

$("reveal").addEventListener("click", () => {
  if (status !== "open") return;

  status = "revealed";
  totals.revealed++;
  const input = $("answer-input");
  input.value = current.label;
  input.readOnly = true;
  input.parentElement.classList.add("revealed");
  $("hint").hidden = true;
  $("reveal").disabled = true;
  setFeedback(
    `Lösung: ${current.label} – abgeleitet von ${current.derivation}.`
  );
});

$("next").addEventListener("click", () => {
  roundIndex++;

  if (roundIndex >= round.length) {
    finishRound();
  } else {
    renderPlate();
  }
});

loadPlates();