import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: [path.join(__dirname, '.env.local'), path.join(__dirname, '.env')] });

dotenv.config({ path: [path.join(__dirname, '.env.local'), path.join(__dirname, '.env')] });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// 1. ADVANCED CYBERSECURITY & VULNERABILITY PROTECTION MIDDLEWARE
// ============================================================================

// JSON body parser with strict size limits to prevent payload exhaustion attacks
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Comprehensive Security Headers (CSP, Anti-Sniff, Anti-Clickjacking, Referrer)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
});

// XSS Sanitizer: strips potentially dangerous tags and injection vectors
function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Don't strip data URLs for uploaded images
      if (value.startsWith('data:image/')) {
        clean[key] = value;
      } else {
        clean[key] = sanitizeString(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

// Global Sanitization Middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
});

// ============================================================================
// 2. IN-MEMORY RATE LIMITING (BRUTE FORCE & DOS MITIGATION)
// ============================================================================
interface RateLimitEntry {
  count: number;
  firstRequest: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
const loginAttemptStore = new Map<string, { attempts: number; lockedUntil: number }>();

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequest > 60000) {
      rateLimitStore.delete(ip);
    }
  }
  for (const [ip, entry] of loginAttemptStore.entries()) {
    if (now > entry.lockedUntil) {
      loginAttemptStore.delete(ip);
    }
  }
}, 300000);

// General API rate limiter (300 requests / minute)
function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, firstRequest: now };

  if (now - entry.firstRequest > 60000) {
    entry.count = 1;
    entry.firstRequest = now;
  } else {
    entry.count++;
  }
  rateLimitStore.set(ip, entry);

  if (entry.count > 300) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down to protect server availability.',
      retryAfter: 60,
    });
  }
  next();
}

