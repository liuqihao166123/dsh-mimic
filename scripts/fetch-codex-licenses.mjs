// Read-only public licence retrieval. No credentials, local reads, or host configuration changes.
const commit = '19f8797c0f62abecb347e817aac36d18c5fc554e';
const results = await Promise.all(['LICENSE', 'NOTICE'].map(async name => {
  const url = 'https://raw.githubusercontent.com/openai/codex/' + commit + '/' + name;
  try { const response = await fetch(url, { signal: AbortSignal.timeout(25000) }); return { name, url, status: response.status, text: await response.text() }; }
  catch (error) { return { name, url, status: 0, error: String(error) }; }
}));
console.log(JSON.stringify({ commit, results }));
