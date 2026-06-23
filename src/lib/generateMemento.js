const T = {
  accent: '#A47864',
  text:   '#735749',
  dark:   '#412D26',
  cream:  '#FFF1E9',
  border: '#C0A18F',
}

const ra = {
  dark:   (a) => `rgba(65,45,38,${a})`,
  cream:  (a) => `rgba(255,241,233,${a})`,
  border: (a) => `rgba(192,161,143,${a})`,
}

async function fetchFontsCss() {
  const url = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=Montserrat:wght@400;500;600&family=Pinyon+Script&display=swap'
  try {
    const resp = await fetch(url)
    let css = await resp.text()
    const fontUrls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1])
    const encoded = await Promise.all(fontUrls.map(async (fontUrl) => {
      try { return [fontUrl, await urlToBase64(fontUrl)] } catch { return null }
    }))
    for (const pair of encoded) {
      if (pair) css = css.replaceAll(pair[0], pair[1])
    }
    return css
  } catch {
    return null
  }
}

async function urlToBase64(url) {
  try {
    const resp = await fetch(url, { cache: 'reload' })
    const blob = await resp.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

function ceremonies(event) {
  const PRIORITY = ['reception', 'ceremony', 'civil']
  const LABELS = { civil: 'Ceremonia Civil', ceremony: 'Ceremonia Religiosa', reception: 'Recepción' }
  const AT = { civil: 'civil_at', ceremony: 'ceremony_at', reception: 'reception_at' }

  const nodes = ['civil', 'ceremony', 'reception'].filter((k) => event[AT[k]])
  if (!nodes.length) return ''

  const parent = Object.fromEntries(nodes.map((n) => [n, n]))
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  if (event.civil_ceremony_same_venue) parent[find('civil')] = find('ceremony')
  if (event.civil_reception_same_venue) parent[find('civil')] = find('reception')
  if (event.ceremony_reception_same_venue) parent[find('ceremony')] = find('reception')

  const map = {}
  nodes.forEach((n) => { const root = find(n); map[root] = map[root] ? [...map[root], n] : [n] })
  const groups = Object.values(map)
  groups.sort((a, b) => Math.min(...a.map((k) => +new Date(event[AT[k]]))) - Math.min(...b.map((k) => +new Date(event[AT[k]]))))
  groups.forEach((g) => g.sort((a, b) => +new Date(event[AT[a]]) - +new Date(event[AT[b]])))

  const cols = groups.length >= 2 ? 'repeat(auto-fit,minmax(260px,1fr))' : '1fr'

  const groupsHtml = groups.map((group, gi) => {
    let imageUrl = null, location = null, mapUrl = null
    for (const k of PRIORITY) {
      if (!group.includes(k)) continue
      if (event[`${k}_image_url`]) { imageUrl = event[`${k}_image_url`]; location = event[`${k}_location`]; mapUrl = event[`${k}_url`]; break }
    }
    if (!imageUrl) for (const k of PRIORITY) { if (group.includes(k)) { location = event[`${k}_location`]; mapUrl = event[`${k}_url`]; break } }

    const imageContent = imageUrl
      ? (mapUrl
          ? `<a href="${mapUrl}" target="_blank" style="display:block;width:100%;height:100%"><img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/></a>`
          : `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/>`)
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${T.border};font-size:12px;text-transform:uppercase;letter-spacing:.1em">${group.map((k) => LABELS[k]).join(' / ')}</div>`

    const times = group.map((k) => `
      <div>
        <p style="font-family:'Montserrat',sans-serif;font-weight:600;color:${T.dark};margin:0 0 2px">${LABELS[k]}</p>
        <p style="font-size:14px;color:${T.text};margin:0">${new Date(event[AT[k]]).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
      </div>`).join('')

    const locationHtml = location
      ? (mapUrl
          ? `<a href="${mapUrl}" target="_blank" style="font-size:14px;color:${T.text};text-decoration:underline">${location}</a>`
          : `<p style="font-size:14px;color:${T.text};margin:0">${location}</p>`)
      : ''

    const span = groups.length >= 2 && groups.length % 2 !== 0 && gi === groups.length - 1 ? ' style="grid-column:1/-1"' : ''
    return `<div${span}>
      <div style="width:100%;aspect-ratio:16/9;background:${ra.border(.1)};border-radius:12px;overflow:hidden;margin-bottom:12px">${imageContent}</div>
      <div style="display:flex;flex-direction:column;gap:8px">${times}${locationHtml}</div>
    </div>`
  }).join('')

  return `<div style="display:grid;grid-template-columns:${cols};gap:32px;width:100%">${groupsHtml}</div>`
}

function infoBlock(label, text, imageUrl) {
  if (!text && !imageUrl) return ''
  return `<div style="width:100%;border-radius:12px;overflow:hidden;border:1px solid ${ra.border(.6)}">
    <div style="background:${ra.border(.1)};padding:12px 16px;text-align:center">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:${ra.dark(.6)};margin:0 0 4px">${label}</p>
      ${text ? `<p style="font-size:14px;color:${T.text};margin:0">${text}</p>` : ''}
    </div>
    ${imageUrl ? `<div style="width:100%;aspect-ratio:16/9"><img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/></div>` : ''}
  </div>`
}

function buildCarousel(images, intervalMs) {
  if (!images?.length) return ''

  const imgs = images.map((img, i) =>
    `<img src="${img.url}" alt="" class="cimg" data-idx="${i}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .5s;opacity:${i === 0 ? 1 : 0}"/>`
  ).join('')

  const dots = images.map((_, i) =>
    `<button class="cdot" data-idx="${i}" onclick="cGo(${i})" style="width:${i === 0 ? 16 : 8}px;height:8px;border-radius:9999px;background:${i === 0 ? T.accent : ra.border(.5)};border:none;cursor:pointer;padding:0;transition:all .3s"></button>`
  ).join('')

  return `<div style="width:100%;display:flex;flex-direction:column;gap:12px">
    <div style="position:relative;width:100%;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:${ra.border(.1)}">
      ${imgs}
      <button onclick="cPrev()" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.3);border:none;cursor:pointer;color:#fff;font-size:22px;line-height:32px;display:flex;align-items:center;justify-content:center">&#8249;</button>
      <button onclick="cNext()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.3);border:none;cursor:pointer;color:#fff;font-size:22px;line-height:32px;display:flex;align-items:center;justify-content:center">&#8250;</button>
      <span id="cc" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.3);color:#fff;font-size:12px;padding:2px 8px;border-radius:9999px">1 / ${images.length}</span>
    </div>
    <div style="display:flex;justify-content:center;gap:6px">${dots}</div>
  </div>
  <script>
    (function(){
      var cur = 0, tot = ${images.length}, interval = ${intervalMs}, timer;
      function go(i) {
        var next = (i % tot + tot) % tot;
        document.querySelectorAll('.cimg').forEach(function(el) {
          el.style.opacity = parseInt(el.dataset.idx) === next ? 1 : 0;
        });
        document.querySelectorAll('.cdot').forEach(function(el) {
          var active = parseInt(el.dataset.idx) === next;
          el.style.width = active ? '16px' : '8px';
          el.style.background = active ? '${T.accent}' : '${ra.border(.5)}';
        });
        document.getElementById('cc').textContent = (next + 1) + ' / ' + tot;
        cur = next;
        clearInterval(timer);
        timer = setInterval(function() { go(cur + 1); }, interval);
      }
      window.cGo = go;
      window.cNext = function() { go(cur + 1); };
      window.cPrev = function() { go(cur - 1); };
      timer = setInterval(function() { go(cur + 1); }, interval);
    })();
  </script>`
}

function buildHtml(event, fontsCss) {
  const heroSrc = event.couple_image_url ?? ''
  const mobileSrc = event.couple_mobile_image_url ?? heroSrc

  const parentsHtml = (event.partner1_parent1 || event.partner1_parent2 || event.partner2_parent1 || event.partner2_parent2)
    ? `<div style="width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px">
        <div>
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:.2em;color:${ra.dark(.6)};margin:0 0 4px">Con la bendición de</p>
          <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;text-transform:uppercase;font-size:24px;color:${T.text};margin:0">nuestros padres</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;width:100%">
          ${(event.partner1_parent1 || event.partner1_parent2) ? `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <p style="font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:${ra.dark(.6)};margin:0">De la novia</p>
            ${event.partner1_parent1 ? `<p style="font-style:italic;color:${T.dark};margin:0">${event.partner1_parent1}</p>` : ''}
            ${event.partner1_parent2 ? `<p style="font-style:italic;color:${T.dark};margin:0">y ${event.partner1_parent2}</p>` : ''}
          </div>` : ''}
          ${(event.partner2_parent1 || event.partner2_parent2) ? `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <p style="font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:${ra.dark(.6)};margin:0">Del novio</p>
            ${event.partner2_parent1 ? `<p style="font-style:italic;color:${T.dark};margin:0">${event.partner2_parent1}</p>` : ''}
            ${event.partner2_parent2 ? `<p style="font-style:italic;color:${T.dark};margin:0">y ${event.partner2_parent2}</p>` : ''}
          </div>` : ''}
        </div>
       </div>`
    : ''

  const coupleHtml = event.name
    ? `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
        <p style="font-size:24px;text-transform:uppercase;letter-spacing:.2em;color:${ra.dark(.6)};margin:0">Nosotros</p>
        <h2 id="couple-name" style="font-family:'Snell Roundhand','Pinyon Script',cursive;color:${T.accent};margin:0">${event.name}</h2>
        ${event.subtitle ? `<p style="font-size:12px;text-transform:uppercase;letter-spacing:.2em;color:${ra.dark(.6)};margin:0">${event.subtitle}</p>` : ''}
       </div>`
    : ''

  const invCardHtml = event.invitation_image_url
    ? `<div style="width:100%;max-width:280px;margin:0 auto;aspect-ratio:3/4;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px ${ra.dark(.15)}">
        <img src="${event.invitation_image_url}" alt="Invitación" style="width:100%;height:100%;object-fit:cover"/>
       </div>`
    : ''

  const noKidsHtml = event.no_kids
    ? `<div style="width:100%;border-radius:12px;border:1px solid ${ra.border(.6)};background:${ra.border(.1)};padding:12px 16px;text-align:center">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:${ra.dark(.6)};margin:0 0 4px">Solo adultos</p>
        <p style="font-size:14px;color:${T.text};margin:0">${event.no_kids_message || 'Este evento es para adultos. Te pedimos no traer niños.'}</p>
       </div>`
    : ''

  const musicHtml = event.song_url
    ? `<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0">
        <audio id="msong" src="${event.song_url}" loop preload="auto"></audio>
        <p id="mplay-label" style="font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:${ra.cream(.5)};margin:0">Play</p>
        <button id="mplay-btn" onclick="(function(){var a=document.getElementById('msong'),b=document.getElementById('mplay-btn'),l=document.getElementById('mplay-label');if(a.paused){a.play().then(function(){l.style.visibility='hidden';b.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\' stroke=\\'none\\'><rect x=\\'6\\' y=\\'4\\' width=\\'4\\' height=\\'16\\'></rect><rect x=\\'14\\' y=\\'4\\' width=\\'4\\' height=\\'16\\'></rect></svg>'})}else{a.pause();l.style.visibility='visible';b.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\' stroke=\\'none\\'><polygon points=\\'5 3 19 12 5 21 5 3\\'></polygon></svg>'}})()" aria-label="Reproducir música" style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:${ra.cream(.2)};border:none;cursor:pointer;color:${T.cream};transition:background .2s">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
       </div>`
    : ''

  const mementoMsg = `<div style="text-align:center;padding:8px 0 4px">
    <p style="font-size:14px;color:${ra.dark(.7)};margin:0 0 6px">Este evento ha concluido.</p>
    <p style="font-size:14px;color:${ra.dark(.7)};margin:0">Gracias por acompañarnos en este momento tan especial. 💌</p>
  </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Recuerdo · ${event.name ?? 'Invitación'}</title>
  ${fontsCss
    ? `<style>${fontsCss}</style>`
    : `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=Montserrat:wght@400;500;600&family=Pinyon+Script&display=swap" rel="stylesheet"/>`
  }
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.accent}; min-height: 100vh; font-family: 'Montserrat', sans-serif; }
    #hero { width: 100%; aspect-ratio: 4/5; overflow: hidden; background: ${ra.border(.2)}; }
    #hero img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    #hero-mobile { display: block; width: 100%; height: 100%; }
    #hero-desktop { display: none; width: 100%; height: 100%; }
    #couple-name { font-size: 1.875rem; line-height: 1.25; }
    @media (min-width: 768px) {
      #hero { aspect-ratio: 10/6; }
      #hero-mobile { display: none; }
      #hero-desktop { display: block; }
      #couple-name { font-size: 3rem; }
    }
  </style>
