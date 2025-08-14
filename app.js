// ===== app.js (module entry) =====
import {
  boot, showScreen, renderUsers, saveUser, enterAs, delUser,
  cycleTheme, addDevCoins, addDevGems
} from './js/core.js';

import {
  startOdyssey, odPrev, odNext, odCheck, odFinishStage, odKey
} from './js/odyssey.js';

import {
  openCrossword, cwToggleSheet, cwSetDir, cwPrev, cwNext, cwCheckWord, cwCheckAll,
  cwHintLetter, cwFlipDir, cwMarkLater, cwSearch, cwFilter
} from './js/crossword.js';

// اجعل الدوال متاحة لعناصر HTML (onclick/onsubmit…)
window.showScreen   = showScreen;
window.renderUsers  = renderUsers;
window.saveUser     = saveUser;
window.enterAs      = enterAs;
window.delUser      = delUser;
window.cycleTheme   = cycleTheme;
window.addDevCoins  = addDevCoins;
window.addDevGems   = addDevGems;

window.startOdyssey   = startOdyssey;
window.odPrev         = odPrev;
window.odNext         = odNext;
window.odCheck        = odCheck;
window.odFinishStage  = odFinishStage;
window.odKey          = odKey;

window.openCrossword  = openCrossword;
window.cwToggleSheet  = cwToggleSheet;
window.cwSetDir       = cwSetDir;
window.cwPrev         = cwPrev;
window.cwNext         = cwNext;
window.cwCheckWord    = cwCheckWord;
window.cwCheckAll     = cwCheckAll;
// === Smart Dock extras ===
window.cwHintLetter   = cwHintLetter;
window.cwFlipDir      = cwFlipDir;
window.cwMarkLater    = cwMarkLater;
window.cwSearch       = cwSearch;
window.cwFilter       = cwFilter;

// تشغيل التطبيق عند جاهزية DOM
document.addEventListener('DOMContentLoaded', boot);
