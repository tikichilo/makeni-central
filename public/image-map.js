'use strict';

(function () {
  let imageMap = {};

  function mapKey(value) {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    try {
      return decodeURIComponent(new URL(value, window.location.origin).pathname);
    } catch (err) {
      console.warn('[images] invalid local image key:', value, err);
      return value;
    }
  }

  function optimizeCloudinaryUrl(url, width) {
    if (typeof url !== 'string' || !url.includes('res.cloudinary.com/')) return url;
    const marker = '/image/upload/';
    const index = url.indexOf(marker);
    if (index < 0) return url;
    const before = url.slice(0, index + marker.length);
    const remainder = url.slice(index + marker.length);
    const segments = remainder.split('/');
    const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment));
    const resourcePath = versionIndex >= 0
      ? segments.slice(versionIndex).join('/')
      : segments.slice(1).join('/');
    return `${before}f_auto,q_auto,w_${width}/${resourcePath}`;
  }

  function cloudinaryImageUrl(url, width) {
    const mapped = imageMap[mapKey(url)];
    const value = mapped || url;
    const mappedWidth = mapped && mapped.match(/(?:^|[,/])w_(\d+)(?:[,/]|$)/);
    return optimizeCloudinaryUrl(value, Number(width) || (mappedWidth ? Number(mappedWidth[1]) : 800));
  }

  function resolveElement(element) {
    if (element.matches && element.matches('[data-cloudinary-key]')) {
      const key = mapKey(element.dataset.cloudinaryKey);
      const mapped = imageMap[key];
      if (mapped) {
        const mappedWidth = mapped.match(/(?:^|[,/])w_(\d+)(?:[,/]|$)/);
        const width = element.dataset.cloudinaryWidth || element.getAttribute('width') ||
          (mappedWidth && mappedWidth[1]);
        const url = cloudinaryImageUrl(mapped, width);
        if (element.tagName === 'META') element.setAttribute('content', url);
        else element.setAttribute('src', url);
        element.removeAttribute('data-cloudinary-key');
      } else if (element.dataset.localFallback) {
        element.setAttribute('src', element.dataset.localFallback);
        element.removeAttribute('data-cloudinary-key');
        element.removeAttribute('data-local-fallback');
      }
    }

    if (element.matches && element.matches('[data-cloudinary-background]')) {
      const key = mapKey(element.dataset.cloudinaryBackground);
      const mapped = imageMap[key];
      if (mapped) {
        const width = Number(element.dataset.cloudinaryWidth) || 1600;
        element.style.backgroundImage = `url("${cloudinaryImageUrl(mapped, width)}")`;
        element.removeAttribute('data-cloudinary-background');
      } else if (element.dataset.localBackground) {
        element.style.backgroundImage = `url("${element.dataset.localBackground}")`;
        element.removeAttribute('data-cloudinary-background');
      }
    }

    if (element.querySelectorAll) {
      element.querySelectorAll('[data-cloudinary-key], [data-cloudinary-background]').forEach(resolveElement);
    }
  }

  window.cloudinaryImageUrl = cloudinaryImageUrl;
  window.cloudinaryImageMapReady = fetch('/image-map.json', { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`Image map request failed: HTTP ${response.status}`);
      return response.json();
    })
    .then(map => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) {
        throw new Error('The image map response has an invalid shape');
      }
      imageMap = map;
      resolveElement(document);
      return imageMap;
    })
    .catch(err => {
      console.warn('[images] Cloudinary image map is unavailable:', err);
      resolveElement(document);
      return imageMap;
    });

  new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          window.cloudinaryImageMapReady.then(() => resolveElement(node));
        }
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('error', event => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.dataset.localFallback && !img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'true';
      img.src = img.dataset.localFallback;
    }
  }, true);

})();
