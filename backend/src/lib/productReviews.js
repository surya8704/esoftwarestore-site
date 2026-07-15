/**
 * Deterministic, locale-aware product reviews so every product looks
 * reviewed without storing fake rows in MongoDB.
 */

const LOCALE_META = {
  en: { label: 'English', dir: 'ltr' },
  de: { label: 'Deutsch', dir: 'ltr' },
  fr: { label: 'Français', dir: 'ltr' },
  es: { label: 'Español', dir: 'ltr' },
  it: { label: 'Italiano', dir: 'ltr' },
  pt: { label: 'Português', dir: 'ltr' },
  nl: { label: 'Nederlands', dir: 'ltr' },
  pl: { label: 'Polski', dir: 'ltr' },
  ru: { label: 'Русский', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
}

const NAMES = {
  en: ['James Carter', 'Priya Nair', 'Michael Brooks', 'Sarah Chen', 'Daniel Okonkwo', 'Emily Walsh', 'Omar Hassan', 'Lisa Thompson', 'Ryan Patel', 'Amanda Greer'],
  de: ['Anna Müller', 'Thomas Schneider', 'Julia Weber', 'Markus Fischer', 'Sophie Bauer', 'Lukas Hoffmann', 'Nina Richter', 'Felix Wagner'],
  fr: ['Camille Dupont', 'Lucas Martin', 'Sophie Bernard', 'Antoine Lefèvre', 'Émilie Moreau', 'Hugo Petit', 'Claire Laurent'],
  es: ['María González', 'Carlos Ruiz', 'Lucía Fernández', 'Javier Morales', 'Sofía Herrera', 'Diego Castillo', 'Valentina Romero'],
  it: ['Giulia Rossi', 'Marco Bianchi', 'Francesca Conti', 'Luca Esposito', 'Chiara Ricci', 'Alessandro Greco'],
  pt: ['Ana Sousa', 'Pedro Costa', 'Mariana Oliveira', 'Rafael Santos', 'Beatriz Almeida', 'Gabriel Ferreira'],
  nl: ['Emma de Vries', 'Lars Jansen', 'Sophie Bakker', 'Noah Visser', 'Lisa Meijer', 'Daan de Boer'],
  pl: ['Anna Kowalska', 'Piotr Nowak', 'Magdalena Wiśniewska', 'Tomasz Wójcik', 'Karolina Kamińska'],
  ru: ['Анна Иванова', 'Дмитрий Смирнов', 'Елена Козлова', 'Алексей Новиков', 'Мария Морозова'],
  ar: ['أحمد المنصوري', 'فاطمة الحسن', 'خالد العتيبي', 'نورة الشمري', 'يوسف القحطاني'],
}

/** Review bodies by locale — genuine tone, digital-license context */
const BODIES = {
  en: [
    { stars: 5, title: 'Instant delivery, smooth activation', text: 'Key arrived in my inbox within minutes. Installation guide was clear and the license activated on the first try. Will buy again.' },
    { stars: 5, title: 'Exactly what I needed', text: 'Genuine key, fair price, and support replied quickly when I had a question about system requirements. No regrets.' },
    { stars: 4, title: 'Works great on Windows 11', text: 'Slight delay (about 20 minutes), but everything worked. Product is solid and the download link was fine.' },
    { stars: 5, title: 'Professional and trustworthy', text: 'I was hesitant about buying software online, but this felt legitimate. Verified purchase, prompt email, and the tool runs perfectly.' },
    { stars: 5, title: 'Best price I found', text: 'Compared a few stores — this one had the best deal and delivery was basically instant. Recommended.' },
    { stars: 4, title: 'Good value', text: 'Activation took a couple of attempts on my older PC, then support helped. Overall happy with the purchase.' },
    { stars: 5, title: 'Clear instructions', text: 'Email included step-by-step setup. Took me under 10 minutes from payment to working software.' },
    { stars: 5, title: 'Repeat customer', text: 'Third purchase from this store. Same reliable experience every time — fast keys, no surprises.' },
  ],
  de: [
    { stars: 5, title: 'Sofortige Lieferung', text: 'Lizenzschlüssel kam in wenigen Minuten per E-Mail. Aktivierung problemlos, Anleitung verständlich. Sehr empfehlenswert.' },
    { stars: 5, title: 'Alles wie beschrieben', text: 'Echter Key, fairer Preis und schneller Support. Installation auf Windows 11 ohne Probleme.' },
    { stars: 4, title: 'Gutes Preis-Leistungs-Verhältnis', text: 'Lieferung etwas verzögert (~15 Min.), danach alles einwandfrei. Würde wieder hier kaufen.' },
    { stars: 5, title: 'Seriöser Shop', text: 'War zuerst skeptisch, aber Kauf war transparent. Sofortiger Download und funktionierende Lizenz.' },
    { stars: 5, title: 'Sehr zufrieden', text: 'Schnelle Lieferung, klare Schritte zur Aktivierung. Produkt läuft stabil.' },
    { stars: 4, title: 'Funktioniert einwandfrei', text: 'Einmal Support wegen Antiviren-False-Positive kontaktiert – schnelle Antwort. Alles gut.' },
  ],
  fr: [
    { stars: 5, title: 'Livraison immédiate', text: 'Clé reçue en quelques minutes. Activation simple, guide clair. Je recommande vivement.' },
    { stars: 5, title: 'Achat rassurant', text: 'Licence authentique, bon prix, et le support a répondu rapidement. Aucun souci.' },
    { stars: 4, title: 'Très bon rapport qualité-prix', text: 'Petit délai de livraison, puis tout a parfaitement fonctionné sous Windows 11.' },
    { stars: 5, title: 'Expérience fluide', text: 'Paiement, e-mail, activation — moins de dix minutes. Boutique sérieuse.' },
    { stars: 5, title: 'Je rachèterai ici', text: 'Deuxième achat. Même rapidité et mêmes instructions claires. Parfait.' },
    { stars: 4, title: 'Satisfait', text: 'Logiciel bien livré. Support utile pour une question d’installation.' },
  ],
  es: [
    { stars: 5, title: 'Entrega al instante', text: 'La clave llegó en minutos. Activación fácil y guía clara. Muy recomendable.' },
    { stars: 5, title: 'Compra confiable', text: 'Licencia genuina, buen precio y soporte rápido. Exactamente lo esperado.' },
    { stars: 4, title: 'Buena relación calidad-precio', text: 'Tardó un poco más de lo previsto, pero funcionó a la primera en Windows 11.' },
    { stars: 5, title: 'Proceso sencillo', text: 'Desde el pago hasta tener el programa listo, menos de 10 minutos. Excelente.' },
    { stars: 5, title: 'Volveré a comprar', text: 'Ya es mi segunda compra. Mismos resultados rápidos y seguros.' },
    { stars: 4, title: 'Todo bien', text: 'El soporte me ayudó con un detalle de instalación. Muy contento.' },
  ],
  it: [
    { stars: 5, title: 'Consegna immediata', text: 'Chiave arrivata in pochi minuti. Attivazione semplice e guida chiara. Consigliato.' },
    { stars: 5, title: 'Acquisto sicuro', text: 'Licenza originale, buon prezzo e supporto veloce. Nessun problema.' },
    { stars: 4, title: 'Ottimo rapporto qualità-prezzo', text: 'Piccolo ritardo nella mail, poi tutto ha funzionato al primo tentativo.' },
    { stars: 5, title: 'Esperienza fluida', text: 'Pagamento, email, attivazione — meno di dieci minuti. Negozio serio.' },
    { stars: 5, title: 'Tornerò a comprare', text: 'Secondo acquisto qui. Stessa velocità e istruzioni chiare.' },
  ],
  pt: [
    { stars: 5, title: 'Entrega imediata', text: 'Chave no e-mail em poucos minutos. Ativação fácil e instruções claras. Recomendo.' },
    { stars: 5, title: 'Compra confiável', text: 'Licença genuína, preço justo e suporte rápido. Sem complicações.' },
    { stars: 4, title: 'Bom custo-benefício', text: 'Demorou um pouco, mas funcionou perfeitamente no Windows 11.' },
    { stars: 5, title: 'Processo simples', text: 'Do pagamento ao software funcionando em menos de 10 minutos.' },
    { stars: 5, title: 'Voltarei a comprar', text: 'Já é a segunda compra. Mesma rapidez e segurança.' },
  ],
  nl: [
    { stars: 5, title: 'Direct geleverd', text: 'Sleutel binnen enkele minuten in mijn inbox. Activatie soepel, handleiding duidelijk.' },
    { stars: 5, title: 'Betrouwbare aankoop', text: 'Echte licentie, eerlijke prijs en snelle support. Precies zoals beloofd.' },
    { stars: 4, title: 'Goede prijs-kwaliteit', text: 'Kleine vertraging, daarna alles prima op Windows 11.' },
    { stars: 5, title: 'Vlotte ervaring', text: 'Betaling → mail → activatie in onder de tien minuten. Aanrader.' },
    { stars: 5, title: 'Tevreden klant', text: 'Tweede aankoop hier. Zelfde snelle en nette afhandeling.' },
  ],
  pl: [
    { stars: 5, title: 'Natychmiastowa dostawa', text: 'Klucz w skrzynce w kilka minut. Aktywacja bez problemów, instrukcja jasna. Polecam.' },
    { stars: 5, title: 'Pewny zakup', text: 'Oryginalna licencja, dobra cena i szybkie wsparcie. Wszystko zgodnie z opisem.' },
    { stars: 4, title: 'Dobry stosunek ceny do jakości', text: 'Lekkie opóźnienie maila, potem instalacja przebiegła sprawnie.' },
    { stars: 5, title: 'Prosty proces', text: 'Od płatności do działającego programu poniżej 10 minut.' },
    { stars: 5, title: 'Kupię tu ponownie', text: 'Drugie zamówienie — ten sam szybki i bezpieczny przebieg.' },
  ],
  ru: [
    { stars: 5, title: 'Мгновенная доставка', text: 'Ключ пришёл на почту за несколько минут. Активация простая, инструкция понятная. Рекомендую.' },
    { stars: 5, title: 'Надёжная покупка', text: 'Оригинальная лицензия, хорошая цена и быстрая поддержка. Всё как обещали.' },
    { stars: 4, title: 'Отличное соотношение цена/качество', text: 'Небольшая задержка письма, затем всё заработало с первого раза.' },
    { stars: 5, title: 'Быстрый процесс', text: 'От оплаты до рабочей программы меньше 10 минут. Отличный магазин.' },
    { stars: 5, title: 'Куплю ещё раз', text: 'Это уже вторая покупка. Та же скорость и чёткие инструкции.' },
  ],
  ar: [
    { stars: 5, title: 'توصيل فوري', text: 'وصل المفتاح خلال دقائق. التفعيل سهل والتعليمات واضحة. أنصح به بشدة.' },
    { stars: 5, title: 'شراء موثوق', text: 'ترخيص أصلي وسعر مناسب ودعم سريع. التجربة كانت مطمئنة.' },
    { stars: 4, title: 'قيمة ممتازة', text: 'تأخر بسيط في البريد ثم عمل كل شيء بشكل ممتاز من المحاولة الأولى.' },
    { stars: 5, title: 'تجربة سلسة', text: 'من الدفع حتى تشغيل البرنامج في أقل من عشر دقائق.' },
    { stars: 5, title: 'سأشتري مجدداً', text: 'هذا ثاني طلب لي من المتجر. نفس السرعة والموثوقية.' },
  ],
}

const DAYS_AGO = [1, 2, 3, 5, 7, 9, 12, 14, 18, 21, 27, 35, 42, 48, 56, 63]

function hashString(value) {
  let hash = 2166136261
  const str = String(value ?? '')
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length]
}

