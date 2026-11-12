// Runs before first paint so a saved light/dark choice never flashes the wrong theme.
// With no saved choice (or "system"), CSS follows the OS via prefers-color-scheme.
(function () {
  try {
    var saved = localStorage.getItem('cb_theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (_err) {
    // Storage unavailable (private mode): fall back to the system theme.
  }
})();
