# Frontend Demo

This is a minimal React (Vite) demo that talks to the mock backend in `tools/mock_server.py`.

Quick start (Windows PowerShell):

```powershell
# from repository root: start mock server
python -m uvicorn tools.mock_server:app --reload --port 8081

# open a new shell and start frontend
cd frontend_demo
npm install
npm run dev
```

Open `http://localhost:5173` (Vite default) to view the demo. The demo uses endpoints:

- `GET http://127.0.0.1:8081/mock/get_current_question` to fetch a question
- `POST http://127.0.0.1:8081/mock/submit_session_answer` to submit teaching message

If your environment blocks CORS or uses a different port, change `MOCK_BASE` in `src/App.jsx`.