function reviewCountForProduct(productKey) {
  const hash = hashString(productKey)
  return 24 + (hash % 161) // 24–184
}

function averageFromProductRating(rating) {
  const value = Number(rating)
  if (!Number.isFinite(value) || value <= 0) return 4.7
  return Math.min(5, Math.max(3.8, value > 10 ? value / 10 : value))
}

function buildLocaleOrder(preferred) {
  const locales = Object.keys(BODIES)
  const preferredSafe = locales.includes(preferred) ? preferred : 'en'
  return [preferredSafe, ...locales.filter((code) => code !== preferredSafe)]
}

/**
 * @param {{ id?: string, slug?: string, name?: string, rating?: number }} product
 * @param {{ locale?: string, limit?: number }} [options]
 */
export function generateProductReviews(product, options = {}) {
  const productKey = String(product?.id ?? product?.slug ?? product?.name ?? 'product')
  const preferred = String(options.locale ?? 'en').slice(0, 2).toLowerCase()
  const limit = Math.min(24, Math.max(4, Number(options.limit) || 10))
  const avg = averageFromProductRating(product?.rating)
  const total = reviewCountForProduct(productKey)
  const rand = mulberry32(hashString(`${productKey}:reviews`))
  const localeOrder = buildLocaleOrder(preferred)

  const reviews = []
  for (let i = 0; i < limit; i += 1) {
    // Prefer current locale for ~60% of early reviews
    const locale =
      i < Math.ceil(limit * 0.55)
        ? localeOrder[0]
        : pick(rand, localeOrder.slice(0, Math.min(5, localeOrder.length)))

    const bodies = BODIES[locale] ?? BODIES.en
    const names = NAMES[locale] ?? NAMES.en
    const body = bodies[Math.floor(rand() * bodies.length) % bodies.length]
    const name = names[Math.floor(rand() * names.length) % names.length]

    // Keep distribution skewed toward product average
    let stars = body.stars
    if (avg >= 4.7 && rand() > 0.85) stars = 4
    if (avg < 4.5 && rand() > 0.7) stars = 4
    if (rand() > 0.94) stars = 3

    const daysAgo = DAYS_AGO[Math.floor(rand() * DAYS_AGO.length) % DAYS_AGO.length]
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    reviews.push({
      id: `${productKey}-${i}`,
      author: name,
      locale,
      language: LOCALE_META[locale]?.label ?? locale,
      dir: LOCALE_META[locale]?.dir ?? 'ltr',
      rating: stars,
      title: body.title,
      text: body.text,
      verified: rand() > 0.12,
      helpful: 2 + Math.floor(rand() * 38),
      createdAt,
      daysAgo,
    })
  }

  // Sort: preferred locale first, then newest
  reviews.sort((a, b) => {
    const aPref = a.locale === preferred ? 0 : 1
    const bPref = b.locale === preferred ? 0 : 1
    if (aPref !== bPref) return aPref - bPref
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  // Approximate histogram from average + total
  distribution[5] = Math.round(total * (avg >= 4.7 ? 0.72 : 0.58))
  distribution[4] = Math.round(total * (avg >= 4.7 ? 0.2 : 0.28))
  distribution[3] = Math.round(total * 0.06)
  distribution[2] = Math.max(0, Math.round(total * 0.015))
  distribution[1] = Math.max(0, total - distribution[5] - distribution[4] - distribution[3] - distribution[2])

  return {
    averageRating: Math.round(avg * 10) / 10,
    reviewCount: total,
    distribution,
    reviews,
    locales: Object.entries(LOCALE_META).map(([code, meta]) => ({ code, label: meta.label })),
  }
}

export function attachReviewSummary(product) {
  const productKey = String(product?.id ?? product?.slug ?? product?.name ?? 'product')
  return {
    reviewCount: reviewCountForProduct(productKey),
    averageRating: averageFromProductRating(product?.rating),
  }
}

export function getReviewMarketingTemplates() {
  return {
    locales: Object.entries(LOCALE_META).map(([code, meta]) => ({
      code,
      label: meta.label,
      dir: meta.dir,
    })),
    names: NAMES,
    bodies: BODIES,
  }
}

export function mapStoredReview(doc) {
  const locale = String(doc.locale || 'en').slice(0, 2).toLowerCase()
  const createdAt = doc.createdAt ? new Date(doc.createdAt) : new Date()
  const daysAgo = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)))
  return {
    id: String(doc._id ?? doc.id),
    author: doc.author,
    locale,
    language: LOCALE_META[locale]?.label ?? locale,
    dir: LOCALE_META[locale]?.dir ?? 'ltr',
    rating: Number(doc.rating) || 5,
    title: doc.title,
    text: doc.text,
    verified: doc.verified !== false,
    helpful: Number(doc.helpful) || 0,
    createdAt: createdAt.toISOString(),
    daysAgo,
    source: 'admin',
  }
}

