// Rekenhart van de Suikerwater-app.
//
// Dit bestand bevat uitsluitend pure functies en raakt geen enkele browser-API aan,
// zodat test/calc.test.mjs het met Node kan importeren en doorrekenen.
//
// De formules komen cel-voor-cel uit Suikerwater_berekenen_bottelen_repeteerspuit_v1.0.xlsx
// van HobbyBrouwShop.nl:
//
//   D7  suiker per injectie  = D2 * D3
//   D9  dichtheid omgekeerd  = 1 / D8
//   D10 water per injectie   = D6 - (D7 * D9)
//   D12 benodigd water       = (D4 / D3) * D10
//   D13 benodigd suiker      = (D4 / D3) * D7
//   D14 totaal               = D12 + D13

/** Standaardwaarden. De eerste drie zijn voorbeelden, de laatste twee echte constanten. */
export const DEFAULTS = Object.freeze({
  sugarPerLitre: 8, //      S  g/L    cel D2
  bottleVolume: 0.33, //    V  L      cel D3
  batchVolume: 30, //       T  L      cel D4
  syringeVolume: 5, //      P  ml     cel D6
  sugarDensity: 1.587, //   D  g/mL   cel D8
})

/** De velden in de volgorde waarin ze in de interface staan. */
export const FIELDS = Object.freeze(Object.keys(DEFAULTS))

/**
 * Leest een door de gebruiker getypt getal.
 *
 * Accepteert zowel de Nederlandse komma ("0,33") als de punt ("0.33"), en negeert
 * omringende witruimte. Weigert bewust alles wat verder tot verwarring leidt: een
 * minteken, wetenschappelijke notatie, losse scheidingstekens en elke andere tekst.
 * Dat weigeren is wat voorkomt dat er ooit NaN op het scherm belandt.
 *
 * @returns {number|null} het getal, of null als er niets bruikbaars staat
 */
export function parseNumber(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null
  }
  if (typeof raw !== 'string') return null

  const cleaned = raw.trim().replace(/,/g, '.')
  // Alleen "12", "12.", "12.5" en ".5" zijn geldig. Zo vallen "", ".", "1e3",
  // "-5", "0..33" en "0.33 L" er allemaal buiten.
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null

  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * Rekent het suikerwater door.
 *
 * @param {{sugarPerLitre:number, bottleVolume:number, batchVolume:number,
 *          syringeVolume:number, sugarDensity:number}} input
 * @returns {object} een resultaat met altijd een `status`:
 *   'incomplete'          een veld is nog niet (geldig) ingevuld
 *   'invalidBottle'       flesvolume is 0 -> aantal flessen zou oneindig worden
 *   'invalidSyringe'      spuitinhoud is 0 of kleiner
 *   'invalidDensity'      dichtheid is 0 of kleiner -> 1/D bestaat niet
 *   'sugarExceedsSyringe' de suiker vult de spuit al; water zou negatief worden
 *   'ok'                  bruikbare uitkomst
 */
export function calculate(input) {
  const {
    sugarPerLitre: S,
    bottleVolume: V,
    batchVolume: T,
    syringeVolume: P,
    sugarDensity: D,
  } = input ?? {}

  const numbers = [S, V, T, P, D]
  if (!numbers.every(n => typeof n === 'number' && Number.isFinite(n))) {
    return { status: 'incomplete' }
  }
  // Deze drie zouden door nul delen of een negatieve uitkomst opleveren.
  if (V <= 0) return { status: 'invalidBottle' }
  if (P <= 0) return { status: 'invalidSyringe' }
  if (D <= 0) return { status: 'invalidDensity' }

  const densityInverse = 1 / D //                                cel D9
  const sugarPerInjection = S * V //                             cel D7
  const waterPerInjection = P - sugarPerInjection * densityInverse // cel D10

  // Niet afronden. De sheet rekent met een gebroken aantal flessen (30 / 0,33 = 90,909...)
  // zodat je per definitie iets ruim zit, precies zoals de toelichting in de sheet vraagt.
  const bottles = T / V

  const water = bottles * waterPerInjection //                   cel D12
  const sugar = bottles * sugarPerInjection //                   cel D13
  const total = water + sugar //                                 cel D14

  return {
    // De sheet rekent hier stil door en toont een negatieve waterhoeveelheid.
    // Wij geven de waarden wél terug (de suiker is immers nog correct), maar
    // markeren de situatie zodat de interface geen onmogelijk getal presenteert.
    status: waterPerInjection < 0 ? 'sugarExceedsSyringe' : 'ok',
    densityInverse,
    sugarPerInjection,
    waterPerInjection,
    bottles,
    water,
    sugar,
    total,
  }
}

const formatters = new Map()

/** Zet een getal om naar Nederlandse notatie met een vast aantal decimalen. */
export function formatNumber(value, decimals = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
  if (!formatters.has(decimals)) {
    formatters.set(
      decimals,
      new Intl.NumberFormat('nl-NL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    )
  }
  // + 0 maakt van een eventuele -0 een gewone 0, zodat er nooit "-0" verschijnt.
  return formatters.get(decimals).format(value + 0)
}
