import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL = "https://en.wikipedia.org/wiki/List_of_countries_and_territories_by_land_and_maritime_borders"
OUTPUT = Path("data/countries.json")

EXCLUDED = {
    "Abkhazia",
    "South Ossetia",
    "Somaliland",
    "Transnistria",
    "Northern Cyprus",
    "Western Sahara",
    "Akrotiri and Dhekelia",
    "United Nations Buffer Zone in Cyprus",
    "Sint Maarten",
    "Saint Martin",
}

NAMES = {
    "Afghanistan": ("Afghanistan", "Asien"),
    "Albania": ("Albanien", "Europa"),
    "Algeria": ("Algerien", "Afrika"),
    "Andorra": ("Andorra", "Europa"),
    "Angola": ("Angola", "Afrika"),
    "Argentina": ("Argentinien", "Südamerika"),
    "Armenia": ("Armenien", "Asien"),
    "Austria": ("Österreich", "Europa"),
    "Azerbaijan": ("Aserbaidschan", "Asien"),
    "Bangladesh": ("Bangladesch", "Asien"),
    "Belarus": ("Belarus", "Europa"),
    "Belgium": ("Belgien", "Europa"),
    "Belize": ("Belize", "Nordamerika"),
    "Benin": ("Benin", "Afrika"),
    "Bhutan": ("Bhutan", "Asien"),
    "Bolivia": ("Bolivien", "Südamerika"),
    "Bosnia and Herzegovina": ("Bosnien und Herzegowina", "Europa"),
    "Botswana": ("Botswana", "Afrika"),
    "Brazil": ("Brasilien", "Südamerika"),
    "Brunei": ("Brunei", "Asien"),
    "Bulgaria": ("Bulgarien", "Europa"),
    "Burkina Faso": ("Burkina Faso", "Afrika"),
    "Burundi": ("Burundi", "Afrika"),
    "Cambodia": ("Kambodscha", "Asien"),
    "Cameroon": ("Kamerun", "Afrika"),
    "Canada": ("Kanada", "Nordamerika"),
    "Central African Republic": ("Zentralafrikanische Republik", "Afrika"),
    "Chad": ("Tschad", "Afrika"),
    "Chile": ("Chile", "Südamerika"),
    "China": ("China", "Asien"),
    "People's Republic of China": ("China", "Asien"),
    "Colombia": ("Kolumbien", "Südamerika"),
    "Democratic Republic of the Congo": ("Demokratische Republik Kongo", "Afrika"),
    "Republic of the Congo": ("Republik Kongo", "Afrika"),
    "Costa Rica": ("Costa Rica", "Nordamerika"),
    "Côte d'Ivoire": ("Elfenbeinküste", "Afrika"),
    "Croatia": ("Kroatien", "Europa"),
    "Czech Republic": ("Tschechien", "Europa"),
    "Denmark": ("Dänemark", "Europa"),
    "Djibouti": ("Dschibuti", "Afrika"),
    "Dominican Republic": ("Dominikanische Republik", "Nordamerika"),
    "East Timor": ("Osttimor", "Asien"),
    "Ecuador": ("Ecuador", "Südamerika"),
    "Egypt": ("Ägypten", "Afrika"),
    "El Salvador": ("El Salvador", "Nordamerika"),
    "Equatorial Guinea": ("Äquatorialguinea", "Afrika"),
    "Eritrea": ("Eritrea", "Afrika"),
    "Estonia": ("Estland", "Europa"),
    "Eswatini": ("Eswatini", "Afrika"),
    "Ethiopia": ("Äthiopien", "Afrika"),
    "Finland": ("Finnland", "Europa"),
    "France": ("Frankreich", "Europa"),
    "Gabon": ("Gabun", "Afrika"),
    "The Gambia": ("Gambia", "Afrika"),
    "Georgia": ("Georgien", "Asien"),
    "Germany": ("Deutschland", "Europa"),
    "Ghana": ("Ghana", "Afrika"),
    "Greece": ("Griechenland", "Europa"),
    "Guatemala": ("Guatemala", "Nordamerika"),
    "Guinea": ("Guinea", "Afrika"),
    "Guinea-Bissau": ("Guinea-Bissau", "Afrika"),
    "Guyana": ("Guyana", "Südamerika"),
    "Haiti": ("Haiti", "Nordamerika"),
    "Honduras": ("Honduras", "Nordamerika"),
    "Hungary": ("Ungarn", "Europa"),
    "India": ("Indien", "Asien"),
    "Indonesia": ("Indonesien", "Asien"),
    "Iran": ("Iran", "Asien"),
    "Iraq": ("Irak", "Asien"),
    "Ireland": ("Irland", "Europa"),
    "Israel": ("Israel", "Asien"),
    "Italy": ("Italien", "Europa"),
    "Jordan": ("Jordanien", "Asien"),
    "Kazakhstan": ("Kasachstan", "Asien"),
    "Kenya": ("Kenia", "Afrika"),
    "North Korea": ("Nordkorea", "Asien"),
    "South Korea": ("Südkorea", "Asien"),
    "Kosovo": ("Kosovo", "Europa"),
    "Kuwait": ("Kuwait", "Asien"),
    "Kyrgyzstan": ("Kirgisistan", "Asien"),
    "Laos": ("Laos", "Asien"),
    "Latvia": ("Lettland", "Europa"),
    "Lebanon": ("Libanon", "Asien"),
    "Lesotho": ("Lesotho", "Afrika"),
    "Liberia": ("Liberia", "Afrika"),
    "Libya": ("Libyen", "Afrika"),
    "Liechtenstein": ("Liechtenstein", "Europa"),
    "Lithuania": ("Litauen", "Europa"),
    "Luxembourg": ("Luxemburg", "Europa"),
    "Malawi": ("Malawi", "Afrika"),
    "Malaysia": ("Malaysia", "Asien"),
    "Mali": ("Mali", "Afrika"),
    "Mauritania": ("Mauretanien", "Afrika"),
    "Mexico": ("Mexiko", "Nordamerika"),
    "Moldova": ("Moldau", "Europa"),
    "Monaco": ("Monaco", "Europa"),
    "Mongolia": ("Mongolei", "Asien"),
    "Montenegro": ("Montenegro", "Europa"),
    "Morocco": ("Marokko", "Afrika"),
    "Mozambique": ("Mosambik", "Afrika"),
    "Myanmar": ("Myanmar", "Asien"),
    "Namibia": ("Namibia", "Afrika"),
    "Nepal": ("Nepal", "Asien"),
    "Netherlands": ("Niederlande", "Europa"),
    "Nicaragua": ("Nicaragua", "Nordamerika"),
    "Niger": ("Niger", "Afrika"),
    "Nigeria": ("Nigeria", "Afrika"),
    "North Macedonia": ("Nordmazedonien", "Europa"),
    "Norway": ("Norwegen", "Europa"),
    "Oman": ("Oman", "Asien"),
    "Pakistan": ("Pakistan", "Asien"),
    "Palestine": ("Palästina", "Asien"),
    "Panama": ("Panama", "Nordamerika"),
    "Papua New Guinea": ("Papua-Neuguinea", "Ozeanien"),
    "Paraguay": ("Paraguay", "Südamerika"),
    "Peru": ("Peru", "Südamerika"),
    "Poland": ("Polen", "Europa"),
    "Portugal": ("Portugal", "Europa"),
    "Qatar": ("Katar", "Asien"),
    "Romania": ("Rumänien", "Europa"),
    "Russia": ("Russland", "Europa"),
    "Rwanda": ("Ruanda", "Afrika"),
    "San Marino": ("San Marino", "Europa"),
    "Saudi Arabia": ("Saudi-Arabien", "Asien"),
    "Senegal": ("Senegal", "Afrika"),
    "Serbia": ("Serbien", "Europa"),
    "Sierra Leone": ("Sierra Leone", "Afrika"),
    "Slovakia": ("Slowakei", "Europa"),
    "Slovenia": ("Slowenien", "Europa"),
    "Somalia": ("Somalia", "Afrika"),
    "South Africa": ("Südafrika", "Afrika"),
    "South Sudan": ("Südsudan", "Afrika"),
    "Spain": ("Spanien", "Europa"),
    "Sudan": ("Sudan", "Afrika"),
    "Suriname": ("Suriname", "Südamerika"),
    "Sweden": ("Schweden", "Europa"),
    "Switzerland": ("Schweiz", "Europa"),
    "Syria": ("Syrien", "Asien"),
    "Tajikistan": ("Tadschikistan", "Asien"),
    "Tanzania": ("Tansania", "Afrika"),
    "Thailand": ("Thailand", "Asien"),
    "Togo": ("Togo", "Afrika"),
    "Tunisia": ("Tunesien", "Afrika"),
    "Turkey": ("Türkei", "Asien"),
    "Turkmenistan": ("Turkmenistan", "Asien"),
    "Uganda": ("Uganda", "Afrika"),
    "Ukraine": ("Ukraine", "Europa"),
    "United Arab Emirates": ("Vereinigte Arabische Emirate", "Asien"),
    "United Kingdom": ("Vereinigtes Königreich", "Europa"),
    "United States": ("Vereinigte Staaten", "Nordamerika"),
    "Uruguay": ("Uruguay", "Südamerika"),
    "Uzbekistan": ("Usbekistan", "Asien"),
    "Vatican City": ("Vatikanstadt", "Europa"),
    "Venezuela": ("Venezuela", "Südamerika"),
    "Vietnam": ("Vietnam", "Asien"),
    "Yemen": ("Jemen", "Asien"),
    "Zambia": ("Sambia", "Afrika"),
    "Zimbabwe": ("Simbabwe", "Afrika"),
        "Aland Islands": ("Ålandinseln", "Europa"),
    "Antigua and Barbuda": ("Antigua und Barbuda", "Nordamerika"),
    "Bahamas": ("Bahamas", "Nordamerika"),
    "Bahrain": ("Bahrain", "Asien"),
    "Barbados": ("Barbados", "Nordamerika"),
    "Greenland": ("Grönland", "Nordamerika"),
    "Cape Verde": ("Kap Verde", "Afrika"),
    "Comoros": ("Komoren", "Afrika"),
    "Cuba": ("Kuba", "Nordamerika"),
    "Cyprus": ("Zypern", "Asien"),
    "Dominica": ("Dominica", "Nordamerika"),
    "Fiji": ("Fidschi", "Ozeanien"),
    "Grenada": ("Grenada", "Nordamerika"),
    "Iceland": ("Island", "Europa"),
    "Jamaica": ("Jamaika", "Nordamerika"),
    "Japan": ("Japan", "Asien"),
    "Kiribati": ("Kiribati", "Ozeanien"),
    "Madagascar": ("Madagaskar", "Afrika"),
    "Maldives": ("Malediven", "Asien"),
    "Malta": ("Malta", "Europa"),
    "Marshall Islands": ("Marshallinseln", "Ozeanien"),
    "Mauritius": ("Mauritius", "Afrika"),
    "Federated States of Micronesia": ("Föderierte Staaten von Mikronesien", "Ozeanien"),
    "Nauru": ("Nauru", "Ozeanien"),
    "New Zealand": ("Neuseeland", "Ozeanien"),
    "Palau": ("Palau", "Ozeanien"),
    "Philippines": ("Philippinen", "Asien"),
    "Réunion": ("Réunion", "Afrika"),
    "Saint Kitts and Nevis": ("St. Kitts und Nevis", "Nordamerika"),
    "Saint Lucia": ("St. Lucia", "Nordamerika"),
    "Saint Vincent and the Grenadines": ("St. Vincent und die Grenadinen", "Nordamerika"),
    "Samoa": ("Samoa", "Ozeanien"),
    "São Tomé and Príncipe": ("São Tomé und Príncipe", "Afrika"),
    "Seychelles": ("Seychellen", "Afrika"),
    "Singapore": ("Singapur", "Asien"),
    "Solomon Islands": ("Salomonen", "Ozeanien"),
    "Gibraltar": ("Gibraltar", "Europa"),
    "Sri Lanka": ("Sri Lanka", "Asien"),
    "Republic of China": ("Taiwan", "Asien"),
    "Tonga": ("Tonga", "Ozeanien"),
    "Trinidad and Tobago": ("Trinidad und Tobago", "Nordamerika"),
    "Tuvalu": ("Tuvalu", "Ozeanien"),
    "Vanuatu": ("Vanuatu", "Ozeanien"),
}


