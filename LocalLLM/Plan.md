# Local LLM System - Implementation Plan

> **For Future AI Agents**: This document contains the complete implementation plan for a 100% offline local LLM system with RLM (Recursive Language Model) at its core.

---

## Reference Documentation

### RLM Paper (Primary Reference)
- **Title**: Recursive Language Models
- **Authors**: Alex L. Zhang, Tim Kraska, Omar Khattab (MIT CSAIL)
- **arXiv**: https://arxiv.org/abs/2512.24601
- **PDF Direct Link**: https://arxiv.org/pdf/2512.24601
- **Official GitHub**: https://github.com/alexzhang13/rlm
- **Blog Post**: https://alexzhang13.github.io/blog/2025/rlm/

**Key Insight from Paper**: Long prompts should not be fed into the LLM directly, but should instead be treated as part of the environment that the LLM can search, read and interact with as needed for the task. The RLM allows an LLM to use a persistent Python REPL to inspect and transform its input data, and to call sub-LLMs from within that Python REPL.

---

## Goal

Build a **100% offline local LLM system** where **RLM is fundamentally integrated into every chat interaction**. This is not a separate tool—RLM is the core inference engine that processes ALL user messages.

---

## Target System

| Component | Specification |
|-----------|---------------|
| **GPU** | NVIDIA RTX 4060 8GB VRAM |
| **RAM** | 64GB DDR5 |
| **CPU** | Intel i7-14700KF |
| **OS** | Windows 11 |
| **Backend** | Ollama (local service, no cloud) |
| **Interface** | Web UI (index.html) served by Python backend |

---

## Core Architecture: RLM-First Design

**CRITICAL**: RLM is NOT a separate CLI tool. It is the fundamental processing layer for ALL interactions.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│                     Web UI (index.html)                         │
│   - Chat interface                                              │
│   - Model selector                                              │
│   - Service controls                                            │
│   - Settings panel                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (localhost:8000)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RLM CORE ENGINE (Python)                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  RLMEngine (Always Active)              │   │
│   │   1. Receive user message                               │   │
│   │   2. Analyze complexity → decide: direct or recursive   │   │
│   │   3. If complex: decompose → recurse → synthesize       │   │
│   │   4. Python REPL available for data processing          │   │
│   │   5. Return final response                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│   ┌──────────────┐  ┌────────┴───────┐  ┌──────────────┐        │
│   │ContextManager│  │  PythonREPL    │  │ OllamaClient │        │
│   │ (chunking)   │  │  (sandbox)     │  │ (API calls)  │        │
│   └──────────────┘  └────────────────┘  └──────────────┘        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (localhost:11434)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OLLAMA (Local Service)                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │ Qwen3-8B    │  │ GLM-Z1-9B   │  │Qwen3-30B-A3B│             │
│   │ (Primary)   │  │ (RLM/Tools) │  │ (Quality)   │             │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HARDWARE                                │
│        RTX 4060 8GB  │  64GB DDR5  │  i7-14700KF                │
└─────────────────────────────────────────────────────────────────┘
```

---

## How RLM Works (Per-Message Flow)

Every message from the user goes through this process:

```
User Message
     │
     ▼
┌────────────────────────────────┐
│  1. COMPLEXITY ANALYSIS        │
│     - Is this a simple query?  │
│     - Does it need context?    │
│     - Is input > threshold?    │
└────────────┬───────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌──────────────────────────────────┐
│ SIMPLE  │    │ COMPLEX (RLM Recursive Mode)     │
│ Direct  │    │                                  │
│ LLM call│    │  1. Decompose into sub-tasks     │
└────┬────┘    │  2. For each sub-task:           │
     │         │     - May use Python REPL        │
     │         │     - May call LLM recursively   │
     │         │     - May read/search context    │
     │         │  3. Synthesize sub-results       │
     │         │  4. Generate final answer        │
     │         └────────────┬─────────────────────┘
     │                      │
     └──────────┬───────────┘
                │
                ▼
         Final Response
```

---

## Memory System (Persistent Context)

The agent has a two-tier memory system for handling long conversations:

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKING MEMORY                           │
│  Last 10 messages (always in LLM context)                   │
│  Fast, no retrieval needed                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Auto-archive when threshold reached
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   LONG-TERM MEMORY                          │
│  All past messages (searchable, persisted to disk)          │
│  Retrieved on-demand based on relevance to current query    │
└─────────────────────────────────────────────────────────────┘
```