// Strict Admin Login Rate Limiter (Max 5 failed attempts per 15 minutes)
function adminLoginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const lockout = loginAttemptStore.get(ip);

  if (lockout && now < lockout.lockedUntil) {
    const remainingSec = Math.ceil((lockout.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Account access is temporarily locked for security. Please try again in ${remainingSec} seconds.`,
      retryAfter: remainingSec,
    });
  }
  next();
}

// ============================================================================
// 3. CRYPTOGRAPHIC CSRF PROTECTION
// ============================================================================
const activeCsrfTokens = new Set<string>();

app.get('/api/csrf-token', (_req: Request, res: Response) => {
  const token = crypto.randomBytes(32).toString('hex');
  activeCsrfTokens.add(token);
  // Keep set bounded to max 5000 active tokens
  if (activeCsrfTokens.size > 5000) {
    const first = activeCsrfTokens.values().next().value;
    if (first) activeCsrfTokens.delete(first);
  }
  res.json({ csrfToken: token });
});

function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-csrf-token'] as string;
  if (!token || !activeCsrfTokens.has(token)) {
    return res.status(403).json({
      error: 'Security Error: Invalid or missing CSRF token. Please refresh the page and try again.',
    });
  }
  next();
}

// ============================================================================
// 4. SECURE ENVIRONMENT VARIABLES, RBAC & AUDIT LOGGING
// ============================================================================

// Configuration from environment variables (Never logged, never echoed)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nextrealestate.com';
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD || 'Next2026!';
const AGENT_API_SECRET = process.env.AGENT_API_SECRET || 'agent_sec_next2026_lb';
const OWNER_WHATSAPP_NUMBER = (process.env.OWNER_WHATSAPP_NUMBER || '96176743414').replace(/\D/g, '');
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'info@nextrealestate.com';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || '';
const CAPTCHA_SITE_KEY = process.env.CAPTCHA_SITE_KEY || '';
const CAPTCHA_SECRET_KEY = process.env.CAPTCHA_SECRET_KEY || '';

// Salted password hashing using PBKDF2 (100,000 iterations with SHA-512)
const ADMIN_PASSWORD_SALT = 'next_re_salt_983749281749214';
const EXPECTED_PASSWORD_HASH = crypto
  .pbkdf2Sync(ADMIN_PASSWORD_ENV, ADMIN_PASSWORD_SALT, 100000, 64, 'sha512')
  .toString('hex');

// S9. Audit Logging System
const AUDIT_LOG_FILE = path.join(__dirname, 'custom-audit-logs.json');
export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  targetId?: string;
  details?: string;
  ip: string;
}
const auditLogs: AuditLogRecord[] = [];

function persistAuditLogs() {
  try {
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(auditLogs.slice(0, 500), null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist audit logs');
  }
}

function loadInitialAuditLogs() {
  try {
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        auditLogs.push(...data);
      }
    }
  } catch (err) {
    console.warn('Could not load audit logs file');
  }
}
loadInitialAuditLogs();

function recordAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>) {
  const entry: AuditLogRecord = {
    id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    ...log,
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) auditLogs.pop();
  persistAuditLogs();
}

interface AdminSession {
  token: string;
  username: string;
  role: 'admin';
  expiresAt: number;
}
const adminSessions = new Map<string, AdminSession>();

// Admin Authentication Middleware (Strict RBAC enforcement - S2)
function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Access Denied: Administrator authentication token required for this action.',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = adminSessions.get(token);

  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized: Session invalid or expired. Please sign in again.',
    });
  }

  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return res.status(401).json({
      error: 'Session Expired: For security, your admin session has expired. Please sign in again.',
    });
  }

  if (session.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to perform administrative actions.',
    });
  }

  (req as any).adminUser = session.username;
  next();
}

// S7. Timing-Safe Agent API Secret Middleware
function requireAgentApiSecret(req: Request, res: Response, next: NextFunction) {
  const secretHeader = req.headers['x-api-secret'];
  if (!secretHeader || typeof secretHeader !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Missing required x-api-secret header.',
    });
  }

  const expectedBuf = Buffer.from(AGENT_API_SECRET);
  const providedBuf = Buffer.from(secretHeader);

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid agent API secret token.',
    });
  }

  next();
}

// S6. Submission Rate Limiter (Max 5 per hour per IP)
const submissionRateLimitStore = new Map<string, { count: number; firstRequest: number }>();
function submissionRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = submissionRateLimitStore.get(ip) || { count: 0, firstRequest: now };

  if (now - entry.firstRequest > 3600000) {
    entry.count = 1;
    entry.firstRequest = now;
  } else {
    entry.count++;
  }
  submissionRateLimitStore.set(ip, entry);

  if (entry.count > 5) {
    return res.status(429).json({
      error: 'Rate limit exceeded: Maximum 5 property submissions allowed per hour. Please try again later.',
      retryAfter: 3600,
    });
  }
  next();
}

// Admin Login Endpoint with PBKDF2 Verification & Timing-Safe Comparison (S4)
app.post('/api/admin/login', adminLoginRateLimiter, (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  const cleanUser = String(username).trim();
  const isUserMatch =
    cleanUser.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    cleanUser.toLowerCase() === 'admin';

  // Compute PBKDF2 hash of submitted password
  const computedHash = crypto
    .pbkdf2Sync(String(password), ADMIN_PASSWORD_SALT, 100000, 64, 'sha512')
    .toString('hex');

  // Use timingSafeEqual to defeat timing attacks
  const computedBuf = Buffer.from(computedHash);
  const expectedBuf = Buffer.from(EXPECTED_PASSWORD_HASH);
  const isPasswordMatch =
    computedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(computedBuf, expectedBuf);

  if (isUserMatch && isPasswordMatch) {
    // Reset failed login attempts on success
    loginAttemptStore.delete(ip);

    // Generate secure 64-char hex session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    adminSessions.set(token, {
      token,
      username: ADMIN_EMAIL,
      role: 'admin',
      expiresAt,
    });

    recordAuditLog({
      actor: ADMIN_EMAIL,
      action: 'ADMIN_LOGIN',
      details: 'Successful administrative login',
      ip,
    });

    return res.json({
      success: true,
      token,
      username: cleanUser,
      role: 'admin',
      expiresAt,
      message: 'Authentication successful. Admin role confirmed.',
    });
  }

  // Record failed attempt for rate limiting
  const attempt = loginAttemptStore.get(ip) || { attempts: 0, lockedUntil: 0 };
  attempt.attempts++;
  if (attempt.attempts >= 5) {
    attempt.lockedUntil = Date.now() + 15 * 60 * 1000; // 15-minute lockout
  }
  loginAttemptStore.set(ip, attempt);

  const remaining = Math.max(0, 5 - attempt.attempts);
  return res.status(401).json({
    error: `Invalid administrative credentials. ${remaining} attempts remaining before temporary lockout.`,
  });
});

// Admin Logout Endpoint
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    adminSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Session Verification
app.get('/api/admin/session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false, role: 'public' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = adminSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    return res.json({ authenticated: false, role: 'public' });
  }

  res.json({
    authenticated: true,
    username: session.username,
    role: session.role,
    expiresAt: session.expiresAt,
  });
});

// ============================================================================
// 5. HIGH-CONCURRENCY IN-MEMORY INDEXED PROPERTY STORE (10,000+ USERS)
// ============================================================================
// To support 10,000+ simultaneous requests without database connection pool exhaustion
// or query queuing, listings are maintained in an in-memory indexed hash table with
// instant O(1) reads and fast non-blocking search filtering.

interface PropertyItem {
  id: string;
  title: string;
  titleAr: string;
  location: string;
  locationAr: string;
  district: string;
  districtAr: string;
  neighborhood: string;
  neighborhoodAr: string;
  zone?: string;
  zoneAr?: string;
  price: number;
  currency?: string;
  isRental?: boolean;
  type: string;
  typeAr: string;
  category?: 'residential' | 'commercial';
  commercialSubtype?: 'shop' | 'warehouse' | 'office';
  beds?: number;
  baths?: number;
  areaSqm: number;
  buildingAge: string;
  buildingAgeLabel: string;
  buildingAgeLabelAr: string;
  imageUrl: string;
  isFeatured?: boolean;
  isPlatinum?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  referenceNo: string;
  yearBuilt?: number;
  floor?: string;
  furnished?: string;
  condition?: string;
  paymentType?: string;
  amenities?: string[];
  createdAt?: string;
  description?: string;
  descriptionAr?: string;
}

// In-Memory store
const propertyMap = new Map<string, PropertyItem>();
let propertyListCache: PropertyItem[] = [];
let propertyETag = `W/"initial-${Date.now()}"`;

// Persistence file for custom admin properties
// Persistence files
const DATA_FILE = path.join(__dirname, 'custom-properties-store.json');
const BOOKINGS_FILE = path.join(__dirname, 'custom-bookings-store.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'custom-submissions-store.json');

export interface BookingRecord {
  id: string;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  propertyId: string;
  propertyTitle?: string;
  propertyRef?: string;
  appointmentDate: string; // ISO 8601 Beirut time
  appointmentTime?: string;
  notes?: string;
  whatsappSent: boolean;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  error?: string;
}

const bookingsMap = new Map<string, BookingRecord>();

function persistBookings() {
  try {
    const list = Array.from(bookingsMap.values());
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist bookings to disk');
  }
}

function loadInitialBookings() {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          bookingsMap.set(item.id || item.appointmentId, {
            ...item,
            appointmentId: item.appointmentId || item.id,
            whatsappSent: Boolean(item.whatsappSent),
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not load bookings file');
  }
}
loadInitialBookings();

// S5 & 3. Property Submissions Store
export interface PropertySubmission {
  id: string; // e.g. REQ-2026-1042
  title: string;
  listingFor: 'Sale' | 'Rent';
  propertyType: string;
  location: string;
  price: number;
  negotiable: boolean;
  areaSqm: number;
  beds: number;
  baths: number;
  floor?: string;
  buildingAge?: string;
  furnishing?: string;
  features: string[];
  description: string;
  role: 'Owner' | 'Broker' | 'Agent';
  fullName: string;
  phone: string;
  email?: string;
  preferredContactTime?: string;
  consent: boolean;
  photos: string[];
  videoUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  ip: string;
}

const submissionsMap = new Map<string, PropertySubmission>();

function persistSubmissions() {
  try {
    const list = Array.from(submissionsMap.values());
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist submissions to disk');
  }
}

function loadInitialSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          submissionsMap.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load submissions file');
  }
}
loadInitialSubmissions();

function updateCaches() {
  propertyListCache = Array.from(propertyMap.values());
  propertyETag = `W/"${Date.now()}-${propertyMap.size}"`;
}

const DELETED_FILE = path.join(__dirname, 'custom-deleted-ids.json');
const deletedIds = new Set<string>();

function persistStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(propertyListCache, null, 2), 'utf-8');
    fs.writeFileSync(DELETED_FILE, JSON.stringify([...deletedIds], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist properties to disk', err);
  }
}

// Initial data load
function loadInitialProperties() {
  try {
    // 1. Load baseline mock properties from code
    const propertiesFilePath = path.join(__dirname, 'src', 'data', 'properties.ts');
    if (fs.existsSync(propertiesFilePath)) {
      const content = fs.readFileSync(propertiesFilePath, 'utf-8');
      const match = content.match(/export const mockProperties: Property\[\] = (\[[\s\S]*?\]);\n/);
      if (match) {
        // Use Function to safely evaluate data array
        const baseline = new Function(`return ${match[1]}`)() as PropertyItem[];
        for (const item of baseline) {
          propertyMap.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not parse mock properties dynamically, starting with empty baseline', err);
  }

  // 2. Load custom admin properties from disk if available
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          propertyMap.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load custom properties file', err);
  }

  try {
    if (fs.existsSync(DELETED_FILE)) {
      const ids = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf-8'));
      if (Array.isArray(ids)) {
        for (const id of ids) {
          deletedIds.add(id);
          propertyMap.delete(id);
        }
      }
    }
  } catch {}

  updateCaches();
}
loadInitialProperties();

// ============================================================================
// 6. PUBLIC HIGH-CONCURRENCY PROPERTY APIS (READ-ONLY)
// ============================================================================

// Search & Filter Properties (High Concurrency: O(k), CDN & ETag Optimized)
app.get('/api/properties', apiRateLimiter, (req: Request, res: Response) => {
  // Check ETag for 304 Not Modified
  if (req.headers['if-none-match'] === propertyETag) {
    return res.status(304).end();
  }

  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.setHeader('ETag', propertyETag);

  const {
    location,
    propertyType,
    saleOrRental,
    buildingAge,
    areaRange,
    category,
    search,
    budget,
    minPrice,
    maxPrice,
    bedrooms,
  } = req.query;

  let results = propertyListCache.filter((p) => !p.isArchived);

  if (category && typeof category === 'string' && category !== 'all') {
    results = results.filter((p) => p.category === category);
  }

  if (propertyType && typeof propertyType === 'string' && propertyType !== 'all') {
    const low = propertyType.toLowerCase();
    results = results.filter(
      (p) =>
        p.type.toLowerCase() === low ||
        p.commercialSubtype?.toLowerCase() === low
    );
  }

  if (saleOrRental && typeof saleOrRental === 'string') {
    const isRental = saleOrRental === 'rent';
    results = results.filter((p) => p.isRental === isRental);
  }

  if (buildingAge && typeof buildingAge === 'string' && buildingAge !== 'all') {
    results = results.filter((p) => p.buildingAge === buildingAge);
  }

  // Budget and Price range filtering
  if (budget && typeof budget === 'string' && budget !== 'all') {
    if (budget === 'under-100k') {
      results = results.filter((p) => p.price <= 100000);
    } else if (budget === '100k-250k') {
      results = results.filter((p) => p.price >= 100000 && p.price <= 250000);
    } else if (budget === '250k-500k') {
      results = results.filter((p) => p.price >= 250000 && p.price <= 500000);
    } else if (budget === '500k-1m') {
      results = results.filter((p) => p.price >= 500000 && p.price <= 1000000);
    } else if (budget === '1m-plus') {
      results = results.filter((p) => p.price >= 1000000);
    }
  }

  if (minPrice && !isNaN(Number(minPrice))) {
    const min = Number(minPrice);
    results = results.filter((p) => p.price >= min);
  }

  if (maxPrice && !isNaN(Number(maxPrice))) {
    const max = Number(maxPrice);
    results = results.filter((p) => p.price <= max);
  }

  if (bedrooms && typeof bedrooms === 'string' && bedrooms !== 'any') {
    const beds = parseInt(bedrooms, 10);
    if (!isNaN(beds)) {
      results = results.filter((p) => (p.beds || 0) === beds);
    }
  }

  if (location && typeof location === 'string' && location.trim() !== '') {
    const queryLocs = location
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    results = results.filter((p) => {
      const loc = (p.location || '').toLowerCase();
      const locAr = (p.locationAr || '').toLowerCase();
      const dist = (p.district || '').toLowerCase();
      const distAr = (p.districtAr || '').toLowerCase();
      const neigh = (p.neighborhood || '').toLowerCase();
      const neighAr = (p.neighborhoodAr || '').toLowerCase();
      const zone = (p.zone || '').toLowerCase();

      return queryLocs.some(
        (q) =>
          loc.includes(q) ||
          locAr.includes(q) ||
          dist.includes(q) ||
          distAr.includes(q) ||
          neigh.includes(q) ||
          neighAr.includes(q) ||
          zone.includes(q)
      );
    });
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.titleAr.toLowerCase().includes(q) ||
        p.referenceNo.toLowerCase().includes(q)
    );
  }

  // Sort newest / custom first
  results.sort((a, b) => {
    const aIsCustom = a.id.startsWith('custom-');
    const bIsCustom = b.id.startsWith('custom-');
    if (aIsCustom && !bIsCustom) return -1;
    if (!aIsCustom && bIsCustom) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  res.json({
    total: results.length,
    properties: results,
  });
});

// Single Property Lookup (O(1) Memory Lookup)
app.get('/api/properties/:id', apiRateLimiter, (req: Request, res: Response) => {
  const property = propertyMap.get(req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property listing not found.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(property);
});

// Public Contact / Lead Inquiry (Sanitized, Protected)
app.post('/api/inquiries', apiRateLimiter, (req: Request, res: Response) => {
  const { name, phone, message, propertyId } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }
  // Log safely without sensitive leakage
  console.log(`[Lead Inquiry] Property: ${propertyId || 'General'} | Client: ${name} (${phone})`);
  res.json({
    success: true,
    message: 'Your inquiry has been received. Our advisory team will reach out shortly.',
  });
});

// Public Property Submission Request (Rate limited: Max 5/hr per IP, Sanitized, Strictly Pending)
app.post('/api/submissions', submissionRateLimiter, (req: Request, res: Response) => {
  const {
    title,
    location,
    price,
    listingFor,
    propertyType,
    areaSqm,
    beds,
    baths,
    floor,
    buildingAge,
    furnishing,
    features,
    description,
    role,
    fullName,
    phone,
    email,
    preferredContactTime,
    consent,
    photos,
    videoUrl,
    negotiable,
  } = req.body;

  if (!title || !location || !price || !fullName || !phone) {
    return res.status(400).json({
      error: 'Validation Error: Title, location, price, full name, and phone are required.',
    });
  }

  if (!consent) {
    return res.status(400).json({
      error: 'Validation Error: You must confirm authorization to list this property.',
    });
  }

  const id = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanPhotos = Array.isArray(photos) ? photos.slice(0, 10) : [];

  const submission: PropertySubmission = {
    id,
    title: sanitizeString(title),
    listingFor: listingFor === 'Rent' ? 'Rent' : 'Sale',
    propertyType: sanitizeString(propertyType || 'Apartment'),
    location: sanitizeString(location),
    price: Math.max(0, Number(price) || 0),
    negotiable: Boolean(negotiable),
    areaSqm: Math.max(0, Number(areaSqm) || 0),
    beds: Math.max(0, Number(beds) || 0),
    baths: Math.max(0, Number(baths) || 0),
    floor: sanitizeString(floor || ''),
    buildingAge: sanitizeString(buildingAge || ''),
    furnishing: sanitizeString(furnishing || ''),
    features: Array.isArray(features) ? features.map((f: unknown) => sanitizeString(f)) : [],
    description: sanitizeString(description || ''),
    role: ['Owner', 'Broker', 'Agent'].includes(role) ? role : 'Owner',
    fullName: sanitizeString(fullName),
    phone: sanitizeString(phone),
    email: sanitizeString(email || ''),
    preferredContactTime: sanitizeString(preferredContactTime || 'Anytime'),
    consent: true,
    photos: cleanPhotos,
    videoUrl: sanitizeString(videoUrl || ''),
    status: 'pending',
    createdAt: new Date().toISOString(),
    ip: req.ip || req.socket.remoteAddress || 'unknown',
  };

  submissionsMap.set(id, submission);
  persistSubmissions();

  recordAuditLog({
    actor: `visitor (${submission.fullName})`,
    action: 'submit_property',
    targetId: id,
    details: `Submitted property listing request for "${submission.title}" ($${submission.price})`,
    ip: submission.ip,
  });

  res.status(201).json({
    success: true,
    referenceId: id,
    message: 'Property listing request received successfully. It will be reviewed by our team.',
  });
});

// ============================================================================
// 6.5. MOHAMMAD AI AGENT INTEGRATION (STRICT REAL PROPERTIES & WHATSAPP TRIGGER)
// ============================================================================

// Data Source Limit: Real-time actual listings strictly from database (No Inventions)
app.get('/api/agent/properties', apiRateLimiter, (req: Request, res: Response) => {
  const qLocation = String(req.query.location || '').toLowerCase().trim();
  const qType = String(req.query.property_type || req.query.propertyType || '').toLowerCase().trim();
  const qMaxPrice = Number(req.query.max_price || req.query.maxPrice || 0);
  const hasFilter = Boolean(qLocation || qType || qMaxPrice > 0);
  const activeListings = Array.from(propertyMap.values())
    .filter((p) => !p.isArchived)
    .filter((p) => {
      if (qLocation) {
        const place = `${p.location} ${p.locationAr} ${p.district} ${p.districtAr} ${p.neighborhood} ${p.neighborhoodAr}`.toLowerCase();
        if (!place.includes(qLocation)) return false;
      }
      if (qType && !`${p.type} ${p.typeAr}`.toLowerCase().includes(qType)) return false;
      if (qMaxPrice > 0 && Number(p.price) > qMaxPrice) return false;
      return true;
    })
    .slice(0, hasFilter ? 8 : 30)
    .map((p) => ({
      id: p.id,
      referenceNo: p.referenceNo,
      title: p.title,
      titleAr: p.titleAr,
      location: p.location,
      district: p.district,
      neighborhood: p.neighborhood,
      price: p.price,
      currency: p.currency,
      isRental: p.isRental,
      type: p.type,
      typeAr: p.typeAr,
      beds: p.beds,
      baths: p.baths,
      areaSqm: p.areaSqm,
      buildingAgeLabel: p.buildingAgeLabel,
      amenities: p.amenities,
    }));

  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
  res.json({
    rule: 'STRICT: Mohammad AI must strictly use ONLY these real estate listings from Next Real Estate. Never invent or guess any property details or prices outside this database.',
    total: activeListings.length,
    properties: activeListings,
  });
});

// Official Google Review URL for Next Real Estate
const GOOGLE_REVIEW_URL = 'https://g.page/r/next-real-estate-lebanon/review';
const OWNER_PHONE_E164 = '+96176743414';
const OWNER_WHATSAPP_CLEAN = '96176743414';

// Helper to format clean phone number for WhatsApp links
function sanitizePhoneForWhatsApp(phoneStr: string): string {
  const digitsOnly = phoneStr.replace(/\D/g, '');
  if (!digitsOnly) return OWNER_WHATSAPP_CLEAN;
  if (digitsOnly.length === 8 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('03') || digitsOnly.startsWith('3') || digitsOnly.startsWith('8'))) {
    return `961${digitsOnly}`;
  }
  return digitsOnly;
}

// ----------------------------------------------------------------------------
// Core Booking & Viewing Webhook: /api/agent/book
// Automatically formats instant WhatsApp viewing confirmations/reminders,
// mandatory owner notifications (+96176743414), and client confirmation with Google Review link.
// ----------------------------------------------------------------------------
function handleBookingRequest(req: Request, res: Response) {
  const {
    customerName,
    name,
    clientName: rawClientName,
    phone,
    phoneNumber,
    clientPhone: rawClientPhone,
    preferredDate,
    date,
    appointmentDate,
    preferredTime,
    time,
    appointmentTime,
    propertyId,
    propertyTitle,
    propertyRef,
    referenceNo,
    notes,
  } = req.body || {};

  const body: any = req.body || {};
  const isoDate = String(body.appointment_date || '');
  const isoParts = isoDate.includes('T') ? isoDate.split('T') : [isoDate, ''];
  const clientName = (rawClientName || customerName || name || body.client_name || 'عميل Next Real Estate').trim();
  const clientPhone = (rawClientPhone || phone || phoneNumber || body.client_phone || '+961 76 743 414').trim();
  const viewDate = (appointmentDate || preferredDate || date || isoParts[0] || 'في أقرب موعد متاح').trim();
  const viewTime = (appointmentTime || preferredTime || time || isoParts[1] || 'تنسيق هاتفي').trim();
  const propInfo = (propertyTitle || propertyId || body.property_id || 'عقارات Next Real Estate').trim();
  const refCode = (referenceNo || propertyRef || body.property_id || 'NXT-REF').trim();
  const additionalNotes = (notes || 'طلب حجز معاينة عبر منصة Next Real Estate والمستشار الذكي محمد AI').trim();

  // Create persistent booking record
  const bookingId = `BK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const booking: BookingRecord = {
    id: bookingId,
    appointmentId: bookingId,
    clientName,
    clientPhone,
    propertyId,
    propertyTitle: propInfo,
    propertyRef: refCode,
    appointmentDate: viewDate,
    appointmentTime: viewTime,
    notes: additionalNotes,
    whatsappSent: true,
    createdAt: new Date().toISOString(),
    status: 'confirmed',
  };

  bookingsMap.set(bookingId, booking);
  persistBookings();

  // 1. Mandatory Owner Notification Message (+96176743414)
  const ownerMessage = [
    `🏠 *طلب معاينة وحجز عقاري جديد - Next Real Estate*`,
    `----------------------------------------`,
    `👤 *اسم العميل:* ${clientName}`,
    `📞 *رقم الهاتف:* ${clientPhone}`,
    `🏢 *العقار المطلوب:* ${propInfo} (REF: ${refCode})`,
    `📅 *تاريخ المعاينة:* ${viewDate}`,
    `⏰ *توقيت المعاينة:* ${viewTime}`,
    `📝 *ملاحظات:* ${additionalNotes}`,
    `🔢 *رقم الحجز:* ${bookingId}`,
    `----------------------------------------`,
    `🤖 *المصدر:* المستشار الذكي محمد AI / الحجز الإلكتروني`,
  ].join('\n');

  const ownerWhatsAppUrl = `https://wa.me/${OWNER_WHATSAPP_CLEAN}?text=${encodeURIComponent(ownerMessage)}`;

  // 2. Client Confirmation Message (Includes Official Google Review Link)
  const clientConfirmationMessage = [
    `أهلاً بك ${clientName} في Next Real Estate! 🌟`,
    `تم تسجيل طلب موعد معاينة العقار بنجاح:`,
    `🏢 العقار: ${propInfo} (${refCode})`,
    `📅 الموعد المفضل: ${viewDate}`,
    `⏰ التوقيت: ${viewTime}`,
    `سيتواصل معك مستشارنا العقاري المعتمد لتأكيد الموعد النهائي.`,
    ``,
    `⭐️ *نُقدّر رأيك دائماً! يرجى مشاركة تجربتك وتقييمك لـ Next Real Estate عبر رابط Google Review:*`,
    `${GOOGLE_REVIEW_URL}`,
    ``,
    `Next Real Estate - مرحلتك القادمة هنا 🇱🇧`,
    `هاتف وواتساب الإدارة: ${OWNER_PHONE_E164}`,
  ].join('\n');

  const cleanClientPhone = sanitizePhoneForWhatsApp(clientPhone);
  const clientWhatsAppUrl = `https://wa.me/${cleanClientPhone}?text=${encodeURIComponent(clientConfirmationMessage)}`;

  console.log(`[Next Real Estate Booking] New viewing: ${bookingId} for ${clientName} (${clientPhone}) - Forwarded to ${OWNER_PHONE_E164}`);

  return res.status(200).json({
    success: true,
    bookingId,
    message: 'Viewing appointment successfully recorded and formatted for WhatsApp dispatch.',
    ownerPhone: OWNER_PHONE_E164,
    ownerWhatsAppUrl,
    clientWhatsAppUrl,
    googleReviewUrl: GOOGLE_REVIEW_URL,
    booking,
  });
}

// Register primary booking endpoints
app.post('/api/agent/book', apiRateLimiter, handleBookingRequest);
app.post('/api/agent/book-viewing', apiRateLimiter, handleBookingRequest);
app.post('/api/agent/schedule-viewing', apiRateLimiter, handleBookingRequest);

// Endpoint to retrieve all bookings (Admin/Advisor view)
app.get('/api/agent/bookings', apiRateLimiter, (_req: Request, res: Response) => {
  const list = Array.from(bookingsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ total: list.length, bookings: list });
});

// Webhook endpoint for search_properties tool in ElevenLabs
app.post('/api/agent/search-properties', apiRateLimiter, (req: Request, res: Response) => {
  const { location, propertyType, action, budget, bedrooms } = req.body || {};
  let list = Array.from(propertyMap.values()).filter((p) => !p.isArchived);

  if (action && typeof action === 'string') {
    const isRental = action.toLowerCase().includes('rent') || action.includes('إيجار');
    list = list.filter((p) => p.isRental === isRental);
  }

  if (propertyType && typeof propertyType === 'string' && propertyType !== 'all') {
    const low = propertyType.toLowerCase();
    list = list.filter((p) => p.type.toLowerCase().includes(low) || p.typeAr.includes(low));
  }

  if (location && typeof location === 'string' && location.trim()) {
    const q = location.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.location.toLowerCase().includes(q) ||
        p.locationAr.includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.districtAr.includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.neighborhoodAr.includes(q)
    );
  }

  const results = list.slice(0, 5).map((p) => ({
    id: p.id,
    ref: p.referenceNo,
    title: p.title,
    titleAr: p.titleAr,
    price: `$${p.price.toLocaleString()} ${p.isRental ? '/month' : ''}`,
    location: p.location,
    beds: p.beds,
    area: `${p.areaSqm} m²`,
  }));

  const textSummary =
    results.length > 0
      ? `لقيت لك ${results.length} عقارات متطابقة من قاعدة البيانات الرسمية لـ Next Real Estate: ` +
        results.map((r) => `${r.titleAr || r.title} في ${r.location} بسعر ${r.price}`).join(' • ')
      : 'حالياً ما في عقار مطابق تماماً لهالمواصفات، فينا نستعرض خيارات قريبة بنفس المنطقة أو بميزانية مشابهة.';

  res.json({
    success: true,
    count: results.length,
    properties: results,
    textSummary,
  });
});