</head>
<body>

<div id="hero">
  <div id="hero-mobile">${mobileSrc ? `<img src="${mobileSrc}" alt="Foto de la pareja"/>` : ''}</div>
  <div id="hero-desktop">${heroSrc ? `<img src="${heroSrc}" alt="Foto de la pareja"/>` : ''}</div>
</div>

${musicHtml}

<div style="width:100%;height:1px;background:linear-gradient(to right,transparent,${ra.border(.6)},transparent)"></div>

<div style="width:100%;max-width:672px;margin:0 auto;padding:40px 16px">
  <div style="display:flex;flex-direction:column;align-items:center;gap:40px;background:${ra.cream(.92)};border-radius:24px;box-shadow:0 20px 60px ${ra.dark(.12)};border:1px solid ${ra.border(.4)};padding:48px 24px">
    ${parentsHtml}
    ${coupleHtml}
    ${invCardHtml}
    ${ceremonies(event)}
    ${buildCarousel(event.carousel_images, (event.carousel_interval ?? 5) * 1000)}
    ${infoBlock('Vestimenta', event.dress_code, event.dress_code_image_url)}
    ${infoBlock('Regalo', event.gift_suggestion, event.gift_suggestion_image_url)}
    ${infoBlock('Recomendaciones', event.recommendations, event.recommendations_image_url)}
    ${noKidsHtml}
    ${mementoMsg}
  </div>
</div>

</body>
</html>`
}

export async function generateMemento(event, onProgress) {
  const imageKeys = [
    'couple_image_url', 'couple_mobile_image_url', 'invitation_image_url',
    'dress_code_image_url', 'gift_suggestion_image_url', 'recommendations_image_url',
    'civil_image_url', 'ceremony_image_url', 'reception_image_url',
    'song_url',
  ]

  onProgress?.('Preparando fuentes…')
  const fontsCss = await fetchFontsCss()

  onProgress?.('Preparando archivos…')
  const ev = { ...event }

  await Promise.all(imageKeys.map(async (key) => {
    if (ev[key]) ev[key] = await urlToBase64(ev[key])
  }))

  if (ev.carousel_images?.length) {
    ev.carousel_images = await Promise.all(
      ev.carousel_images.map(async (img) => ({ ...img, url: await urlToBase64(img.url) }))
    )
  }

  onProgress?.('Generando archivo…')
  const html = buildHtml(ev, fontsCss)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recuerdo-${ev.slug ?? 'evento'}.html`
  a.click()
  URL.revokeObjectURL(url)
}
