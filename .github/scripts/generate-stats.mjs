import { writeFileSync, mkdirSync } from 'fs';

const USERNAME = 'unproduktif';
const TOKEN = process.env.GITHUB_TOKEN;

const headers = {
  'User-Agent': 'profile-stats-generator',
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Kotlin: '#A97BFF',
  Java: '#b07219',
  PHP: '#4F5D95',
  Blade: '#f7523f',
  HTML: '#e34c26',
  CSS: '#563d7c',
  'Jupyter Notebook': '#DA5B0B',
};
const DEFAULT_LANG_COLOR = '#8b949e';

async function main() {
  const user = await fetchJson(`https://api.github.com/users/${USERNAME}`);

  let repos = [];
  let page = 1;
  while (true) {
    const batch = await fetchJson(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`
    );
    repos = repos.concat(batch);
    if (batch.length < 100) break;
    page += 1;
  }

  const nonForkRepos = repos.filter((r) => !r.fork);
  const totalStars = nonForkRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForksReceived = nonForkRepos.reduce((sum, r) => sum + r.forks_count, 0);

  const langCounts = {};
  for (const r of nonForkRepos) {
    if (!r.language) continue;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const totalLangRepos = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const stats = [
    ['Public Repos', nonForkRepos.length],
    ['Total Stars', totalStars],
    ['Total Forks', totalForksReceived],
    ['Followers', user.followers],
  ];

  const width = 420;
  const statsHeight = 40 + stats.length * 28 + 20;
  const langBarWidth = width - 40;
  const langHeight = 40 + topLangs.length * 26 + 20;

  const statsSvg = buildCard({
    width,
    height: statsHeight,
    title: `${USERNAME}'s GitHub Stats`,
    body: stats
      .map(
        ([label, value], i) => `
      <text x="20" y="${58 + i * 28}" class="label">${escapeXml(label)}:</text>
      <text x="${width - 20}" y="${58 + i * 28}" text-anchor="end" class="value">${value}</text>`
      )
      .join(''),
  });

  const langRows = topLangs
    .map(([lang, count], i) => {
      const pct = (count / totalLangRepos) * 100;
      const y = 50 + i * 26;
      const color = LANG_COLORS[lang] || DEFAULT_LANG_COLOR;
      return `
      <circle cx="24" cy="${y - 5}" r="5" fill="${color}" />
      <text x="38" y="${y}" class="label">${escapeXml(lang)}</text>
      <text x="${width - 20}" y="${y}" text-anchor="end" class="value">${pct.toFixed(1)}%</text>
      <rect x="20" y="${y + 6}" width="${langBarWidth}" height="6" rx="3" fill="#21262d" />
      <rect x="20" y="${y + 6}" width="${(langBarWidth * pct) / 100}" height="6" rx="3" fill="${color}" />`;
    })
    .join('');

  const langSvg = buildCard({
    width,
    height: langHeight,
    title: 'Most Used Languages',
    body: langRows,
  });

  mkdirSync('profile-summary-card-output', { recursive: true });
  writeFileSync('profile-summary-card-output/stats.svg', statsSvg);
  writeFileSync('profile-summary-card-output/languages.svg', langSvg);

  console.log(`Generated cards for ${USERNAME}: ${nonForkRepos.length} repos, ${totalStars} stars.`);
}

function buildCard({ width, height, title, body }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#0d1117" stroke="#30363d" />
  <text x="20" y="30" fill="#4ade80" font-family="Segoe UI, Ubuntu, Helvetica, sans-serif" font-size="16" font-weight="700">${escapeXml(title)}</text>
  <g font-family="Segoe UI, Ubuntu, Helvetica, sans-serif" font-size="13">
    <style>.label{fill:#c9d1d9} .value{fill:#e6edf3;font-weight:600}</style>
    ${body}
  </g>
</svg>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
