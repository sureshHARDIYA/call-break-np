# Call Break Real-Time WebSocket Protocol

Endpoint: `ws://<host>:3000/ws` (or `wss://` over HTTPS)

All mutations use an `actionId` UUID for idempotency and optional `expectedVersion` for optimistic concurrency control. Every server state update carries a monotonically increasing `version` integer and sanitized per-seat `ClientRoomView` (opponent hands are never transmitted).

## Client -> Server Commands

| Command | Payload | Description |
|---|---|---|
| `room.join` | `{ actionId, roomCode, displayName?, sessionToken?, preferredSeat? }` | Join a vacant seat or reclaim an existing seat via `sessionToken`. |
| `player.ready` | `{ actionId, ready }` | Toggle lobby readiness. |
| `seat.select` | `{ actionId, seat }` | Switch to a vacant seat in the lobby. |
| `bot.add` | `{ actionId, seat, difficulty? }` | Host adds an AI bot to a vacant seat. |
| `bot.remove` | `{ actionId, seat }` | Host removes an AI bot before game start. |
| `room.update_settings` | `{ actionId, settings }` | Host updates rules (`rounds`, `maxBid`, `strictMustBeat`, `strictMustTrump`, `turnTimerEnabled`, `botDifficulty`). |
| `host.transfer` | `{ actionId, targetSeat }` | Host transfers ownership to another human player. |
| `game.start` | `{ actionId }` | Host starts the match once all 4 seats are filled. |
| `bid.submit` | `{ actionId, expectedVersion?, bid }` | Submit trick bid (`1..maxBid`) on active turn. |
| `card.play` | `{ actionId, expectedVersion?, cardId }` | Play a legal card on active turn. |
| `round.next` | `{ actionId }` | Advance from round summary to next round (dealer rotates counterclockwise). |
| `game.restart` | `{ actionId }` | Start a fresh match after `GAME_COMPLETE`. |
| `chat.send` | `{ actionId, text }` | Broadcast a real-time chat message to the table. |
| `player.typing` | `{ isTyping }` | Notify table of typing status. |
| `game.request_sync` | `{ lastKnownVersion? }` | Request authoritative `game.state_sync` snapshot. |
| `ping` | `{ timestamp }` | Client heartbeat probe. |

## Server -> Client Events

- `room.created` — Emitted upon room creation.
- `room.joined` — Sent to joining/reconnecting client with `sessionToken`, `seat`, and `state`.
- `room.updated` — Room settings, seat switch, or host ownership updated.
- `player.joined` — New human player seated.
- `player.left` — Player disconnected (seat preserved for reconnection; host migrated if needed).
- `player.reconnected` — Player reclaimed original seat with session token.
- `player.ready` — Lobby ready toggle updated.
- `bot.added` — AI bot placed into a vacant seat.
- `bot.removed` — AI bot removed from lobby.
- `game.started` — Match initialized (Round 1).
- `cards.dealt` — Per-seat private 13-card hand delivered for the round.
- `bid.submitted` — Player bid locked and broadcast.
- `bidding.completed` — All 4 bids placed; Trick 1 lead seat announced.
- `card.played` — Legal card added to current trick.
- `trick.completed` — 4th card played; trick winner announced before clearing.
- `round.completed` — 13 tricks finished; integer-tenths round scores computed.
- `game.completed` — Final round finished; match winner(s) announced.
- `chat.message` — Chat or system event message.
- `player.typing` — Live typing indicator.
- `game.state_sync` — Authoritative state reconciliation snapshot.
- `game.error` — Validation/turn/state error with `code` and `message`.
- `pong` — Heartbeat response.
