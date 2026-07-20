document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initMobileMenu();
    initModals();
    initCanvasBackground();
    initNavScroll();
    initSmoothCounters();
    initMagneticButtons();
    initParallaxElements();
    checkHashForModal();
});

/* ══════════════════════════════════════
   SCROLL REVEALS — adds .visible (matches CSS)
   ══════════════════════════════════════ */
function initScrollReveal() {
    const observerOptions = {
        threshold: 0.06,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add both 'visible' (CSS uses this) and 'active' (legacy compat)
                entry.target.classList.add('visible', 'active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children').forEach(el => {
        revealObserver.observe(el);
    });
}

/* ══════════════════════════════════════
   NAV SCROLL EFFECT
   ══════════════════════════════════════ */
function initNavScroll() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
                ticking = false;
            });
            ticking = true;
        }
    });
}

/* ══════════════════════════════════════
   ANIMATED COUNTERS — Stats that count up
   ══════════════════════════════════════ */
function initSmoothCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    counters.forEach(counter => counterObserver.observe(counter));
}

function animateCounter(el) {
    const target = el.getAttribute('data-count');
    const suffix = el.getAttribute('data-suffix') || '';
    const numericTarget = parseInt(target.replace(/[^0-9]/g, ''));
    const hasPlus = target.includes('+');
    const duration = 1800;
    const start = performance.now();

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(progress);
        const current = Math.round(numericTarget * eased);

        el.textContent = current + (hasPlus && progress >= 1 ? '+' : '') + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/* ══════════════════════════════════════
   MAGNETIC BUTTONS — Very subtle, premium
   ══════════════════════════════════════ */
function initMagneticButtons() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translateY(-1px) translate(${x * 0.05}px, ${y * 0.05}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

/* ══════════════════════════════════════
   PARALLAX ELEMENTS — Subtle depth on scroll
   ══════════════════════════════════════ */
function initParallaxElements() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const parallaxItems = document.querySelectorAll('[data-parallax]');
    if (!parallaxItems.length) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                parallaxItems.forEach(item => {
                    const speed = parseFloat(item.getAttribute('data-parallax')) || 0.1;
                    const rect = item.getBoundingClientRect();
                    const center = rect.top + rect.height / 2;
                    const offset = (center - window.innerHeight / 2) * speed;
                    item.style.transform = `translateY(${offset}px)`;
                });
                ticking = false;
            });
            ticking = true;
        }
    });
}

/* ══════════════════════════════════════
   MOBILE MENU
   ══════════════════════════════════════ */
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-toggle');
    const drawer = document.querySelector('.mobile-nav-drawer');
    const body = document.body;

    if (!toggle || !drawer) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Submenu toggles in mobile drawer
    document.querySelectorAll('.mobile-nav-links button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const submenu = btn.nextElementSibling;
            if (submenu && submenu.classList.contains('mobile-sub-drawer')) {
                const isCurrentlyOpen = submenu.style.display === 'flex';
                submenu.style.display = isCurrentlyOpen ? 'none' : 'flex';
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.style.transform = isCurrentlyOpen ? 'none' : 'rotate(180deg)';
                }
            }
        });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (drawer.classList.contains('open') && !drawer.contains(e.target) && !toggle.contains(e.target)) {
            closeMenu();
        }
    });

    function openMenu() {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';

        drawer.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        
        let overlay = document.querySelector('.mobile-nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-nav-overlay';
            overlay.id = 'mobileNavOverlay';
            document.body.prepend(overlay);
        }
        overlay.classList.add('active');
        overlay.onclick = closeMenu;

        // Animate hamburger to X
        const spans = toggle.querySelectorAll('span');
        if (spans.length === 3) {
            spans[0].style.transform = 'translateY(7px) rotate(45deg)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
        }
    }

    function closeMenu() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';

        drawer.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');

        const overlay = document.querySelector('.mobile-nav-overlay');
        if (overlay) overlay.classList.remove('active');

        // Restore hamburger
        const spans = toggle.querySelectorAll('span');
        if (spans.length === 3) {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    }
}

/* ══════════════════════════════════════
   MODALS
   ══════════════════════════════════════ */
let activeModalType = '';


/* ══════════════════════════════════════
   CANVAS BACKGROUND — Auralis-style dot grid
   Very quiet, barely perceptible. Premium feel.
   ══════════════════════════════════════ */
function initCanvasBackground() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // 32px gap matches Auralis grid unit (8px x 4)
    const GAP = 32;
    const DOT_R = 1;
    let time = 0;
    let width, height, dots;

    function buildGrid() {
        width  = canvas.width  = container.offsetWidth;
        height = canvas.height = container.offsetHeight;
        const cols = Math.ceil(width  / GAP) + 1;
        const rows = Math.ceil(height / GAP) + 1;
        dots = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                // Deterministic phase per dot for non-random shimmer
                dots.push({
                    x: c * GAP,
                    y: r * GAP,
                    phase: ((c * 7 + r * 11) % 628) / 100  // pseudo-random 0..2pi
                });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        time += 0.004;

        dots.forEach(d => {
            // Barely-perceptible breathing — alpha range 0.08 to 0.18
            const alpha = 0.13 + Math.sin(time * 0.8 + d.phase) * 0.05;
            ctx.fillStyle = `rgba(122, 155, 118, ${alpha})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    buildGrid();
    draw();
    window.addEventListener('resize', debounce(buildGrid, 250));
}


/* ══════════════════════════════════════
   HERO NETWORK GRAPHIC — Animated SVG
   ══════════════════════════════════════ */
function initHeroGraphic() {
    const container = document.getElementById('hero-graphic');
    if (!container) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    // Animate nodes
    const nodes = svg.querySelectorAll('.node');
    nodes.forEach((node, i) => {
        node.style.animation = `node-pulse ${2 + Math.random() * 2}s ease-in-out ${i * 0.2}s infinite`;
    });

    // Animate lines
    const lines = svg.querySelectorAll('.line');
    lines.forEach((line, i) => {
        const length = line.getTotalLength ? line.getTotalLength() : 200;
        line.style.strokeDasharray = length;
        line.style.strokeDashoffset = length;
        line.style.animation = `draw-line 2s ease ${i * 0.15}s forwards`;
    });
}

// Initialize hero graphic after DOM is ready
document.addEventListener('DOMContentLoaded', initHeroGraphic);

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Show view helper – toggles UI sections based on navigation
function showView(view) {
    // Hide all view sections
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show target view if exists
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.add('active');
    // Update sidebar navigation active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[onclick*='${view}']`);
    if (navBtn) navBtn.classList.add('active');
    // Ensure focus for accessibility
    if (target) target.focus();
    // Scroll to top of main content for smoother UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Expose globally
window.showView = showView;