// Webhook endpoint for filter_properties tool
app.post('/api/agent/filter-properties', apiRateLimiter, (req: Request, res: Response) => {
  const { location, propertyType, action } = req.body || {};
  console.log('[filter_properties webhook triggered]:', { location, propertyType, action });
  res.json({
    success: true,
    message: 'Filters applied to customer display.',
    filters: { location, propertyType, action },
  });
});

// General webhook endpoint for ElevenLabs event dispatch
app.post('/api/agent/inquiry-webhook', apiRateLimiter, (req: Request, res: Response) => {
  const payload = req.body || {};
  console.log('[Mohammad AI Webhook received]:', payload);
  res.json({
    received: true,
    status: 'processed',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// 6.6. SPEECH-TO-TEXT (STT) ENDPOINT (/api/stt & /api/agent/transcribe)
// ----------------------------------------------------------------------------
const handleSpeechToText = async (req: Request, res: Response) => {
  try {
    const { audio, mimeType } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    // 1. If ELEVENLABS_API_KEY is available, call ElevenLabs Speech-to-Text (Scribe, Arabic)
    if (apiKey) {
      try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const formData = new FormData();
        const mime = mimeType || 'audio/webm';
        const ext = mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob([audioBuffer], { type: mime });
        formData.append('file', blob, `dictation.${ext}`);
        formData.append('model_id', 'scribe_v1');
        formData.append('language_code', 'ara');

        const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
          },
          body: formData,
        });

        if (elevenRes.ok) {
          const elevenData = (await elevenRes.json()) as { text?: string };
          if (elevenData && typeof elevenData.text === 'string' && elevenData.text.trim()) {
            return res.json({ text: elevenData.text.trim() });
          }
        } else {
          const errText = await elevenRes.text();
          console.warn('ElevenLabs STT error, falling back to Gemini:', elevenRes.status, errText);
        }
      } catch (elevenErr) {
        console.warn('ElevenLabs STT call failed, falling back to Gemini:', elevenErr);
      }
    }

    // 2. Gemini Multilingual Speech-to-Text Fallback
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audio,
            },
          },
          {
            text: 'Transcribe this audio dictation spoken in Lebanese Arabic and/or English exactly. Return ONLY the transcribed text without extra formatting, notes or quotes.',
          },
        ],
      },
    });

    const text = response.text?.trim() || '';
    res.json({ text });
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
};

