#!/usr/bin/env node
/**
 * Bulk-delete GitHub deployments (oldest first).
 *
 * For GitHub Pages repos, the standard Deployments DELETE often returns 404 (GitHub only
 * allows deleting *inactive* deployments, and Pages deployment records are not deletable
 * that way). This script tries both: Deployments DELETE, then Pages "cancel deployment"
 * using the commit SHA. If both fail, the deployment is skipped.
 *
 * Usage:
 *   Set GITHUB_TOKEN (required): PAT with "repo" scope (and "Pages" read if using Pages).
 *   Optionally set GITHUB_REPO or pass as arg: owner/repo (default: 23johnw/Fc25-score-keeper)
 *
 *   node scripts/delete-old-github-deployments.js [count]
 *
 * Windows:
 *   set GITHUB_TOKEN=ghp_xxx
 *   node scripts/delete-old-github-deployments.js 100
 *
 * Default: tries to delete/cancel the 100 oldest deployments.
 */

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO || '23johnw/Fc25-score-keeper';
const count = Math.min(parseInt(process.argv[2], 10) || 100, 500);

if (!token) {
  console.error('Set GITHUB_TOKEN (Personal Access Token with repo scope).');
  process.exit(1);
}

const [owner, repoName] = repo.split('/');
if (!owner || !repoName) {
  console.error('GITHUB_REPO or repo arg must be owner/repo (e.g. 23johnw/Fc25-score-keeper).');
  process.exit(1);
}

const base = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${token}`,
};

async function listAllDeployments() {
  const all = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const res = await fetch(
      `${base}/repos/${owner}/${repoName}/deployments?per_page=${perPage}&page=${page}`,
      { headers }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`List deployments failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return all;
}

async function deleteDeploymentApi(id) {
  const res = await fetch(
    `${base}/repos/${owner}/${repoName}/deployments/${id}`,
    { method: 'DELETE', headers }
  );
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  const t = await res.text();
  throw new Error(`Delete ${id} failed: ${res.status} ${t}`);
}

async function cancelPagesDeployment(pagesDeploymentId) {
  const res = await fetch(
    `${base}/repos/${owner}/${repoName}/pages/deployments/${encodeURIComponent(pagesDeploymentId)}/cancel`,
    { method: 'POST', headers }
  );
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  const t = await res.text();
  throw new Error(`Pages cancel ${pagesDeploymentId} failed: ${res.status} ${t}`);
}

async function deleteOrCancelDeployment(d) {
  const deleted = await deleteDeploymentApi(d.id);
  if (deleted) return 'deleted';
  if (d.sha) {
    const cancelled = await cancelPagesDeployment(d.sha);
    if (cancelled) return 'cancelled';
  }
  return 'skipped';
}

async function main() {
  console.log(`Listing deployments for ${repo}...`);
  const deployments = await listAllDeployments();
  console.log(`Total deployments: ${deployments.length}`);

  const sorted = deployments
    .filter((d) => d.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const toDelete = sorted.slice(0, count);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log(`Deleting/cancelling ${toDelete.length} oldest deployments...`);
  let deleted = 0;
  let cancelled = 0;
  let skipped = 0;
  for (let i = 0; i < toDelete.length; i++) {
    const d = toDelete[i];
    const result = await deleteOrCancelDeployment(d);
    if (result === 'deleted') {
      deleted++;
      console.log(`  [${i + 1}/${toDelete.length}] deleted ${d.id} (${d.created_at})`);
    } else if (result === 'cancelled') {
      cancelled++;
      console.log(`  [${i + 1}/${toDelete.length}] cancelled Pages ${d.id} / ${d.sha} (${d.created_at})`);
    } else {
      skipped++;
      console.log(`  [${i + 1}/${toDelete.length}] skipped ${d.id} (not deletable via API)`);
    }
  }
  console.log(`Done. Deleted: ${deleted}, Pages cancelled: ${cancelled}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
