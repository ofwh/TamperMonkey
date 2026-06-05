// ==UserScript==
// @name            Endless Google (Refactored)
// @description     Load more results automatically and endlessly.
// @author          tumpio
// @namespace       tumpio@sci.fi
// @homepageURL     https://openuserjs.org/scripts/tumpio/Endless_Google
// @supportURL      https://github.com/tumpio/gmscripts/issues
// @icon            https://github.com/tumpio/gmscripts/raw/master/Endless_Google/large.png
// @include         http://www.google.*
// @include         https://www.google.*
// @include         https://encrypted.google.*
// @run-at          document-start
// @version         1.0.0
// @license         MIT
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    centerSelector: '#center_col',
    loadWindowSize: 1.6,
    maxPages: 10,
    globalFilters: ['#foot', '#bottomads'],
    contentFilters: ['#foot', '#bottomads', '#extrares', '#imagebox_bigimages'],
    loadingText: 'Loading next page...',
  };

  const STYLE = `
:root {
  --eg-divider-line: #ededed;
  --eg-divider-text: #dbdbdb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --eg-divider-line: #4a4a4a;
    --eg-divider-text: #b7bcc5;
  }
}

.eg-page-number {
  position: relative;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  font-size: 36px;
  line-height: normal;
  color: var(--eg-divider-text);
  margin-left: -2em;
}
.eg-page-number-text {
  font: inherit;
  line-height: inherit;
  color: inherit;
}
.eg-page-number-divider {
  display: none;
}
.eg-page-number::before {
  content: "";
  background-color: var(--eg-divider-line);
  height: 1px;
  width: calc(100% + 2em);
  margin: 1em 0 1em 1em;
}
@media (max-width: 768px) {
  .eg-page-number {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.6em;
    padding: 0 2em;
    font-size: 30px;
    margin-left: 0;
    margin: 0.85em 0;
  }

  .eg-page-number::before {
    display: none;
  }

  .eg-page-number-divider {
    display: block;
    flex: 1;
    min-width: 2em;
    height: 1px;
    background-color: var(--eg-divider-line);
  }

  .eg-page-number-text {
    flex: none;
  }
}
.eg-endless-msg {
  position: fixed;
  bottom: 0;
  left: 0;
  padding: 5px 10px;
  background: darkred;
  color: white;
  font-size: 11px;
  display: none;
}
.eg-endless-msg.shown {
  display: block;
}
`;

  const state = {
    pageNumber: 1,
    previousScrollY: 0,
    loading: false,
    messageEl: null,
  };

  if (shouldSkipPage()) {
    return;
  }

  document.addEventListener('DOMContentLoaded', init);

  function shouldSkipPage() {
    return location.href.includes('tbm=isch') || window.top !== window.self;
  }

  function init() {
    const center = document.querySelector(CONFIG.centerSelector);
    if (!center || !document.body || !document.head) {
      return;
    }

    state.previousScrollY = window.scrollY;

    filterNodes(document, CONFIG.globalFilters);
    injectStyle();
    createLoadingMessage();

    window.addEventListener('scroll', onScrollDocumentEnd, { passive: true });
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(STYLE));
    document.head.appendChild(style);
  }

  function createLoadingMessage() {
    state.messageEl = document.createElement('div');
    state.messageEl.className = 'eg-endless-msg';
    state.messageEl.textContent = CONFIG.loadingText;
    document.body.appendChild(state.messageEl);
  }

  function showLoading(show) {
    if (!state.messageEl) {
      return;
    }
    state.messageEl.classList.toggle('shown', show);
  }

  function onScrollDocumentEnd() {
    const y = window.scrollY;
    const delta = y - state.previousScrollY;

    if (state.loading || delta <= 0 || !isNearDocumentEnd(y)) {
      state.previousScrollY = y;
      return;
    }

    void requestNextPage();
    state.previousScrollY = y;
  }

  function isNearDocumentEnd(y) {
    return y + window.innerHeight * CONFIG.loadWindowSize >= document.body.clientHeight;
  }

  async function requestNextPage() {
    if (state.pageNumber >= CONFIG.maxPages) {
      stopListening();
      return;
    }

    const nextPageUrl = buildNextPageUrl(state.pageNumber);
    if (!nextPageUrl) {
      return;
    }

    state.loading = true;
    showLoading(true);

    try {
      const text = await fetchPageHtml(nextPageUrl);

      const parsed = parseGoogleResultPage(text, state.pageNumber);
      if (!parsed) {
        stopListening();
        return;
      }

      appendNextResultColumn(parsed.content);

      if (!parsed.hasResultList) {
        stopListening();
        return;
      }

      state.pageNumber += 1;
    } catch (_error) {
      // Keep quiet to match userscript behavior and avoid intrusive logs.
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  function buildNextPageUrl(pageNumber) {
    const nextPageUrl = new URL(location.href);
    if (!nextPageUrl.searchParams.has('q')) {
      return null;
    }

    nextPageUrl.searchParams.set('start', String(pageNumber * 10));
    return nextPageUrl;
  }

  async function fetchPageHtml(pageUrl) {
    const response = await fetch(pageUrl.href);
    return response.text();
  }

  function parseGoogleResultPage(htmlText, pageNumber) {
    const parser = new DOMParser();
    const htmlDocument = parser.parseFromString(htmlText, 'text/html');
    const content = htmlDocument.querySelector(CONFIG.centerSelector);

    if (!content) {
      return null;
    }

    content.id = `col_${pageNumber}`;
    content.style.marginLeft = '0';

    filterNodes(content, CONFIG.contentFilters);
    hydrateImages(htmlDocument, htmlText);

    return {
      content,
      hasResultList: Boolean(content.querySelector('#rso')),
    };
  }

  function appendNextResultColumn(content) {
    const center = document.querySelector(CONFIG.centerSelector);
    if (!center) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'next-col';

    const marker = createPageMarker(String(state.pageNumber + 1).padStart(2, '0'));

    wrapper.appendChild(marker);
    wrapper.appendChild(content);
    center.appendChild(wrapper);
  }

  function createPageMarker(pageText) {
    const marker = document.createElement('div');
    marker.className = 'eg-page-number';

    const leftDivider = document.createElement('span');
    leftDivider.className = 'eg-page-number-divider';
    marker.appendChild(leftDivider);

    const textNode = document.createElement('span');
    textNode.className = 'eg-page-number-text';
    textNode.textContent = pageText;
    marker.appendChild(textNode);

    const rightDivider = document.createElement('span');
    rightDivider.className = 'eg-page-number-divider';
    marker.appendChild(rightDivider);
    return marker;
  }

  function hydrateImages(doc, rawHtml) {
    hydrateThumbnailMap(doc, rawHtml);
    hydrateImageByPattern(doc, rawHtml);
    hydrateDataSrcImages(doc);
  }

  function hydrateThumbnailMap(doc, rawHtml) {
    const match = rawHtml.match(/google\.ldi=({.+?})/);
    if (!match || !match[1]) {
      return;
    }

    try {
      const thumbnailMap = JSON.parse(match[1]);

      for (const id in thumbnailMap) {
        setImageSourceById(doc, id, decodeHexEscapes(thumbnailMap[id]));
      }
    } catch (_error) {
      // Ignore parsing failures: Google markup changes frequently.
    }
  }

  function hydrateImageByPattern(doc, rawHtml) {
    const imageSourceMap = extractInlineImageSourceMap(rawHtml);
    if (!imageSourceMap.size) {
      return;
    }

    doc.querySelectorAll('g-img > img[id], div > img[id^=dimg_]').forEach((img) => {
      const src = imageSourceMap.get(img.id);
      if (src) {
        setImageSourceById(doc, img.id, src);
      }
    });
  }

  function extractInlineImageSourceMap(rawHtml) {
    const sourceMap = new Map();
    const scriptPattern = /var\ss='(\S+)';var\sii=\[([^\]]+)\];/g;
    let match;

    while ((match = scriptPattern.exec(rawHtml)) !== null) {
      const src = decodeHexEscapes(match[1]);
      if (!src) {
        continue;
      }

      const idPattern = /'([^']+)'/g;
      let idMatch;
      while ((idMatch = idPattern.exec(match[2])) !== null) {
        sourceMap.set(idMatch[1], src);
      }
    }

    return sourceMap;
  }

  function hydrateDataSrcImages(doc) {
    doc.querySelectorAll('img[data-src]').forEach((img) => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      img.style.visibility = 'visible';
    });
  }

  function setImageSourceById(doc, id, src) {
    if (!id || !src) {
      return;
    }

    const img = doc.getElementById(id);
    if (img) {
      img.src = src;
    }
  }

  function decodeHexEscapes(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\\x([0-9a-f]{2})/gi, (_, chunk) => {
      return String.fromCharCode(parseInt(chunk, 16));
    });
  }

  function filterNodes(root, selectors) {
    for (const selector of selectors) {
      for (const node of root.querySelectorAll(selector)) {
        node.remove();
      }
    }
  }

  function stopListening() {
    window.removeEventListener('scroll', onScrollDocumentEnd);
  }
})();
