-- GENERATED FILE — do not edit by hand.
-- Source: data/products.json
-- Regenerate: npm run seed:build
--
-- 16 listings. Upserts on slug; votes and moderation status are preserved.

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('hallow', 'Hallow', 'The prayer and meditation app that took Catholic devotion mainstream.', 'Guided rosaries, examens, lectio divina, night prayer and sleep-time scripture, with reading plans and community challenges around Lent and Advent. The production values are the point: audio is properly produced and the onboarding assumes you might be coming back to prayer after years away. A free tier covers a daily selection; the subscription unlocks the full library.', 'https://hallow.com/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'freemium', 'Free daily selection; subscription for the full library.', 0, NULL, 'unknown', 'unknown', 0, '["Prayer","Devotionals"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('universalis', 'Universalis', 'The Liturgy of the Hours and daily Mass, done properly and offline.', 'Every hour of the Divine Office plus the readings for Mass, calculated for your calendar and available without a connection. Unfashionable interface, unimpeachable substance — it handles the propers, the ranks and the regional calendars that prettier apps quietly skip. A long-standing favourite of clergy and religious for exactly that reason.', 'https://universalis.com/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web","desktop"]', 'freemium', 'Free on the web; one-time purchase for the apps and ebooks.', 0, NULL, 'unknown', 'unknown', 0, '["Liturgy of the Hours","Daily Readings"]', '["en","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('ibreviary', 'iBreviary', 'The breviary and missal in your pocket, free, in several languages.', 'One of the first serious Catholic apps and still going: the full Liturgy of the Hours and the Roman Missal, in Italian, English, Spanish, French, Portuguese and Latin, including the extraordinary form. Free with no tier above it.', 'https://www.ibreviary.org/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'free', NULL, 0, NULL, 'unknown', 'unknown', 0, '["Liturgy of the Hours","Liturgy"]', '["it","en","es","fr","pt","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('divine-office-app', 'Divine Office', 'The Hours prayed aloud, with a community reciting alongside you.', 'Audio recordings of every hour of the breviary, recorded with a small group so the psalms are prayed antiphonally rather than read at you. Podcast, apps and web. Useful if you find the office easier to keep by ear than by page. The same apostolate publishes the JSON feeds listed on the API side of this directory.', 'https://divineoffice.org/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'freemium', 'Free podcast and web; paid apps support the apostolate.', 0, NULL, 'unknown', 'unknown', 0, '["Liturgy of the Hours","Prayer"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('magnificat', 'Magnificat', 'The monthly worship aid, in print and on a screen.', 'Daily Mass texts, morning and evening prayer, and a curated meditation for each day, published monthly. The editorial selection is the value — someone has chosen the readings and the art for you. Print subscription with digital access.', 'https://us.magnificat.net/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'paid', 'Subscription; print and digital.', 0, NULL, 'unknown', 'unknown', 0, '["Daily Readings","Devotionals","Prayer"]', '["en","fr","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('ascension', 'Ascension', 'Bible in a Year, Catechism in a Year, and the study programmes behind them.', 'The publisher whose podcasts pulled hundreds of thousands of people through the whole Bible and the whole Catechism a chapter a day. The podcasts are free; the study programmes, the Great Adventure Bible and the parish materials are what you pay for. Their reading-plan structure is the thing most imitators get wrong and they get right.', 'https://ascensionpress.com/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'freemium', 'Podcasts free; books, courses and parish programmes paid.', 0, NULL, 'unknown', 'unknown', 0, '["Bible & Study","Formation","Media"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('formed', 'FORMED', 'Catholic streaming — films, studies and audio — usually free through your parish.', 'The Augustine Institute''s streaming service: documentaries, sacramental prep, children''s programming and audio talks. Most people get access free because their parish subscribes, which makes it the default answer when a DRE asks where to find video for a class. Individual subscriptions exist too.', 'https://formed.org/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'paid', 'Parish subscriptions give parishioners free access; individual plans available.', 0, NULL, 'unknown', 'unknown', 0, '["Media","Formation","Parish Tools"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('word-on-fire', 'Word on Fire', 'Bishop Barron''s evangelisation ministry: video, essays and the Bible commentaries.', 'Sermons, the CATHOLICISM series, daily gospel reflections by email, and a growing shelf of published Bibles and commentaries. Much of the video and writing is free; the institute membership and the print editions are paid. Aimed squarely at the seeker and the lapsed rather than the already-convinced.', 'https://www.wordonfire.org/', NULL, NULL, 'api', 'product', NULL, '["web","ios","android"]', 'freemium', 'Most video and writing free; membership and books paid.', 0, NULL, 'unknown', 'unknown', 0, '["Media","Formation","Apologetics"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('exodus-90', 'Exodus 90', 'A ninety-day ascetic programme for men, with a fraternity to keep you honest.', 'Cold showers, no alcohol, no screens for entertainment, an hour of prayer, and a small group that notices when you stop. Structured as a daily plan tied to readings from Exodus. Demanding by design and unusually specific about what it asks — which is why it works for the people it works for.', 'https://exodus90.com/', NULL, NULL, 'api', 'product', NULL, '["ios","android","web"]', 'paid', 'Subscription per exercise season.', 0, NULL, 'unknown', 'unknown', 0, '["Formation","Prayer","Community"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catholic-answers', 'Catholic Answers', 'Apologetics: the searchable archive of answers to the hard questions.', 'Decades of tracts, articles, radio archives and forum answers on doctrine, scripture and the objections people actually raise. Free and enormous. The first place to look when you need a sourced answer rather than an opinion, and a useful corpus if you are building anything that needs to cite.', 'https://www.catholic.com/', NULL, NULL, 'api', 'product', NULL, '["web","ios","android"]', 'free', 'Free; donor supported.', 0, NULL, 'unknown', 'unknown', 0, '["Apologetics","Formation","Media"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('magisterium-ai', 'Magisterium AI', 'Ask the Church a question and get an answer with the citations attached.', 'The consumer side of the engine whose API is listed on the developer track: put a question in plain language, get an answer drawn from councils, encyclicals, the Catechism and canon law, with references you can follow. The citations are the feature — you can check it, which is more than most AI assistants let you do. Free tier with a prompt limit, subscription above it.', 'https://www.magisterium.com/', NULL, NULL, 'api', 'product', NULL, '["web","ios","android"]', 'freemium', 'Free prompt allowance; subscription for unlimited use.', 0, NULL, 'unknown', 'unknown', 0, '["AI & Search","Formation","Apologetics"]', '["en","es","fr","it","pt","de","pl"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('the-pillar', 'The Pillar', 'Catholic journalism that reports on the institution rather than for it.', 'News and analysis on the Church as a governed body — finances, canon law, appointments, the things that get covered thinly elsewhere. Free newsletter with paid subscriber posts. Read it for the canonical detail; the reporters know the code and it shows.', 'https://www.pillarcatholic.com/', NULL, NULL, 'api', 'product', NULL, '["web"]', 'freemium', 'Free posts; paid subscription for the full archive.', 0, NULL, 'unknown', 'unknown', 0, '["News","Media"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('vatican-news', 'Vatican News', 'The Holy See''s own newsroom, in dozens of languages.', 'Official coverage of the pope and the Roman curia from the Dicastery for Communication, published in a long list of languages with audio from Vatican Radio. The primary source when you need what was actually said rather than what was reported.', 'https://www.vaticannews.va/', NULL, NULL, 'api', 'product', NULL, '["web","ios","android"]', 'free', NULL, 0, NULL, 'unknown', 'unknown', 1, '["News","Media"]', '["it","en","es","fr","de","pt","pl","la"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('ecatholic', 'eCatholic', 'Parish websites for staff who are not web developers.', 'Hosted websites, giving and communication tools built for parishes and dioceses, with templates that already know what a Mass schedule and a bulletin are. The realistic alternative to a volunteer maintaining WordPress, which is the situation it is actually competing against.', 'https://www.ecatholic.com/', NULL, NULL, 'api', 'product', NULL, '["web","parish"]', 'paid', 'Monthly plans by parish size.', 0, NULL, 'unknown', 'unknown', 0, '["Parish Tools"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('laudate', 'Laudate', 'The Swiss army knife Catholic app, free since before that was normal.', 'Readings, the rosary, the Divine Mercy chaplet, the Liturgy of the Hours, the Catechism, prayers, a confession examen and more, crammed into one free app with no subscription. The interface shows its age; the coverage is still hard to beat for the price, which is nothing.', 'https://apps.apple.com/us/app/laudate/id499428207', NULL, NULL, 'api', 'product', NULL, '["ios","android"]', 'free', NULL, 0, NULL, 'unknown', 'unknown', 0, '["Prayer","Devotionals","Daily Readings"]', '["en","es"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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

INSERT INTO apis (slug, name, tagline, description, homepage_url, docs_url, repo_url, kind, track, launched_at, platforms, pricing, pricing_note, open_source, license, auth, cors, official, categories, languages, status)
VALUES ('catholic-digital-commons', 'Catholic Digital Commons', 'Open infrastructure for Catholic builders, including a Bible API.', 'A project putting shared Catholic digital resources in the commons rather than behind fifteen separate paywalls — among them a Bible API. Sits exactly on the seam between this directory''s two tracks: an organisation to know about, and a source of the building blocks listed on the developer side.', 'https://catholicdigitalcommons.org/', NULL, NULL, 'api', 'product', NULL, '["web"]', 'free', NULL, 1, NULL, 'unknown', 'unknown', 0, '["Developer Tools","Community"]', '["en"]', 'published')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  homepage_url = excluded.homepage_url,
  docs_url = excluded.docs_url,
  repo_url = excluded.repo_url,
  kind = excluded.kind,
  track = excluded.track,
  launched_at = excluded.launched_at,
  platforms = excluded.platforms,
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
