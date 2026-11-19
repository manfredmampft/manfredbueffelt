"use strict";

const $ = id => document.getElementById(id);

let countries = [];
let round = [];
let roundIndex = 0;
let slots = [];
let totals = { correct: 0, hinted: 0, revealed: 0 };
let currentCounted = false;
let completedCountries = 0;

// Alternative Schreibweisen und gebräuchliche Kurzformen.
// Normalisierung übernimmt Großschreibung, Umlaute und Satzzeichen.
const aliases = {
  "Niederlande": ["Holland"],
  "Vereinigtes Königreich": [
    "Großbritannien",
    "United Kingdom",
    "UK"
  ],
  "Vereinigte Staaten": [
    "USA",
    "US",
    "Vereinigte Staaten von Amerika",
    "United States"
  ],
  "Tschechien": ["Tschechische Republik", "Czechia"],
  "Belarus": ["Weißrussland"],
  "Moldau": ["Moldawien", "Republik Moldau"],
  "Myanmar": ["Burma", "Birma"],
  "Eswatini": ["Swasiland"],
  "Elfenbeinküste": ["Côte d'Ivoire", "Cote d'Ivoire"],
  "Osttimor": ["Timor-Leste"],
  "Kap Verde": ["Cabo Verde"],
  "Vatikanstadt": ["Vatikan", "Vatican City"],
  "Demokratische Republik Kongo": [
    "DR Kongo",
    "DRK",
    "Kongo Kinshasa"
  ],
  "Republik Kongo": ["Kongo Brazzaville"],
  "Bosnien und Herzegowina": [
    "Bosnien-Herzegowina",
    "Bosnien Herzegowina"
  ],
  "Vereinigte Arabische Emirate": ["VAE", "UAE"],
  "São Tomé und Príncipe": ["Sao Tome und Principe"],
  "Föderierte Staaten von Mikronesien": ["Mikronesien"],
  "St. Kitts und Nevis": ["Saint Kitts und Nevis"],
  "St. Lucia": ["Saint Lucia"],
  "St. Vincent und die Grenadinen": [
    "Saint Vincent und die Grenadinen"
  ]
};

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

function matchesAnswer(input, countryName) {
  const value = normalize(input);
  const accepted = [countryName, ...(aliases[countryName] || [])];
  return accepted.some(name => normalize(name) === value);
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
  const continent = $("continent").value;

  return countries.filter(country =>
    continent === "all" || country.continent === continent
  );
}

function updateAvailability() {
  const count = getPool().length;
  $("load-status").textContent = `${count} Länder verfügbar.`;
  $("start").disabled = count === 0;
}

