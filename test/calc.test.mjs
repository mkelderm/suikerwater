// Tests voor het rekenhart. Draaien met:   node test/calc.test.mjs
//
// De verwachte waarden hieronder zijn NIET uit calc.js overgenomen, maar los uit de
// spreadsheetformules herleid. Een test die de implementatie naschrijft bewijst niets.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculate, parseNumber, formatNumber, DEFAULTS } from '../web/calc.js'

/** Vult de standaardwaarden aan, zodat een test alleen hoeft te noemen wat afwijkt. */
const input = (over = {}) => ({ ...DEFAULTS, ...over })

/** Vergelijkt met wat een double nog kan onderscheiden; geen losse tolerantie. */
const near = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${msg ?? ''} verwacht ${expected}, kreeg ${actual}`
  )

test('gouden testvector uit de spreadsheet (8 g/L, 0,33 L, 30 L)', () => {
  const r = calculate(input())

  assert.equal(r.status, 'ok')
  near(r.sugarPerInjection, 2.64, 'suiker per injectie D7')
  near(r.densityInverse, 0.630119722747322, 'dichtheid omgekeerd D9')
  near(r.waterPerInjection, 3.33648393194707, 'water per injectie D10')
  near(r.bottles, 30 / 0.33, 'aantal flessen D4/D3')
  near(r.water, 303.3167210860973, 'benodigd water D12')
  near(r.sugar, 240, 'benodigd suiker D13')
  near(r.total, 543.3167210860972, 'totaal D14')

  // Dit is wat de sheet op het scherm zet.
  assert.equal(formatNumber(r.water, 0), '303')
  assert.equal(formatNumber(r.sugar, 0), '240')
  assert.equal(formatNumber(r.total, 0), '543')
})

test('aantal flessen blijft een breuk en wordt niet afgerond', () => {
  const r = calculate(input())
  // 30 / 0,33 is 90,909..., niet 90 en niet 91. Afronden hier zou de sheet tegenspreken.
  assert.notEqual(r.bottles, 90)
  assert.notEqual(r.bottles, 91)
  near(r.bottles, 90.9090909090909)

  // Met 91 flessen zou de suiker op 240,24 uitkomen in plaats van exact 240.
  near(r.sugar, 240)
})

test('de formules zijn onderling consistent', () => {
  const r = calculate(input({ sugarPerLitre: 6.5, bottleVolume: 0.5, batchVolume: 19 }))
  near(r.water + r.sugar, r.total, 'totaal is de som')
  near(r.sugar, r.bottles * r.sugarPerInjection, 'suiker = flessen x per injectie')
  near(r.water, r.bottles * r.waterPerInjection, 'water = flessen x per injectie')
  // De spuit is per injectie vol: water + het volume van de opgeloste suiker.
  near(r.waterPerInjection + r.sugarPerInjection / DEFAULTS.sugarDensity, DEFAULTS.syringeVolume)
})

test('tweede en derde onafhankelijk doorgerekende vector', () => {
  // 7 g/L, halve-literflessen, 20 L -> 40 flessen, 3,5 g suiker per fles.
  // water/injectie = 5 - 3,5/1,587 = 2,794580970384373
  const a = calculate(input({ sugarPerLitre: 7, bottleVolume: 0.5, batchVolume: 20 }))
  near(a.bottles, 40)
  near(a.sugarPerInjection, 3.5)
  near(a.waterPerInjection, 2.794580970384373)
  near(a.water, 111.78323881537493)
  near(a.sugar, 140)
  near(a.total, 251.78323881537494)

  // 6 g/L, 0,75 L, 25 L -> 33,333... flessen, 4,5 g suiker per fles.
  const b = calculate(input({ sugarPerLitre: 6, bottleVolume: 0.75, batchVolume: 25 }))
  near(b.bottles, 33.333333333333336)
  near(b.sugarPerInjection, 4.5)
  near(b.waterPerInjection, 2.164461247637051)
  near(b.water, 72.14870825456838)
  near(b.sugar, 150)
})

test('afwijkende spuitinhoud en afwijkende suikersoort', () => {
  // Grotere spuit: alleen het water per injectie verschuift, de suiker niet.
  const big = calculate(input({ syringeVolume: 10 }))
  near(big.sugar, 240, 'suiker is onafhankelijk van de spuit')
  near(big.waterPerInjection, 10 - 2.64 * (1 / 1.587))
  near(big.water, (30 / 0.33) * (10 - 2.64 / 1.587))

  // Andere dichtheid (bv. een andere suikersoort) verandert alleen het water.
  const honey = calculate(input({ syringeVolume: 10, sugarDensity: 1.42 }))
  near(honey.densityInverse, 1 / 1.42)
  near(honey.sugar, 240, 'suiker is onafhankelijk van de dichtheid')
  near(honey.water, 740.0768245838668)
})

test('randgeval: de suiker vult de spuit al helemaal', () => {
  // 11 g/L in flessen van 0,75 L = 8,25 g suiker = 5,2 ml. Dat past niet in 5 ml.
  // De sheet rekent hier stil door naar negatief water; wij markeren het.
  const r = calculate(input({ sugarPerLitre: 11, bottleVolume: 0.75, batchVolume: 20 }))
  assert.equal(r.status, 'sugarExceedsSyringe')
  assert.ok(r.waterPerInjection < 0, 'water per injectie is negatief')
  near(r.waterPerInjection, -0.19848771266540588)
  // De suiker zelf blijft wel correct, die mag de interface gewoon tonen.
  near(r.sugar, 220)
})

test('randgeval: precies op de grens is water exact nul en nog geldig', () => {
  // Zoveel suiker per liter dat de suiker de spuit exact vult.
  const S = (DEFAULTS.syringeVolume * DEFAULTS.sugarDensity) / DEFAULTS.bottleVolume
  const r = calculate(input({ sugarPerLitre: S }))
  near(r.waterPerInjection, 0)
  assert.equal(r.status, 'ok', 'exact nul water is geen fout')
  assert.equal(formatNumber(r.water, 0), '0', 'en zeker niet "-0"')
})

test('ongeldige invoer geeft een status in plaats van NaN of Infinity', () => {
  // Flesvolume 0 zou 30/0 = Infinity flessen geven en daarmee NaN suiker.
  assert.equal(calculate(input({ bottleVolume: 0 })).status, 'invalidBottle')
  assert.equal(calculate(input({ syringeVolume: 0 })).status, 'invalidSyringe')
  assert.equal(calculate(input({ sugarDensity: 0 })).status, 'invalidDensity')

  for (const field of Object.keys(DEFAULTS)) {
    assert.equal(calculate(input({ [field]: null })).status, 'incomplete', field)
  }
  assert.equal(calculate({}).status, 'incomplete')
  assert.equal(calculate(undefined).status, 'incomplete')
})

test('nul suiker of nul volume levert een geldige, lege uitkomst', () => {
  const noSugar = calculate(input({ sugarPerLitre: 0 }))
  assert.equal(noSugar.status, 'ok')
  near(noSugar.sugar, 0)
  near(noSugar.waterPerInjection, 5, 'zonder suiker is de spuit puur water')

  const noBatch = calculate(input({ batchVolume: 0 }))
  assert.equal(noBatch.status, 'ok')
  near(noBatch.bottles, 0)
  near(noBatch.water, 0)
  near(noBatch.total, 0)
})

test('parseNumber accepteert komma en punt', () => {
  assert.equal(parseNumber('0,33'), 0.33)
  assert.equal(parseNumber('0.33'), 0.33)
  assert.equal(parseNumber('  0,33  '), 0.33, 'witruimte eromheen mag')
  assert.equal(parseNumber('8'), 8)
  assert.equal(parseNumber('1,587'), 1.587)
  assert.equal(parseNumber(',5'), 0.5)
  assert.equal(parseNumber('33,'), 33)
  assert.equal(parseNumber('0'), 0, 'nul is een geldige waarde, niet leeg')
  assert.equal(parseNumber(30), 30, 'een echt getal mag ook')
})

test('parseNumber weigert alles wat tot NaN zou leiden', () => {
  for (const bad of [
    '', '   ', ',', '.', '-', '-5', '-0,5', '0,,33', '0..33', '1,2,3',
    '1e3', '1E3', 'acht', '0,33 L', '0 33', '8g', '+8', 'Infinity', 'NaN',
    null, undefined, NaN, Infinity, -Infinity, -1, {}, [], true,
  ]) {
    assert.equal(parseNumber(bad), null, `${JSON.stringify(bad)} had geweigerd moeten worden`)
  }
})

test('formatNumber gebruikt de Nederlandse komma', () => {
  assert.equal(formatNumber(3.33648393194707, 2), '3,34')
  assert.equal(formatNumber(2.64, 2), '2,64')
  assert.equal(formatNumber(303.3167210860973, 0), '303')
  assert.equal(formatNumber(0, 0), '0')
  assert.equal(formatNumber(-0, 0), '0', 'geen "-0" op het scherm')
  assert.equal(formatNumber(NaN, 0), '–')
  assert.equal(formatNumber(Infinity, 0), '–')
  assert.equal(formatNumber(undefined, 0), '–')
})

test('invoer uit de velden leidt tot dezelfde uitkomst als de sheet', () => {
  // Zoals de app het doet: ruwe tekst uit de velden, dan parsen, dan rekenen.
  const typed = { sugarPerLitre: '8', bottleVolume: '0,33', batchVolume: '30', syringeVolume: '5', sugarDensity: '1,587' }
  const parsed = Object.fromEntries(Object.entries(typed).map(([k, v]) => [k, parseNumber(v)]))
  const r = calculate(parsed)

  assert.equal(r.status, 'ok')
  assert.equal(formatNumber(r.water, 0), '303')
  assert.equal(formatNumber(r.sugar, 0), '240')
  assert.equal(formatNumber(r.total, 0), '543')
})
