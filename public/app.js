// Progressive enhancement only. Every interaction here also works as a plain
// form submission with JavaScript switched off — this file just removes the
// page reload.

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

  // ------------------------------------------------------------ search ----

  // Submit the search as the reader stops typing, so filtering feels live
  // without needing a client-side rendering layer.
  var search = document.getElementById('q');
  if (search && window.history && window.history.replaceState) {
    var debounce;
    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        var form = search.form;
        if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
      }, 450);
    });
  }

  // Surface the outcome of no-JS redirects (?reported=1, ?error=rate-limited).
  var params = new URLSearchParams(window.location.search);
  if (params.get('reported') === '1') toast('Thank you — report received.');
  if (params.get('error') === 'rate-limited') toast('Too many requests. Try again later.');
})();