async function loadCountries() {
  try {
    const response = await fetch("./data/countries.json");

    if (!response.ok) {
      throw new Error(`countries.json konnte nicht geladen werden (${response.status}).`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Die JSON-Datei muss eine Liste von Ländern enthalten.");
    }

    countries = data
      .filter(country =>
        typeof country.name === "string" &&
        typeof country.continent === "string" &&
        Array.isArray(country.neighbors)
      )
      .map(country => ({
        name: country.name,
        continent: country.continent,
        neighbors: [...new Set(
          country.neighbors
            .filter(name => typeof name === "string")
            .map(name => name.trim())
            .filter(Boolean)
        )]
      }))
      .filter(country => country.neighbors.length > 0);

    if (!countries.length) {
      throw new Error("Keine Länder mit Nachbarn in der JSON-Datei gefunden.");
    }

    const continents = [...new Set(
      countries.map(country => country.continent)
    )].sort((a, b) => a.localeCompare(b, "de"));

    continents.forEach(continent => {
      const option = document.createElement("option");
      option.value = continent;
      option.textContent = continent;
      $("continent").append(option);
    });

    $("start").textContent = "Los geht’s →";
    updateAvailability();
  } catch (error) {
    $("start").textContent = "Daten konnten nicht geladen werden";
    $("load-status").textContent =
      `${error.message} Prüfe den Pfad data/countries.json im Repository.`;
    console.error(error);
  }
}

function startRound() {
  const pool = getPool();

  if (!pool.length) {
    return;
  }

  const selection = $("round-size").value;
  const size = selection === "all"
    ? pool.length
    : Math.min(Number(selection), pool.length);

  round = shuffle(pool).slice(0, size);
  roundIndex = 0;
  completedCountries = 0;
  totals = { correct: 0, hinted: 0, revealed: 0 };

  showScreen("game");
  renderCountry();
}

function renderCountry() {
  currentCounted = false;

  const country = round[roundIndex];

  // Das Ziel eines Feldes wird erst beim richtigen Antworten festgelegt.
  // Nur ein Hinweis bindet das betreffende Feld an ein bestimmtes Land.
  slots = country.neighbors.map(() => ({
    target: null,
    status: "open",
    hinted: false,
    hintLength: 0,
    element: null,
    input: null,
    hintButton: null,
    statusElement: null
  }));

  $("country-name").textContent = country.name;
  $("round-label").textContent = `Land ${roundIndex + 1} von ${round.length}`;
  $("country-description").textContent =
    `${country.neighbors.length} Nachbarländer · Antworten in beliebiger Reihenfolge`;

  const percent = Math.round(roundIndex / round.length * 100);
  $("progress-fill").style.width = `${percent}%`;
  $("progress").setAttribute("aria-valuenow", String(percent));

  $("next").textContent =
    roundIndex === round.length - 1 ? "Ergebnis ansehen →" : "Weiter →";

  $("reveal").disabled = false;
  $("answers").replaceChildren();
  setFeedback("Tippe ein Land ein. Richtige Antworten werden automatisch erkannt.");

  slots.forEach((slot, index) => {
    const element = document.createElement("div");
    element.className = "answer";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Nachbarland ${index + 1}`;
    input.setAttribute("aria-label", `Nachbarland ${index + 1}`);
    input.autocomplete = "off";
    input.spellcheck = false;

    const hintButton = document.createElement("button");
    hintButton.type = "button";
    hintButton.className = "hint-button";
    hintButton.textContent = "?";
    hintButton.title = "Anfangsbuchstaben anzeigen";
    hintButton.setAttribute(
      "aria-label",
      `Hinweis für Nachbarland ${index + 1}`
    );

    const statusElement = document.createElement("span");
    statusElement.className = "answer-status";

    Object.assign(slot, {
      element,
      input,
      hintButton,
      statusElement
    });

    input.addEventListener("input", () => {
      const solved = tryAnswer(slot);

      if (solved) {
        focusNextOpen(index);
      }
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        checkAnswers();
        focusNextOpen(index);
      }
    });

    hintButton.addEventListener("click", () => giveHint(slot));

    element.append(input, hintButton, statusElement);
    $("answers").append(element);
  });

  updateScore();
  slots[0]?.input.focus();
}

function reservedTargets(exceptSlot = null) {
  return new Set(
    slots
      .filter(slot => slot !== exceptSlot && slot.target !== null)
      .map(slot => slot.target)
  );
}

function tryAnswer(slot) {
  if (slot.status !== "open" || !slot.input.value.trim()) {
    return false;
  }

  const country = round[roundIndex];
  const reserved = reservedTargets(slot);

  const match = country.neighbors.find(name =>
    !reserved.has(name) &&
    (slot.target === null || slot.target === name) &&
    matchesAnswer(slot.input.value, name)
  );

  if (!match) {
    return false;
  }

  slot.target = match;
  slot.status = "correct";
  slot.input.value = match;
  slot.input.readOnly = true;
  slot.element.classList.add("correct");
  slot.hintButton.hidden = true;
  slot.statusElement.textContent = "✓";

  updateScore();

  if (slots.every(item => item.status === "correct")) {
    setFeedback("🎉 Alle Nachbarländer gefunden! Stark gemacht.", true);
  } else if (slots.every(item => item.status !== "open")) {
    setFeedback("Dieses Land ist abgeschlossen. Weiter geht’s!", true);
  } else {
    setFeedback(`✓ ${match} ist richtig!`, true);
  }

  return true;
}

function checkAnswers() {
  let newlySolved = 0;

  slots.forEach(slot => {
    if (tryAnswer(slot)) {
      newlySolved++;
    }
  });

  if (newlySolved || slots.every(slot => slot.status !== "open")) {
    return;
  }

  const filled = slots.filter(slot =>
    slot.status === "open" && slot.input.value.trim()
  );

  if (!filled.length) {
    setFeedback("Trage ein Nachbarland in ein freies Feld ein.");
    return;
  }

  const duplicate = filled.some(slot =>
    slots.some(other =>
      other !== slot &&
      other.status !== "open" &&
      matchesAnswer(slot.input.value, other.target)
    )
  );

  setFeedback(
    duplicate
      ? "Dieses Land ist schon eingetragen. Jedes Land zählt nur einmal."
      : "Noch nicht richtig. Prüfe die Schreibweise oder nutze einen Hinweis. Ein Feld mit Hinweis erwartet das dazugehörige Land."
  );
}

function focusNextOpen(index) {
  for (let step = 1; step <= slots.length; step++) {
    const candidate = slots[(index + step) % slots.length];

    if (candidate.status === "open" && !candidate.input.value.trim()) {
      candidate.input.focus();
      return;
    }
  }

  if (slots.every(slot => slot.status !== "open")) {
    $("next").focus();
  }
}

function giveHint(slot) {
  if (slot.status !== "open") {
    return;
  }

  // Eine bereits richtige Eingabe erst anerkennen, bevor ein Hinweis zählt.
  if (tryAnswer(slot)) {
    return;
  }

  if (slot.target === null) {
    const reserved = reservedTargets(slot);
    slot.target = round[roundIndex].neighbors.find(
      name => !reserved.has(name)
    );
  }

  slot.hinted = true;

  // Den letzten Buchstaben nicht durch Hinweise verraten.
  slot.hintLength = Math.min(
    slot.hintLength + 1,
    Math.max(1, slot.target.length - 1)
  );

  const prefix = slot.target.slice(0, slot.hintLength);
  slot.input.placeholder = `Hinweis: ${prefix}…`;
  slot.input.setAttribute(
    "aria-label",
    `Gesuchtes Nachbarland beginnt mit ${prefix}`
  );

  setFeedback(`Dieses Feld sucht ein Land mit „${prefix}…“.`);
  slot.input.focus();
}

function revealRemaining() {
  // Richtige, noch nicht erkannte Eingaben zuerst werten.
  slots.forEach(slot => tryAnswer(slot));

  const reserved = reservedTargets();

  slots.forEach(slot => {
    if (slot.status !== "open") {
      return;
    }

    if (slot.target === null) {
      slot.target = round[roundIndex].neighbors.find(
        name => !reserved.has(name)
      );
      reserved.add(slot.target);
    }

    slot.status = "revealed";
    slot.input.value = slot.target;
    slot.input.readOnly = true;
    slot.element.classList.add("revealed");
    slot.hintButton.hidden = true;
    slot.statusElement.textContent = "↗";
  });

  $("reveal").disabled = true;
  updateScore();
  setFeedback(
    "Fehlende Antworten sind orange markiert und zählen nicht als erraten."
  );
}

function updateScore() {
  const found = slots.filter(slot => slot.status === "correct").length;
  $("score-label").textContent = `${found} / ${slots.length} gefunden`;
}

function countCurrentCountry() {
  if (currentCounted) {
    return;
  }

  slots.forEach(slot => {
    if (slot.status === "correct") {
      totals[slot.hinted ? "hinted" : "correct"]++;
    } else {
      totals.revealed++;
    }
  });

  currentCounted = true;
  completedCountries++;
}

function nextCountry() {
  slots.forEach(slot => tryAnswer(slot));
  countCurrentCountry();
  roundIndex++;

  if (roundIndex >= round.length) {
    finishRound();
  } else {
    renderCountry();
  }
}

function finishRound() {
  const total = totals.correct + totals.hinted + totals.revealed;

  $("final-correct").textContent = totals.correct;
  $("final-hinted").textContent = totals.hinted;
  $("final-revealed").textContent = totals.revealed;
  $("finish-description").textContent =
    `Du hast ${completedCountries} Länder gespielt und ` +
    `${totals.correct + totals.hinted} von ${total} Nachbarländern erraten.`;

  showScreen("finish");
  $("restart").focus();
}

$("answer-form").addEventListener("submit", event => {
  event.preventDefault();
  checkAnswers();
});

$("start").addEventListener("click", startRound);
$("restart").addEventListener("click", startRound);
$("continent").addEventListener("change", updateAvailability);
$("next").addEventListener("click", nextCountry);
$("reveal").addEventListener("click", revealRemaining);

$("quit").addEventListener("click", () => {
  slots.forEach(slot => tryAnswer(slot));
  countCurrentCountry();
  finishRound();
});

$("settings").addEventListener("click", () => {
  showScreen("setup");
  $("start").focus();
});

loadCountries();