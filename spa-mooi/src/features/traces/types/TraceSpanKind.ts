/** What a span stands for: a user turn, one model request, a tool call, a sub-agent, a skill, a hook... */
export type TraceSpanKind = 'turn' | 'llm' | 'tool' | 'agent' | 'skill' | 'hook' | 'context' | 'compaction' | 'event';
