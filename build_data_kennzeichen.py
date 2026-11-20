import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL = "https://de.wikipedia.org/wiki/Liste_der_Kfz-Kennzeichen_in_Deutschland"
OUTPUT = Path("data/kennzeichen.json")

# Diese Einträge sind keine normalen Stadt-/Kreis-Kennzeichen
SKIP_SUBSTRINGS = [
    "diplomaten", "bundespolizei", "landesregierung", "landtag",
    "senat", "bürgerschaft", "abgeordnetenhaus", "wasserstraßen",
    "bundesverfassungsgericht", "bundesministerien",
    "bundesfinanzverwaltung", "bundespräsidialamt", "bundesrat",
    "bundestag", "kfz des", "kraftfahrzeuge", "bundesweit",
    "bundesdruckerei", "bundesamt", "bundesanstalt", "bundeswehr",
    "thw", "zoll"
]

BUNDESLAENDER = {
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
    "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
    "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen", "bundesweit"
}


def clean(text):
    text = text.replace("’", "'")
    text = re.sub(r"\^\[[a-z0-9]+\]\^?", "", text)
    text = re.sub(r"\[[a-z0-9]+\]", "", text)
    text = re.sub(r"\[\d+\]", "", text)
    text = text.replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def reconstruct_name(cell):
    parts = []

    for segment in cell:
        text = clean(segment["text"])
        if not text:
            continue

        if segment["bold"]:
            previous = "".join(p["text"] for p in parts)
            at_word_start = not previous or previous[-1] in " (,-"

            if len(text) > 1:
                if at_word_start:
                    text = text[0] + text[1:].lower()
                else:
                    text = text.lower()

        parts.append({"text": text, "bold": segment["bold"]})

    name = "".join(part["text"] for part in parts).strip()
    name = re.sub(r"\s*/\s*", "/", name)
    name = re.sub(r"\s*,\s*", ", ", name)
    name = re.sub(r"\s+", " ", name)

    # "Hansestadt Hamburg" -> "Hamburg"
    name = re.sub(r"^Hansestadt\s+", "", name)

    return name


def is_skipped(text):
    lowered = text.lower()
    return any(word in lowered for word in SKIP_SUBSTRINGS)


class PlateTableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None
        self.bold = 0

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "b" and self.cell is not None:
            self.bold += 1

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append({"text": data, "bold": self.bold > 0})

    def handle_endtag(self, tag):
        if tag == "b":
            self.bold = max(0, self.bold - 1)
        elif tag in ("td", "th") and self.cell is not None:
            if self.row is not None:
                self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.cell is not None:
                self.row.append(self.cell)
                self.cell = None
            self.rows.append(self.row)
            self.row = None


def main():
    request = urllib.request.Request(
        URL,
        headers={"User-Agent": "Mozilla/5.0 (Kennzeichen-Quiz Datenexport)"}
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")

    parser = PlateTableParser()
    parser.feed(html)

    plates = {}

    for row in parser.rows:
        if len(row) != 4:
            continue

        code = clean(row[0][0]["text"]).strip() if row[0] else ""

        if not code or len(code) > 3:
            continue

        if not row[0][0]["bold"]:
            continue

        region = clean("".join(seg["text"] for seg in row[3]))

        if region not in BUNDESLAENDER:
            continue

        # Stadt/Landkreis, z. B. "Stadt Köln" oder "Landkreis Kleve"
        label = clean("".join(seg["text"] for seg in row[1]))
        label = re.sub(r"\s*\(.*?\)\s*", " ", label).strip()

        # Abgeleitet von, z. B. "Köln" oder "Kleve"
        derivation = reconstruct_name(row[2])

        if not label or not derivation:
            continue

        if is_skipped(label) or is_skipped(derivation):
            continue

        # Doppelte Kürzel: nur das erste Vorkommen behalten
        if code in plates:
            continue

        plates[code] = {
            "code": code,
            "label": label,
            "derivation": derivation,
            "region": region
        }

    result = list(plates.values())

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"{len(result)} Kennzeichen gespeichert in {OUTPUT}")


if __name__ == "__main__":
    main()