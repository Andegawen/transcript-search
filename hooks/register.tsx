import { atom, read, update } from 'claude-code'
import type { Hook, Register, RenderElement, RenderInput } from 'claude-code'

import type { Row } from '../types'

const PANE = 'find'
const query = atom({ plugin: 'transcript-search', key: 'query' } as const, '')
const selected = atom({ plugin: 'transcript-search', key: 'selected' } as const, null as string | null)

type Hit = { id: string; n: number; who: Row['who']; snippet: string; count: number }

// One line of context around the first match, whitespace flattened.
const snippetOf = (text: string, at: number, len: number, width: number) => {
  const flat = text.replace(/\s+/g, ' ')
  const pos = text.slice(0, at).replace(/\s+/g, ' ').length
  const side = Math.max(10, Math.floor((width - len) / 2))
  const start = Math.max(0, pos - side)
  const end = Math.min(flat.length, pos + len + side)

  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '')
}

// The colour the searched phrase is drawn in, in the pane's results.
const MATCH = '#b26bff'

// The text cut into the runs that match `needle`, ignoring case, and those between.
const splitOn = (text: string, needle: string) => {
  const parts: { text: string; isMatch: boolean }[] = []
  const lower = text.toLowerCase()
  const find = needle.toLowerCase()
  let from = 0
  for (let at = lower.indexOf(find); find !== '' && at >= 0; at = lower.indexOf(find, from)) {
    if (at > from) {
      parts.push({ text: text.slice(from, at), isMatch: false })
    }
    parts.push({ text: text.slice(at, at + find.length), isMatch: true })
    from = at + find.length
  }
  if (from < text.length) {
    parts.push({ text: text.slice(from), isMatch: false })
  }

  return parts
}

// Every transcript message row drawn since this module loaded, by the id its
// ui.render carries: the id is what $.ui.scroll moves the transcript to. Kept in
// the module, as drawing may not write $.state; a reload redraws the rows.
const rows = new Map<string, Row>()

// Draws the engine's row inside a red border when it is the selected one.
const highlight = async ($: Parameters<Hook<'ui.render'>>[0], e: RenderInput<'UserMessage' | 'AssistantMessage'>, drawn: RenderElement) => {
  if ((await read($, selected)) !== e.requestId) {
    return drawn
  }
  const { Box } = $.ui.resolve(e)

  return (
    <Box borderStyle="round" borderColor="red">
      {drawn}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'find',
      description: 'Search this conversation: /find <text>',
    })

    return next(e)
  })

  on('command.run', { command: 'find' }, async ($, e) => {
    const text = e.args.trim()
    if (text) {
      await update($, query, () => text)
    }
    await $.ui.open({ id: PANE, title: 'Find', focus: true, closeOnEscape: true })

    return { text: text ? `Searching for "${text}".` : 'Search pane opened.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, selected, () => null).catch(() => {})

    return next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    rows.set(e.requestId, { id: e.requestId, who: 'you', text: e.props.text })

    return highlight($, e, await next(e))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    rows.set(e.requestId, { id: e.requestId, who: 'claude', text: e.props.text })

    return highlight($, e, await next(e))
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // The mobile surface has no text field: there the query comes from /find alone.
    const Input = 'Input' in elements ? elements.Input : undefined
    const q = await read($, query)
    const current = await read($, selected)
    // The pane's own body: the tree is drawn exactly this tall, so the footer
    // stays on its last rows and nothing needs scrolling.
    const width = Math.max(30, e.props.bodyColumns)
    const height = Math.max(4, e.props.scroll.bodyRows)
    const room = Math.max(1, height - 3)

    const hits: Hit[] = []
    if (q) {
      const needle = q.toLowerCase()
      Array.from(rows.values()).forEach((row, i) => {
        const lower = row.text.toLowerCase()
        const at = lower.indexOf(needle)
        if (at >= 0) {
          const count = lower.split(needle).length - 1
          hits.push({ id: row.id, n: i + 1, who: row.who, count, snippet: snippetOf(row.text, at, q.length, width - 22) })
        }
      })
    }
    const total = hits.reduce((sum, hit) => sum + hit.count, 0)

    const go = async (id: string) => {
      await update($, selected, () => id)
      await $.ui.scroll({ to: { requestId: id }, block: 'center' })
    }

    return (
      <Box flexDirection="column" height={height}>
        {Input ? (
          <Input
            key="q"
            label="Find"
            placeholder="text to search for"
            value={q}
            submitLabel="search"
            autoFocus
            onSubmit={(value: string) => update($, query, () => value.trim())}
          />
        ) : (
          <Text>Find: {q}</Text>
        )}
        <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
        {hits.slice(-room).map(hit => (
          <Box key={`row:${hit.id}`}>
            <Text color={hit.id === current ? 'red' : hit.who === 'you' ? 'cyan' : 'green'}>
              {hit.id === current ? '▶' : ' '}
            </Text>
            <Button
              key={`hit:${hit.id}`}
              label={`#${hit.n} ${hit.who}: ${hit.snippet}`}
              onPress={() => go(hit.id)}
            >
              {`#${hit.n} ${hit.who}: `}
              {splitOn(hit.snippet, q).map((part, i) =>
                part.isMatch ? (
                  <Text color={MATCH} bold>
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )}
            </Button>
          </Box>
        ))}
        </Box>
        <Box flexDirection="column" flexShrink={0}>
          {current !== null && (
            <Button key="clear" label="Clear highlight" onPress={() => update($, selected, () => null)} />
          )}
          {q !== '' && (
            <Text dimColor wrap="truncate-end">
              {total} matches in {hits.length} messages
              {hits.length > room ? ` · newest ${room} shown` : ''} · ↑↓ move, Enter jumps
            </Text>
          )}
        </Box>
      </Box>
    )
  })
}
