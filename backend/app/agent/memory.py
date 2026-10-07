from typing import List, Dict, Any
from collections import defaultdict

# In-memory conversation store keyed by session_id or user_id
_conversation_store: Dict[str, List[Dict[str, Any]]] = defaultdict(list)


def get_conversation_history(session_id: str, max_messages: int = 10) -> List[Dict[str, Any]]:
    return _conversation_store[session_id][-max_messages:]


def add_message_to_history(session_id: str, role: str, content: str, tool_calls: Any = None):
    msg: Dict[str, Any] = {"role": role, "content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    _conversation_store[session_id].append(msg)
    # Keep last 20 messages per session
    if len(_conversation_store[session_id]) > 20:
        _conversation_store[session_id] = _conversation_store[session_id][-20:]


def clear_conversation_history(session_id: str):
    if session_id in _conversation_store:
        del _conversation_store[session_id]
