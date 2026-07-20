(function () {
  'use strict';

  function initMobileNav() {
    const btn = document.getElementById('nav-hamburger-btn');
    const drawer = document.getElementById('nav-mobile-drawer');

    if (!btn || !drawer) return;

    function openDrawer() {
      drawer.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('modal-open');
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('modal-open');
    }

    function toggleDrawer() {
      const isOpen = drawer.classList.contains('is-open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    }

    btn.addEventListener('click', toggleDrawer);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
        btn.focus();
      }
    });

    // Close when a nav link is clicked
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeDrawer();
      });
    });

    // Close drawer if window resizes above 900px
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) {
        closeDrawer();
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
