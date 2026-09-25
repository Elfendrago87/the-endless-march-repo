// Theme toggle (light / dark "night" / follow the system), remembered per browser.
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('em-theme'); } catch (e) {}
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('.theme');
    if (!b) return;
    var label = function () {
      var t = root.getAttribute('data-theme');
      b.textContent = t === 'dark' ? 'Night' : t === 'light' ? 'Day' : 'Auto';
    };
    label();
    b.addEventListener('click', function () {
      var t = root.getAttribute('data-theme');
      var next = t === 'light' ? 'dark' : t === 'dark' ? null : 'light';
      if (next) root.setAttribute('data-theme', next); else root.removeAttribute('data-theme');
      try { next ? localStorage.setItem('em-theme', next) : localStorage.removeItem('em-theme'); } catch (e) {}
      label();
    });
  });
})();
