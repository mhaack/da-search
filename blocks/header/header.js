import { getMetadata, loadCSS, loadScript } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]'
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]'
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections
    .querySelectorAll('.nav-sections .default-content-wrapper > ul > li')
    .forEach((section) => {
      section.setAttribute('aria-expanded', expanded);
    });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded =
    forceExpanded !== null
      ? !forceExpanded
      : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = expanded || isDesktop.matches ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(
    navSections,
    expanded || isDesktop.matches ? 'false' : 'true'
  );
  button.setAttribute(
    'aria-label',
    expanded ? 'Open navigation' : 'Close navigation'
  );
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

function decorateSearchPanel(container) {
  container.innerHTML = '';

  const searchPanel = document.createElement('div');
  searchPanel.id = 'search';
  container.append(searchPanel);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search-input';
  searchInput.placeholder = 'Search';
  searchInput.classList.add('header-search-input');
  container.append(searchInput);

  // Create results container
  const resultsPanel = document.createElement('div');
  resultsPanel.id = 'search-results';
  resultsPanel.classList.add('search-results');
  container.append(resultsPanel);

  // Create individual result element
  const createResultElement = (data) => {
    const resultDiv = document.createElement('div');
    resultDiv.classList.add('search-result-item');

    const title = data.meta?.title || data.url || 'Untitled';
    const excerpt = data.excerpt || data.content || 'No description available';
    const url = data.meta?.url || data.url || '#';

    resultDiv.innerHTML = `
      <h4 class="search-result-title">
        <a href="${url}" target="_blank">${title}</a>
      </h4>
      <p class="search-result-excerpt">${excerpt}</p>
    `;
    return resultDiv;
  };

  // Display search results
  const displaySearchResults = async (searchResults, query) => {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (!searchResults || searchResults.results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="search-no-results">
          <p>No results found for "${query}"</p>
        </div>
      `;
      return;
    }

    // Create results header
    const resultsHeader = document.createElement('div');
    resultsHeader.classList.add('search-results-header');
    resultsHeader.innerHTML = `
      <h3>Search Results for "${query}" (${searchResults.results.length} found)</h3>
    `;
    resultsContainer.append(resultsHeader);

    // Process and display results
    for (const result of searchResults.results.slice(0, 5)) {
      try {
        const data = await result.data();
        const resultElement = createResultElement(data, result);
        resultsContainer.append(resultElement);
      } catch (error) {
        console.error('Error processing result:', error);
      }
    }
  };

  const clearSearchResults = () => {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
  };

  const displaySearchError = () => {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = `
      <div class="search-error">
        <p>Sorry, there was an error performing the search. Please try again.</p>
      </div>
    `;
  };

  // Debounce function to limit search frequency
  let searchTimeout;
  const debounceSearch = (callback, delay) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(callback, delay);
  };

  // Search handler
  const handleSearch = async (query) => {
    // load pagefind on the inital search
    if (!window.hlx.pagefind) {
      window.hlx.pagefind = await import(
        `${window.hlx.codeBasePath}/index/pagefind.js`
      );
    }

    try {
      if (query.length >= 2) {
        console.log(`Searching for: "${query}"`);
        const searchResults = await window.hlx.pagefind.search(query);
        displaySearchResults(searchResults, query);
      } else {
        clearSearchResults();
      }
    } catch (error) {
      console.error('Search error:', error);
      displaySearchError();
    }
  };

  // Add input event listener with debouncing
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    debounceSearch(() => handleSearch(query), 300); // 300ms delay
  });

  // Clear results when input is cleared
  searchInput.addEventListener('input', (e) => {
    if (e.target.value.trim().length === 0) {
      clearSearchResults();
    }
  });

  // Focus handler
  searchInput.addEventListener('focus', (e) => {
    document.body.classList.add('search-focused');

    // If there's text in the input and no results showing, trigger search
    const query = e.target.value.trim();
    if (query.length >= 2 && resultsPanel.innerHTML === '') {
      handleSearch(query);
    }
  });

  // Blur handler
  searchInput.addEventListener('blur', (e) => {
    // Remove blur effect when search loses focus
    document.body.classList.remove('search-focused');
  });

  // Add click outside handler to close search results
  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.nav-tools');
    if (searchContainer && !searchContainer.contains(e.target)) {
      // Only clear results if clicking outside, not on blur
      clearSearchResults();
      document.body.classList.remove('search-focused');
    }
  });

  // Prevent search results from closing when clicking inside them
  resultsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections
      .querySelectorAll(':scope .default-content-wrapper > ul > li')
      .forEach((navSection) => {
        if (navSection.querySelector('ul'))
          navSection.classList.add('nav-drop');
        navSection.addEventListener('click', () => {
          if (isDesktop.matches) {
            const expanded =
              navSection.getAttribute('aria-expanded') === 'true';
            toggleAllNavSections(navSections);
            navSection.setAttribute(
              'aria-expanded',
              expanded ? 'false' : 'true'
            );
          }
        });
      });
  }

  // search panel
  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () =>
    toggleMenu(nav, navSections, isDesktop.matches)
  );

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  const searchContainer = nav.querySelector('.nav-tools');
  decorateSearchPanel(searchContainer);
}
