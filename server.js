const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');

[DATA_DIR, UPLOADS_DIR, IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for PDF/DOCX Resume uploads and image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDFs, Word documents, and images are allowed.'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('premium_enterprise_website_secret'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Database File Paths
const DB_PATHS = {
  users: path.join(DATA_DIR, 'users.json'),
  blog: path.join(DATA_DIR, 'blog.json'),
  portfolio: path.join(DATA_DIR, 'portfolio.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  subscribers: path.join(DATA_DIR, 'subscribers.json'),
  careers: path.join(DATA_DIR, 'careers.json'),
  applications: path.join(DATA_DIR, 'applications.json')
};

// Database helper functions
const readData = (key) => {
  try {
    const filePath = DB_PATHS[key];
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${key} database:`, err);
    return [];
  }
};

const writeData = (key, data) => {
  try {
    fs.writeFileSync(DB_PATHS[key], JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${key} database:`, err);
    return false;
  }
};

// Initialize Admin User if not exists
const initializeAdminUser = async () => {
  const users = readData('users');
  if (users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const defaultUser = {
      username: 'admin',
      password: hashedPassword,
      role: 'Admin' // Admin, Editor, Viewer
    };
    writeData('users', [defaultUser]);
    console.log('Default admin user created: admin / admin123');
  }
};
initializeAdminUser();

// Session Management (In-Memory)
const SESSIONS = new Map();

// Helper to authenticate session cookie
const getAuthenticatedUser = (req) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return null;
  const session = SESSIONS.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expires) {
    SESSIONS.delete(sessionId);
    return null;
  }
  return session;
};

// Authentication Middleware
const requireAuth = (req, res, next) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.redirect('/admin');
  }
  req.user = user;
  res.locals.user = user;
  next();
};

// Permissions check helper
const checkPermission = (action, role) => {
  // Viewer can only read
  if (role === 'Viewer') {
    return action === 'read';
  }
  // Editor can read and write (create/update) but cannot delete
  if (role === 'Editor') {
    return action === 'read' || action === 'write';
  }
  // Admin can do anything
  if (role === 'Admin') {
    return true;
  }
  return false;
};

// Inject global locals (navbar, default values, user session)
app.use((req, res, next) => {
  res.locals.title = 'Manssouri Tech | Innovative Solutions for Modern Businesses';
  res.locals.author = 'Youssef Manssouri';
  res.locals.metaDescription = 'We help organizations grow through technology, design, strategy, and digital transformation. Built by Youssef Manssouri.';
  res.locals.currentPath = req.path;
  res.locals.user = getAuthenticatedUser(req);
  next();
});

// Helper for SEO Schema
const generateOrgSchema = () => {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Corporation",
    "name": "Manssouri Tech",
    "alternateName": "Manssouri Enterprises",
    "url": "http://localhost:3000",
    "logo": "http://localhost:3000/images/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-800-555-0199",
      "contactType": "customer service",
      "email": "contact@manssouritech.com",
      "availableLanguage": ["en", "fr"]
    },
    "sameAs": [
      "https://www.facebook.com",
      "https://www.twitter.com",
      "https://www.linkedin.com",
      "https://github.com"
    ]
  });
};

/* ==========================================================================
   PUBLIC ROUTES
   ========================================================================== */

// Home Page
app.get('/', (req, res) => {
  const blogs = readData('blog');
  const portfolio = readData('portfolio');
  
  const featuredBlogs = blogs.filter(b => b.featured).slice(0, 3);
  const featuredPortfolio = portfolio.filter(p => p.featured).slice(0, 2);
  
  res.render('index', {
    title: 'Innovative Solutions for Modern Businesses | Manssouri Tech',
    metaDescription: 'Discover professional web development, cloud solutions, and UI/UX design with Manssouri Tech. Built by Youssef Manssouri.',
    featuredBlogs,
    featuredPortfolio,
    schemaMarkup: generateOrgSchema()
  });
});

// About Us Page
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us - Our Story, Mission & Core Values | Manssouri Tech',
    metaDescription: 'Learn about Manssouri Tech, our mission to drive digital transformation, and our focus on premium technological engineering.'
  });
});

// Services Page
app.get('/services', (req, res) => {
  res.render('services', {
    title: 'Enterprise Digital Services & Cloud Solutions | Manssouri Tech',
    metaDescription: 'Explore our technology consulting services, UI/UX designs, and advanced custom web & mobile software applications.'
  });
});