**How it works:**
1. Messages 1-10: Kept in working memory (direct context)
2. Message 11+: Oldest messages archived to long-term memory
3. When user asks a question, relevant old memories are retrieved
4. Context = Recent messages + Relevant retrieved memories
5. Memory persists across sessions (saved to `data/memory.json`)

**Effective result:** Unlimited conversation length with coherent memory.

---

## Model Stack

| Role | Model | Ollama Command | VRAM | Speed | Purpose |
|------|-------|----------------|------|-------|---------|
| **Primary** | Qwen3-8B Q4_K_M | `qwen3:8b` | ~5.5GB | 42 tok/s | Fast responses, simple queries |
| **RLM/Tools** | GLM-Z1-9B Q4_K_M | `glm-z1:9b` | ~6GB | 50 tok/s | Tool calling, REPL interaction, decomposition |
| **Quality** | Qwen3-30B-A3B Q4 | `qwen3:30b-a3b` | ~18GB | 15-25 tok/s | Complex reasoning, synthesis (CPU offload) |

**Model Selection Logic**:
- Simple chat → Qwen3-8B (fast)
- RLM decomposition/tool use → GLM-Z1-9B (tool-optimized)
- Final synthesis of complex tasks → Qwen3-30B-A3B (quality)

---

## File Structure

```
LocalLLM/
├── Plan.md                 # THIS FILE - Implementation plan
├── LOCAL_LLM_SETUP.md      # Detailed setup instructions (to create)
│
├── server.py               # Python backend (FastAPI/Flask)
├── index.html              # Web UI (self-contained)
├── start.bat               # Windows launcher
├── stop.bat                # Stop all services
│
├── rlm/                    # RLM Python package
│   ├── __init__.py
│   ├── engine.py           # RLMEngine - core recursive orchestrator
│   ├── complexity.py       # Complexity analyzer (simple vs recursive)
│   ├── decomposer.py       # Task decomposition logic
│   ├── synthesizer.py      # Result synthesis
│   ├── repl.py             # Python REPL sandbox
│   ├── context.py          # Context/document management
│   └── ollama_client.py    # Ollama API wrapper
│
├── config/
│   └── settings.json       # User preferences
│
└── README.md               # Usage guide
```

---

## Chapters for LOCAL_LLM_SETUP.md

The main deliverable `LOCAL_LLM_SETUP.md` should contain these chapters:

### Chapter 1: System Overview
- Hardware specifications
- Architecture diagram (as shown above)
- RLM-first design philosophy
- What "100% local" means
- Link to RLM paper and resources

### Chapter 2: Environment Setup
- Prerequisites checklist
- Ollama installation (Windows)
- Python 3.12+ installation
- GPU driver verification (NVIDIA)
- Directory structure creation
- Required Python packages (FastAPI, uvicorn, RestrictedPython)

### Chapter 3: Model Installation
- `ollama pull qwen3:8b`
- `ollama pull glm-z1:9b`
- `ollama pull qwen3:30b-a3b`
- VRAM verification steps
- Testing commands

### Chapter 4: RLM Core Implementation
**This is the heart of the system.**

Read and understand the Scientific Paper, Understand it Fully, take notes.


Contents:
- `engine.py`: Main RLMEngine class
  - `process_message(user_input, context=None)` → always called
  - Complexity detection
  - Recursive decomposition loop
  - Result synthesis
- `complexity.py`: Analyzes if message needs RLM or direct response
- `decomposer.py`: Breaks complex tasks into sub-tasks
- `synthesizer.py`: Combines sub-results into coherent response
- `repl.py`: Safe Python execution sandbox
- `context.py`: Handles documents, chunking, retrieval
- `ollama_client.py`: Wrapper for Ollama REST API

**Key Implementation Detail**: The RLMEngine must:
1. Maintain a Python REPL session across the conversation
2. Allow the LLM to write and execute Python code
3. Store intermediate results in variables
4. Call itself recursively for sub-problems

