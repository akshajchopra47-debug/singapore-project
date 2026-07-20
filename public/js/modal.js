(function () {
  'use strict';

  function safeText(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function openModal(id) {
    const modal = document.getElementById(id + 'Modal');
    if (!modal) {
      console.warn('Modal not found:', id + 'Modal');
      return;
    }
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    const firstFocusable = modal.querySelector(
      'input, select, textarea, button:not(.modal-close), [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) firstFocusable.focus();
  }

  function closeModal(id) {
    const modal = document.getElementById(id + 'Modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  async function submitBookCall() {
    const nameEl = document.getElementById('mc-name');
    const emailEl = document.getElementById('mc-email');
    const companyEl = document.getElementById('mc-company');
    const topicEl = document.getElementById('mc-topic');
    const btn = document.getElementById('mc-submit');

    const name = nameEl?.value.trim();
    const email = emailEl?.value.trim();
    const company = companyEl?.value.trim();
    const topic = topicEl?.value.trim();

    if (!name || !email) {
      alert('Please fill in your name and email.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'book_call',
          full_name: name,
          email: email,
          company: company || null,
          topic: topic || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      closeModal('bookCall');
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (companyEl) companyEl.value = '';
      if (topicEl) topicEl.value = '';
      alert('Thank you! We will be in touch within one business day.');
    } catch (e) {
      console.error('Book call submission failed:', e);
      alert('Something went wrong. Please try again or email us directly.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Request a Call';
      }
    }
  }

  // Close on overlay click
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
      const modal = e.target;
      const id = modal.id.replace('Modal', '');
      closeModal(id);
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-open').forEach(function (modal) {
        const id = modal.id.replace('Modal', '');
        closeModal(id);
      });
    }
  });

  // Expose globally
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.submitBookCall = submitBookCall;
})();
