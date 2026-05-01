(function () {
  const categoryLabels = {
    'getting-started': 'Start building',
    'sensor-basics': 'Sensor basics',
    'gait-analysis': 'Gait Analysis',
    'recording-analysis': 'Recording and analysis',
    'playable-app': 'Playable apps',
    'creative-coding': 'Creative coding',
    'research-integration': 'Research and integrations',
    'workshop-archive': 'Workshops',
    'developer-tool': 'Developer tools',
    'internal-test': 'Internal tests'
  };

  const fallbackCategoryByType = {
    'starter-template': 'sensor-basics',
    guide: 'getting-started',
    workshop: 'workshop-archive',
    tool: 'developer-tool',
    'internal-test': 'internal-test'
  };

  const gallery = document.querySelector('#gallery');
  const stats = document.querySelector('#stats');
  const categoryFilter = document.querySelector('#categoryFilter');
  const difficultyFilter = document.querySelector('#difficultyFilter');
  const searchFilter = document.querySelector('#searchFilter');

  let allEntries = [];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeLink(value) {
    if (!value) return '#';
    if (/^https?:\/\//.test(value)) return value;
    return value.startsWith('../') ? value : `../${value}`;
  }

  function demoLink(entry) {
    if (entry.links?.demo) return normalizeLink(entry.links.demo);
    if (!entry.path) return '#';
    if (entry.path.endsWith('.html')) return normalizeLink(entry.path);
    return normalizeLink(`${entry.path.replace(/\/?$/, '/') }index.html`);
  }

  function categoryFor(entry) {
    if (entry.category) return entry.category;
    if ((entry.topics || []).includes('game')) return 'playable-app';
    if ((entry.topics || []).includes('gait-analysis')) return 'gait-analysis';
    return fallbackCategoryByType[entry.type] || 'research-integration';
  }

  function difficultyFor(entry) {
    return entry.difficulty || (entry.type === 'starter-template' || entry.type === 'guide' ? 'beginner' : 'intermediate');
  }

  function sortValue(entry, index) {
    return Number.isInteger(entry.sort_order) ? entry.sort_order : 10000 + index;
  }

  function isPublicEntry(entry) {
    if (entry.type === 'internal-test') return false;
    if (entry.public_navigation === 'hidden') return false;
    return entry.status === 'public' || entry.status === 'public-candidate';
  }

  function populateFilters(entries) {
    const categories = [...new Set(entries.map(categoryFor))].sort();
    const difficulties = [...new Set(entries.map(difficultyFor))].sort();

    categoryFilter.insertAdjacentHTML('beforeend', categories.map((category) => {
      const label = categoryLabels[category] || category;
      return `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`;
    }).join(''));

    difficultyFilter.insertAdjacentHTML('beforeend', difficulties.map((difficulty) => (
      `<option value="${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</option>`
    )).join(''));
  }

  function entryMatches(entry) {
    const category = categoryFilter.value;
    const difficulty = difficultyFilter.value;
    const query = searchFilter.value.trim().toLowerCase();

    if (category && categoryFor(entry) !== category) return false;
    if (difficulty && difficultyFor(entry) !== difficulty) return false;
    if (!query) return true;

    const haystack = [
      entry.title,
      entry.value,
      ...(entry.topics || []),
      ...(entry.data || []),
      ...(entry.audience || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function card(entry) {
    const thumbnail = entry.thumbnail
      ? `<img src="${escapeHtml(normalizeLink(entry.thumbnail))}" alt="">`
      : `<span>No thumbnail yet</span>`;
    const devices = entry.device_count || entry.devices || 1;
    const verification = entry.needs_real_device_validation || (entry.validation || []).some((item) => item.includes('device'));

    return `
      <a class="card" href="${escapeHtml(demoLink(entry))}">
        <div class="thumb">${thumbnail}</div>
        <div class="card-body">
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.value || '')}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(difficultyFor(entry))}</span>
            <span class="pill">${devices} device${devices === 1 ? '' : 's'}</span>
            ${verification ? '<span class="pill">needs device check</span>' : ''}
          </div>
        </div>
      </a>
    `;
  }

  function render() {
    const filtered = allEntries.filter(entryMatches);
    const groups = new Map();

    filtered.forEach((entry) => {
      const category = categoryFor(entry);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(entry);
    });

    stats.textContent = `${filtered.length} of ${allEntries.length} public examples shown`;

    if (!filtered.length) {
      gallery.innerHTML = '<div class="empty">No examples match the current filters.</div>';
      return;
    }

    gallery.innerHTML = [...groups.entries()].map(([category, entries]) => {
      const cards = entries
        .sort((a, b) => sortValue(a, 0) - sortValue(b, 0) || a.title.localeCompare(b.title))
        .map(card)
        .join('');
      return `
        <section class="category">
          <h2>${escapeHtml(categoryLabels[category] || category)}</h2>
          <div class="grid">${cards}</div>
        </section>
      `;
    }).join('');
  }

  function setError(error) {
    gallery.innerHTML = `<div class="error">Could not load examples/catalog.json: ${escapeHtml(error.message)}</div>`;
  }

  fetch('catalog.json')
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    })
    .then((catalog) => {
      allEntries = (catalog.entries || [])
        .filter(isPublicEntry)
        .map((entry, index) => ({ ...entry, _index: index }))
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || a.title.localeCompare(b.title));
      populateFilters(allEntries);
      render();
    })
    .catch(setError);

  [categoryFilter, difficultyFilter, searchFilter].forEach((control) => {
    control.addEventListener('input', render);
  });
}());