def clean(text):
    text = text.replace("’", "'")
    text = re.sub(r"\^\[[a-z0-9]+\]\^?", "", text)
    text = re.sub(r"\[[a-z0-9]+\]", "", text)
    text = re.sub(r"\[\d+\]", "", text)
    text = text.replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_country(text):
    if "People's Republic of China" in text:
        return "People's Republic of China"

    if "Eswatini" in text:
        return "Eswatini"

    return text


def is_playable_country(cell_text):
    text = normalize_country(clean(cell_text))

    if not text:
        return None

    if "(" in text:
        return None

    lowered = text.lower()

    if any(word in lowered for word in ["including", "excluding", "kingdom of", "includes"]):
        return None

    if text in EXCLUDED:
        return None

    return text


def extract_land_neighbours(cell_text):
    text = clean(cell_text)
    text = text.replace("Eswatini (Swaziland)", "Eswatini")

    neighbours = []

    for match in re.finditer(
        r"([^()]+?)\s*(?:\([^()]*\)\s*)?\((L/M|L)\)",
        text,
    ):
        name = clean(match.group(1)).strip(" .")

        if not name or name in EXCLUDED:
            continue

        if name not in NAMES:
            print(f"  Übersetzung fehlt für Nachbar: {name}")
            continue

        neighbours.append(NAMES[name][0])

    return list(dict.fromkeys(neighbours))


class WikiTableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.table_depth = 0
        self.row = None
        self.cell = None
        self.bold = 0
        self.italic = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        css_classes = attributes.get("class", "")

        if tag == "table":
            self.table_depth += 1

            if self.table_depth == 1 and "wikitable" in css_classes:
                self.rows = []

        if self.table_depth == 0:
            return

        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = {"text": "", "bold": False}
        elif tag == "b":
            self.bold += 1
        elif tag == "i":
            self.italic += 1

    def handle_data(self, data):
        if self.cell is None:
            return

        self.cell["text"] += data

        if self.bold:
            self.cell["bold"] = True

    def handle_endtag(self, tag):
        if tag == "b":
            self.bold = max(0, self.bold - 1)
        elif tag == "i":
            self.italic = max(0, self.italic - 1)
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
        elif tag == "table":
            self.table_depth = max(0, self.table_depth - 1)


def main():
    request = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Nachbarlaender-Raetsel Datenexport)"
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")

    parser = WikiTableParser()
    parser.feed(html)

    countries = []

    for row in parser.rows:
        if len(row) < 5:
            continue

        english_name = is_playable_country(row[0]["text"])

        if not english_name:
            continue

        if not row[0]["bold"]:
            continue

        if english_name not in NAMES:
            print(f"  Übersetzung fehlt für Land: {english_name}")
            continue

        neighbours = extract_land_neighbours(row[-1]["text"])

        if not neighbours:
            continue

        german_name, continent = NAMES[english_name]

        countries.append({
            "name": german_name,
            "continent": continent,
            "neighbors": neighbours,
        })

    countries.sort(key=lambda country: country["name"])

    OUTPUT.parent.mkdir(exist_ok=True)

    OUTPUT.write_text(
        json.dumps(countries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"{len(countries)} Länder gespeichert in {OUTPUT}")


if __name__ == "__main__":
    main()