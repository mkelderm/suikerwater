# Suikerwater

Rekent uit hoeveel **suiker** en hoeveel **water** je moet oplossen om een batch
bier te bottelen met een repeteer-doseerspuit. Je vult drie velden in, het
antwoord staat er meteen — geen knop om op te drukken.

Het rekenmodel komt uit de spreadsheet *Suikerwater berekenen bottelen
repeteerspuit v1.0* van HobbyBrouwShop.nl.

Er zijn twee vormen, met precies dezelfde code:

- een **Android-app** (APK) die je zelf installeert, en
- een **webversie** die in elke browser werkt en die je ook op je beginscherm
  kunt zetten.

Beide werken volledig zonder internet.

---

## Hoe je hem gebruikt

| Veld | Wat je invult | Standaard |
| --- | --- | --- |
| **Bottelsuiker** | gram suiker per liter bier; meer suiker is meer koolzuur | 8 g/L |
| **Volume fles** | inhoud van één fles in liter | 0,33 L |
| **Te bottelen** | hoeveel liter bier je gaat bottelen | 30 L |

Onder *Spuit en suikersoort* staan nog twee waarden die normaal gelijk blijven:
de inhoud van de doseerspuit (5 ml) en de dichtheid van de suiker (1,587 g/mL
voor kristalsuiker).

Je invoer wordt bewaard, dus bij de volgende brouwdag staat alles er nog.

Komma's en punten mogen beide: `0,33` en `0.33` werken.

---

## Het rekenmodel

De cellen verwijzen naar de oorspronkelijke spreadsheet, zodat je kunt
natrekken dat er niets is veranderd.

```
Invoer       S = bottelsuiker g/L        (D2)
             V = volume fles L           (D3)
             T = te bottelen L           (D4)
Instelling   P = inhoud spuit ml         (D6)
             D = dichtheid suiker g/mL   (D8)

D7   suiker per injectie  = S × V
D9   dichtheid omgekeerd  = 1 / D
D10  water per injectie   = P − (D7 × D9)
D12  benodigd water       = (T / V) × D10
D13  benodigde suiker     = (T / V) × D7
D14  totaal suikerwater   = D12 + D13
```

Met de standaardwaarden (8 g/L, 0,33 L, 30 L) geeft dat **303 g water**,
**240 g suiker**, samen **543 g** — precies wat de spreadsheet laat zien.

### Twee dingen die er bewust zo in zitten

**Het aantal flessen wordt niet afgerond.** `T / V` is met 30 L en 0,33 L
gelijk aan 90,909…, en dat getal gaat als breuk door de berekening. De
spreadsheet doet het net zo, met de toelichting *"reken ruim zodat je nooit te
weinig hebt"*. Rond je af op 90, dan maak je te weinig suikerwater. Het aantal
flessen dat de app **toont** is wel afgerond, naar boven — je kunt geen 90,9
flessen vullen, en een restje is beter dan tekortkomen.

**Water staat in gram, niet in milliliter.** De formule rekent in ml; de
spreadsheet noemt de uitkomst gram. Dat is de aanname water = 1 g/ml, en die is
voor dit doel prima. Het staat ook in de voettekst van de app.

### Twee dingen die de app wel afvangt en de spreadsheet niet

- **Volume fles = 0** geeft in de spreadsheet een deling door nul. De app zegt
  dat het volume groter dan nul moet zijn.
- **Te veel suiker voor de spuit.** Bij 11 g/L in flessen van 0,75 L moet er
  8,25 g suiker per fles in, en die neemt zelf al 5,20 ml in. In een spuit van
  5 ml past dat niet. De spreadsheet rekent gewoon door en komt op **−5 g
  water** uit. De app weigert dat getal te laten zien en vertelt waarom: neem
  een grotere spuit, minder suiker per liter, of kleinere flessen.

---

## Op je telefoon zetten

### De Android-app

