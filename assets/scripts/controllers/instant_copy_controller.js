// Importamos la clase Controller desde Stimulus
import { Controller } from '@hotwired/stimulus'

// Exportamos la clase por defecto para que Stimulus pueda registrarla
export default class extends Controller {
  // Definimos los targets OBLIGATORIOS que deben existir en el DOM
  static targets = ['placeholder', 'button']
  
  // Definimos los valores estáticos que podemos pasar desde el HTML mediante atributos data-
  static values = {
    text: String,                // Texto directo a copiar (opcional)
    target: String,               // Selector CSS del elemento del que copiar texto (opcional)
    lang: { type: String, default: 'es' },  // Idioma por defecto: español
    translations: { type: String, default: '{}' }, // Traducciones personalizadas en JSON
    successClass: { type: String, default: 'text-success bg-opacity-10' }, // Clases para éxito
    errorClass: { type: String, default: 'text-danger bg-opacity-10' },    // Clases para error
    iconSuccess: { type: String, default: 'bi-check-circle-fill' },        // Icono de éxito
    iconError: { type: String, default: 'bi-exclamation-triangle-fill' },  // Icono de error
    removeClasses: { type: String, default: '' },                          // Clases a eliminar temporalmente
    ariaLabelEnabled: { type: Boolean, default: false }                    // Si se debe aplicar aria-label al botón
  }

  // Traducciones por defecto en español e inglés
  // Incluye textos para el botón, feedback visual, feedback accesible y aria-label
  defaultTranslations = {
    es: {
      button: 'Copiar',
      success: '¡Copiado!',
      error: 'Error al copiar',
      livesuccess: 'Texto copiado al portapapeles',
      liveerror: 'Error al copiar el texto',
      arialabel: 'Copiar al portapapeles'
    },
    en: {
      button: 'Copy',
      success: 'Copied!',
      error: 'Copy failed',
      livesuccess: 'Text copied to clipboard',
      liveerror: 'Failed to copy text',
      arialabel: 'Copy to clipboard'
    }
  }

  // Getters para targets opcionales
  get buttonTextTarget() {
    return this.targets.find('buttonText')
  }

  get hasButtonTextTarget() {
    return this.targets.has('buttonText')
  }

  get liveTarget() {
    return this.targets.find('live')
  }

  get hasLiveTarget() {
    return this.targets.has('live')
  }

  // Se ejecuta automáticamente cuando el controlador se conecta al DOM
  connect() {
    this.translations = this._loadTranslations()
    this.lang = this._determineLanguage()
    this.textSource = this._resolveTextSource()
    this._updateButtonText()
    this._updateAriaLabel()               // Aplica aria-label si está habilitado
    this._showComponent()
    this._saveOriginalState()
    this.timeoutId = null

    document.addEventListener('turbo:before-cache', this.beforeCache)
  }

