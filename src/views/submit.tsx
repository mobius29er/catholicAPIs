import type { FC } from 'hono/jsx';

export const CATEGORY_SUGGESTIONS = [
  'Liturgical Calendar',
  'Daily Readings',
  'Liturgy of the Hours',
  'Bible',
  'Prayers',
  'Saints',
  'Catechism & Doctrine',
  'Canon Law',
  'Church Documents',
  'AI & Search',
  'Mass Times',
  'Chant & Music',
  'Church Data',
  'Spiritual Reading',
  'Traditional Latin Mass',
  'Quotes',
  'Developer Tools',
];

export const Submit: FC<{
  errors?: string[];
  values?: Record<string, string>;
  turnstileSiteKey?: string;
}> = ({ errors = [], values = {}, turnstileSiteKey }) => (
  <div class="wrap narrow page">
    <h1>Submit an API</h1>
    <p class="lede">
      Anything that helps someone build Catholic software belongs here: hosted APIs, open
      datasets, libraries, MCP servers. Paid services are welcome — just be straight about the
      pricing. Submissions are reviewed by hand before they appear.
    </p>

    {errors.length > 0 && (
      <div class="alert alert-error" role="alert">
        <p>
          <strong>That didn't go through:</strong>
        </p>
        <ul>
          {errors.map((error) => (
            <li>{error}</li>
          ))}
        </ul>
      </div>
    )}

    <form method="post" action="/submit" class="form">
      <div class="field">
        <label for="name">
          Name <span class="req">required</span>
        </label>
        <input id="name" name="name" required maxlength={120} value={values.name ?? ''} />
      </div>

      <div class="field">
        <label for="tagline">
          One-line summary <span class="req">required</span>
        </label>
        <input
          id="tagline"
          name="tagline"
          required
          maxlength={160}
          value={values.tagline ?? ''}
          placeholder="Daily Mass readings and saints as JSON, no key needed."
        />
        <p class="hint">What it does, in one sentence. This is what shows in the listing.</p>
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" name="description" rows={5} maxlength={2000}>
          {values.description ?? ''}
        </textarea>
        <p class="hint">
          What it covers, what it costs, what it's good for, and anything a developer would want
          to know before depending on it.
        </p>
      </div>

      <div class="field">
        <label for="homepage_url">
          Homepage URL <span class="req">required</span>
        </label>
        <input
          id="homepage_url"
          name="homepage_url"
          type="url"
          required
          value={values.homepage_url ?? ''}
          placeholder="https://"
        />
      </div>

      <div class="field-row">
        <div class="field">
          <label for="docs_url">Documentation URL</label>
          <input id="docs_url" name="docs_url" type="url" value={values.docs_url ?? ''} placeholder="https://" />
        </div>
        <div class="field">
          <label for="repo_url">Source repository</label>
          <input id="repo_url" name="repo_url" type="url" value={values.repo_url ?? ''} placeholder="https://" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="kind">Type</label>
          <select id="kind" name="kind">
            <option value="api" selected={values.kind !== undefined ? values.kind === 'api' : true}>
              Hosted API
            </option>
            <option value="dataset" selected={values.kind === 'dataset'}>
              Dataset
            </option>
            <option value="library" selected={values.kind === 'library'}>
              Library
            </option>
            <option value="mcp" selected={values.kind === 'mcp'}>
              MCP server
            </option>
          </select>
        </div>

        <div class="field">
          <label for="pricing">Cost</label>
          <select id="pricing" name="pricing">
            <option value="free" selected={values.pricing !== undefined ? values.pricing === 'free' : true}>
              Free
            </option>
            <option value="freemium" selected={values.pricing === 'freemium'}>
              Freemium — free tier, paid above it
            </option>
            <option value="paid" selected={values.pricing === 'paid'}>
              Paid
            </option>
          </select>
        </div>

        <div class="field">
          <label for="auth">Authentication</label>
          <select id="auth" name="auth">
            <option value="none" selected={values.auth !== undefined ? values.auth === 'none' : true}>
              None
            </option>
            <option value="api-key" selected={values.auth === 'api-key'}>
              API key
            </option>
            <option value="oauth" selected={values.auth === 'oauth'}>
              OAuth
            </option>
            <option value="unknown" selected={values.auth === 'unknown'}>
              Not sure
            </option>
          </select>
        </div>
      </div>

      <div class="field field-check">
        <label>
          <input type="checkbox" name="open_source" value="1" checked={values.open_source === '1'} />
          The source code is open
        </label>
      </div>

      <div class="field">
        <label for="categories">
          Categories <span class="req">required</span>
        </label>
        <input
          id="categories"
          name="categories"
          required
          list="category-suggestions"
          value={values.categories ?? ''}
          placeholder="Daily Readings, Saints"
        />
        <datalist id="category-suggestions">
          {CATEGORY_SUGGESTIONS.map((category) => (
            <option value={category} />
          ))}
        </datalist>
        <p class="hint">Comma-separated. Reuse an existing category where one fits.</p>
      </div>

      <div class="field">
        <label for="languages">Content languages</label>
        <input
          id="languages"
          name="languages"
          value={values.languages ?? ''}
          placeholder="en, la, pt"
        />
        <p class="hint">
          Two-letter codes for the languages the <em>content</em> is in, comma-separated. Leave
          blank if it isn't text.
        </p>
      </div>

      <div class="field">
        <label for="submitter">Your name or handle</label>
        <input id="submitter" name="submitter" maxlength={80} value={values.submitter ?? ''} />
        <p class="hint">Optional, and shown to moderators only.</p>
      </div>

      <div class="field">
        <label for="submitter_note">Note for the moderators</label>
        <textarea id="submitter_note" name="submitter_note" rows={2} maxlength={500}>
          {values.submitter_note ?? ''}
        </textarea>
      </div>

      {/* Bots fill in every field they find; humans never see this one. */}
      <div class="hp" aria-hidden="true">
        <label for="website">Leave this field empty</label>
        <input id="website" name="website" tabindex={-1} autocomplete="off" />
      </div>

      {turnstileSiteKey && (
        <div class="field">
          <div class="cf-turnstile" data-sitekey={turnstileSiteKey} />
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
        </div>
      )}

      <button type="submit" class="btn btn-primary btn-wide">
        Submit for review
      </button>
    </form>
  </div>
);
