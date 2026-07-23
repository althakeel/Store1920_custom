#!/usr/bin/env node
/**
 * Security Verification Script
 * Run this before deploying to production
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Starting Security Verification...\n');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

// Check 1: .env files in .gitignore
console.log('1. Checking .gitignore...');
try {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (gitignore.includes('.env') && gitignore.includes('.env.local')) {
    checks.passed.push('✅ .env files are in .gitignore');
  } else {
    checks.failed.push('❌ .env files NOT properly configured in .gitignore');
  }
} catch (e) {
  checks.failed.push('❌ .gitignore file not found');
}

// Check 2: No .env.local in Git
console.log('2. Checking if .env.local is tracked by Git...');
const { execSync } = require('child_process');
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
  if (trackedFiles.includes('.env')) {
    checks.failed.push('❌ CRITICAL: .env file is tracked by Git! Remove it immediately!');
  } else {
    checks.passed.push('✅ No .env files tracked by Git');
  }
} catch (e) {
  checks.warnings.push('⚠️  Could not check Git tracked files (not a Git repo?)');
}

// Check 3: package.json has no vulnerabilities
console.log('3. Checking for known vulnerabilities...');
try {
  const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
  const audit = JSON.parse(auditResult);
  if (audit.metadata.vulnerabilities.high > 0 || audit.metadata.vulnerabilities.critical > 0) {
    checks.failed.push(`❌ Found ${audit.metadata.vulnerabilities.critical} critical and ${audit.metadata.vulnerabilities.high} high vulnerabilities. Run: npm audit fix`);
  } else {
    checks.passed.push('✅ No critical vulnerabilities found');
  }
} catch (e) {
  checks.warnings.push('⚠️  Could not run npm audit (dependencies not installed?)');
}

// Check 4: Hardcoded secrets in code
console.log('4. Scanning for hardcoded secrets...');
const dangerousPatterns = [
  /password\s*=\s*["'][^"']+["']/i,
  /api[_-]?key\s*=\s*["'][^"']+["']/i,
  /secret\s*=\s*["'][^"']+["']/i,
  /mongodb:\/\/[^"'\s]+/i,
  /Bearer\s+[A-Za-z0-9-._~+/]+=*/
];

let foundSecrets = false;
const filesToScan = [
  'components',
  'app',
  'lib',
  'configs'
];

function scanDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            checks.failed.push(`❌ Possible hardcoded secret in: ${fullPath}`);
            foundSecrets = true;
          }
        }
      }
    }
  } catch (e) {
    // Directory doesn't exist, skip
  }
}

filesToScan.forEach(dir => {
  if (fs.existsSync(dir)) {
    scanDirectory(dir);
  }
});

if (!foundSecrets) {
  checks.passed.push('✅ No hardcoded secrets detected');
}

// Check 5: Security headers in next.config.mjs
console.log('5. Checking security headers...');
try {
  const nextConfig = fs.readFileSync('next.config.mjs', 'utf8');
  const requiredHeaders = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Strict-Transport-Security',
    'Referrer-Policy'
  ];
  
  let missingHeaders = [];
  requiredHeaders.forEach(header => {
    if (!nextConfig.includes(header)) {
      missingHeaders.push(header);
    }
  });
  
  if (missingHeaders.length === 0) {
    checks.passed.push('✅ All security headers configured');
  } else {
    checks.warnings.push(`⚠️  Missing security headers: ${missingHeaders.join(', ')}`);
  }
} catch (e) {
  checks.failed.push('❌ Could not read next.config.mjs');
}

// Check 5b: API security controls (rate limit, CORS, Zod validation)
console.log('5b. Checking API security layer...');
try {
  const apiSecurity = fs.readFileSync('lib/apiSecurity.js', 'utf8');
  const apiValidate = fs.readFileSync('lib/apiValidate.js', 'utf8');
  const apiSchemas = fs.readFileSync('lib/apiSchemas.js', 'utf8');
  const proxy = fs.existsSync('proxy.ts')
    ? fs.readFileSync('proxy.ts', 'utf8')
    : (fs.existsSync('middleware.ts') ? fs.readFileSync('middleware.ts', 'utf8') : '');

  if (apiSecurity.includes('checkRateLimit') && apiSecurity.includes('applyCorsHeaders')) {
    checks.passed.push('✅ API rate limiting + CORS helpers present');
  } else {
    checks.failed.push('❌ Missing API rate limiting / CORS helpers in lib/apiSecurity.js');
  }

  if (proxy.includes('checkRateLimit') && proxy.includes('applyCorsHeaders')) {
    checks.passed.push('✅ Proxy/middleware enforces rate limit + CORS');
  } else {
    checks.warnings.push('⚠️  Proxy/middleware may not enforce global rate limit / CORS');
  }

  if (apiValidate.includes('parseJsonBody') && apiSchemas.includes("from 'zod'")) {
    checks.passed.push('✅ Zod request validation helpers present');
  } else {
    checks.warnings.push('⚠️  Zod validation helpers incomplete');
  }
} catch (e) {
  checks.warnings.push('⚠️  Could not verify API security layer files');
}

// Check 6: Firebase config not exposed
console.log('6. Checking Firebase configuration...');
try {
  const firebaseConfig = fs.readFileSync('lib/firebase.js', 'utf8');
  if (firebaseConfig.includes('NEXT_PUBLIC_') || firebaseConfig.includes('process.env.FIREBASE')) {
    checks.passed.push('✅ Firebase config uses environment variables');
  } else {
    checks.warnings.push('⚠️  Firebase config might be hardcoded');
  }
} catch (e) {
  checks.warnings.push('⚠️  Could not find lib/firebase.js');
}

// Print Results
console.log('\n' + '='.repeat(60));
console.log('📊 Security Verification Results');
console.log('='.repeat(60) + '\n');

if (checks.passed.length > 0) {
  console.log('✅ PASSED CHECKS:');
  checks.passed.forEach(check => console.log(`   ${check}`));
  console.log('');
}

if (checks.warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  checks.warnings.forEach(check => console.log(`   ${check}`));
  console.log('');
}

if (checks.failed.length > 0) {
  console.log('❌ FAILED CHECKS (FIX BEFORE DEPLOYMENT):');
  checks.failed.forEach(check => console.log(`   ${check}`));
  console.log('');
}

console.log('='.repeat(60));

if (checks.failed.length === 0) {
  console.log('✅ Security verification PASSED! Safe to deploy.');
  console.log('');
  console.log('Before deploying to production:');
  console.log('1. Enable HTTPS (automatic on Vercel)');
  console.log('2. Test security headers: https://securityheaders.com');
  console.log('3. Run: npm audit');
  console.log('4. Verify all .env variables are set in production');
  process.exit(0);
} else {
  console.log('❌ Security verification FAILED!');
  console.log('⚠️  DO NOT DEPLOY until issues are fixed!');
  process.exit(1);
}
