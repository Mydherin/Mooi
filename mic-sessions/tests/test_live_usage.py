"""Session lists follow usage live without a summary per streamed token; no live accounts needed."""
import asyncio
from unittest.mock import Mock
from uuid import uuid4

from mic_sessions.features import sessions


def _session(player_id, connection_id, *, status='ready', runtime=True, refreshed_at=0.0):
    session = sessions.new_session(uuid4(), player_id, uuid4(), 'owner/repo', 'claude', connection_id, 'feat/x', 'main')
    session.status = status
    session.runtime = object() if runtime else None
    session.usage_refresh_at = refreshed_at
    return session


def _context(percent):
    return {'context': {'percent': percent, 'usedTokens': 1, 'limitTokens': 100, 'updatedAt': 1.0}}


def test_usage_is_announced_only_when_a_listed_value_changes(monkeypatch):
    session = _session(uuid4(), uuid4())
    registry = Mock(get=Mock(return_value=session))
    monkeypatch.setattr(sessions, 'get_registry', lambda: registry)
    published = []
    monkeypatch.setattr(sessions._channels, 'watched', lambda _: True)
    monkeypatch.setattr(sessions._channels, 'publish', lambda *args: published.append(args))

    async def scenario():
        async def settle():
            await asyncio.sleep(0)
            await asyncio.sleep(0)

        sessions.record(session, 'session.usage', _context(10.2))
        await settle()
        sessions.record(session, 'session.usage', _context(10.4))  # Still 10%: transcript only.
        await settle()
        sessions.record(session, 'session.usage', _context(11.0))
        await settle()
        sessions.record(session, 'session.usage', {'quota': {'five_hour': {'percent': 30, 'updatedAt': 2.0}}})
        await settle()
        sessions.record(session, 'session.usage', {'quota': {'five_hour': {'percent': 30, 'updatedAt': 3.0}}})
        await settle()

    asyncio.run(scenario())
    assert [args[2]['usage'] for args in published] == [
        _context(10.2), _context(11.0),
        {**_context(11.0), 'quota': {'five_hour': {'percent': 30, 'updatedAt': 2.0}}},
    ]


def test_unwatched_channel_builds_no_summary(monkeypatch):
    session = _session(uuid4(), uuid4())
    monkeypatch.setattr(sessions, 'get_registry', lambda: Mock(get=Mock(return_value=session)))
    monkeypatch.setattr(sessions._channels, 'watched', lambda _: False)
    payload = Mock(side_effect=AssertionError('built a summary nobody receives'))
    monkeypatch.setattr(session, 'to_payload', payload)

    async def scenario():
        sessions.record(session, 'session.usage', _context(50))
        await asyncio.sleep(0)

    asyncio.run(scenario())
    assert session.usage_signature == sessions._usage_signature(session.usage)


def test_listed_limits_refresh_one_live_session_per_account(monkeypatch):
    player, first, second = uuid4(), uuid4(), uuid4()
    stale = _session(player, first, refreshed_at=1.0)
    fresher = _session(player, first, refreshed_at=5.0)
    other = _session(player, second)
    idle = [_session(player, second, status='provisioning'), _session(player, second, runtime=False)]
    monkeypatch.setattr(sessions, 'get_registry',
                        lambda: Mock(list_for=Mock(return_value=[fresher, stale, other, *idle])))
    refreshed = []
    monkeypatch.setattr(sessions, '_refresh_visible_usage', refreshed.append)
    monkeypatch.setattr(sessions, '_player_usage_refresh_at', {})

    sessions._refresh_listed_usage(player)
    sessions._refresh_listed_usage(player)  # Throttled: one look per minute per player.

    assert refreshed == [stale, other]
