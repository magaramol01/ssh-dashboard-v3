import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanLatexMath } from '../../app/lib/utils'

test('cleanLatexMath converts CO2 LaTeX formulas to clean unicode CO₂', () => {
  assert.equal(cleanLatexMath('Direct $\\text{CO}_2$ Emissions'), 'Direct CO₂ Emissions')
  assert.equal(cleanLatexMath('+ 135.8 MT $\\text{CO}_2$'), '+ 135.8 MT CO₂')
  assert.equal(cleanLatexMath('Added $\\text{CO}_2$ (MT)'), 'Added CO₂ (MT)')
  assert.equal(cleanLatexMath('(+ 13.84 MT $\\text{CO}_2$)'), '(+ 13.84 MT CO₂)')
  assert.equal(cleanLatexMath('$\\text{CO}_{2}$'), 'CO₂')
  assert.equal(cleanLatexMath('$CO_2$'), 'CO₂')
})

test('cleanLatexMath converts comparison and directional operators', () => {
  assert.equal(cleanLatexMath('Heavy Weather Days (BF $\\ge 6$)'), 'Heavy Weather Days (BF ≥ 6)')
  assert.equal(cleanLatexMath('3. Heavy Weather Days Breakdown (Beaufort $\\ge 6$)'), '3. Heavy Weather Days Breakdown (Beaufort ≥ 6)')
  assert.equal(cleanLatexMath('hydrodynamic range of $\\le 10\\%$'), 'hydrodynamic range of ≤ 10%')
  assert.equal(cleanLatexMath('waves $\\rightarrow$ SOG down to 7.5 kts'), 'waves → SOG down to 7.5 kts')
  assert.equal(cleanLatexMath('$\\to$'), '→')
  assert.equal(cleanLatexMath('$\\approx 5.2$'), '≈ 5.2')
})

test('cleanLatexMath strips percentage delimiters and negative ranges properly', () => {
  assert.equal(
    cleanLatexMath('slip stabilized between $-3.7\\%$ and $+6.0\\%$'),
    'slip stabilized between -3.7% and +6.0%'
  )
})

test('cleanLatexMath preserves standard currency notations', () => {
  assert.equal(cleanLatexMath('Fuel price is $650 per MT'), 'Fuel price is $650 per MT')
  assert.equal(cleanLatexMath('Cost ranges between $100 and $200'), 'Cost ranges between $100 and $200')
})
