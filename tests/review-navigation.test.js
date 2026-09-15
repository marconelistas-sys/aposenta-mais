import test from 'node:test'
import assert from 'node:assert/strict'
import { openReviewTarget } from '../src/app/review-navigation.js'
import { investmentReviewLink, budgetReviewLink, fieldReviewLink } from '../src/domain/review-targets.js'

function fixture() {
  const visits = []
  const root = {}
  const details = { tagName: 'DETAILS', open: false, parentElement: root }
  const target = { name: 'investmentReleaseYear', parentElement: details, focus: () => visits.push('focus'), scrollIntoView: () => visits.push('scroll') }
  const original = { open: false }
  const record = { ...target, querySelector: () => original }
  const editor = { querySelectorAll: () => [target] }
  const buttons = [{ dataset: { editInvestment: 'other' }, click: () => visits.push('wrong') }, { dataset: { editInvestment: 'finapp:initial_assets:3' }, click: () => visits.push('edit') }]
  root.querySelectorAll = selector => selector === '[data-edit-investment]' ? buttons : [target]
  root.querySelector = selector => selector === '#migration-pending-initial_assets-3' ? record : selector.startsWith('#') ? null : editor
  return { root, target, details, visits, original }
}

test('investment review opens the exact editor and focuses release year', () => {
  const view = fixture()
  assert.equal(openReviewTarget(view.root, investmentReviewLink('finapp:initial_assets:3', 'investmentReleaseYear')), true)
  assert.deepEqual(view.visits, ['edit', 'focus', 'scroll'])
  assert.equal(view.details.open, true)
})

test('budget link opens by id even without an item in the filtered list', () => {
  const view = fixture()
  view.target.name = 'startDate'
  assert.equal(openReviewTarget(view.root, budgetReviewLink('hidden-by-filter'), { openBudget: id => view.visits.push(id) }), true)
  assert.deepEqual(view.visits, ['hidden-by-filter', 'focus', 'scroll'])
})

test('premise links expand disclosure and migration links expose original evidence', () => {
  const view = fixture()
  view.target.name = 'taxRegime'
  assert.equal(openReviewTarget(view.root, fieldReviewLink('/viabilidade', 'taxRegime')), true)
  assert.equal(view.details.open, true)
  assert.equal(openReviewTarget(view.root, '/perfil#migration-pending-initial_assets-3'), true)
  assert.equal(view.original.open, true)
})

test('privacy and unsupported targets do not open editors and missing records report the problem', () => {
  const view = fixture(), messages = []
  const link = investmentReviewLink('finapp:initial_assets:3', 'investmentReleaseYear')
  assert.equal(openReviewTarget(view.root, link, { hidden: true }), false)
  assert.equal(openReviewTarget(view.root, '/carteira?review=field&field=password'), false)
  assert.equal(openReviewTarget(view.root, '/perfil#invalid'), false)
  assert.deepEqual(view.visits, [])
  assert.equal(openReviewTarget(view.root, investmentReviewLink('deleted'), { onMissing: message => messages.push(message) }), false)
  assert.match(messages[0], /não está mais no cadastro/)
})
