import * as Turbo from "@hotwired/turbo"
import { Application } from '@hotwired/stimulus'
import * as bootstrap from 'bootstrap'
import ThemeController from 'controllers/theme_controller'
import InstantCopyController from 'controllers/instant_copy_controller'

const application = Application.start()
application.register('theme', ThemeController)
application.register('instant-copy', InstantCopyController)
