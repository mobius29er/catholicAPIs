// Progressive enhancement only. Every interaction here also works as a plain
// link or form submission with JavaScript switched off — this file just removes
// the page reload, and with it the scroll jump that came free with one.

(function () {
  'use strict';

  // -------------------------------------------------------------- theme ---

  var root = document.documentElement;

  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* private mode; the choice just won't persist */
      }
    });
  }

  // -------------------------------------------------------------- toast ---

  var toastEl = document.querySelector('[data-toast]');
  var toastTimer;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    // Force a reflow so the transition runs on a freshly unhidden element.
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () {
        toastEl.hidden = true;
      }, 250);
    }, 2600);
  }

  // -------------------------------------------------------------- menus ---

  // The sort and filter popovers are <details>, so they already open and close
  // without us. What they don't do natively is close when you click somewhere
  // else or press Escape, which is the whole difference between a menu and a
  // box that gets stuck open.

  function closeMenus(except) {
    var menus = document.querySelectorAll('[data-menu][open]');
    for (var i = 0; i < menus.length; i++) {
      if (menus[i] !== except) menus[i].open = false;
    }
  }

  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    // Clicking inside a menu closes the other one; clicking the page closes both.
    closeMenus(event.target.closest('[data-menu]'));
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var open = document.querySelector('[data-menu][open]');
    if (!open) return;
    open.open = false;
    var summary = open.querySelector('summary');
    if (summary) summary.focus();
  });

  // --------------------------------------------------------------- vote ---

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-vote] button[name="value"]');
    if (!button) return;

    var form = button.closest('[data-vote]');
    if (!form) return;

    event.preventDefault();
    submitVote(form, button);
  });

  function submitVote(form, button) {
    var value = button.value;
    var scoreEl = form.querySelector('[data-vote-score]');
    var status = form.querySelector('[data-vote-status]');
    var buttons = form.querySelectorAll('button[name="value"]');

    buttons.forEach(function (b) {
      b.disabled = true;
    });

    fetch(form.action, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'value=' + encodeURIComponent(value),
      credentials: 'same-origin',
    })
      .then(function (response) {
        if (response.status === 429) {
          toast('Too many votes from your network. Try again later.');
          return null;
        }
        if (!response.ok) throw new Error('vote failed: ' + response.status);
        return response.json();
      })
      .then(function (result) {
        if (!result) return;

        if (scoreEl) {
          scoreEl.textContent = result.score;
          scoreEl.title = result.upvotes + ' up · ' + result.downvotes + ' down';
          scoreEl.classList.remove('vote-flash');
          void scoreEl.offsetWidth;
          scoreEl.classList.add('vote-flash');
        }

        buttons.forEach(function (b) {
          b.setAttribute('aria-pressed', String(Number(b.value) === result.myVote));
        });

        if (status) {
          status.textContent =
            result.myVote === 1
              ? 'Upvoted. Score is now ' + result.score + '.'
              : result.myVote === -1
                ? 'Downvoted. Score is now ' + result.score + '.'
                : 'Vote removed. Score is now ' + result.score + '.';
        }
      })
      .catch(function () {
        // Fall back to the real form post rather than silently losing the vote.
        form.submit();
      })
      .finally(function () {
        buttons.forEach(function (b) {
          b.disabled = false;
        });
      });
  }

  // ------------------------------------------------------ live filtering ---

  // Refining the list used to be a full document navigation: the browser threw
  // away the scroll position, the hero re-rendered, the filter panel came back
  // open, and the reader ended up at the top of a page that no longer looked
  // like the one they had clicked in. Everything below fetches `?partial=1` and
  // swaps the results region instead. The markup is unchanged — these are the
  // same <a href>s, and without this file they still work, just with a reload.

  var TOGGLE_FLAGS = ['open_source', 'no_auth'];
  var pending = null;

  function resultsRegion() {
    return document.querySelector('[data-results]');
  }

  /**
   * The URL a toggle leads to, derived from wherever we are *now* rather than
   * from the link's rendered href. Two quick clicks in the panel would
   * otherwise both compute from the state before the first one landed, and the
   * second would silently undo the first.
   */
  function toggledUrl(key, value) {
    var url = new URL(window.location.href);
    var params = url.searchParams;

    if (key === 'q') {
      params.delete('q');
    } else if (TOGGLE_FLAGS.indexOf(key) !== -1) {
      if (params.has(key)) params.delete(key);
      else params.set(key, '1');
    } else {
      var values = params.getAll(key);
      var next = values.indexOf(value) === -1
        ? values.concat([value])
        : values.filter(function (v) { return v !== value; });
      params.delete(key);
      next.forEach(function (v) { params.append(key, v); });
    }

    params.delete('page');
    params.delete('partial');
    return url;
  }

  /** Which option the reader was on, so focus survives the swap. */
  function focusKey() {
    var el = document.activeElement;
    if (!el || !el.getAttribute || !el.getAttribute('data-facet')) return null;
    return el.getAttribute('data-facet') + '\u0000' + (el.getAttribute('data-facet-value') || '');
  }

  function restoreFocus(key) {
    if (!key) return;
    var parts = key.split('\u0000');
    var selector = '[data-facet="' + CSS.escape(parts[0]) + '"]' +
      (parts[1] ? '[data-facet-value="' + CSS.escape(parts[1]) + '"]' : ':not([data-facet-value])');
    var el = document.querySelector(selector);
    if (el) el.focus();
  }

  function applyFresh(fresh) {
    if (!fresh) return;

    var sortLabel = document.querySelector('[data-sort-label]');
    var freshSort = fresh.querySelector('[data-fresh-sort]');
    if (sortLabel && freshSort) sortLabel.textContent = freshSort.textContent;

    var badge = document.querySelector('[data-filter-badge]');
    var freshCount = fresh.querySelector('[data-fresh-count]');
    if (badge && freshCount) {
      badge.textContent = freshCount.textContent;
      badge.hidden = freshCount.textContent === '0';
    }

    var heading = document.querySelector('[data-feed-heading]');
    var freshHeading = fresh.querySelector('[data-fresh-heading]');
    if (heading && freshHeading) heading.textContent = freshHeading.textContent;
    var currentParams = new URL(window.location.href).searchParams;
    var searchInput = document.querySelector('[data-search]');
    if (searchInput && document.activeElement !== searchInput) searchInput.value = currentParams.get('q') || '';


    // Replace the popover's *contents*, never the <details> around them, so a
    // reader part-way through ticking boxes keeps the panel open.
    var body = document.querySelector('[data-filter-body]');
    var freshFacets = fresh.querySelector('[data-fresh-facets]');
    if (body && freshFacets) body.innerHTML = freshFacets.innerHTML;
  }

  /**
   * Fetch a directory URL and swap in its results.
   * `scroll` is true only for pagination, where staying put would leave the
   * reader looking at the middle of a page they have not seen the top of.
   */
  function swapTo(url, options) {
    var region = resultsRegion();
    if (!region) {
      window.location.href = url.toString();
      return;
    }

    var opts = options || {};
    var target = new URL(url.toString(), window.location.href);
    var request = new URL(target.toString());
    request.searchParams.set('partial', '1');

    if (!opts.replaceState) window.history.pushState({ swap: true }, '', target);
    else window.history.replaceState({ swap: true }, '', target);

    region.setAttribute('aria-busy', 'true');

    if (pending) pending.abort();
    var controller = new AbortController();
    pending = controller;

    var keepFocus = focusKey();

    fetch(request.toString(), {
      headers: { accept: 'text/html' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(function (response) {
        if (!response.ok) throw new Error('partial failed: ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        var holder = document.createElement('div');
        holder.innerHTML = markup;

        var next = holder.querySelector('[data-results]');
        var live = resultsRegion();
        if (!next || !live) throw new Error('no results region');

        live.replaceWith(next);
        applyFresh(holder.querySelector('[data-fresh]'));
        restoreFocus(keepFocus);

        if (opts.scroll) {
          var anchor = document.getElementById('listings');
          if (anchor) anchor.scrollIntoView({ block: 'start' });
        }
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') return;
        // Any trouble at all: hand it back to the browser, which knows how to
        // render this URL the ordinary way.
        window.location.href = target.toString();
      })
      .finally(function () {
        if (pending === controller) pending = null;
        var current = resultsRegion();
        if (current) current.removeAttribute('aria-busy');
      });
  }

  function plainClick(event) {
    return !(
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  document.addEventListener('click', function (event) {
    if (!event.target.closest || !resultsRegion() || !plainClick(event)) return;

    var link = event.target.closest('a');
    if (!link || link.hasAttribute('download') || link.target) return;
    if (link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }

    var facet = link.getAttribute('data-facet');
    if (facet) {
      event.preventDefault();
      swapTo(toggledUrl(facet, link.getAttribute('data-facet-value')));
      return;
    }

    // Sort options, "clear all", topic links, pagination: these carry absolute
    // state rather than a toggle, so the rendered href is already right.
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '/') return;

    var url = new URL(href, window.location.href);
    if (url.pathname !== window.location.pathname) return;

    if (link.closest('.menu-sort')) {
      var selectedSort = url.searchParams.get('sort') || 'top';
      url = new URL(window.location.href);
      if (selectedSort === 'top') url.searchParams.delete('sort'); else url.searchParams.set('sort', selectedSort);
      url.searchParams.delete('page');
    }
    var paged = link.classList.contains('page-number') || link.classList.contains('page-step');
    if (!paged && !link.closest('[data-menu], [data-results], .rail')) return;

    event.preventDefault();
    // Picking a sort is a decision, not a refinement — the menu is done.
    closeMenus(null);
    swapTo(url, { scroll: paged });
  });

  window.addEventListener('popstate', function () {
    if (!resultsRegion()) return;
    swapTo(new URL(window.location.href), { replaceState: true });
  });

  // ------------------------------------------------------------ search ----

  // Bound to [data-search], not #q — the masthead field is #masthead-q, so the
  // old selector matched nothing and the debounce had never once run.
  var search = document.querySelector('[data-search]');
  if (search) {
    var debounce;
    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        if (resultsRegion()) {
          var url = new URL(window.location.href);
          var term = search.value.trim();
          if (term) url.searchParams.set('q', term);
          else url.searchParams.delete('q');
          url.searchParams.delete('page');
          swapTo(url, { replaceState: true });
        } else if (search.form) {
          search.form.requestSubmit ? search.form.requestSubmit() : search.form.submit();
        }
      }, 300);
    });
  }

  // -------------------------------------------------------- / to search ---

  // The masthead shows a "/" hint, so it had better do something.
  document.addEventListener('keydown', function (event) {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    var active = document.activeElement;
    var tag = active ? active.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (active && active.isContentEditable) return;

    var field = document.querySelector('[data-search]');
    if (!field) return;
    event.preventDefault();
    field.focus();
  });

  // ------------------------------------------------- submit form track ---

  // The submit form asks for different things depending on the track. Both
  // sets are in the DOM so the form still works without JavaScript; this just
  // hides the half that doesn't apply.
  var submitForm = document.querySelector('[data-submit-form]');
  if (submitForm) {
    var syncTrack = function () {
      var checked = submitForm.querySelector('[data-track-radio]:checked');
      var track = checked ? checked.value : 'api';
      submitForm.querySelectorAll('[data-track-only]').forEach(function (el) {
        el.hidden = el.getAttribute('data-track-only') !== track;
      });
    };
    submitForm.querySelectorAll('[data-track-radio]').forEach(function (radio) {
      radio.addEventListener('change', syncTrack);
    });
    syncTrack();
  }

  // Surface the outcome of no-JS redirects (?reported=1, ?error=rate-limited).
  var params = new URLSearchParams(window.location.search);
  if (params.get('reported') === '1') toast('Thank you — report received.');
  if (params.get('error') === 'rate-limited') toast('Too many requests. Try again later.');
})();
