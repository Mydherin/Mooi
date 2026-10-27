"""Compaction compatibility and provider transport regression coverage; no live accounts needed."""
import asyncio
from contextlib import nullcontext
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mic_sessions.features import sessions
from mic_sessions.shared import agents, codex


@pytest.mark.parametrize('body, expected', [
    (None, None), ({}, None), ({'instructions': '  \n '}, None),
    ({'instructions': ' Keep decisions\nCondense logs '}, 'Keep decisions\nCondense logs'),
])
def test_endpoint_accepts_old_and_guided_requests(monkeypatch, body, expected):
    session = NS(operation_lock=asyncio.Lock(), status='ready', closing=False,
                 deployment=NS(state='stopped'), usage={'context': {'usedTokens': 100}})
    registry = NS(get_for=Mock(return_value=session))
    monkeypatch.setattr(sessions, 'get_registry', lambda: registry)
    monkeypatch.setattr(sessions, '_runtime', lambda _: NS())
    monkeypatch.setattr(sessions, '_touch', Mock())
    monkeypatch.setattr(sessions, 'record', Mock())
    monkeypatch.setattr(sessions, '_record_status', Mock())
    run = AsyncMock()
    monkeypatch.setattr(sessions, '_run_compaction', run)
    monkeypatch.setattr(sessions, '_spawn', lambda _, coroutine: coroutine.close())
    app = FastAPI()
    app.include_router(sessions.router)
    app.dependency_overrides[sessions.current_caller] = lambda: NS()
    with TestClient(app) as client:
        response = client.post('/sessions/00000000-0000-0000-0000-000000000001/compact',
                               **({'json': body} if body is not None else {}))
    assert response.status_code == 202, response.text
    run.assert_called_once_with(session, session.usage['context'], expected)
    registry.get_for.assert_called_once()


def test_instruction_length_is_bounded():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        sessions.CompactSessionRequest(instructions='x' * 10_001)


@pytest.mark.parametrize('failure', [False, True])
def test_operation_forwards_guidance_and_restores_status(monkeypatch, failure):
    runtime = NS(compact=AsyncMock(side_effect=RuntimeError('provider failed') if failure else None))
    session = NS(id='session', operation_lock=asyncio.Lock(), closing=False, status='compacting')
    monkeypatch.setattr(sessions, '_runtime', lambda _: runtime)
    record, status = Mock(), Mock()
    monkeypatch.setattr(sessions, 'record', record)
    monkeypatch.setattr(sessions, '_record_status', status)
    previous = {'usedTokens': 123}
    asyncio.run(sessions._run_compaction(session, previous, 'Keep decisions'))
    runtime.compact.assert_awaited_once_with('Keep decisions')
    status.assert_called_once_with(session, 'ready')
    record.assert_any_call(session, sessions.EVENT_SESSION_COMPACTION,
                           {'phase': 'failed' if failure else 'completed'})
    if failure:
        record.assert_any_call(session, 'session.usage', {'context': previous})


@pytest.mark.parametrize('instructions', [None, 'Keep decisions'])
def test_codex_native_compaction_and_guidance(instructions):
    client = object.__new__(codex.Client)
    router = NS(pending_turn=Mock(return_value=nullcontext({})), prepare_turn=Mock())
    client.sdk = NS(_router=router, unregister_turn_notifications=Mock())
    notes = iter([
        ('thread/tokenUsage/updated', {'tokenUsage': {'last': {'totalTokens': 42}}}),
        ('item/completed', {'item': {'type': 'contextCompaction'}}),
        ('turn/completed', {'turn': {'status': 'completed'}}),
    ])
    reads = iter([NS(thread=NS(turns=[])), NS(thread=NS(turns=[NS(id='compact-turn')]))])
    async def call(method, *args, **kwargs):
        if method == 'thread_read':
            return next(reads)
        if method == 'next_turn_notification':
            name, payload = next(notes)
            return NS(method=name, payload=NS(model_dump=lambda **_: payload))
    client.call = AsyncMock(side_effect=call)
    result = asyncio.run(client.compact('thread', instructions))
    assert result['last']['totalTokens'] == 42
    client.call.assert_any_await('thread_compact', 'thread')
    injected = [c for c in client.call.await_args_list if c.args[0] == 'request']
    assert len(injected) == bool(instructions)
    if instructions:
        assert injected[0].args[1] == 'thread/inject_items'
        assert instructions in injected[0].args[2]['items'][0]['content'][0]['text']
        methods = [c.args[0] for c in client.call.await_args_list]
        assert methods.index('request') < methods.index('thread_compact')
    client.sdk.unregister_turn_notifications.assert_called_once_with('compact-turn')


def test_codex_does_not_silently_ignore_failed_guidance():
    client = object.__new__(codex.Client)
    async def call(method, *args, **kwargs):
        if method == 'thread_read':
            return NS(thread=NS(turns=[]))
        if method == 'request':
            raise RuntimeError('Injection rejected')
        raise AssertionError('Must not compact without requested guidance')
    client.call = AsyncMock(side_effect=call)
    with pytest.raises(RuntimeError, match='Injection rejected'):
        asyncio.run(client.compact('thread', 'Keep decisions'))


@pytest.mark.parametrize('instructions', [None, 'Keep decisions'])
def test_claude_summary_prompt_and_tool_isolation(monkeypatch, instructions):
    runtime = object.__new__(agents.ClaudeAgentRuntime)
    runtime._conversation_id = 'conversation'
    runtime._config = NS()
    runtime._compacted_context = None
    runtime._transcript_store = object()
    runtime._build_options = Mock(return_value=agents.ClaudeAgentOptions())
    runtime._connect_client = AsyncMock()
    runtime._replace_client = AsyncMock()
    runtime._emit = AsyncMock()
    runtime._refresh_context = AsyncMock()
    runtime._refresh_quota = AsyncMock()
    async def response():
        yield agents.AssistantMessage(content=[agents.TextBlock(text='Retained context')], model='test')
    summary_client = NS(connect=AsyncMock(), query=AsyncMock(), receive_response=response,
                        disconnect=AsyncMock())
    factory = Mock(return_value=summary_client)
    monkeypatch.setattr(agents, 'ClaudeSDKClient', factory)
    asyncio.run(runtime.compact(instructions))
    prompt = summary_client.query.await_args.args[0]
    assert ('Keep decisions' in prompt) == bool(instructions)
    assert 'Use at most 2,000 words' in prompt
    options = factory.call_args.kwargs['options']
    assert options.fork_session and options.tools == [] and options.mcp_servers == {}
    assert runtime._compacted_context == 'Retained context'
    summary_client.disconnect.assert_awaited_once()
