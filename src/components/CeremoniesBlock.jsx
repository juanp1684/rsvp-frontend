import { ImageIcon } from 'lucide-react'

const PRIORITY = ['reception', 'ceremony', 'civil']
const LABELS = { civil: 'Ceremonia Civil', ceremony: 'Ceremonia', reception: 'Recepción' }
const AT_KEYS = { civil: 'civil_at', ceremony: 'ceremony_at', reception: 'reception_at' }

function computeGroups(nodes, edges) {
  const parent = Object.fromEntries(nodes.map(n => [n, n]))

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }

  edges.forEach(([a, b]) => { parent[find(a)] = find(b) })

  const map = {}
  nodes.forEach(n => {
    const root = find(n)
    if (!map[root]) map[root] = []
    map[root].push(n)
  })

  return Object.values(map)
}

function groupDisplay(group, event) {
  for (const key of PRIORITY) {
    if (!group.includes(key)) continue
    const url = event[`${key}_image_url`]
    if (url) return { imageUrl: url, location: event[`${key}_location`], mapUrl: event[`${key}_url`] }
  }
  for (const key of PRIORITY) {
    if (!group.includes(key)) continue
    return { imageUrl: null, location: event[`${key}_location`], mapUrl: event[`${key}_url`] }
  }
  return { imageUrl: null, location: null, mapUrl: null }
}

export default function CeremoniesBlock({ event }) {
  const nodes = []
  if (event.civil_at) nodes.push('civil')
  if (event.ceremony_at) nodes.push('ceremony')
  if (event.reception_at) nodes.push('reception')

  if (nodes.length === 0) return null

  const edges = []
  if (event.civil_ceremony_same_venue && nodes.includes('civil') && nodes.includes('ceremony'))
    edges.push(['civil', 'ceremony'])
  if (event.civil_reception_same_venue && nodes.includes('civil') && nodes.includes('reception'))
    edges.push(['civil', 'reception'])
  if (event.ceremony_reception_same_venue && nodes.includes('ceremony') && nodes.includes('reception'))
    edges.push(['ceremony', 'reception'])

  const groups = computeGroups(nodes, edges)

  groups.sort((a, b) => {
    const aMin = Math.min(...a.map(k => new Date(event[AT_KEYS[k]]).getTime()))
    const bMin = Math.min(...b.map(k => new Date(event[AT_KEYS[k]]).getTime()))
    return aMin - bMin
  })
  groups.forEach(g => g.sort((a, b) => new Date(event[AT_KEYS[a]]) - new Date(event[AT_KEYS[b]])))

  const gridCols = groups.length >= 2 ? 'md:grid-cols-2' : ''

  return (
    <div className={`w-full grid grid-cols-1 gap-8 ${gridCols}`}>
      {groups.map((group, gi) => {
        const { imageUrl, location, mapUrl } = groupDisplay(group, event)
        return (
          <div key={gi} className="flex flex-col gap-3">
            <div className="w-full aspect-video bg-muted rounded-xl overflow-hidden">
              {imageUrl
                ? <img src={imageUrl} alt={group.map(k => LABELS[k]).join(' / ')} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                    <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">
                      {group.map(k => LABELS[k]).join(' / ')}
                    </p>
                  </div>
              }
            </div>
            <div className="flex flex-col gap-2">
              {group.map(k => (
                <div key={k} className="flex flex-col gap-0.5">
                  <p className="font-semibold font-subtitle text-[#412D26]">{LABELS[k]}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event[AT_KEYS[k]]).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                </div>
              ))}
              {location && (
                <div className="mt-1">
                  {mapUrl
                    ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#735749] underline">{location}</a>
                    : <p className="text-sm text-muted-foreground">{location}</p>
                  }
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
