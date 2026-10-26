# transcript-search

A Claude Code mod that adds search to the terminal conversation.

`/find <text>` opens a Find pane beside the transcript that lists every message containing the text, ignoring case, with the searched phrase drawn in purple. Move between results with Up/Down and press Enter: the transcript scrolls to that message and draws a red border around it. A summary line at the bottom of the pane shows how many matches were found. Type a new term in the pane's search box to search again; Esc closes the pane and clears the highlight.

The search runs locally and uses no model tokens. It covers your messages and Claude's replies that the terminal has drawn in the current session; tool output is not searched.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install transcript-search --marketplace Andegawen/transcript-search
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install transcript-search --marketplace Andegawen/transcript-search
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Andegawen/transcript-search`, then Add plugin.
