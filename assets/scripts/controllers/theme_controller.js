import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  static targets = ['icon']

  connect() {
    this.applyTheme()
  }

  toggle() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme')
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-bs-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    this.updateIcon()
  }

  applyTheme() {
    const savedTheme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.setAttribute('data-bs-theme', savedTheme)
    this.updateIcon()
  }

  updateIcon() {
    if (!this.hasIconTarget) return
    const theme = document.documentElement.getAttribute('data-bs-theme')
    const icon = this.iconTarget
    // Cambia la clase del icono según el tema
    icon.className = theme === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun'
  }
}
