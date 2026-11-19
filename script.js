let countries = [];
let current = null;
let round = [];
let roundIndex = 0;

const nameInput = document.getElementById("country-name");
const inputs = document.getElementById("inputs");
const counter = document.getElementById("counter");
const result = document.getElementById("result");

async function loadData() {
  const response = await fetch("data/countries.json");
  countries = await response.json();

  // Nur Länder mit mindestens einem Landnachbarn
  countries = countries.filter(country => country.borders.length > 0);

  startRound();
}

function getContinent() {
  return document.getElementById("continent").value;
}

function startRound() {
  const continent = getContinent();
  const size = Number(document.getElementById("round-size").value);

  const pool = countries.filter(country =>
    continent === "all" || country.region === continent
  );

  round = shuffle(pool).slice(0, size);
  roundIndex = 0;
  showCountry();
}

function showCountry() {
  current = round[roundIndex];
  result.textContent = "";

  nameInput.textContent = current.name;
  counter.textContent = `Land ${roundIndex + 1} von ${round.length}`;

  inputs.innerHTML = "";

  current.borders.forEach((borderCode, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "answer";

    const field = document.createElement("input");
    field.type = "text";
    field.placeholder = `Nachbarland ${index + 1}`;
    field.dataset.correct = current.borderNames[index].toLowerCase();
    field.dataset.hint = current.borderNames[index][0];

    const hintButton = document.createElement("button");
    hintButton.textContent = "?";
    hintButton.onclick = () => {
      field.placeholder = `Beginnt mit „${field.dataset.hint}“`;
    };

    wrapper.append(field, hintButton);
    inputs.append(wrapper);
  });
}

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

document.getElementById("reveal").onclick = () => {
  let correct = 0;

  document.querySelectorAll("#inputs input").forEach(field => {
    const isCorrect =
      normalize(field.value) === normalize(field.dataset.correct);

    field.classList.toggle("correct", isCorrect);
    field.classList.toggle("wrong", !isCorrect);

    if (!isCorrect) {
      field.value = field.dataset.correct;
    } else {
      correct++;
    }
  });

  result.textContent = `${correct} von ${current.borders.length} richtig.`;
};

document.getElementById("next").onclick = () => {
  roundIndex++;

  if (roundIndex >= round.length) {
    result.textContent = "Runde beendet! Neue Runde starten.";
    roundIndex = 0;
  }

  showCountry();
};

document.getElementById("continent").onchange = startRound;
document.getElementById("round-size").onchange = startRound;

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

loadData();