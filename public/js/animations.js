/* ==========================================================================
    Manssouri Tech - Custom Animations Engine
    ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initHeroCanvas();
  initScrollReveals();
  initMetricsCounters();
  initTiltCards();
});

// 1. Hero Canvas Constellation Particle System
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId;

  // Set canvas size
  function resizeCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Particles config
  const particles = [];
  const particleCount = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
  const connectionDistance = 120;
  
  const mouse = {
    x: null,
    y: null,
    radius: 150
  };

  // Track mouse coordinates over hero container (not just canvas to cover text overlays)
  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    heroSection.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });
  }

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 1; // 1px to 3px
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.color = Math.random() > 0.5 ? 'rgba(37, 99, 235, 0.4)' : 'rgba(124, 58, 237, 0.4)';
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Bounce on edges
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

      // React to mouse proximity (subtle push)
      if (mouse.x !== null && mouse.y !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * force * 1.5;
          this.y += Math.sin(angle) * force * 1.5;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  // Generate particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Main drawing loop
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw lines first
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < connectionDistance) {
          // Fade alpha as distance increases
          const alpha = (1 - (distance / connectionDistance)) * 0.15;
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw and update particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
  }
  animate();
}

// 2. Scroll-triggered reveal animations
function initScrollReveals() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        // Stop observing once animated
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  reveals.forEach(r => observer.observe(r));
}

// 3. Metric Counter Animation
function initMetricsCounters() {
  const metrics = document.querySelectorAll('.metric-num');
  if (metrics.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const targetElement = entry.target;
        const targetValue = parseInt(targetElement.getAttribute('data-target'), 10);
        const prefix = targetElement.getAttribute('data-prefix') || '';
        const suffix = targetElement.getAttribute('data-suffix') || '';
        const duration = 2000; // 2 seconds
        let startTime = null;

        function animateCount(timestamp) {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          const currentValue = Math.floor(progress * targetValue);
          
          targetElement.textContent = `${prefix}${currentValue.toLocaleString()}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(animateCount);
          } else {
            targetElement.textContent = `${prefix}${targetValue.toLocaleString()}${suffix}`;
          }
        }

        requestAnimationFrame(animateCount);
        observer.unobserve(targetElement);
      }
    });
  }, {
    threshold: 0.2
  });

  metrics.forEach(m => observer.observe(m));
}

// 4. Premium 3D tilt interaction on hover
function initTiltCards() {
  const cards = document.querySelectorAll('.glass-card-interactive, .service-card, .portfolio-card, .team-card');
  if (cards.length === 0 || window.innerWidth < 768) return; // Disable on small screens for performance

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x coordinate within element
      const y = e.clientY - rect.top;  // y coordinate within element
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate rotation angles (max 6 degrees tilt)
      const rotateX = ((centerY - y) / centerY) * 5;
      const rotateY = ((x - centerX) / centerX) * 5;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      card.style.boxShadow = `0 15px 35px rgba(0,0,0,0.5), 0 0 20px rgba(37, 99, 235, 0.15)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      card.style.boxShadow = '';
    });
  });
}