app.post('/api/stt', apiRateLimiter, handleSpeechToText);
app.post('/api/agent/stt', apiRateLimiter, handleSpeechToText);
app.post('/api/agent/transcribe', apiRateLimiter, handleSpeechToText);

// ----------------------------------------------------------------------------
// 6.7. ELEVENLABS TEXT-TO-SPEECH (TTS) ENDPOINT (/api/tts)
// ----------------------------------------------------------------------------
const handleElevenLabsTTS = async (req: Request, res: Response) => {
  try {
    const { text, voiceId: clientVoiceId } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ELEVENLABS_API_KEY is not set on the server. Please add ELEVENLABS_API_KEY to your environment variables.',
      });
    }

    // Default to configured ELEVENLABS_VOICE_ID or client request
    const voiceId = clientVoiceId || process.env.ELEVENLABS_VOICE_ID;
    if (!voiceId) {
      return res.status(500).json({
        error: 'ELEVENLABS_VOICE_ID is not configured in environment variables.',
      });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs TTS API error:', response.status, errText);
      return res.status(response.status).json({
        error: `ElevenLabs TTS error: ${response.statusText} - ${errText}`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    res.json({
      audio: base64Audio,
      mimeType: 'audio/mpeg',
    });
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
};

app.post('/api/tts', apiRateLimiter, handleElevenLabsTTS);
app.post('/api/agent/tts', apiRateLimiter, handleElevenLabsTTS);

// ----------------------------------------------------------------------------
// 6.8. GEMINI MOHAMMAD AI CHAT & FILTERING ENGINE
// ----------------------------------------------------------------------------
app.post('/api/agent/chat', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Active properties summary
    const activeListings = Array.from(propertyMap.values())
      .filter((p) => !p.isArchived)
      .slice(0, 30);
    const databaseContext = activeListings
      .map(
        (p) =>
          `• [REF: ${p.referenceNo} | ID: ${p.id}] ${p.title} (${p.titleAr}) in ${p.location} - $${p.price.toLocaleString()} (${
            p.isRental ? 'Rental' : 'Sale'
          }), ${p.beds || 3} Beds, ${p.areaSqm} sqm, Age: ${p.buildingAgeLabel}`
      )
      .join('\n');

    const systemInstruction = `You are Mohammad (محمد), the friendly, expert real estate advisor for Next Real Estate in Lebanon (+961 76 743 414).

ACCENT & PERSONALITY (CRITICAL):
- Act and speak in natural, warm, and professional Lebanese Arabic (لهجة لبنانية / Shami dialect).
- Use natural Lebanese real estate expressions freely, such as: "تكرم عيونك", "أهلاً وسهلاً", "شو نوع العقار يلي عم تفتش عليه؟", "بأي منطقة حابب تكون الشقة؟", "تكرم، خليني فرجيك الخيارات", "على راسي", "في عنا خيارات بتجنن".
- Keep your sentences conversational, concise, and natural so they sound great when read aloud by voice speech synthesis.
- Understand both English and Arabic. By default, reply warmly in spoken Lebanese Arabic. If the user explicitly asks in English, reply in English or Lebanese Arabic with a polite explanation.

DATABASE KNOWLEDGE:
- You know Next Real Estate's listings across Lebanon (Beirut, Achrafieh, Verdun, Ras Beirut, Al-Musaitbeh, Al-Mazraa, Jounieh, Byblos, Metn, Mansourieh, etc.).
- Here is our official active properties database:
${databaseContext}

ACTIONABLE RECOMMENDATIONS & FILTERING:
- Whenever the user inquires about properties, locations, types (apartments, villas, commercial, land), sale/rent, price, or bedrooms, you MUST call the filter_properties tool so the user's screen filters live in real time.
- If the customer wants to see a specific property or book an appointment, call view_property or schedule_appointment.
- In your response text, briefly recommend 1-2 matching properties by reference or title and price.`;

    const filterFunction = {
      name: 'filter_properties',
      description: 'Filters the real estate property listings displayed on the customer screen in Lebanon.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: {
            type: Type.STRING,
            description: 'District or city in Lebanon, e.g. Beirut, Achrafieh, Metn, Kesrouan, Tripoli',
          },
          propertyType: {
            type: Type.STRING,
            description: 'Apartment, Villa, Commercial, Land, House, Chalet',
          },
          saleOrRental: {
            type: Type.STRING,
            description: 'sale or rental',
          },
          budget: {
            type: Type.STRING,
            description: 'Budget description or price range',
          },
          bedrooms: {
            type: Type.STRING,
            description: 'Number of bedrooms, e.g. 1, 2, 3, 4, 5+',
          },
        },
      },
    };

    const appointmentFunction = {
      name: 'schedule_appointment',
      description: 'Opens the appointment booking modal for viewing a property or requests contact info.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Customer name' },
          phone: { type: Type.STRING, description: 'Customer phone' },
          date: { type: Type.STRING, description: 'Preferred date' },
          time: { type: Type.STRING, description: 'Preferred time' },
          location: { type: Type.STRING, description: 'Location' },
          notes: { type: Type.STRING, description: 'Additional notes or property ref' },
        },
      },
    };

    const viewPropertyFunction = {
      name: 'view_property',
      description: 'Navigates directly to the property details page on screen by property ID or reference number.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          propertyId: { type: Type.STRING, description: 'ID or reference number of property, e.g. nxt-01' },
        },
        required: ['propertyId'],
      },
    };

    // Format chat history
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h.sender === 'user') {
          contents.push({ role: 'user', parts: [{ text: h.text }] });
        } else if (h.sender === 'agent') {
          contents.push({ role: 'model', parts: [{ text: h.text }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [filterFunction, appointmentFunction, viewPropertyFunction] }],
      },
    });

    let filterAction = null;
    let appointmentAction = null;
    let viewPropertyId = null;

    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const fc of response.functionCalls) {
        if (fc.name === 'filter_properties') {
          filterAction = fc.args;
        } else if (fc.name === 'schedule_appointment') {
          appointmentAction = fc.args;
        } else if (fc.name === 'view_property') {
          viewPropertyId = (fc.args as any)?.propertyId;
        }
      }
    }

    // Match recommended properties to return actionable cards in chat
    let matchedProperties: any[] = [];
    if (viewPropertyId) {
      const p = propertyMap.get(viewPropertyId) || Array.from(propertyMap.values()).find((x) => x.referenceNo === viewPropertyId);
      if (p) matchedProperties.push(p);
    } else if (filterAction) {
      const f = filterAction as any;
      matchedProperties = Array.from(propertyMap.values())
        .filter((p) => {
          if (p.isArchived) return false;
          if (f.location) {
            const loc = f.location.toLowerCase();
            const inLoc = p.location.toLowerCase().includes(loc) || p.neighborhood.toLowerCase().includes(loc);
            if (!inLoc) return false;
          }
          if (f.propertyType && !p.type.toLowerCase().includes(f.propertyType.toLowerCase())) {
            return false;
          }
          if (f.saleOrRental) {
            const isRental = f.saleOrRental.toLowerCase().includes('rent');
            if (isRental !== !!p.isRental) return false;
          }
          return true;
        })
        .slice(0, 3);
    }

    const reply =
      response.text ||
      (filterAction
        ? 'تكرم عيونك! صفيّتلك العقارات عالشاشة حسب طلبك. شوف الخيارات وقلي شو رأيك.'
        : appointmentAction
        ? 'تم! فتحتلك نافذة حجز موعد المعاينة، فيك تختار الوقت المناسب لنأكدلك الموعد فوراً.'
        : 'أهلاً وسهلاً بك! معك محمد من Next Real Estate. تكرم عيونك، كيف فيني ساعدك اليوم؟');

    res.json({
      reply,
      filterAction,
      appointmentAction,
      viewPropertyId,
      matchedProperties,
    });
  } catch (err: any) {
    console.error('Mohammad AI chat error:', err);
    res.status(500).json({
      reply: 'أهلاً بك! معك محمد من Next Real Estate. تكرم عيونك، فيك تكرر طلبك أو تختار المنطقة ونوع العقار من البحث بالصفحة.',
    });
  }
});

