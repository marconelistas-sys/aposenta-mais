// A visibility barrier, not encryption or account authorization.
let opened = false
export const localLockKey = 'aposenta-plus-screen-lock-v1'
export function openLocalPlan() { opened = true }
export function closeLocalPlan() { opened = false }
export function isLocalPlanOpen() { return opened }
export function isPublicPage(path) {
  return ['/inicio', '/entrar', '/cadastro', '/recuperar-senha', '/nova-senha', '/privacidade'].includes(path)
}
export function canRenderFinancialPage(path) { return opened || isPublicPage(path) }
