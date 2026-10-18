// Interface van de Suikerwater-app. Alle rekenwerk zit in calc.js; dit bestand
// doet uitsluitend het lezen van de velden, het tekenen van de uitkomst en het
// bewaren van je invoer.

import { calculate, parseNumber, formatNumber, DEFAULTS, FIELDS } from './calc.js'

const STORAGE_KEY = 'suikerwater.v1'

const $ = id => document.getElementById(id)

const inputs = Object.fromEntries(FIELDS.map(name => [name, $(name)]))

const out = {
  water: $('water'),
  sugar: $('sugar'),
  total: $('total'),
  perBottleSugar: $('perBottleSugar'),
  perBottleWater: $('perBottleWater'),
  bottles: $('bottles'),
  notice: $('notice'),
  announcer: $('announcer'),
}

/** Nederlandse notatie voor een standaardwaarde, zonder nullen achteraan. */
const asTyped = value => String(value).replace('.', ',')

/** Twee decimalen, maar geen "4,00" waar gewoon "4" staat te wachten. */
const compact = value =>
  Number.isInteger(value) ? formatNumber(value, 0) : formatNumber(value, 2)

/* ─── Bewaren en terughalen ─────────────────────────────────────────────────
   localStorage kan onbeschikbaar zijn (privémodus, geblokkeerde cookies) en de
   inhoud kan door een vorige versie of handmatig bewerken bedorven zijn. In al
   die gevallen moet de app gewoon met de standaardwaarden opstarten, nooit leeg.
   ───────────────────────────────────────────────────────────────────────────── */

function load() {
  let stored = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    // Alleen een echt object is bruikbaar; een array of een los getal niet.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed
  } catch {
    stored = {}
  }

  for (const name of FIELDS) {
    const candidate = stored[name]
    // Elke bewaarde waarde moet opnieuw door de parser; anders zou bedorven
    // data alsnog als geldige invoer in het veld belanden.
    const usable = typeof candidate === 'string' && parseNumber(candidate) !== null
    inputs[name].value = usable ? candidate : asTyped(DEFAULTS[name])
  }
}

