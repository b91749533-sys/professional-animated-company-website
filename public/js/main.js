/* ==========================================================================
    Manssouri Tech - Core Client UI Logic
    ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initTestimonialCarousel();
  initForms();
  initModals();
});

// 1. Sticky Navbar styling on scroll
function initNavbar() {
  const header = document.querySelector('header.main-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// 2. Mobile Menu Toggle
function initMobileMenu() {
  const toggleBtn = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    toggleBtn.classList.toggle('open');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      toggleBtn.classList.remove('open');
    });
  });
}

// 3. Testimonial Slider Carousel
function initTestimonialCarousel() {
  const track = document.querySelector('.testimonial-track');
  const slides = Array.from(document.querySelectorAll('.testimonial-slide'));
  const indicatorsContainer = document.querySelector('.carousel-indicators');

  if (!track || slides.length === 0) return;

  let currentIndex = 0;
  let slideInterval;

  // Create dot indicators
  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.classList.add('indicator-dot');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => {
      goToSlide(index);
      resetAutoPlay();
    });
    indicatorsContainer.appendChild(dot);
  });

  const dots = Array.from(indicatorsContainer.querySelectorAll('.indicator-dot'));

  function goToSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    
    currentIndex = index;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    // Update dots
    dots.forEach(dot => dot.classList.remove('active'));
    dots[currentIndex].classList.add('active');
  }

  function startAutoPlay() {
    slideInterval = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 6000);
  }

  function resetAutoPlay() {
    clearInterval(slideInterval);
    startAutoPlay();
  }

  startAutoPlay();
}

// 4. Toast Notification helper
function showToast(message, isSuccess = true) {
  let toast = document.querySelector('.form-response-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.classList.add('form-response-toast');
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.borderLeftColor = isSuccess ? '#10b981' : '#ef4444';
  toast.classList.add('active');

  setTimeout(() => {
    toast.classList.remove('active');
  }, 4000);
}

// 5. AJAX Form Handlers
function initForms() {
  // Contact Form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending Message...';
      submitBtn.disabled = true;

      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
      };

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const res = await response.json();

        if (response.ok) {
          showToast(res.message || 'Message sent successfully!', true);
          contactForm.reset();
        } else {
          showToast(res.error || 'Failed to send message.', false);
        }
      } catch (err) {
        showToast('Network error, please try again.', false);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Newsletter Form (Footer)
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const submitBtn = newsletterForm.querySelector('button');
      
      const email = emailInput.value;
      if (!email) return;

      submitBtn.disabled = true;

      try {
        const response = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const res = await response.json();

        if (response.ok) {
          showToast(res.message || 'Thank you for subscribing!', true);
          emailInput.value = '';
        } else {
          showToast(res.error || 'Failed to subscribe.', false);
        }
      } catch (err) {
        showToast('Network error, please try again.', false);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Careers Job Application Form
  const applyForm = document.getElementById('applyForm');
  if (applyForm) {
    applyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = applyForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting Application...';
      submitBtn.disabled = true;

      const formData = new FormData(applyForm);

      try {
        const response = await fetch('/api/careers/apply', {
          method: 'POST',
          body: formData
        });
        const res = await response.json();

        if (response.ok) {
          showToast(res.message || 'Application submitted successfully!', true);
          applyForm.reset();
          const modal = document.getElementById('applyModal');
          if (modal) modal.style.display = 'none';
        } else {
          showToast(res.error || 'Failed to submit application.', false);
        }
      } catch (err) {
        showToast('Network error or file size too large.', false);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

// 6. Modal triggers (Open careers apply modal)
function initModals() {
  const modal = document.getElementById('applyModal');
  const closeBtn = document.querySelector('.modal-close');
  const applyBtns = document.querySelectorAll('.apply-trigger');

  if (!modal) return;

  applyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const jobId = btn.getAttribute('data-job-id');
      const jobTitle = btn.getAttribute('data-job-title');

      document.getElementById('modalJobId').value = jobId;
      document.getElementById('modalJobTitle').value = jobTitle;
      document.getElementById('modalJobDisplayTitle').textContent = jobTitle;

      modal.style.display = 'flex';
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}
