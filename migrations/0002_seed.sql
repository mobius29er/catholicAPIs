-- GENERATED FILE — do not edit by hand.
-- Source: data/seed.json
-- Regenerate: npm run seed:build
--
-- 28 listings. Upserts on slug; votes and moderation status are preserved.

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('church-calendar-api', 'Church Calendar API', 'Roman Catholic liturgical calendar as a no-auth REST API.', 'Serves the General Roman Calendar as reformed after the Second Vatican Council: the season, rank, liturgical colour and celebrations for any date, plus whole-year listings. Runs at calapi.inadiutorium.cz with no key and no rate limit, and the Ruby service behind it is open source so you can self-host a diocesan or religious-order calendar with its own proper celebrations. The usual starting point for anyone who needs ''what feast is today?''.', 'http://calapi.inadiutorium.cz/', 'http://calapi.inadiutorium.cz/api-doc', 'https://github.com/igneus/church-calendar-api', 'api', 'free', 'No key, no published rate limit.', 1, NULL, 'none', 'unknown', 0, '["Liturgical Calendar","Saints"]', '["en","cs","fr","it","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('litcal-api', 'Liturgical Calendar API (LitCal)', 'Generates the General Roman Calendar for any year from 1970 to 9999.', 'Calculates movable feasts and applies the precedence rules between solemnities, feasts and memorials, for national and diocesan calendars as well as the universal one. Also exposes a standalone endpoint for the date of Easter from 1583 onward. Output is available in several localisations and formats, which makes it a good fit when you need more than English.', 'https://litcal.johnromanodorazio.com/', 'https://litcal.johnromanodorazio.com/swagger.php', 'https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Liturgical Calendar"]', '["en","it","la","es","fr","de","pt","nl"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catholic-readings-api', 'Catholic Readings API', 'Daily Mass readings, saints and liturgical seasons as static JSON.', 'A free REST API for the day''s Mass readings, the saint or feast being kept, and the current liturgical season, with links back to the USCCB text and to Wikipedia for biographies. Because it is published as static JSON on GitHub Pages there is no rate limit and CORS is open, so a browser-only app can call it directly with no proxy.', 'https://cpbjr.github.io/catholic-readings-api/', 'https://cpbjr.github.io/catholic-readings-api/', 'https://github.com/cpbjr/catholic-readings-api', 'api', 'free', 'Static hosting, no rate limits advertised.', 1, NULL, 'none', 'yes', 0, '["Daily Readings","Saints","Liturgical Calendar"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('aelf-api', 'AELF API', 'Official French liturgical texts: Mass readings and the Hours.', 'AELF is the episcopal liturgical association for French-speaking countries, and this is the API behind its apps and website. It returns the readings for Mass and the offices of the Liturgy of the Hours by date and region, in the approved French translations. If you are building anything francophone this is the authoritative source rather than a scrape.', 'https://api.aelf.org/', 'https://api.aelf.org/', NULL, 'api', 'free', 'Free to call; check AELF''s terms before commercial or high-volume use.', 0, NULL, 'none', 'unknown', 1, '["Daily Readings","Liturgy of the Hours"]', '["fr"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('divine-office-json', 'Divine Office JSON', 'Liturgy of the Hours in English as JSON feeds.', 'The Divine Office apostolate publishes JSON alongside its podcast and apps, covering the hours of the breviary in English. Useful if you want to render Lauds, Vespers or Compline in your own interface instead of embedding someone else''s player. Confirm the current terms of use with the maintainers before shipping a public app on top of it.', 'https://divineoffice.org/json/', 'https://divineoffice.org/json/', NULL, 'api', 'free', 'Free feeds; terms of use are set by the publisher.', 0, NULL, 'unknown', 'unknown', 0, '["Liturgy of the Hours","Daily Readings"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('magisterium-ai-api', 'Magisterium AI API', 'Answers grounded in Church documents, with citations, over an OpenAI-compatible API.', 'A retrieval-augmented answer engine trained on the corpus of Church teaching — councils, encyclicals, the Catechism, canon law — that returns citations with every answer rather than free-associating. The API is OpenAI-compatible, so most existing SDKs and agent frameworks work against it by changing the base URL. Billing is pay-as-you-go on input and output tokens; the console shows usage.', 'https://www.magisterium.com/developers', 'https://www.magisterium.com/developers', NULL, 'api', 'paid', 'Pay-as-you-go per token. See the developer pricing page for current rates.', 0, NULL, 'api-key', 'unknown', 0, '["AI & Search","Church Documents","Catechism & Doctrine"]', '["en","es","fr","it","pt","de","pl"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('api-bible', 'API.Bible', 'American Bible Society''s scripture API, with a free non-commercial tier.', 'The largest licensed scripture API: hundreds of translations across many languages, addressable by book, chapter, verse or passage, with search. The Starter tier is free for non-commercial use with a monthly call allowance and a limited pick of copyrighted translations; commercial use means licensing the translations you ship. Check the catalogue for the Catholic editions you need — deuterocanonical coverage varies by translation.', 'https://api.bible/', 'https://docs.api.bible/', NULL, 'api', 'freemium', 'Free non-commercial Starter tier; paid plans and per-translation commercial licensing above it.', 0, NULL, 'api-key', 'unknown', 1, '["Bible"]', '["en","es","fr","pt","de","it","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('bibleget-io', 'BibleGet I/O', 'Catholic-canon scripture quotes for documents and web pages.', 'Built specifically for Catholic use: request a citation like ''Jn 3,16-18'' and get back formatted verse text, including the deuterocanonical books, across a set of approved Catholic translations. Ships alongside WordPress and LibreOffice integrations, which is a good sign the API surface is stable and the citation parser handles the usual continental notation.', 'https://www.bibleget.io/', 'https://www.bibleget.io/api-documentation/', 'https://github.com/BibleGet-I-O', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Bible"]', '["en","it","es","fr","pt","de","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('biblia-sacra-vulgata', 'Biblia Sacra Vulgata', 'The Latin Vulgate and the Catholic Public Domain Version, with study notes.', 'A REST API over the original Latin Vulgate paired verse-by-verse with its English translation, the Catholic Public Domain Version, plus study notes. Both texts are public domain, so there is no licensing question hanging over whatever you build — handy for side-by-side Latin/English readers and for anything that needs to ship the text offline.', 'https://github.com/aseemsavio/Biblia-Sacra-Vulgata', NULL, 'https://github.com/aseemsavio/Biblia-Sacra-Vulgata', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Bible"]', '["la","en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('wldeh-bible-api', 'wldeh/bible-api', 'CDN-served Bible text in 200+ versions, no key required.', 'Bible text published as flat JSON on a CDN rather than a running server, covering more than two hundred versions and languages. Nothing to authenticate against, nothing to rate limit, and latency is whatever your nearest edge node gives you. The trade-off is that you get text retrieval only — no search endpoint, no cross-references.', 'https://github.com/wldeh/bible-api', 'https://github.com/wldeh/bible-api#usage', 'https://github.com/wldeh/bible-api', 'api', 'free', 'Served from a public CDN.', 1, NULL, 'none', 'yes', 0, '["Bible"]', '["en","es","fr","pt","de","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('matos-soares-biblia-api', 'matosSoaresBibliaApi', 'The Sixto-Clementine Vulgate in Fr. Matos Soares'' Portuguese translation.', 'Verse-level access to the Portuguese translation of the Sixto-Clementine Vulgate made by Fr. Matos Soares — a standard Catholic Portuguese text that is hard to find in machine-readable form anywhere else. Small, focused, and open source.', 'https://github.com/edsonbittencourt/matosSoaresBibliaApi', NULL, 'https://github.com/edsonbittencourt/matosSoaresBibliaApi', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Bible"]', '["pt"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('liturgia-diaria', 'liturgia-diaria', 'Daily Mass readings in Portuguese.', 'An open-source API returning the day''s liturgy in Portuguese: first reading, psalm, gospel and the celebration being kept. The straightforward choice for Brazilian and Portuguese apps that would otherwise be scraping a diocesan website.', 'https://github.com/Dancrf/liturgia-diaria', NULL, 'https://github.com/Dancrf/liturgia-diaria', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Daily Readings"]', '["pt"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('lumen-impulse', 'lumen-impulse', 'Daily gospel reflections in German, English and Polish.', 'Generates a short reflection on the day''s gospel each morning through a GitHub Actions job backed by Magisterium AI, then publishes it as JSON. Worth knowing that the reflections are machine-generated: fine for a devotional widget, not a substitute for a homily or an approved commentary.', 'https://github.com/michaelporwol/lumen-impulse', NULL, 'https://github.com/michaelporwol/lumen-impulse', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Daily Readings","AI & Search"]', '["de","en","pl"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catholic-prayers-api', 'The Collection of Catholic Prayers API', 'Traditional prayers and devotions over REST.', 'A REST API over a broad collection of traditional Catholic prayers, devotions and liturgical texts — the Angelus, the rosary mysteries, novenas, litanies, the common prayers everyone needs and nobody wants to retype into a database. Convenient starting point for prayer apps and parish sites.', 'https://github.com/erickouassi/The-Collection-of-Catholic-Prayers-Api', NULL, 'https://github.com/erickouassi/The-Collection-of-Catholic-Prayers-Api', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Prayers"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('caminho-api', 'caminho-api', 'All 999 points of St. Josemaría Escrivá''s The Way.', 'A FastAPI service serving the complete text of The Way in Portuguese, point by point, so you can pull a single number or a random one. Small and single-purpose — the sort of thing a daily-quote bot is built on in an afternoon.', 'https://github.com/ElderFausto/caminho-api', NULL, 'https://github.com/ElderFausto/caminho-api', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Spiritual Reading"]', '["pt"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('geomesse-api', 'geomesse-api', 'Mass times, searchable by location.', 'An open-source API for finding when and where Mass is celebrated near a given place, from the Carpe Deum project. Coverage depends on the underlying dataset, so check your country before designing a feature around it.', 'https://github.com/carpedeum-fr/geomesse-api', NULL, 'https://github.com/carpedeum-fr/geomesse-api', 'api', 'free', NULL, 1, NULL, 'unknown', 'unknown', 0, '["Mass Times"]', '["fr","en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('motivational-api', 'MotivationalAPI', 'Catholic and secular encouragement, one request at a time.', 'Returns short motivational and consoling phrases from Catholic and secular sources. Built for apps that want a gentle line on a hard day — a widget, a bot, a lock screen.', 'https://github.com/GomezMig03/MotivationalAPI', NULL, 'https://github.com/GomezMig03/MotivationalAPI', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Quotes"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('sanctum-ipsum', 'sanctum-ipsum', 'Lorem ipsum, but from the saints.', 'A placeholder-text generator that fills your mockups with the words of the saints instead of Cicero. Usable from the website or as an API. Not serious infrastructure, and all the better for it.', 'https://github.com/graysonhicks/sanctum-ipsum', NULL, 'https://github.com/graysonhicks/sanctum-ipsum', 'api', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Developer Tools","Quotes"]', '["en","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('tamil-bible-database', 'Tamil Bible Database', 'Tamil scripture as a database dump with a PHP API.', 'The Tamil Bible in MySQL with a thin PHP API in front of it. Self-hosted rather than a service you call, which is exactly what you want if you are shipping to a region with patchy connectivity.', 'https://github.com/jayarathina/Tamil-Bible-Database', NULL, 'https://github.com/jayarathina/Tamil-Bible-Database', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Bible"]', '["ta"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('liturgical-calendar-mcp', 'liturgical-calendar-mcp', 'MCP server that lets AI agents query the liturgical calendar.', 'A Model Context Protocol server wrapping the Liturgical Calendar API, so an assistant can answer ''what colour are the vestments on the third Sunday of Advent 2027?'' by calling a tool instead of guessing. Drop it into any MCP-capable client.', 'https://github.com/CatholicOS/liturgical-calendar-mcp', NULL, 'https://github.com/CatholicOS/liturgical-calendar-mcp', 'mcp', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Liturgical Calendar","AI & Search"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('romcal', 'romcal', 'Generate the Roman Rite calendar locally, no network call.', 'A JavaScript and TypeScript library that computes the liturgical calendar in-process: seasons, ranks, colours, national propers, for any year. Because it runs locally it works offline, inside a Worker, or at build time — a different trade-off from calling a calendar API, and usually the better one for a frontend.', 'https://github.com/romcal/romcal', 'https://github.com/romcal/romcal#readme', 'https://github.com/romcal/romcal', 'library', 'free', 'MIT-licensed npm package.', 1, NULL, 'none', 'unknown', 0, '["Liturgical Calendar"]', '["en","fr","es","it","pt","pl","cs","sk"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catechism-ccc-json', 'catechism-ccc-json', 'The Catechism of the Catholic Church as structured JSON.', 'All 2,865 paragraphs of the Catechism in JSON, keyed by paragraph number and preserving the part/section/chapter/article hierarchy. Ready to index for search or to embed for retrieval — the usual first ingredient in a Catholic RAG pipeline.', 'https://github.com/nossbigg/catechism-ccc-json', NULL, 'https://github.com/nossbigg/catechism-ccc-json', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Catechism & Doctrine"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catholicism-in-json', 'catholicism-in-json', 'Catechism, Code of Canon Law and the GIRM in one JSON repo.', 'Three foundational texts already parsed into usable JSON: the Catechism, the Code of Canon Law, and the General Instruction of the Roman Missal. Saves you the miserable job of turning Vatican HTML into structured data three separate times.', 'https://github.com/aseemsavio/catholicism-in-json', NULL, 'https://github.com/aseemsavio/catholicism-in-json', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Catechism & Doctrine","Canon Law","Church Documents"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('vulgata-dataset', 'vulgata', 'Douay-Rheims and Clementine Vulgate, aligned.', 'The whole Bible with the Douay-Rheims English and the Clementine Vulgate Latin side by side, verse-aligned. Both public domain. If you are building a parallel reader or a Latin study tool, the alignment work is already done for you.', 'https://github.com/borderstech/vulgata', NULL, 'https://github.com/borderstech/vulgata', 'dataset', 'free', 'Public domain texts.', 1, NULL, 'none', 'unknown', 0, '["Bible"]', '["la","en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('cardinals-json', 'cardinals', 'Every cardinal of the Roman Church, in JSON.', 'A machine-readable list of the members of the College of Cardinals. Being a static repository, it is only as current as its last commit — check the history before relying on it for anything time-sensitive, and expect to refresh it around a consistory.', 'https://github.com/ChrisVo/cardinals', NULL, 'https://github.com/ChrisVo/cardinals', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Church Data"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('aquinas-opera-omnia', 'AquinasOperaOmnia', 'The complete works of St. Thomas Aquinas.', 'The full Aquinas corpus in machine-readable form — the Summa and a great deal besides. A large, clean text corpus for search, citation tooling or embeddings, and one of the few places to get the whole thing without scraping.', 'https://github.com/Geremia/AquinasOperaOmnia', NULL, 'https://github.com/Geremia/AquinasOperaOmnia', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Spiritual Reading","Catechism & Doctrine"]', '["la","en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('romanus-roman-catechism', 'romanus', 'The Roman Catechism of the Council of Trent, structured.', 'The Catechism of the Council of Trent in machine-readable form. Pairs naturally with the modern Catechism when you want to show both, and fills an obvious gap for anyone working on traditional catechetical material.', 'https://github.com/borderstech/romanus', NULL, 'https://github.com/borderstech/romanus', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Catechism & Doctrine"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('divinum-officium', 'Divinum Officium', 'The traditional Divine Office and Missal, source and all.', 'The project behind divinumofficium.com: the complete pre-conciliar breviary and missal across multiple editions, with the text files that generate them in the open. Not a REST API, but the canonical machine-readable source for the traditional office, and self-hostable.', 'https://www.divinumofficium.com/', NULL, 'https://github.com/DivinumOfficium/divinum-officium', 'dataset', 'free', NULL, 1, NULL, 'none', 'unknown', 0, '["Liturgy of the Hours","Traditional Latin Mass"]', '["la","en","it","de","hu","pl"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  pricing = excluded.pricing,
  pricing_note = excluded.pricing_note,
  open_source = excluded.open_source,
  license = excluded.license,
  auth = excluded.auth,
  cors = excluded.cors,
  official = excluded.official,
  categories = excluded.categories,
  languages = excluded.languages,
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');
