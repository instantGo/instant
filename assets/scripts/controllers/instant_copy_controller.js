// Importamos la clase Controller desde Stimulus
import { Controller } from '@hotwired/stimulus'

// Exportamos la clase por defecto para que Stimulus pueda registrarla
export default class extends Controller {
  // Definimos los targets OBLIGATORIOS que deben existir en el DOM
  // placeholder: se muestra mientras el controlador no está listo
  // button: el botón que ejecuta la copia
  // Los targets opcionales (buttonText, live) se manejan con getters más abajo
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
    removeClasses: { type: String, default: '' }                           // Clases a eliminar temporalmente
  }

  // Traducciones por defecto en español e inglés
  // Incluye textos para el botón, feedback visual (success/error) y feedback accesible (livesuccess/liveerror)
  defaultTranslations = {
    es: {
      button: 'Copiar',
      success: '¡Copiado!',
      error: 'Error al copiar',
      livesuccess: 'Texto copiado al portapapeles',
      liveerror: 'Error al copiar el texto'
    },
    en: {
      button: 'Copy',
      success: 'Copied!',
      error: 'Copy failed',
      livesuccess: 'Text copied to clipboard',
      liveerror: 'Failed to copy text'
    }
  }

  // Getters para targets opcionales
  // Utilizan this.targets.find() que no lanza error si no existen
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
    // Carga las traducciones combinando las por defecto con las personalizadas
    this.translations = this._loadTranslations()
    // Determina el idioma según prioridad: frame > URL > valor del atributo
    this.lang = this._determineLanguage()
    // Resuelve de dónde se obtendrá el texto a copiar (texto directo o selector)
    this.textSource = this._resolveTextSource()
    // Actualiza el texto del botón con la traducción correspondiente
    this._updateButtonText()
    // Muestra el componente ocultando el placeholder y mostrando el botón
    this._showComponent()
    // Guarda el estado original del botón (para poder restaurarlo después del feedback)
    this._saveOriginalState()
    // Inicializa el timeout como nulo
    this.timeoutId = null

    // Escucha el evento de Turbo antes de guardar la página en caché para limpiar el estado
    document.addEventListener('turbo:before-cache', this.beforeCache)
  }

  // Se ejecuta cuando el controlador se desconecta del DOM (ej: al cambiar de página con Turbo)
  disconnect() {
    // Si hay un timeout activo, lo cancela
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    // Elimina el listener de Turbo
    document.removeEventListener('turbo:before-cache', this.beforeCache)
    // Restaura el estado original del botón (por si acaso)
    this._restoreOriginalState()
  }

  // Función que se ejecuta antes de que Turbo guarde la página en caché
  beforeCache = () => {
    // Limpia el timeout si existe
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    // Restaura el estado original
    this._restoreOriginalState()
  }

  // Método principal: copia el texto al portapapeles
  copy() {
    // Obtiene el texto a copiar según la fuente configurada
    const textToCopy = this._getTextToCopy()
    // Si no hay texto, muestra feedback de error y termina
    if (!textToCopy) {
      this._showFeedback('error')
      return
    }

    // Verifica si la API clipboard está disponible
    if (!navigator.clipboard) {
      console.error('API clipboard no disponible')
      this._showFeedback('error')
      return
    }

    // Intenta copiar el texto y muestra el feedback correspondiente
    navigator.clipboard.writeText(textToCopy)
      .then(() => this._showFeedback('success'))
      .catch(() => this._showFeedback('error'))
  }

  // Carga las traducciones combinando las por defecto con las personalizadas
  _loadTranslations() {
    try {
      // Intenta parsear el JSON de traducciones personalizadas
      const custom = JSON.parse(this.translationsValue)
      // Combina las traducciones: primero las por defecto, luego las personalizadas por idioma
      return {
        es: { ...this.defaultTranslations.es, ...custom.es },
        en: { ...this.defaultTranslations.en, ...custom.en },
        ...custom  // También permite añadir otros idiomas directamente
      }
    } catch {
      // Si hay error en el JSON, usa las traducciones por defecto
      return this.defaultTranslations
    }
  }

  // Determina el idioma a usar según prioridad:
  // 1. Parámetro 'lang' en la URL del turbo-frame que contiene el controlador
  // 2. Parámetro 'lang' en la URL de la página
  // 3. Valor del atributo data-lang (this.langValue)
  _determineLanguage() {
    const frameParams = this._getFrameParams()
    if (frameParams.has('lang')) return frameParams.get('lang')

    const pageParams = new URLSearchParams(window.location.search)
    if (pageParams.has('lang')) return pageParams.get('lang')

    return this.langValue
  }

  // Obtiene los parámetros de la URL del turbo-frame que contiene al controlador (si existe)
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

  // Resuelve la fuente del texto a copiar, con prioridad:
  // 1. Parámetro 'target' en la URL del frame
  // 2. Valor del atributo data-text
  // 3. Valor del atributo data-target
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

  // Obtiene el texto a copiar según la fuente resuelta
  _getTextToCopy() {
    if (!this.textSource?.value) return null

    // Si la fuente es texto directo, lo devuelve
    if (this.textSource.type === 'text') {
      return this.textSource.value
    }

    // Si es un selector, busca el elemento en el DOM
    const element = document.querySelector(this.textSource.value)
    if (!element) return null

    // Si es un campo de formulario, devuelve su value
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      return element.value
    }
    // En otro caso, devuelve el texto interno
    return element.innerText || element.textContent
  }

  // Actualiza el texto del botón con la traducción 'button' del idioma actual
  _updateButtonText() {
    const buttonTextEl = this.buttonTextTarget
    if (buttonTextEl) {
      const t = this.translations[this.lang] || this.defaultTranslations.es
      buttonTextEl.textContent = t.button
    }
  }

  // Oculta el placeholder y muestra el botón
  _showComponent() {
    this.placeholderTarget?.classList.add('d-none')
    this.buttonTarget?.classList.remove('d-none')
  }

  // Guarda el estado original del botón (clases del icono, texto, clases del botón)
  // para poder restaurarlo después del feedback
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

  // Restaura el estado original del botón y limpia la región live
  _restoreOriginalState() {
    if (this.hasButtonTarget && this.original) {
      const icon = this.buttonTarget.querySelector('i')
      if (icon) icon.className = this.original.iconClass
      const buttonTextEl = this.buttonTextTarget
      if (buttonTextEl) buttonTextEl.textContent = this.original.buttonText
      this.buttonTarget.className = this.original.buttonClass
    }

    // Limpia el contenido de la región live si existe
    const liveEl = this.liveTarget
    if (liveEl) {
      liveEl.textContent = ''
    }
  }

  // Muestra el feedback visual y accesible (éxito o error)
  _showFeedback(type = 'success') {
    if (!this.hasButtonTarget) return

    // Si hay un timeout anterior pendiente, lo cancela y restaura el estado
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this._restoreOriginalState()
    }

    // Guarda el estado actual antes de modificarlo
    this._saveOriginalState()

    const t = this.translations[this.lang] || this.defaultTranslations.es
    const isSuccess = type === 'success'

    // Cambia el icono si existe
    const icon = this.buttonTarget.querySelector('i')
    if (icon) {
      icon.className = `bi ${isSuccess ? this.iconSuccessValue : this.iconErrorValue}`
    }

    // Cambia el texto del botón si existe el target buttonText
    const buttonTextEl = this.buttonTextTarget
    if (buttonTextEl) {
      buttonTextEl.textContent = isSuccess ? t.success : t.error
    }

    // Elimina las clases indicadas en removeClassesValue (temporalmente)
    if (this.removeClassesValue) {
      const clasesAEliminar = this.removeClassesValue.split(' ')
      clasesAEliminar.forEach(clase => {
        if (clase && this.buttonTarget.classList.contains(clase)) {
          this.buttonTarget.classList.remove(clase)
        }
      })
    }

    // Quita las clases de feedback previas (tanto de éxito como de error)
    const feedbackClasses = [...this.successClassValue.split(' '), ...this.errorClassValue.split(' ')]
    this.buttonTarget.classList.remove(...feedbackClasses)

    // Añade las clases correspondientes al nuevo estado
    const newClasses = isSuccess ? this.successClassValue : this.errorClassValue
    this.buttonTarget.classList.add(...newClasses.split(' '))

    // Actualiza la región live si existe, con el mensaje correspondiente
    const liveEl = this.liveTarget
    if (liveEl) {
      const liveMessage = isSuccess ? t.livesuccess : t.liveerror
      liveEl.textContent = liveMessage
    }

    // Programa la restauración del estado después de 2 segundos
    this.timeoutId = setTimeout(() => {
      this._restoreOriginalState()
      this.timeoutId = null
    }, 2000)
  }
}