function save() {
  try {
    const data = Object.fromEntries(FIELDS.map(name => [name, inputs[name].value]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Niet kunnen bewaren is hinderlijk, maar mag het rekenen nooit blokkeren.
  }
}

/* ─── Tekenen ─────────────────────────────────────────────────────────────── */

/** Zet een waarde in een uitvoerveld, of een liggend streepje als die ontbreekt. */
function put(el, text) {
  const empty = text === null
  el.textContent = empty ? '–' : text
  if (empty) el.setAttribute('data-empty', '')
  else el.removeAttribute('data-empty')
}

function noticeFor(status, values, result, hasUnreadable) {
  switch (status) {
    case 'incomplete':
      // Een veld met onleesbare inhoud is iets anders dan een leeg veld; daar
      // helpt "vul in" niet, want er staat juist wél iets.
      return hasUnreadable
        ? 'Eén van de velden is niet te lezen. Gebruik alleen cijfers, met een komma voor de decimalen.'
        : 'Vul bottelsuiker, flesvolume en te bottelen volume in om de uitkomst te zien.'
    case 'invalidBottle':
      return 'Het volume van een fles moet groter dan nul zijn, anders is het aantal flessen niet te bepalen.'
    case 'invalidSyringe':
      return 'De inhoud van de spuit moet groter dan nul zijn.'
    case 'invalidDensity':
      return 'De dichtheid van de suiker moet groter dan nul zijn.'
    case 'sugarExceedsSyringe': {
      const sugar = formatNumber(result.sugarPerInjection, 2)
      const volume = formatNumber(result.sugarPerInjection / values.sugarDensity, 2)
      const syringe = formatNumber(values.syringeVolume, 2)
      return `Er moet ${sugar} g suiker per fles in, en die neemt zelf al ${volume} ml in. ` +
             `Dat past niet in een spuit van ${syringe} ml. Neem een grotere spuit, ` +
             `minder suiker per liter, of kleinere flessen.`
    }
    default:
      return null
  }
}

function render() {
  const values = Object.fromEntries(
    FIELDS.map(name => [name, parseNumber(inputs[name].value)])
  )

  // Een onleesbaar veld krijgt een rustige markering, zodat je ziet wáár het misgaat.
  let hasUnreadable = false
  for (const name of FIELDS) {
    const bad = inputs[name].value.trim() !== '' && values[name] === null
    if (bad) {
      hasUnreadable = true
      inputs[name].setAttribute('data-state', 'bad')
      inputs[name].setAttribute('aria-invalid', 'true')
    } else {
      inputs[name].removeAttribute('data-state')
      inputs[name].removeAttribute('aria-invalid')
    }
  }

  const result = calculate(values)
  const usable = result.status === 'ok'

  // Bij een te volle spuit is het water onmogelijk, maar de suiker wel juist.
  const showWater = usable
  const showSugar = usable || result.status === 'sugarExceedsSyringe'

  put(out.water, showWater ? formatNumber(result.water, 0) : null)
  put(out.sugar, showSugar ? formatNumber(result.sugar, 0) : null)
  put(out.total, usable ? formatNumber(result.total, 0) : null)

  put(out.perBottleSugar, showSugar ? compact(result.sugarPerInjection) : null)
  put(out.perBottleWater, usable ? compact(result.waterPerInjection) : null)
  // Hier wél afronden, en naar boven: je kunt geen 90,9 flessen vullen, en
  // tekortkomen is erger dan een restje. Het rekenwerk zelf blijft de breuk.
  put(out.bottles, usable ? formatNumber(Math.ceil(result.bottles), 0) : null)

  const message = noticeFor(result.status, values, result, hasUnreadable)
  out.notice.textContent = message ?? ''
  out.notice.hidden = message === null

  announce(
    usable
      ? `${formatNumber(result.water, 0)} gram water, ${formatNumber(result.sugar, 0)} gram suiker, ` +
        `samen ${formatNumber(result.total, 0)} gram.`
      : (message ?? '')
  )
}

/* ─── Aankondiging voor schermlezers ────────────────────────────────────────
   De uitkomst verandert bij elke toetsaanslag. Die rechtstreeks in een aria-live
   gebied zetten maakt de app onbruikbaar met een schermlezer, dus wachten we tot
   het typen even stilligt en spreken dan één samenvatting uit.
   ───────────────────────────────────────────────────────────────────────────── */

let announceTimer = 0
let lastAnnounced = ''

function announce(text) {
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    if (text === lastAnnounced) return
    lastAnnounced = text
    out.announcer.textContent = text
  }, 700)
}

/* ─── Gebeurtenissen ──────────────────────────────────────────────────────── */

for (const input of Object.values(inputs)) {
  input.addEventListener('input', () => {
    render()
    save()
  })
}

const disclosure = $('disclosure')
const advancedBody = $('advanced-body')

disclosure.addEventListener('click', () => {
  const open = disclosure.getAttribute('aria-expanded') === 'true'
  disclosure.setAttribute('aria-expanded', String(!open))
  advancedBody.hidden = open
})

$('reset').addEventListener('click', () => {
  // Alleen de twee geavanceerde waarden terug naar standaard; de drie velden
  // van je batch blijven staan, want die zijn jouw invoer.
  inputs.syringeVolume.value = asTyped(DEFAULTS.syringeVolume)
  inputs.sugarDensity.value = asTyped(DEFAULTS.sugarDensity)
  render()
  save()
})

/* ─── Start ───────────────────────────────────────────────────────────────── */

load()
render()

// Offline maken. Mislukken is niet erg: zonder service worker werkt de app nog
// steeds, alleen dan niet zonder netwerk. Op file:// is registreren onmogelijk.
//
// In de Android-app is er niets te doen: daar zitten de bestanden al in de APK
// en levert de app ze zelf uit onder dit vaste adres. Een service worker zou daar
// alleen een overbodige tweede kopie bijhouden.
const IN_ANDROID_APP = location.hostname === 'appassets.androidplatform.net'

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !IN_ANDROID_APP) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
