# The Vibe Metaverse v2

## What This Is

A web-based game entry for The Vibe Metaverse v2 competition. This is a browser game that must be instantly playable with no friction.

## Competition Rules

- **AI-written code**: At least 90% of the code must be written by AI
- **Started on or after**: 2026-04-02 — do not submit old/pre-existing games
- **Free & accessible**: The game must be playable on the web with no login, no signup, and free-to-play (preferably on its own domain or subdomain)
- **Multiplayer preferred**: Multiplayer games are preferred but not required
- **3D engine**: Three.js
- **No loading screens or heavy downloads**: The game must load almost instantly — no splash screens, no large asset downloads. The only acceptable gate is an optional username prompt

## Development Guidelines

- Use Three.js unless there's a strong reason to use something else
- Keep assets minimal and lightweight — inline or procedurally generate where possible
- Avoid external asset dependencies that add load time
- Target instant load: the player should be in the game within seconds of opening the page
- If multiplayer, use WebSockets or WebRTC for real-time communication
- Deploy to a publicly accessible URL (own domain/subdomain preferred)
