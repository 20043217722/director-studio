/**
 * Auto-deploy — push master + deploy gh-pages
 */
const { execSync } = require('child_process');
const path = require('path');

process.chdir(path.join(__dirname, '..'));
const log = (m) => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`);

try {
  log('Push master...');
  const r1 = execSync('git push origin master 2>&1', { timeout: 30000, encoding: 'utf-8' });
  log(`Master: ${r1.trim()}`);

  log('Deploy gh-pages...');
  const r2 = execSync(
    'git subtree split --prefix dist -b gh-pages-deploy 2>&1 && ' +
    'git push origin gh-pages-deploy:gh-pages --force 2>&1 && ' +
    'git branch -D gh-pages-deploy 2>&1',
    { timeout: 60000, encoding: 'utf-8' }
  );
  log(`gh-pages: ${r2.trim()}`);

  log('✅ DEPLOY COMPLETE — https://20043217722.github.io/director-studio/');
  process.exit(0);
} catch (e) {
  log(`FAILED: ${e.message?.slice(0, 100)}`);
  process.exit(1);
}
