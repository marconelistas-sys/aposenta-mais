export const householdOwners = Object.freeze({ unspecified: 'Não informado', primary: 'Titular', spouse: 'Cônjuge', shared: 'Compartilhado' })
export const budgetOwnerView = { selected: 'all' }
export function householdOwnerField(selected = 'unspecified') {
  return `<label class="form-field"><span>Titularidade</span><select name="householdOwner">${Object.entries(householdOwners).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')}</select><small>Para cônjuge ou compartilhado, use data final manual. O vínculo de aposentadoria refere-se ao titular.</small></label>`
}
export function filterByHouseholdOwner(items, selected) {
  return selected === 'all' ? items : items.filter(item => (item.householdOwner || 'unspecified') === selected)
}