1. Open op je telefoon in Chrome de
   [laatste release](https://github.com/mkelderm/suikerwater/releases/latest).
2. Tik onder *Assets* op **suikerwater-x.y.z.apk**.
3. Android vraagt of Chrome apps mag installeren. Tik op **Instellingen**, zet
   *Toestaan van deze bron* aan en ga terug.
4. Tik op **Installeren**.

Bijwerken gaat net zo: download de nieuwe APK en installeer hem over de oude
heen. Je invoer blijft staan.

De app vraagt geen enkele permissie, ook geen internet. Alle bestanden zitten in
de APK zelf.

> Play Protect kan waarschuwen dat de app onbekend is. Dat klopt: hij komt niet
> uit de Play Store. Kies *Toch installeren*.

### De webversie

Op [mkelderm.github.io/suikerwater](https://mkelderm.github.io/suikerwater/).
Open dat adres in Chrome op je telefoon, tik op de drie puntjes rechts boven en
kies **Toevoegen aan startscherm**. Daarna werkt hij ook zonder bereik.

### Snel uitproberen over je eigen wifi

Op de computer, in deze map:

```bash
node tools/dev-server.mjs
```

De server noemt bij het starten de adressen waarop hij te bereiken is, zoiets
als `http://192.168.1.23:8787`. Dat adres typ je in Chrome op je telefoon,
mits telefoon en computer op dezelfde wifi zitten. Offline werkt dit niet:
Chrome staat een service worker alleen toe op https of op localhost.

---

## Een nieuwe versie uitbrengen

Alles gaat via GitHub. Commit en push je wijzigingen naar `main`, en geef de
versie daarna een tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

De workflow *Android* bouwt dan de ondertekende APK en zet hem als release op
GitHub, met de installatie-instructies erbij. Zonder tag krijg je bij elke push
alleen een **testbuild**: die staat als artefact bij de run in het tabblad
*Actions*, heet op je telefoon *Suikerwater (test)* en komt naast de echte app
te staan in plaats van eroverheen.

Het versienummer moet steeds omhoog, anders weigert Android de update.
`v1.2.3` wordt intern versiecode 10203, dus minor en patch gaan tot en met 99.

De webversie op GitHub Pages wordt bij elke push naar `main` vanzelf bijgewerkt.

### De ondertekensleutel

Android installeert een update alleen als die met **dezelfde sleutel** is
ondertekend als de versie die er al op staat. Die sleutel staat op de pc waar hij
gemaakt is, in de map `.suikerwater-signing` in je gebruikersmap — het
sleutelbestand en het wachtwoord — en als geheimen in de repository (*Settings →
Secrets and variables → Actions*):

| Geheim | |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | het sleutelbestand, base64 |
| `ANDROID_KEYSTORE_PASSWORD` | wachtwoord van het bestand |
| `ANDROID_KEY_ALIAS` | `suikerwater` |
| `ANDROID_KEY_PASSWORD` | gelijk aan het wachtwoord van het bestand |

**Maak een reservekopie van die map**, bijvoorbeeld in je wachtwoordbeheerder.
Ben je de sleutel kwijt, dan kun je geen updates meer uitbrengen: dan moet je de
app op je telefoon verwijderen en opnieuw installeren, en ben je je bewaarde
invoer kwijt.

De sleutel komt nooit in de repository; `.gitignore` houdt `*.p12`, `*.jks` en
`*.keystore` buiten de deur. De enige uitzondering is
`android/app/test.keystore`: een openbare sleutel, alleen voor testbuilds, zodat
die elkaar kunnen bijwerken. Daarmee kun je de echte app niet ondertekenen.

---

## De berekening testen

```bash
node test/calc.test.mjs
```

Dertien tests. De verwachte uitkomsten zijn apart uit de spreadsheetformules
afgeleid en niet uit `calc.js` overgenomen — anders zou een fout in de code
zichzelf goedkeuren. Ze dekken de standaardwaarden, drie andere combinaties,
een afwijkende spuit en suikersoort, het geval waarin de suiker niet in de
spuit past, de grens waarop het water precies nul is, en alles wat je in een
veld kunt typen dat geen getal is.

De workflow draait deze tests vóór elke build; faalt er één, dan komt er geen
APK.

---

## Hoe het in elkaar zit

Gewone HTML, CSS en JavaScript. Geen build, geen framework, niets dat van
buiten wordt opgehaald — dat laatste zou offline gebruik juist stukmaken.

| Map / bestand | |
| --- | --- |
| `web/` | **de app zelf**; dit is wat de browser laadt en wat in de APK zit |
| `web/calc.js` | de berekening, zonder browser-afhankelijkheden |
| `web/app.js` | velden lezen, uitkomst tekenen, invoer bewaren |
| `web/sw.js` | service worker, maakt de webversie offline bruikbaar |
| `web/logo.png` | het MAD-wapen rechts boven in de kop |
| `android/` | het Android-project dat `web/` in een app verpakt |
| `test/calc.test.mjs` | de tests |
| `tools/dev-server.mjs` | lokale server om te testen |
| `tools/make-icons.mjs` | tekent alle iconen, voor web en Android; `node tools/make-icons.mjs` |
| `.github/workflows/` | bouwen, releasen en de webversie publiceren |

De berekening staat apart in `calc.js` en raakt niets van de browser. Daarom
kan Node hem importeren en kunnen de tests precies dezelfde code controleren
als die in de app draait.

`web/logo.png` is een onbewerkte kopie van het originele wapen,
`schild-tranparant.png`. Het bestand heeft
rondom een transparante rand — het schild vult 78% van de breedte en 67% van de
hoogte — en die rand wordt in `app.css` met negatieve marges uit de opmaak
gehaald. Het plaatje zelf is niet aangepast.

### De Android-app

Geen tweede versie van de app, maar een verpakking om dezelfde bestanden heen.
Gradle neemt `web/` bij het bouwen ongewijzigd op in de APK, en de app toont die
in een WebView. Een wijziging in `web/` zit dus bij de volgende build vanzelf
ook in de Android-app.

De bestanden worden uitgeleverd via een vast `https://`-adres binnen de app, dat
nooit het netwerk op gaat. Het moet https zijn en geen `file://`: alleen dan
laden de JavaScript-modules en werkt het bewaren van je invoer. Licht of donker
volgt de instelling van je telefoon, net als in de browser.

### Een wijziging doorvoeren in de webversie

De service worker levert eerst uit de cache en haalt daarna op de achtergrond
de nieuwe versie op. Een aanpassing is dus bij de **volgende** keer opstarten
te zien, niet direct bij herladen. Wil je dat forceren, verhoog dan `VERSION`
in `web/sw.js`; dan wordt de oude cache in één keer weggegooid. De Android-app
heeft hier geen last van: die gebruikt geen service worker.

### Zelf de APK bouwen

Hoeft niet — GitHub doet dat — maar het kan. Je hebt Java 21 en de Android SDK
nodig, met `ANDROID_HOME` naar de SDK:

```bash
cd android
./gradlew assembleDebug
```

De APK staat daarna in `android/app/build/outputs/apk/debug/`.

---

Rekenmodel: HobbyBrouwShop.nl. Water is in gram, uitgaande van 1 g per ml.
