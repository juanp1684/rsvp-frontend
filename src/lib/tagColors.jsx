export const TAG_COLORS = [
  { key: 'red',    bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  { key: 'orange', bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
  { key: 'yellow', bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  { key: 'green',  bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  { key: 'teal',   bg: '#CCFBF1', text: '#115E59', border: '#99F6E4' },
  { key: 'blue',   bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  { key: 'purple', bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  { key: 'pink',   bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
  { key: 'gray',   bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
]

export const getTagColor = (key) =>
  TAG_COLORS.find((c) => c.key === key) ?? TAG_COLORS[TAG_COLORS.length - 1]

export function TagChip({ tag, className = '' }) {
  const { bg, text, border } = getTagColor(tag.color)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-[160px] truncate ${className}`}
      style={{ backgroundColor: bg, color: text, border: `1px solid ${border}` }}
    >
      {tag.name}
    </span>
  )
}