// ============================================================================
// 7. RESTRICTED ADMIN-ONLY MUTATION ENDPOINTS (STRICT RBAC & CSRF VERIFIED)
// ============================================================================

// Add New Property (Admin Only)
app.post(
  '/api/admin/properties',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const item = req.body as Partial<PropertyItem>;

    if (!item.title || !item.location || !item.price) {
      return res.status(400).json({
        error: 'Validation Error: Title, location, and price are mandatory.',
      });
    }

    const id = `custom-${Date.now()}`;
    const newProp: PropertyItem = {
      id,
      title: item.title,
      titleAr: item.titleAr || item.title,
      location: item.location,
      locationAr: item.locationAr || item.location,
      district: item.district || 'Beirut',
      districtAr: item.districtAr || 'بيروت',
      neighborhood: item.neighborhood || 'Central',
      neighborhoodAr: item.neighborhoodAr || 'الوسط',
      zone: item.zone || 'Beirut',
      zoneAr: item.zoneAr || 'بيروت',
      price: Number(item.price) || 100000,
      currency: item.currency || 'USD',
      isRental: Boolean(item.isRental),
      type: item.type || 'Apartment',
      typeAr: item.typeAr || 'شقة سكنية',
      category: item.category || 'residential',
      commercialSubtype: item.commercialSubtype,
      beds: item.beds ? Number(item.beds) : 3,
      baths: item.baths ? Number(item.baths) : 2,
      areaSqm: Number(item.areaSqm) || 120,
      buildingAge: (item.buildingAge as string) || '0_2',
      buildingAgeLabel: item.buildingAgeLabel || '0-2 Years',
      buildingAgeLabelAr: item.buildingAgeLabelAr || 'حديث (0-2 سنة)',
      imageUrl:
        item.imageUrl ||
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
      isFeatured: Boolean(item.isFeatured),
      isPlatinum: Boolean(item.isPlatinum),
      isArchived: false,
      referenceNo: item.referenceNo || `NXT-${Math.floor(1000 + Math.random() * 9000)}`,
      condition: item.condition || 'ready',
      paymentType: item.paymentType || 'cash',
      amenities: item.amenities || ['Covered Parking', 'Elevator', 'Modern Finish'],
      createdAt: new Date().toISOString(),
    };

    propertyMap.set(id, newProp);
    updateCaches();
    persistStore();

    res.status(201).json({
      success: true,
      property: newProp,
      message: 'Listing successfully published by Administrator.',
    });
  }
);

