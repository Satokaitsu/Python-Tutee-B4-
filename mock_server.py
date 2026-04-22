
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import os
import requests
import sys
import uuid
import re
from datetime import datetime
from dotenv import load_dotenv

# Ensure learning-ui is on path to import prompts
ROOT = Path(__file__).resolve().parents[1]
_lu = str(ROOT / 'learning-ui')
if _lu not in sys.path:
    sys.path.insert(0, _lu)

try:
    from python_tutee_prompts_improved import build_ack_prompt
    print("✅ prompts imported successfully")
except ImportError:
    print("⚠️ Failed to import prompts")
    def build_ack_prompt(*args, **kwargs):
        return {'user_prompt': 'Error: Prompts not found'}

# Load Environment Variables
KEY_ENV_FILE = ROOT / 'learning-ui' / 'key.env'
load_dotenv(KEY_ENV_FILE)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Mount static assets
PUBLIC_ASSETS = ROOT / 'learning-ui' / 'public' / 'assets'
if PUBLIC_ASSETS.exists():
    app.mount('/mock/assets', StaticFiles(directory=str(PUBLIC_ASSETS)), name='mock_assets')

# Directories
QDIR = ROOT / 'data' / 'mock_questions'
FALLBACK_QUESTION_DIR = ROOT / 'learning-ui'
SESSIONS_DIR = ROOT / 'data' / 'mock_sessions'
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR = ROOT / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
USERS_FILE = DATA_DIR / 'users.json'

# In-memory sessions
SESSIONS = {}

# --- Utility Functions ---

def _load_json(p: Path):
    try:
        if not p.exists(): return None
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def _now_iso():
    return datetime.utcnow().isoformat()

def _call_llm_direct(prompt: str, model: str = 'gpt-5.1', system_prompt: str = None):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {'error': 'OPENAI_API_KEY not set in environment'}

    if not system_prompt:
        system_prompt = "You are a helpful assistant."

    url = 'https://api.openai.com/v1/responses'
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }

    payload = {
        'model': model,
        'input': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': prompt}
        ],
        'max_output_tokens': 1024,
        'temperature': 0.7 
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        body = r.json()
        return {
            'text': body["output"][0]["content"][0]["text"],
            'raw': body
        }
    except Exception as e:
        return {'error': str(e)}


def _extract_stream_text(obj):
    """Best-effort extraction of delta text from OpenAI Responses streaming payloads."""
    if not obj:
        return None

    # New Responses SSE payloads often look like {"output_text": {"index":0, "delta":"..."}}
    if 'output_text' in obj:
        ot = obj.get('output_text') or {}
        if isinstance(ot, dict):
            if ot.get('delta'):
                return ot['delta']
            if ot.get('text'):
                return ot['text']

    # Some variants use {"delta": {"text": "..."}} or nested content arrays
    if 'delta' in obj:
        delta = obj.get('delta')
        if isinstance(delta, dict):
            if delta.get('text'):
                return delta['text']
            content = delta.get('content')
            if isinstance(content, list):
                parts = [c.get('text') for c in content if isinstance(c, dict) and c.get('text')]
                if parts:
                    return ''.join(parts)

    # Chat-completions style fallback {"choices":[{"delta":{"content":"..."}}]}
    if 'choices' in obj:
        try:
            choice = obj['choices'][0]
            delta = choice.get('delta') or {}
            if delta.get('content'):
                return delta['content']
        except Exception:
            pass

    return None


def _stream_llm_direct(prompt: str, model: str = 'gpt-5.1', system_prompt: str = None):
    """Yield text deltas from OpenAI Responses API using streaming mode.

    Falls back to no-yield when streaming is unavailable. Callers should collect
    and handle the case where no chunks are produced.
    """
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return

    if not system_prompt:
        system_prompt = "You are a helpful assistant."

    url = 'https://api.openai.com/v1/responses'
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }

    payload = {
        'model': model,
        'input': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': prompt}
        ],
        'max_output_tokens': 1024,
        'temperature': 0.7,
        'stream': True
    }

    try:
        with requests.post(url, headers=headers, json=payload, stream=True, timeout=90) as r:
            r.raise_for_status()
            for line in r.iter_lines(decode_unicode=True):
                if not line:
                    continue
                # SSE frames may come as "data: {...}"
                if isinstance(line, bytes):
                    try:
                        line = line.decode('utf-8')
                    except Exception:
                        continue
                line = line.strip()
                if not line:
                    continue
                if line.startswith('data:'):
                    line = line[len('data:'):].strip()
                if line in ('[DONE]', 'data: [DONE]'):
                    break
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                delta_text = _extract_stream_text(obj)
                if delta_text:
                    yield delta_text
    except Exception as e:
        print(f"⚠️ stream error: {e}")

