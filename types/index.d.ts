export type Row = { id: string; who: 'you' | 'claude'; text: string }

declare module 'claude-code' {
  interface PluginState {
    'transcript-search': { query: string; selected: string | null }
  }
}