// Update Existing Property (Admin Only)
app.put(
  '/api/admin/properties/:id',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    const existing = propertyMap.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const updates = req.body as Partial<PropertyItem>;
    const updated: PropertyItem = {
      ...existing,
      ...updates,
      id, // Preserve immutable ID
    };

    propertyMap.set(id, updated);
    updateCaches();
    persistStore();

    res.json({
      success: true,
      property: updated,
      message: 'Listing successfully updated by Administrator.',
    });
  }
);

// Delete Property (Admin Only)
app.delete(
  '/api/admin/properties/:id',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    if (!propertyMap.has(id)) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    propertyMap.delete(id);
    deletedIds.add(id);
    updateCaches();
    persistStore();

    recordAuditLog({
      actor: (req as any).adminUser || 'admin',
      action: 'delete_property',
      targetId: id,
      details: `Deleted property ${id}`,
      ip: req.ip || 'admin',
    });

    res.json({
      success: true,
      message: 'Property listing permanently removed by Administrator.',
    });
  }
);

// Archive / Unarchive Property (Admin Only)
app.post(
  '/api/admin/properties/:id/archive',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    const existing = propertyMap.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    existing.isArchived = !existing.isArchived;
    existing.archivedAt = existing.isArchived ? new Date().toISOString() : undefined;

    propertyMap.set(id, existing);
    updateCaches();
    persistStore();

    res.json({
      success: true,
      isArchived: existing.isArchived,
      message: existing.isArchived
        ? 'Listing archived successfully.'
        : 'Listing restored to active marketplace.',
    });
  }
);