# --- User Management ---

def _get_users():
    """Load users from users.json, or return defaults if missing."""
    if USERS_FILE.exists():
        users = _load_json(USERS_FILE)
        if isinstance(users, list):
            return users
    
    # Defaults
    defaults = [
        {'id': 'demo_user_01', 'name': 'Demo User 01'},
        {'id': 'demouser', 'name': 'Demo User'}
    ]
    # Save defaults if file doesn't exist
    if not USERS_FILE.exists():
        try:
            with open(USERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(defaults, f, ensure_ascii=False, indent=2)
        except: pass
        
    return defaults

# --- Session Management ---

def _get_persistent_session_id(user_id: str) -> str:
    """Return a single persistent session ID per user."""
    # Clean user_id just in case
    clean = re.sub(r'[^a-zA-Z0-9_\-]', '', user_id)
    return f"sess_{clean}"

def _get_session_file_path(session_id: str) -> Path:
    # Flat structure: data/mock_sessions/sess_{user_id}.json
    return SESSIONS_DIR / f"{session_id}.json"

def _save_session_to_file(session_id: str):
    s = SESSIONS.get(session_id)
    if not s:
        return
    try:
        filepath = _get_session_file_path(session_id)
        # atomic write
        tmp = filepath.parent / f".{filepath.name}.tmp"
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(s, f, ensure_ascii=False, indent=2)
        os.replace(str(tmp), str(filepath))
    except Exception as e:
        print(f"Warning: failed to save session {session_id}: {e}")

def _load_sessions_from_dir():
    # Load all flat sessions
    if not SESSIONS_DIR.exists():
        return
    for f in SESSIONS_DIR.glob('sess_*.json'):
        try:
            data = _load_json(f)
            if data and 'session_id' in data:
                SESSIONS[data['session_id']] = data
        except: pass

_load_sessions_from_dir()

# --- Question/Unit Utils ---

def _collect_all_question_files():
    files = []
    if QDIR.exists():
        files.extend([p for p in QDIR.glob('*.json')])
    if FALLBACK_QUESTION_DIR.exists():
         for p in FALLBACK_QUESTION_DIR.glob('*.json'):
             if 'questions' not in p.name: # avoid config files
                 files.append(p)
    seen = set()
    unique = []
    for p in files:
        if p.stem not in seen:
            seen.add(p.stem)
            unique.append(p)
    return unique


# --- API Endpoints ---

@app.options('/mock/{path:path}')
def mock_preflight(path: str):
    from fastapi import Response
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    }
    return Response(status_code=200, headers=headers)

@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.get('/mock/units')
def list_units_endpoint():
    return JSONResponse(content={
        'units': [
            {'id': 'cond', 'label': '条件分岐', 'question_count': 12}, 
            {'id': 'loop', 'label': 'ループ', 'question_count': 10}, 
            {'id': 'func', 'label': '関数', 'question_count': 8}
        ]
    })

@app.get('/mock/list_users')
def list_users():
    return JSONResponse(content={'users': _get_users()})

@app.get('/mock/progress/{user_id}')
def get_progress(user_id: str):
    # Dummy progress
    return JSONResponse(content={
        'user_id': user_id, 
        'progress': {'units': []} 
    })

@app.post('/mock/start_chat_session')
def start_chat_session(req: dict):
    user_id = req.get('user_id')
    unit_id = req.get('unit_id')
    qid = req.get('qid')
    
    if not user_id:
        return JSONResponse(content={'error': 'user_id required'}, status_code=400)

    # Use single persistent session ID for this user
    session_id = _get_persistent_session_id(user_id)
    
    # If session exists, load it and update current context
    if session_id in SESSIONS:
        session = SESSIONS[session_id]
        print(f"Resuming persistent session {session_id}")
        
        # Update context if provided
        if unit_id: session['unit_id'] = unit_id
        if qid: session['current_qid'] = qid
        
        # Check if we need to add a separator or system message indicating new context?
        # Maybe just log it.
        
        _save_session_to_file(session_id)
    else:
        # Create new session
        initial_agent = {
            'role': 'agent',
            'text': 'こんにちは！よろしくお願いします。',
            'at': _now_iso(),
            'avatar': '/mock/assets/manabee-robot.svg'
        }
        
        session = {
            'session_id': session_id,
            'user_id': user_id,
            'unit_id': unit_id,
            'created_at': _now_iso(),
            'message_history': [initial_agent],
        }
        SESSIONS[session_id] = session
        _save_session_to_file(session_id)

    return JSONResponse(content={
        'session_id': session_id,
        'message_history': session['message_history'],
    })

