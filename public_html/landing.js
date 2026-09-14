// Landing page interactive behaviors (Vanilla JS)
document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Navigation dynamic blur and shadow on scroll
  const nav = document.getElementById('landingNav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
  });

  // 1b. Mobile Navigation Drawer Toggle
  const navToggleBtn = document.getElementById('navToggleBtn');
  const navLinks = document.getElementById('navLinks');

  function closeMobileMenu() {
    if (navToggleBtn && navLinks) {
      navToggleBtn.classList.remove('active');
      navLinks.classList.remove('nav-open');
      navToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleMobileMenu() {
    if (navToggleBtn && navLinks) {
      const isExpanded = navToggleBtn.classList.toggle('active');
      navLinks.classList.toggle('nav-open', isExpanded);
      navToggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    }
  }

  if (navToggleBtn && navLinks) {
    navToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileMenu();
    });

    // Close when clicking any nav link
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });

    // Close when clicking outside of nav
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('nav-open')) {
        const isInsideNav = nav?.contains(e.target);
        if (!isInsideNav) {
          closeMobileMenu();
        }
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('nav-open')) {
        closeMobileMenu();
        navToggleBtn.focus();
      }
    });

    // Reset when resizing to desktop width
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && navLinks.classList.contains('nav-open')) {
        closeMobileMenu();
      }
    });
  }

  // 2. Interactive Mock Preview Controls
  const mockCheckbox = document.getElementById('mockDemoCheckbox');
  const mockSaveBtn = document.getElementById('mockSaveBtn');
  const mockSaveText = document.getElementById('mockSaveText');
  const mockEmailBtn = document.getElementById('mockEmailBtn');
  const mockEmailText = document.getElementById('mockEmailText');
  const mockExportBtn = document.getElementById('mockExportBtn');
  const mockExportText = document.getElementById('mockExportText');
  const mockClearBtn = document.getElementById('mockClearBtn');

  let isSaved = false;

  function updateBatchButtonLabels() {
    const isChecked = mockCheckbox ? mockCheckbox.checked : true;
    if (isChecked) {
      if (mockSaveText) mockSaveText.textContent = isSaved ? 'Saved' : 'Save 1 article';
      if (mockEmailText) mockEmailText.textContent = 'Email 1 article';
      if (mockExportText) mockExportText.textContent = 'Export 1 as HTML';
      if (mockClearBtn) mockClearBtn.style.display = 'inline-flex';
    } else {
      if (mockSaveText) mockSaveText.textContent = isSaved ? 'Saved' : 'Save all';
      if (mockEmailText) mockEmailText.textContent = 'Email all';
      if (mockExportText) mockExportText.textContent = 'Export all as HTML';
      if (mockClearBtn) mockClearBtn.style.display = 'none';
    }
  }

  if (mockCheckbox) {
    mockCheckbox.addEventListener('change', () => {
      updateBatchButtonLabels();
    });
  }

  if (mockClearBtn) {
    mockClearBtn.addEventListener('click', () => {
      if (mockCheckbox) {
        mockCheckbox.checked = false;
        updateBatchButtonLabels();
      }
    });
  }

  if (mockSaveBtn) {
    mockSaveBtn.addEventListener('click', () => {
      isSaved = !isSaved;
      if (isSaved) {
        mockSaveBtn.classList.add('mock-btn-active');
        if (mockSaveText) mockSaveText.textContent = 'Saved';
      } else {
        mockSaveBtn.classList.remove('mock-btn-active');
        const isChecked = mockCheckbox ? mockCheckbox.checked : true;
        if (mockSaveText) mockSaveText.textContent = isChecked ? 'Save 1 article' : 'Save all';
      }
    });
  }

  if (mockEmailBtn) {
    mockEmailBtn.addEventListener('click', () => {
      const wasActive = mockEmailBtn.classList.contains('mock-btn-active');
      if (!wasActive) {
        mockEmailBtn.classList.add('mock-btn-active');
        const prevText = mockEmailText ? mockEmailText.textContent : 'Email';
        if (mockEmailText) mockEmailText.textContent = 'Digest Dispatched!';
        setTimeout(() => {
          mockEmailBtn.classList.remove('mock-btn-active');
          if (mockEmailText) mockEmailText.textContent = prevText;
        }, 2800);
      }
    });
  }

  // 3. Interactive Real Sample HTML Export
  if (mockExportBtn) {
    mockExportBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const articleElem = document.getElementById('interactiveMockArticle');
      if (!articleElem) return;

      const clone = articleElem.cloneNode(true);
      // Remove interactive controls from exported document
      clone.querySelector('.demo-checkbox-bar')?.remove();
      clone.querySelector('.mock-actions-row')?.remove();

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Saved Summaries - Sample Digest</title>
  <style>
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2rem;
      max-width: 860px;
      margin: 0 auto;
    }
    .article-container {
      margin-bottom: 2rem;
      padding: 1.75rem;
      border: 1px solid #27272a;
      border-radius: 8px;
      background-color: #18181b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid #27272a;
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      text-align: left;
    }
    th {
      background-color: rgba(255, 255, 255, 0.02);
      color: #a1a1aa;
      font-weight: 600;
      width: 140px;
    }
    td { color: #f4f4f5; }
    .link-preview-card {
      display: flex;
      gap: 1.25rem;
      background-color: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 1.25rem;
      margin-top: 0.5rem;
      align-items: stretch;
    }
    .link-preview-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      justify-content: center;
    }
    .link-preview-site {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #a1a1aa;
      font-weight: 600;
    }
    .link-preview-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: #f4f4f5;
      text-decoration: underline;
      line-height: 1.4;
    }
    .link-preview-desc {
      font-size: 0.85rem;
      color: #a1a1aa;
      line-height: 1.5;
      margin: 0;
    }
    .link-preview-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #a1a1aa;
      margin-top: 0.25rem;
    }
    .link-preview-thumbnail {
      width: 120px;
      min-width: 120px;
      height: 90px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid #27272a;
      align-self: center;
    }
    .link-preview-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    h2 {
      font-size: 1.25rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #f4f4f5;
    }
    h3 { margin-top: 0; color: #f4f4f5; font-size: 0.95rem; }
    ul.summary-box {
      background-color: #18181b;
      padding: 1.25rem 1.75rem;
      border: 1px solid #27272a;
      border-radius: 8px;
      margin-bottom: 2rem;
      color: #e4e4e7;
    }
    ul.summary-box li { margin-bottom: 0.5rem; line-height: 1.6; }
    .sentiment-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .sentiment-block {
      padding: 1rem 1.25rem;
      border-radius: 8px;
      border: 1px solid #27272a;
      background-color: #18181b;
    }
    .sentiment-block.positive { border-left: 5px solid #22c55e; }
    .sentiment-block.neutral { border-left: 5px solid #ef4444; }
    .sentiment-block.negative { border-left: 5px solid #71717a; }
    .sentiment-block ul { padding-left: 1.2rem; margin: 0; }
    .sentiment-block li { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 0.4rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="article-container">
    ${clone.innerHTML}
  </div>
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sample_summaries.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // 4. Smooth scrolling for internal anchors with navbar offset
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        closeMobileMenu();
        const nav = document.querySelector('.landing-nav');
        const navHeight = nav ? nav.getBoundingClientRect().height : 70;
        const elemPosition = targetElem.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elemPosition - navHeight - 20;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });

        // Optional URL hash update without instant jump
        if (history.pushState) {
          history.pushState(null, '', targetId);
        }
      }
    });
  });

  // 5. Back to Top Floating Action Button
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
});
