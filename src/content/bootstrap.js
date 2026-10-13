import { createLogger } from '../shared/logger.js';
import { moduleLoader } from '../core/module-loader.js';
import { messaging } from '../core/messaging.js';
import { MODULES } from '../shared/constants.js';
import { ttsModule } from '../modules/tts/tts.module.js';
import { timerModule } from '../modules/timer/timer.module.js';
import { readingModule } from '../modules/reading-mode/reading.module.js';
import { visualModule } from '../modules/visual/visual.module.js';
import { focusLineModule } from '../modules/focus-line/focus-line.module.js';
import { fontsModule } from '../modules/fonts/fonts.module.js';

const log = createLogger('Content');
async function bootstrap() {
  log.info('Iniciando ClariText en la pestaña');
  messaging.start();
  moduleLoader.register(MODULES.TTS, ttsModule);
  moduleLoader.register(MODULES.BREAK_TIMER, timerModule);
  moduleLoader.register(MODULES.READING_MODE, readingModule);
  moduleLoader.register(MODULES.VISUAL, visualModule);
  moduleLoader.register(MODULES.FOCUS_LINE, focusLineModule);
  moduleLoader.register(MODULES.FONTS, fontsModule);

  await moduleLoader.loadAll();
  log.info('ClariText listo. Módulos cargados:', moduleLoader.list());
}
bootstrap().catch((error) => {
  console.error('[ClariText] Falló el bootstrap del content script', error);
});