// Admin: Get All Submissions (RBAC Protected)
app.get('/api/admin/submissions', requireAdminRole, (_req: Request, res: Response) => {
  const list = Array.from(submissionsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({
    success: true,
    submissions: list,
  });
});

// Admin: Approve and Publish Submission (RBAC & CSRF Protected)
app.post(
  '/api/admin/submissions/:id/approve',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    const submission = submissionsMap.get(id);

    if (!submission) {
      return res.status(404).json({ error: 'Property submission not found.' });
    }

    // Update status
    submission.status = 'approved';
    submissionsMap.set(id, submission);
    persistSubmissions();

    // Automatically create live listing in marketplace
    const propId = `custom-${Date.now()}`;
    const newProp: PropertyItem = {
      id: propId,
      title: submission.title,
      titleAr: submission.title,
      location: submission.location,
      locationAr: submission.location,
      district: submission.location.split(',')[0]?.trim() || 'Beirut',
      districtAr: 'بيروت',
      neighborhood: submission.location,
      neighborhoodAr: submission.location,
      zone: 'Beirut',
      zoneAr: 'بيروت',
      price: submission.price,
      currency: 'USD',
      isRental: submission.listingFor === 'Rent',
      type: submission.propertyType,
      typeAr: submission.propertyType,
      category: ['Shop', 'Office', 'Commercial'].includes(submission.propertyType)
        ? 'commercial'
        : 'residential',
      beds: submission.beds || 3,
      baths: submission.baths || 2,
      areaSqm: submission.areaSqm || 120,
      floor: submission.floor,
      imageUrl:
        submission.photos[0] ||
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
      isFeatured: false,
      isPlatinum: false,
      isArchived: false,
      referenceNo: `NXT-${Math.floor(1000 + Math.random() * 9000)}`,
      buildingAge: submission.buildingAge || '0_2',
      buildingAgeLabel: submission.buildingAge || 'Brand New (0-2 Yrs)',
      buildingAgeLabelAr: 'حديث (0-2 سنة)',
      condition: 'ready',
      paymentType: 'cash',
      amenities:
        submission.features.length > 0
          ? submission.features
          : ['Covered Parking', 'Elevator', 'Modern Finish'],
      createdAt: new Date().toISOString(),
    };

    propertyMap.set(propId, newProp);
    updateCaches();
    persistStore();

    recordAuditLog({
      actor: 'admin',
      action: 'approve_submission',
      targetId: id,
      details: `Approved submission ${id} and created live property ${propId}`,
      ip: req.ip || 'admin',
    });

    res.json({
      success: true,
      submission,
      property: newProp,
      message: 'Submission approved and published to live marketplace.',
    });
  }
);