  disconnect() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    document.removeEventListener('turbo:before-cache', this.beforeCache)
    this._restoreOriginalState()
  }

  beforeCache = () => {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this._restoreOriginalState()
  }

  copy() {
    const textToCopy = this._getTextToCopy()
    if (!textToCopy) {
      this._showFeedback('error')
      return
    }

    if (!navigator.clipboard) {
      console.error('API clipboard no disponible')
      this._showFeedback('error')
      return
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => this._showFeedback('success'))
      .catch(() => this._showFeedback('error'))
  }

  _loadTranslations() {
    try {
      const custom = JSON.parse(this.translationsValue)
      return {
        es: { ...this.defaultTranslations.es, ...custom.es },
        en: { ...this.defaultTranslations.en, ...custom.en },
        ...custom
      }
    } catch {
      return this.defaultTranslations
    }
  }

  _determineLanguage() {
    const frameParams = this._getFrameParams()
    if (frameParams.has('lang')) return frameParams.get('lang')

    const pageParams = new URLSearchParams(window.location.search)
    if (pageParams.has('lang')) return pageParams.get('lang')

    return this.langValue
  }

  _getFrameParams() {
    const frame = this.element.closest('turbo-frame')
    if (frame?.src) {
      try {
        return new URL(frame.src, window.location.origin).searchParams
      } catch {
        // Ignorar error de URL mal formada
      }
    }
    return new URLSearchParams()
  }

  _resolveTextSource() {
    const frameParams = this._getFrameParams()

    if (frameParams.has('target')) {
      return { type: 'target', value: frameParams.get('target') }
    }
    if (this.hasTextValue) {
      return { type: 'text', value: this.textValue }
    }
    if (this.hasTargetValue) {
      return { type: 'target', value: this.targetValue }
    }
    return null
  }

  _getTextToCopy() {
    if (!this.textSource?.value) return null

    if (this.textSource.type === 'text') {
      return this.textSource.value
    }

    const element = document.querySelector(this.textSource.value)
    if (!element) return null

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      return element.value
    }
    return element.innerText || element.textContent
  }

  _updateButtonText() {
    const buttonTextEl = this.buttonTextTarget
    if (buttonTextEl) {
      const t = this.translations[this.lang] || this.defaultTranslations.es
      buttonTextEl.textContent = t.button
    }
  }

  // Gestiona el atributo aria-label del botón
  _updateAriaLabel() {
    if (!this.hasButtonTarget) return

    const t = this.translations[this.lang] || this.defaultTranslations.es
    if (this.ariaLabelEnabledValue) {
      this.buttonTarget.setAttribute('aria-label', t.arialabel)
    } else {
      // Si no está habilitado, eliminamos el atributo por si acaso
      this.buttonTarget.removeAttribute('aria-label')
    }
  }

  _showComponent() {
    this.placeholderTarget?.classList.add('d-none')
    this.buttonTarget?.classList.remove('d-none')
  }

  _saveOriginalState() {
    if (!this.hasButtonTarget) return

    const icon = this.buttonTarget.querySelector('i')
    const buttonTextEl = this.buttonTextTarget
    this.original = {
      iconClass: icon ? icon.className : '',
      buttonText: buttonTextEl?.textContent || '',
      buttonClass: this.buttonTarget.className
    }
  }

  _restoreOriginalState() {
    if (this.hasButtonTarget && this.original) {
      const icon = this.buttonTarget.querySelector('i')
      if (icon) icon.className = this.original.iconClass
      const buttonTextEl = this.buttonTextTarget
      if (buttonTextEl) buttonTextEl.textContent = this.original.buttonText
      this.buttonTarget.className = this.original.buttonClass
    }

    const liveEl = this.liveTarget
    if (liveEl) {
      liveEl.textContent = ''
    }
  }

  _showFeedback(type = 'success') {
    if (!this.hasButtonTarget) return

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this._restoreOriginalState()
    }

    this._saveOriginalState()

    const t = this.translations[this.lang] || this.defaultTranslations.es
    const isSuccess = type === 'success'

    const icon = this.buttonTarget.querySelector('i')
    if (icon) {
      icon.className = `bi ${isSuccess ? this.iconSuccessValue : this.iconErrorValue}`
    }

    const buttonTextEl = this.buttonTextTarget
    if (buttonTextEl) {
      buttonTextEl.textContent = isSuccess ? t.success : t.error
    }

    if (this.removeClassesValue) {
      const clasesAEliminar = this.removeClassesValue.split(' ')
      clasesAEliminar.forEach(clase => {
        if (clase && this.buttonTarget.classList.contains(clase)) {
          this.buttonTarget.classList.remove(clase)
        }
      })
    }

    const feedbackClasses = [...this.successClassValue.split(' '), ...this.errorClassValue.split(' ')]
    this.buttonTarget.classList.remove(...feedbackClasses)

    const newClasses = isSuccess ? this.successClassValue : this.errorClassValue
    this.buttonTarget.classList.add(...newClasses.split(' '))

    const liveEl = this.liveTarget
    if (liveEl) {
      const liveMessage = isSuccess ? t.livesuccess : t.liveerror
      liveEl.textContent = liveMessage
    }

    this.timeoutId = setTimeout(() => {
      this._restoreOriginalState()
      this.timeoutId = null
    }, 2000)
  }
        }