@app.get('/mock/get_session_state')
def get_session_state(session_id: str):
    if session_id not in SESSIONS:
        # Fallback: try to load from disk if not in memory (e.g. server restart)
        # But _load_sessions_from_dir should have handled it.
        # If still not found, check if it matches pattern sess_{user} and try to create?
        # No, safe to error.
        return JSONResponse(content={'error': 'session not found'}, status_code=404)
    return JSONResponse(content=SESSIONS[session_id])

@app.post('/mock/send_user_message')
def send_user_message(req: dict):
    session_id = req.get('session_id')
    user_message = req.get('user_message') or req.get('text', '')
    
    if session_id not in SESSIONS:
        return JSONResponse(content={'error': 'session not found'}, status_code=404)
        
    session = SESSIONS[session_id]
    
    # 1. Append User Message
    user_entry = {
        'role': 'user', 
        'text': user_message, 
        'at': _now_iso()
    }
    session['message_history'].append(user_entry)
    
    # 2. Generate Agent Response using CoT Prompt
    # We ignore teaching analysis and updates.
    prompts = build_ack_prompt(session, user_message)
    sys_prompt = prompts.get('system_prompt', '')
    usr_prompt = prompts.get('user_prompt', '')
    
    print(f"Sending to LLM: {len(usr_prompt)} chars")
    
    llm_resp = _call_llm_direct(usr_prompt, system_prompt=sys_prompt)
    if llm_resp.get('error'):
         agent_text = "すみません、少し調子が悪いみたいです... (LLM Error)"
         print(f"LLM Error: {llm_resp.get('error')}")
    else:
         raw_text = llm_resp.get('text', '')
         # Remove CoT blocks (<!-- ... -->)
         agent_text = re.sub(r'<!--[\s\S]*?-->', '', raw_text).strip()
    
    # 3. Append Agent Message
    agent_entry = {
        'role': 'agent',
        'text': agent_text,
        'at': _now_iso(),
        'avatar': '/mock/assets/manabee-robot.svg'
    }
    session['message_history'].append(agent_entry)
    _save_session_to_file(session_id)
    
    return JSONResponse(content={
        'status': 'ack',
        'agent_message': agent_entry,
        'session': session
    })


@app.post('/mock/send_user_message_stream')
def send_user_message_stream(req: dict):
    """Stream Manabee's reply so the UI can render tokens progressively."""
    session_id = req.get('session_id')
    user_message = req.get('user_message') or req.get('text', '')

    if session_id not in SESSIONS:
        return JSONResponse(content={'error': 'session not found'}, status_code=404)

    session = SESSIONS[session_id]

    # Prepare prompts once so we can reuse across stream/fallback
    prompts = build_ack_prompt(session, user_message)
    sys_prompt = prompts.get('system_prompt', '')
    usr_prompt = prompts.get('user_prompt', '')

    def event_stream():
        try:
            # 1) Append user message immediately so other fetchers see it
            user_entry = {
                'role': 'user',
                'text': user_message,
                'at': _now_iso()
            }
            session['message_history'].append(user_entry)
            _save_session_to_file(session_id)

            yield f"data: {json.dumps({'event': 'start'})}\n\n"

            # 2) Stream LLM tokens
            tokens = []
            for delta in _stream_llm_direct(usr_prompt, system_prompt=sys_prompt):
                tokens.append(delta)
                yield f"data: {json.dumps({'event': 'token', 'text': delta})}\n\n"

            # 3) Fallback: if no streaming tokens arrived, do a blocking call
            if not tokens:
                llm_resp = _call_llm_direct(usr_prompt, system_prompt=sys_prompt)
                if llm_resp.get('error'):
                    tokens.append("すみません、少し調子が悪いみたいです... (LLM Error)")
                    print(f"LLM Error: {llm_resp.get('error')}")
                else:
                    tokens.append(llm_resp.get('text', ''))

            full_text = ''.join(tokens)
            # Remove CoT blocks (<!-- ... -->)
            agent_text = re.sub(r'<!--[\s\S]*?-->', '', full_text).strip()

            agent_entry = {
                'role': 'agent',
                'text': agent_text,
                'at': _now_iso(),
                'avatar': '/mock/assets/manabee-robot.svg'
            }
            session['message_history'].append(agent_entry)
            _save_session_to_file(session_id)

            yield f"data: {json.dumps({'event': 'end', 'text': agent_text, 'session': session})}\n\n"
        except Exception as e:
            print(f"stream handler error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type='text/event-stream')

# Stubs
@app.get('/mock/knowledge_state/{session_id}')
def get_knowledge_state_stub(session_id: str):
    return JSONResponse(content={'items': [], 'all_complete': False})

@app.post('/mock/agent_attempt')
def agent_attempt_stub(req: dict):
    return JSONResponse(content={'status': 'ignored', 'can_attempt': False})