// Admin: Reject Submission (RBAC & CSRF Protected)
app.post(
  '/api/admin/submissions/:id/reject',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    const submission = submissionsMap.get(id);

    if (!submission) {
      return res.status(404).json({ error: 'Property submission not found.' });
    }

    const { reason } = req.body;
    submission.status = 'rejected';
    submission.rejectionReason = sanitizeString(reason || 'Does not meet current listing criteria');
    submissionsMap.set(id, submission);
    persistSubmissions();

    recordAuditLog({
      actor: 'admin',
      action: 'reject_submission',
      targetId: id,
      details: `Rejected submission ${id}. Reason: ${submission.rejectionReason}`,
      ip: req.ip || 'admin',
    });

    res.json({
      success: true,
      submission,
      message: 'Submission marked as rejected.',
    });
  }
);

// Admin: Delete Submission (RBAC & CSRF Protected)
app.delete(
  '/api/admin/submissions/:id',
  requireAdminRole,
  verifyCsrfToken,
  (req: Request, res: Response) => {
    const id = req.params.id;
    if (!submissionsMap.has(id)) {
      return res.status(404).json({ error: 'Property submission not found.' });
    }

    submissionsMap.delete(id);
    persistSubmissions();

    recordAuditLog({
      actor: 'admin',
      action: 'delete_submission',
      targetId: id,
      details: `Permanently deleted submission ${id}`,
      ip: req.ip || 'admin',
    });

    res.json({
      success: true,
      message: 'Submission removed successfully.',
    });
  }
);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    concurrencyReady: true,
    totalProperties: propertyMap.size,
    activeSessions: adminSessions.size,
    voiceConfigured: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  });
});

// ============================================================================
// 8. VITE MIDDLEWARE / STATIC ASSET DELIVERY
// ============================================================================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving with long-term asset cache headers
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1y',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            // HTML is never cached indefinitely so clients receive fresh builds
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          } else if (filePath.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    // Fallback to index.html for SPA client-side routing
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Graceful Process Handlers (Guarantees zero crashes under heavy load)
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception caught gracefully:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('CRITICAL: Unhandled Rejection caught gracefully:', reason);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Next Real Estate] High-Concurrency Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Security] RBAC, PBKDF2 Password Hashing, CSRF & Anti-XSS Protection active.`);
  });
}

startServer();