/**
 * Put admin-created reviews first, then fill with generated marketing-style reviews.
 */
export function mergeProductReviews(product, storedDocs = [], options = {}) {
  const preferred = String(options.locale ?? 'en').slice(0, 2).toLowerCase()
  const limit = Math.min(24, Math.max(4, Number(options.limit) || 10))
  const generated = generateProductReviews(product, { locale: preferred, limit })

  const custom = (storedDocs || [])
    .filter((doc) => doc && doc.active !== false)
    .map(mapStoredReview)
    .sort((a, b) => {
      const aPref = a.locale === preferred ? 0 : 1
      const bPref = b.locale === preferred ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  const remaining = Math.max(0, limit - custom.length)
  const filler = generated.reviews.slice(0, remaining)
  const reviews = [...custom, ...filler].slice(0, limit)

  const extra = custom.length
  const reviewCount = generated.reviewCount + extra
  const distribution = { ...generated.distribution }
  for (const review of custom) {
    const key = String(Math.min(5, Math.max(1, Math.round(review.rating))))
    distribution[key] = (distribution[key] || 0) + 1
  }

  let averageRating = generated.averageRating
  if (custom.length) {
    const customAvg = custom.reduce((sum, r) => sum + r.rating, 0) / custom.length
    averageRating = Math.round(((generated.averageRating * generated.reviewCount + customAvg * custom.length) / reviewCount) * 10) / 10
  }

  return {
    averageRating,
    reviewCount,
    distribution,
    reviews,
    locales: generated.locales,
    customReviewCount: custom.length,
  }
}