### Chapter 5: Python Backend (server.py)
- FastAPI server on localhost:8000
- Endpoints:
  - `POST /chat` → receives message, returns RLM-processed response
  - `GET /models` → list available Ollama models
  - `GET /status` → check Ollama service status
  - `POST /settings` → update RLM settings
- WebSocket support for streaming responses

### Chapter 6: Web UI (index.html)
- Self-contained HTML/CSS/JS (no external dependencies)
- Chat interface with message history
- Model selector (affects which model RLM uses)
- Settings panel:
  - Temperature
  - RLM complexity threshold
  - Enable/disable recursive mode
- Service status indicator
- Dark theme, responsive design

### Chapter 7: System Integration
- `start.bat`: Start Ollama + Python backend + open browser
- `stop.bat`: Gracefully stop all services
- `settings.json` format
- First-run setup

### Chapter 8: Testing & Verification
- Test simple query (should go direct)
- Test complex query (should trigger RLM)
- Test document analysis (chunking + recursive)
- GPU monitoring
- Troubleshooting guide

---

## RLM Prompt Templates

### Complexity Analysis Prompt
```
You are analyzing a user message to determine its complexity.

User message: "{message}"
Context length: {context_length} tokens

Classify as:
- SIMPLE: Can be answered directly in one LLM call
- COMPLEX: Requires decomposition, multiple steps, or processing large context

Output JSON: {"complexity": "SIMPLE" | "COMPLEX", "reason": "..."}
```

### Decomposition Prompt
```
You are breaking down a complex task into sub-tasks.

Task: "{task}"
Available tools:
- python_exec(code): Execute Python code, returns result
- llm_call(prompt): Call LLM with a sub-prompt
- read_context(start, end): Read portion of context

Generate a plan as JSON:
{
  "sub_tasks": [
    {"id": 1, "type": "python_exec|llm_call|read_context", "input": "..."},
    ...
  ],
  "synthesis_strategy": "How to combine results"
}
```

### Synthesis Prompt
```
You are synthesizing results from multiple sub-tasks into a final answer.

Original question: "{question}"
Sub-task results:
{results}

Provide a coherent, complete answer that addresses the original question.
```

---

## Key Design Decisions

1. **RLM is always active**: Not a separate mode. Every message is evaluated by the complexity analyzer.

2. **Python REPL persists**: Variables and state persist across the conversation, allowing iterative data exploration.

3. **Model routing**: Simple → fast model, Complex → tool model + quality model for synthesis.

4. **No external dependencies in Web UI**: All CSS/JS inline in index.html.

5. **Safety**: Python REPL uses RestrictedPython or subprocess isolation.

6. **Streaming**: Responses stream to UI for better UX.

---

## Verification Checklist

After implementation, verify:

- [ ] Ollama starts: `ollama serve`
- [ ] Models respond: `ollama run qwen3:8b "Hello"`
- [ ] Python backend starts: `python server.py`
- [ ] Web UI loads and connects
- [ ] Simple message gets direct response (fast)
- [ ] Complex message triggers RLM decomposition (visible in logs)
- [ ] Document upload + analysis works
- [ ] Python REPL executes code safely
- [ ] GPU shows utilization during inference
- [ ] Conversation history persists in session

---

## Implementation Order

1. **Environment**: Install Ollama, Python, pull models
2. **RLM Core**: Build `rlm/` package with all modules
3. **Backend**: Create `server.py` with FastAPI
4. **Web UI**: Build `index.html`
5. **Integration**: Create `start.bat`, `stop.bat`
6. **Testing**: Verify all components
7. **Documentation**: Complete `LOCAL_LLM_SETUP.md`

---

## Notes for Future AI Agent

1. **Read the RLM paper first**: https://arxiv.org/pdf/2512.24601 - understand the recursive decomposition algorithm.

2. **RLM is not optional**: It's the core of the system. Don't build a simple chat that "can use" RLM. Build RLM that "can shortcut" to direct calls for simple queries.

3. **The Python REPL is essential**: RLM's power comes from the ability to write code to process data. Don't skip this.

4. **Test with long documents**: The whole point is handling inputs beyond context windows. Test with 50K+ token documents.

5. **Model switching matters**: Use the right model for each phase (fast for simple, tool-optimized for REPL, quality for synthesis).

---

*Plan created: 2026-01-27*
*Target: 100% offline local LLM with RLM-first architecture*