// Portfolio Page
app.get('/portfolio', (req, res) => {
  const portfolio = readData('portfolio');
  const category = req.query.category || 'All';
  
  const filteredProjects = category === 'All' 
    ? portfolio 
    : portfolio.filter(p => p.category.toLowerCase() === category.toLowerCase() || p.tags.some(t => t.toLowerCase() === category.toLowerCase()));

  // Get unique categories and tags for filter tabs
  const categories = ['All', ...new Set(portfolio.map(p => p.category))];

  res.render('portfolio', {
    title: 'Case Studies & Featured Client Portfolio | Manssouri Tech',
    metaDescription: 'Browse through our premium software integrations, cross-platform mobile apps, and enterprise engineering dashboards.',
    projects: filteredProjects,
    categories,
    selectedCategory: category
  });
});

// Portfolio Detail Page
app.get('/portfolio/:slug', (req, res) => {
  const portfolio = readData('portfolio');
  const project = portfolio.find(p => p.slug === req.params.slug);
  
  if (!project) {
    return res.status(404).render('404', {
      title: 'Project Not Found | Manssouri Tech',
      metaDescription: 'The requested client portfolio project was not found.'
    });
  }

  const projectSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": project.title,
    "description": project.description,
    "creator": {
      "@type": "Organization",
      "name": "Manssouri Tech"
    },
    "client": project.client,
    "genre": project.category
  });

  res.render('portfolio-detail', {
    title: `${project.title} Case Study | Manssouri Tech`,
    metaDescription: project.description.substring(0, 160),
    project,
    schemaMarkup: projectSchema
  });
});

// Team Page
app.get('/team', (req, res) => {
  res.render('team', {
    title: 'Meet Our Leadership & Engineering Team | Manssouri Tech',
    metaDescription: 'Meet the architects, developers, and designers driving innovation at Manssouri Tech. Lead by Youssef Manssouri.'
  });
});

// Blog Page (List/Search/Category)
app.get('/blog', (req, res) => {
  const blogs = readData('blog');
  const searchQuery = (req.query.q || '').trim().toLowerCase();
  const categoryQuery = (req.query.category || '').trim();

  let filteredBlogs = blogs;

  if (categoryQuery && categoryQuery !== 'All') {
    filteredBlogs = filteredBlogs.filter(b => b.category === categoryQuery);
  }

  if (searchQuery) {
    filteredBlogs = filteredBlogs.filter(b => 
      b.title.toLowerCase().includes(searchQuery) || 
      b.excerpt.toLowerCase().includes(searchQuery) || 
      b.content.toLowerCase().includes(searchQuery)
    );
  }

  const categories = ['All', ...new Set(blogs.map(b => b.category))];

  res.render('blog', {
    title: 'Technology Insights, Design, and AI Blog | Manssouri Tech',
    metaDescription: 'Read the latest trends on software systems scaling, UX composition, and DevOps infrastructure.',
    blogs: filteredBlogs,
    categories,
    selectedCategory: categoryQuery || 'All',
    searchQuery: req.query.q || ''
  });
});

// Blog Detail Page
app.get('/blog/:slug', (req, res) => {
  const blogs = readData('blog');
  const post = blogs.find(b => b.slug === req.params.slug);

  if (!post) {
    return res.status(404).render('404', {
      title: 'Blog Article Not Found | Manssouri Tech',
      metaDescription: 'The requested blog post article was not found.'
    });
  }

  // Increment view count dynamically
  post.views = (post.views || 0) + 1;
  writeData('blog', blogs);

  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": `http://localhost:3000${post.image}`,
    "datePublished": post.date,
    "author": {
      "@type": "Person",
      "name": "Youssef Manssouri"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Manssouri Tech",
      "logo": {
        "@type": "ImageObject",
        "url": "http://localhost:3000/images/logo.png"
      }
    },
    "description": post.excerpt
  });

  res.render('blog-detail', {
    title: `${post.title} | Manssouri Tech Blog`,
    metaDescription: post.excerpt.substring(0, 160),
    post,
    schemaMarkup: articleSchema
  });
});

// Careers Page
app.get('/careers', (req, res) => {
  const jobs = readData('careers');
  res.render('careers', {
    title: 'Careers - Open Positions & Company Culture | Manssouri Tech',
    metaDescription: 'Join our fully remote engineering and design teams. Explore open roles in Frontend development, cloud scaling, and UI design.',
    jobs
  });
});

// Contact Page
app.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - Business Consultation | Manssouri Tech',
    metaDescription: 'Get in touch for custom software builds, cloud architecture design, and UI design. Offices in London and remote consultations.'
  });
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: http://localhost:3000/sitemap.xml');
});

// Sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const blogs = readData('blog');
  const portfolio = readData('portfolio');
  const baseUrl = 'http://localhost:3000';
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Static pages
  const staticUrls = ['', '/about', '/services', '/portfolio', '/team', '/blog', '/careers', '/contact'];
  staticUrls.forEach(url => {
    xml += `  <url>\n    <loc>${baseUrl}${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${url === '' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
  });

  // Dynamic portfolio details
  portfolio.forEach(p => {
    xml += `  <url>\n    <loc>${baseUrl}/portfolio/${p.slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  });

  // Dynamic blog articles
  blogs.forEach(b => {
    xml += `  <url>\n    <loc>${baseUrl}/blog/${b.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
  });

  xml += `</urlset>`;
  res.type('application/xml');
  res.send(xml);
});


/* ==========================================================================
   PUBLIC FORM SUBMISSION APIs
   ========================================================================== */

// Submit Contact Request
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const messages = readData('messages');
  const newMsg = {
    id: `msg-${Date.now()}`,
    name,
    email,
    subject,
    message,
    date: new Date().toISOString().split('T')[0],
    status: 'Unread'
  };
  messages.unshift(newMsg);
  writeData('messages', messages);

  res.status(200).json({ success: true, message: 'Message sent successfully.' });
});

// Submit Newsletter Subscription
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const subscribers = readData('subscribers');
  if (subscribers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
    return res.status(200).json({ success: true, message: 'Already subscribed!' });
  }

  subscribers.unshift({
    id: `sub-${Date.now()}`,
    email,
    date: new Date().toISOString().split('T')[0]
  });
  writeData('subscribers', subscribers);

  res.status(200).json({ success: true, message: 'Thank you for subscribing.' });
});

// Submit Job Application (handles PDF resume upload)
app.post('/api/careers/apply', upload.single('resume'), (req, res) => {
  const { jobId, jobTitle, name, email, phone, coverLetter } = req.body;
  if (!jobId || !jobTitle || !name || !email || !phone || !req.file) {
    return res.status(400).json({ error: 'All required fields and your resume file must be submitted.' });
  }

  const applications = readData('applications');
  const newApp = {
    id: `app-${Date.now()}`,
    jobId,
    jobTitle,
    name,
    email,
    phone,
    resumePath: `/uploads/${req.file.filename}`,
    coverLetter: coverLetter || '',
    date: new Date().toISOString().split('T')[0],
    status: 'Applied'
  };
  applications.unshift(newApp);
  writeData('applications', applications);

  res.status(200).json({ success: true, message: 'Your application has been received. Good luck!' });
});


/* ==========================================================================
   ADMIN PORTAL ROUTES & APIS
   ========================================================================== */

// GET Admin Login Screen / Dashboard check
app.get('/admin', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-login', {
    title: 'Admin Console Secure Authentication | Manssouri Tech',
    metaDescription: 'Provide secure tokens to enter the content management console.'
  });
});

// POST Admin Login
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const users = readData('users');
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('admin-login', {
      title: 'Admin Console Secure Authentication | Manssouri Tech',
      metaDescription: 'Provide secure tokens to enter the content management console.',
      error: 'Invalid credentials. Please verify username and password.'
    });
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const session = {
    username: user.username,
    role: user.role, // Default to Admin
    expires: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
  };
  SESSIONS.set(sessionId, session);

  // Set secure cookie
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: false, // Set to true if HTTPS
    maxAge: 2 * 60 * 60 * 1000
  });

  res.redirect('/admin/dashboard');
});

// GET Admin Logout
app.get('/admin/logout', (req, res) => {
  const sessionId = req.cookies.session_id;
  if (sessionId) {
    SESSIONS.delete(sessionId);
    res.clearCookie('session_id');
  }
  res.redirect('/admin');
});

// GET Admin Dashboard (Protected UI)
app.get('/admin/dashboard', requireAuth, (req, res) => {
  const blogs = readData('blog');
  const portfolio = readData('portfolio');
  const messages = readData('messages');
  const subscribers = readData('subscribers');
  const careers = readData('careers');
  const applications = readData('applications');

  // Compute analytics
  const totalViews = blogs.reduce((sum, b) => sum + (b.views || 0), 0);
  const unreadMessages = messages.filter(m => m.status === 'Unread').length;

  res.render('admin-dashboard', {
    title: 'Control Center - Admin Dashboard | Manssouri Tech',
    blogs,
    portfolio,
    messages,
    subscribers,
    careers,
    applications,
    totalViews,
    unreadMessages,
    currentRole: req.user.role
  });
});

// POST simulated permission toggle
app.post('/api/admin/role', requireAuth, (req, res) => {
  const { newRole } = req.body;
  if (!['Admin', 'Editor', 'Viewer'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }

  const sessionId = req.cookies.session_id;
  const session = SESSIONS.get(sessionId);
  if (session) {
    session.role = newRole;
    SESSIONS.set(sessionId, session);
  }

  res.status(200).json({ success: true, message: `Simulated role changed to: ${newRole}` });
});

/* --- Protected Content Management API Endpoints (CRUD) --- */

// BLOG APIs
app.post('/api/blog', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, excerpt, content, category, image, featured } = req.body;
  if (!title || !excerpt || !content || !category) {
    return res.status(400).json({ error: 'Title, excerpt, content, and category are required.' });
  }

  const blogs = readData('blog');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  if (blogs.some(b => b.slug === slug)) {
    return res.status(400).json({ error: 'An article with a similar title/slug already exists.' });
  }

  const newPost = {
    id: `blog-${Date.now()}`,
    title,
    slug,
    excerpt,
    content,
    category,
    image: image || '/images/blog-default.jpg',
    date: new Date().toISOString().split('T')[0],
    readTime: `${Math.max(1, Math.ceil(content.split(' ').length / 200))} min read`,
    views: 0,
    featured: featured === 'true' || featured === true
  };

  blogs.unshift(newPost);
  writeData('blog', blogs);

  res.status(201).json({ success: true, post: newPost });
});

app.put('/api/blog/:id', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, excerpt, content, category, image, featured } = req.body;
  const blogs = readData('blog');
  const postIndex = blogs.findIndex(b => b.id === req.params.id);

  if (postIndex === -1) {
    return res.status(404).json({ error: 'Blog article not found.' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const updatedPost = {
    ...blogs[postIndex],
    title,
    slug,
    excerpt,
    content,
    category,
    image: image || blogs[postIndex].image,
    featured: featured === 'true' || featured === true
  };

  blogs[postIndex] = updatedPost;
  writeData('blog', blogs);

  res.status(200).json({ success: true, post: updatedPost });
});

app.delete('/api/blog/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete items.' });
  }

  const blogs = readData('blog');
  const filtered = blogs.filter(b => b.id !== req.params.id);
  
  if (blogs.length === filtered.length) {
    return res.status(404).json({ error: 'Blog article not found.' });
  }

  writeData('blog', filtered);
  res.status(200).json({ success: true, message: 'Blog article deleted successfully.' });
});

// PORTFOLIO APIs
app.post('/api/portfolio', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, description, category, client, date, tags, challenge, solution, results, featured } = req.body;
  if (!title || !description || !category || !client || !challenge || !solution) {
    return res.status(400).json({ error: 'All primary project fields are required.' });
  }

  const portfolio = readData('portfolio');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  if (portfolio.some(p => p.slug === slug)) {
    return res.status(400).json({ error: 'A project with a similar title/slug already exists.' });
  }

  const tagsArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);
  const resultsArr = Array.isArray(results) ? results : (results ? results.split('\n').map(r => r.trim()).filter(Boolean) : []);

  const newProject = {
    id: `project-${Date.now()}`,
    title,
    slug,
    description,
    category,
    image: '/images/portfolio-default.jpg',
    tags: tagsArr,
    client,
    date: date || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    challenge,
    solution,
    results: resultsArr,
    featured: featured === 'true' || featured === true
  };

  portfolio.unshift(newProject);
  writeData('portfolio', portfolio);

  res.status(201).json({ success: true, project: newProject });
});

app.put('/api/portfolio/:id', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, description, category, client, date, tags, challenge, solution, results, featured } = req.body;
  const portfolio = readData('portfolio');
  const projIndex = portfolio.findIndex(p => p.id === req.params.id);

  if (projIndex === -1) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const tagsArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);
  const resultsArr = Array.isArray(results) ? results : (results ? results.split('\n').map(r => r.trim()).filter(Boolean) : []);

  const updatedProject = {
    ...portfolio[projIndex],
    title,
    slug,
    description,
    category,
    client,
    date,
    tags: tagsArr,
    challenge,
    solution,
    results: resultsArr,
    featured: featured === 'true' || featured === true
  };

  portfolio[projIndex] = updatedProject;
  writeData('portfolio', portfolio);

  res.status(200).json({ success: true, project: updatedProject });
});

app.delete('/api/portfolio/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete items.' });
  }

  const portfolio = readData('portfolio');
  const filtered = portfolio.filter(p => p.id !== req.params.id);

  if (portfolio.length === filtered.length) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  writeData('portfolio', filtered);
  res.status(200).json({ success: true, message: 'Project deleted successfully.' });
});

// CONTACT REQUESTS API
app.post('/api/messages/:id/read', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const messages = readData('messages');
  const msgIndex = messages.findIndex(m => m.id === req.params.id);

  if (msgIndex === -1) {
    return res.status(404).json({ error: 'Inquiry not found.' });
  }

  messages[msgIndex].status = 'Read';
  writeData('messages', messages);

  res.status(200).json({ success: true, message: 'Inquiry marked as read.' });
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete requests.' });
  }

  const messages = readData('messages');
  const filtered = messages.filter(m => m.id !== req.params.id);

  if (messages.length === filtered.length) {
    return res.status(404).json({ error: 'Inquiry not found.' });
  }

  writeData('messages', filtered);
  res.status(200).json({ success: true, message: 'Inquiry deleted successfully.' });
});

// NEWSLETTER SUBSCRIBERS API
app.delete('/api/subscribers/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete subscribers.' });
  }

  const subscribers = readData('subscribers');
  const filtered = subscribers.filter(s => s.id !== req.params.id);

  if (subscribers.length === filtered.length) {
    return res.status(404).json({ error: 'Subscriber not found.' });
  }

  writeData('subscribers', filtered);
  res.status(200).json({ success: true, message: 'Subscriber deleted successfully.' });
});

// CAREER OPEN POSITIONS CRUD
app.post('/api/careers', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, department, location, type, salary, description, requirements, responsibilities } = req.body;
  if (!title || !department || !location || !type || !description) {
    return res.status(400).json({ error: 'Title, department, location, type, and description are required.' });
  }

  const jobs = readData('careers');
  const reqArr = Array.isArray(requirements) ? requirements : (requirements ? requirements.split('\n').map(r => r.trim()).filter(Boolean) : []);
  const respArr = Array.isArray(responsibilities) ? responsibilities : (responsibilities ? responsibilities.split('\n').map(r => r.trim()).filter(Boolean) : []);

  const newJob = {
    id: `job-${Date.now()}`,
    title,
    department,
    location,
    type,
    salary: salary || 'DOE',
    description,
    requirements: reqArr,
    responsibilities: respArr
  };

  jobs.push(newJob);
  writeData('careers', jobs);

  res.status(201).json({ success: true, job: newJob });
});

app.put('/api/careers/:id', requireAuth, (req, res) => {
  if (!checkPermission('write', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Viewer cannot modify content.' });
  }

  const { title, department, location, type, salary, description, requirements, responsibilities } = req.body;
  const jobs = readData('careers');
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);

  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Career position not found.' });
  }

  const reqArr = Array.isArray(requirements) ? requirements : (requirements ? requirements.split('\n').map(r => r.trim()).filter(Boolean) : []);
  const respArr = Array.isArray(responsibilities) ? responsibilities : (responsibilities ? responsibilities.split('\n').map(r => r.trim()).filter(Boolean) : []);

  const updatedJob = {
    ...jobs[jobIndex],
    title,
    department,
    location,
    type,
    salary: salary || jobs[jobIndex].salary,
    description,
    requirements: reqArr,
    responsibilities: respArr
  };

  jobs[jobIndex] = updatedJob;
  writeData('careers', jobs);

  res.status(200).json({ success: true, job: updatedJob });
});

app.delete('/api/careers/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete positions.' });
  }

  const jobs = readData('careers');
  const filtered = jobs.filter(j => j.id !== req.params.id);

  if (jobs.length === filtered.length) {
    return res.status(404).json({ error: 'Position not found.' });
  }

  writeData('careers', filtered);
  res.status(200).json({ success: true, message: 'Position deleted successfully.' });
});

// JOB APPLICATIONS API
app.delete('/api/applications/:id', requireAuth, (req, res) => {
  if (!checkPermission('delete', req.user.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin can delete job applications.' });
  }

  const apps = readData('applications');
  const appItem = apps.find(a => a.id === req.params.id);

  if (!appItem) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  // Delete resume file if exists
  if (appItem.resumePath) {
    const filePath = path.join(__dirname, 'public', appItem.resumePath);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting resume file:', err);
      }
    }
  }

  const filtered = apps.filter(a => a.id !== req.params.id);
  writeData('applications', filtered);

  res.status(200).json({ success: true, message: 'Application deleted successfully.' });
});


// Handle 404
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found - 404 | Manssouri Tech',
    metaDescription: 'The page you are looking for does not exist on Manssouri Tech.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
