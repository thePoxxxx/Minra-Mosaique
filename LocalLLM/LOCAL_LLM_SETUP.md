# Local LLM System - Complete Setup Guide

> **For Future AI Agents**: This document provides comprehensive instructions to implement a 100% offline local LLM system with RLM (Recursive Language Model) as the fundamental processing layer.

---

## Table of Contents

1. [System Overview](#chapter-1-system-overview)
2. [Environment Setup](#chapter-2-environment-setup)
3. [Model Installation](#chapter-3-model-installation)
4. [RLM Core Implementation](#chapter-4-rlm-core-implementation)
5. [Memory System](#chapter-5-memory-system)
6. [Python Backend](#chapter-6-python-backend)
7. [Web UI Implementation](#chapter-7-web-ui-implementation)
8. [System Integration](#chapter-8-system-integration)
9. [Testing & Verification](#chapter-9-testing--verification)

---

## Chapter 1: System Overview

### 1.1 Purpose

This system provides a **100% offline, local LLM interface** that uses **Recursive Language Models (RLM)** as the fundamental processing layer for ALL interactions. RLM is not an optional feature—it is the core inference engine.

### 1.2 Reference Documentation

**CRITICAL**: Before implementing, read and fully understand the RLM paper.

| Resource | URL |
|----------|-----|
| **arXiv Page** | https://arxiv.org/abs/2512.24601 |
| **PDF Direct** | https://arxiv.org/pdf/2512.24601 |
| **Official GitHub** | https://github.com/alexzhang13/rlm |
| **Author's Blog** | https://alexzhang13.github.io/blog/2025/rlm/ |
| **Community Implementation** | https://github.com/fullstackwebdev/rlm_repl |

**Key Paper Insights**:
- Long prompts should NOT be fed directly into the LLM
- Treat input data as an external environment the LLM can search and interact with
- Use a persistent Python REPL to inspect, transform, and process data
- Allow the LLM to call sub-LLMs recursively for sub-problems
- RLMs handle inputs up to 2 orders of magnitude beyond context windows

### 1.3 Hardware Specifications

| Component | Specification | Notes |
|-----------|---------------|-------|
| **GPU** | NVIDIA RTX 4060 | 8GB VRAM |
| **RAM** | 64GB DDR5 | Sufficient for CPU offloading |
| **CPU** | Intel i7-14700KF | 20 cores, good for CPU layers |
| **OS** | Windows 11 | All commands are Windows-specific |

### 1.4 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│                     Web UI (index.html)                         │
│   - Chat interface with message history                         │
│   - Model selector dropdown                                     │
│   - RLM settings panel                                          │
│   - Service status indicator                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP POST /chat
                           │ WebSocket /ws (streaming)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PYTHON BACKEND (server.py)                         │
│                    localhost:8000                               │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              RLM ENGINE (Always Active)                 │   │
│   │                                                         │   │
│   │   ┌─────────────┐    ┌──────────────┐                  │   │
│   │   │ Complexity  │───►│ Direct Call  │ (simple queries) │   │
│   │   │ Analyzer    │    └──────────────┘                  │   │
│   │   └──────┬──────┘                                      │   │
│   │          │ (complex)                                   │   │
│   │          ▼                                             │   │
│   │   ┌─────────────┐    ┌──────────────┐                  │   │
│   │   │ Decomposer  │───►│ Sub-tasks    │                  │   │
│   │   └─────────────┘    └──────┬───────┘                  │   │
│   │                             │                          │   │
│   │          ┌──────────────────┼──────────────────┐       │   │
│   │          ▼                  ▼                  ▼       │   │
│   │   ┌────────────┐    ┌────────────┐    ┌────────────┐   │   │
│   │   │ LLM Call   │    │Python REPL │    │Context Read│   │   │
│   │   │ (recurse)  │    │ (execute)  │    │ (chunk)    │   │   │
│   │   └────────────┘    └────────────┘    └────────────┘   │   │
│   │          │                  │                  │       │   │
│   │          └──────────────────┼──────────────────┘       │   │
│   │                             ▼                          │   │
│   │                     ┌─────────────┐                    │   │
│   │                     │ Synthesizer │                    │   │
│   │                     └─────────────┘                    │   │
│   └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (localhost:11434)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OLLAMA (Local Service)                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │ Qwen3-8B    │  │ GLM-Z1-9B   │  │Qwen3-30B-A3B│             │
│   │ Q4_K_M      │  │ Q4_K_M      │  │ Q4           │             │
│   │ ~5.5GB VRAM │  │ ~6GB VRAM   │  │ ~18GB (offload)│           │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 What "100% Local" Means

- **No internet required** after initial setup
- **No API keys** or cloud services
- **No telemetry** or data collection
- All inference happens on local GPU/CPU
- All data stays on the local machine

### 1.6 RLM-First Design Philosophy

Every user message is processed through the RLM engine:

1. **Complexity Analysis**: Is this simple or complex?
2. **Simple Path**: Direct LLM call, fast response
3. **Complex Path**: Decompose → Execute sub-tasks → Synthesize
4. **Python REPL**: Available for data processing in complex tasks
5. **Recursive Calls**: LLM can call itself for sub-problems

This is NOT "chat with optional RLM"—it IS "RLM with fast path for simple queries."

---

## Chapter 2: Environment Setup

### 2.1 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Windows 11 (64-bit)
- [ ] NVIDIA GPU with 8GB+ VRAM
- [ ] Administrator access
- [ ] ~50GB free disk space (for models)
- [ ] Internet connection (for downloads only)

### 2.2 NVIDIA Driver Verification

Open PowerShell and verify your GPU:

```powershell
nvidia-smi
```

Expected output should show:
- Driver Version: 550.x or higher
- CUDA Version: 12.x
- GPU: NVIDIA GeForce RTX 4060
- Memory: 8192 MiB

If `nvidia-smi` fails, download drivers from: https://www.nvidia.com/drivers

### 2.3 Ollama Installation

**Option A: Windows Installer (Recommended)**

1. Download from: https://ollama.com/download/windows
2. Run `OllamaSetup.exe`
3. Follow installation wizard
4. Ollama will auto-start as a Windows service

**Option B: Winget**

```powershell
winget install Ollama.Ollama
```

**Verify Installation**:

```powershell
ollama --version
```

Expected: `ollama version 0.5.x` or higher

### 2.4 Python Installation

**Install Python 3.12+**:

```powershell
winget install Python.Python.3.12
```

**Verify Installation**:

```powershell
python --version
pip --version
```

**Create Virtual Environment**:

```powershell
cd C:\Users\Poxxxx\Downloads\Peixoto\Image DeMosaique\LocalLLM
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2.5 Python Dependencies

Create `requirements.txt`:

```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
httpx>=0.26.0
pydantic>=2.5.0
python-multipart>=0.0.6
websockets>=12.0
RestrictedPython>=7.0
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

### 2.6 Directory Structure

Create the project structure:

```powershell
$base = "C:\Users\Poxxxx\Downloads\Peixoto\Image DeMosaique\LocalLLM"

# Create directories
New-Item -ItemType Directory -Force -Path "$base\rlm"
New-Item -ItemType Directory -Force -Path "$base\config"
New-Item -ItemType Directory -Force -Path "$base\logs"
New-Item -ItemType Directory -Force -Path "$base\data"

# Create empty Python files
New-Item -ItemType File -Force -Path "$base\rlm\__init__.py"
New-Item -ItemType File -Force -Path "$base\rlm\engine.py"
New-Item -ItemType File -Force -Path "$base\rlm\complexity.py"
New-Item -ItemType File -Force -Path "$base\rlm\decomposer.py"
New-Item -ItemType File -Force -Path "$base\rlm\synthesizer.py"
New-Item -ItemType File -Force -Path "$base\rlm\repl.py"
New-Item -ItemType File -Force -Path "$base\rlm\context.py"
New-Item -ItemType File -Force -Path "$base\rlm\ollama_client.py"
```

Final structure:

```
LocalLLM/
├── Plan.md
├── LOCAL_LLM_SETUP.md      # This file
├── requirements.txt
├── server.py               # FastAPI backend
├── index.html              # Web UI
├── start.bat
├── stop.bat
├── venv/                   # Python virtual environment
├── rlm/
│   ├── __init__.py
│   ├── engine.py           # RLMEngine class
│   ├── complexity.py       # Complexity analyzer
│   ├── decomposer.py       # Task decomposition
│   ├── synthesizer.py      # Result synthesis
│   ├── repl.py             # Python REPL sandbox
│   ├── context.py          # Context management
│   └── ollama_client.py    # Ollama API client
├── config/
│   └── settings.json
├── logs/
└── data/                   # User documents for analysis
```

### 2.7 Environment Variables

Create `config/settings.json`:

```json
{
  "ollama": {
    "host": "http://localhost:11434",
    "timeout": 120
  },
  "models": {
    "primary": "qwen3:8b",
    "tools": "glm-z1:9b",
    "quality": "qwen3:30b-a3b"
  },
  "rlm": {
    "complexity_threshold": 100,
    "max_recursion_depth": 5,
    "chunk_size": 4000,
    "chunk_overlap": 200
  },
  "server": {
    "host": "127.0.0.1",
    "port": 8000
  },
  "repl": {
    "timeout": 30,
    "max_output_length": 10000
  }
}
```

---

## Chapter 3: Model Installation

### 3.1 Start Ollama Service

Ollama should auto-start, but verify:

```powershell
# Check if running
Get-Process ollama -ErrorAction SilentlyContinue

# If not running, start it
ollama serve
```

### 3.2 Pull Required Models

**Primary Model (Daily Use)**:

```powershell
ollama pull qwen3:8b
```

- Size: ~5GB download, ~5.5GB VRAM
- Speed: ~42 tokens/second on RTX 4060
- Use: General chat, simple coding, quick answers

**Tools Model (RLM Operations)**:

```powershell
ollama pull glm-z1:9b
```

- Size: ~6GB download, ~6GB VRAM
- Speed: ~50 tokens/second
- Use: Tool calling, REPL interaction, decomposition

**Quality Model (Complex Reasoning)**:

```powershell
ollama pull qwen3:30b-a3b
```

- Size: ~18GB download
- VRAM: Requires CPU offloading (won't fit in 8GB)
- Speed: ~15-25 tokens/second with offload
- Use: Final synthesis, complex reasoning

### 3.3 Verify Models

```powershell
ollama list
```

Expected output:

```
NAME                ID              SIZE      MODIFIED
qwen3:8b            abc123...       5.0 GB    Just now
glm-z1:9b           def456...       5.8 GB    Just now
qwen3:30b-a3b       ghi789...       18 GB     Just now
```

### 3.4 Test Each Model

**Test Qwen3-8B**:

```powershell
ollama run qwen3:8b "What is 2+2? Answer in one word."
```

Expected: `Four` (fast response, <2 seconds)

**Test GLM-Z1-9B**:

```powershell
ollama run glm-z1:9b "Write a Python function that adds two numbers."
```

Expected: Python code with function definition

**Test Qwen3-30B-A3B**:

```powershell
ollama run qwen3:30b-a3b "Explain recursion in one paragraph."
```

Expected: Detailed explanation (slower, 5-10 seconds)

### 3.5 VRAM Verification

While a model is running, check GPU memory:

```powershell
nvidia-smi
```

Look for "Memory-Usage" column. For RTX 4060 8GB:
- qwen3:8b: ~5500 MiB
- glm-z1:9b: ~6000 MiB
- qwen3:30b-a3b: ~7500 MiB (rest offloaded to CPU)

### 3.6 Model Configuration (Optional)

Create custom Modelfiles for tuned settings:

```powershell
# Create Modelfile for RLM-optimized settings
@"
FROM qwen3:8b
PARAMETER temperature 0.7
PARAMETER num_ctx 8192
PARAMETER num_gpu 99
"@ | Out-File -FilePath "Modelfile.qwen3-rlm" -Encoding UTF8

ollama create qwen3-rlm -f Modelfile.qwen3-rlm
```

### 3.7 Troubleshooting Model Issues

**Issue: Model download fails**
```powershell
# Clear cache and retry
Remove-Item -Recurse -Force "$env:USERPROFILE\.ollama\models\blobs\*"
ollama pull qwen3:8b
```

**Issue: Out of VRAM**
```powershell
# Check what's using GPU memory
nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv

# Unload models
ollama stop qwen3:8b
```

**Issue: Slow inference**
- Ensure no other apps are using GPU
- Check that model fits in VRAM (not offloading unexpectedly)
- Reduce context length in settings

---

## Chapter 4: RLM Core Implementation

### 4.1 Prerequisites

**IMPORTANT**: Before implementing, you MUST:

1. Read the RLM paper: https://arxiv.org/pdf/2512.24601
2. Understand the recursive decomposition algorithm
3. Study the official implementation: https://github.com/alexzhang13/rlm
4. Take notes on key concepts

**Key Concepts to Understand**:
- Why long prompts shouldn't be fed directly to LLMs
- How the Python REPL enables data exploration
- The decomposition → execution → synthesis loop
- How sub-LLM calls work recursively

### 4.2 Module: ollama_client.py

This module wraps the Ollama REST API.

```python
"""
rlm/ollama_client.py
Ollama API client for local LLM inference.
"""

import httpx
import json
from typing import Generator, Optional, Dict, Any


class OllamaClient:
    """Client for Ollama REST API."""

    def __init__(self, host: str = "http://localhost:11434", timeout: float = 120.0):
        self.host = host.rstrip("/")
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)

    def generate(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        num_ctx: int = 8192,
        stream: bool = False
    ) -> str | Generator[str, None, None]:
        """
        Generate a response from the model.

        Args:
            model: Model name (e.g., 'qwen3:8b')
            prompt: User prompt
            system: System prompt (optional)
            temperature: Sampling temperature
            num_ctx: Context window size
            stream: Whether to stream response

        Returns:
            Complete response string, or generator if streaming
        """
        url = f"{self.host}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx
            }
        }

        if system:
            payload["system"] = system

        if stream:
            return self._stream_generate(url, payload)
        else:
            response = self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json()["response"]

    def _stream_generate(self, url: str, payload: dict) -> Generator[str, None, None]:
        """Stream response tokens."""
        with self.client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]
                    if data.get("done", False):
                        break

    def chat(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        num_ctx: int = 8192,
        stream: bool = False
    ) -> str | Generator[str, None, None]:
        """
        Chat completion with message history.

        Args:
            model: Model name
            messages: List of {"role": "user"|"assistant"|"system", "content": "..."}
            temperature: Sampling temperature
            num_ctx: Context window size
            stream: Whether to stream response

        Returns:
            Assistant response string, or generator if streaming
        """
        url = f"{self.host}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx
            }
        }

        if stream:
            return self._stream_chat(url, payload)
        else:
            response = self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json()["message"]["content"]

    def _stream_chat(self, url: str, payload: dict) -> Generator[str, None, None]:
        """Stream chat response tokens."""
        with self.client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if "message" in data and "content" in data["message"]:
                        yield data["message"]["content"]
                    if data.get("done", False):
                        break

    def list_models(self) -> list[dict]:
        """List available models."""
        response = self.client.get(f"{self.host}/api/tags")
        response.raise_for_status()
        return response.json().get("models", [])

    def is_available(self) -> bool:
        """Check if Ollama service is running."""
        try:
            response = self.client.get(f"{self.host}/api/tags")
            return response.status_code == 200
        except Exception:
            return False

    def close(self):
        """Close the HTTP client."""
        self.client.close()
```

### 4.3 Module: repl.py

Secure Python REPL sandbox for code execution.

```python
"""
rlm/repl.py
Secure Python REPL sandbox for RLM code execution.
"""

import sys
import io
import traceback
from typing import Any, Dict, Optional
from contextlib import redirect_stdout, redirect_stderr
import ast

# Optional: Use RestrictedPython for extra security
try:
    from RestrictedPython import compile_restricted, safe_globals
    from RestrictedPython.Eval import default_guarded_getiter
    from RestrictedPython.Guards import guarded_iter_unpack_sequence
    HAS_RESTRICTED = True
except ImportError:
    HAS_RESTRICTED = False


class PythonREPL:
    """
    Persistent Python REPL environment for RLM.

    Variables persist across executions within a session.
    Provides safe execution with output capture.
    """

    # Dangerous builtins to remove
    BLOCKED_BUILTINS = {
        'exec', 'eval', 'compile', '__import__',
        'open', 'input', 'breakpoint'
    }

    # Allowed modules for import
    ALLOWED_MODULES = {
        'math', 'statistics', 'random', 'datetime', 'json',
        're', 'collections', 'itertools', 'functools',
        'string', 'textwrap', 'difflib'
    }

    def __init__(self, timeout: float = 30.0, max_output: int = 10000):
        self.timeout = timeout
        self.max_output = max_output
        self.namespace: Dict[str, Any] = {}
        self._setup_namespace()

    def _setup_namespace(self):
        """Initialize the REPL namespace with safe builtins."""
        safe_builtins = {
            k: v for k, v in __builtins__.items()
            if k not in self.BLOCKED_BUILTINS
        } if isinstance(__builtins__, dict) else {
            k: getattr(__builtins__, k) for k in dir(__builtins__)
            if not k.startswith('_') and k not in self.BLOCKED_BUILTINS
        }

        # Add safe import function
        def safe_import(name, *args, **kwargs):
            if name not in self.ALLOWED_MODULES:
                raise ImportError(f"Module '{name}' is not allowed. Allowed: {self.ALLOWED_MODULES}")
            return __import__(name, *args, **kwargs)

        safe_builtins['__import__'] = safe_import

        self.namespace = {
            '__builtins__': safe_builtins,
            '__name__': '__rlm_repl__',
            'print': self._safe_print,
        }

        # Pre-import common modules
        for mod in ['math', 'json', 're', 'datetime']:
            try:
                self.namespace[mod] = __import__(mod)
            except ImportError:
                pass

    def _safe_print(self, *args, **kwargs):
        """Print function that respects output limits."""
        output = io.StringIO()
        kwargs['file'] = output
        print(*args, **kwargs)
        return output.getvalue()

    def execute(self, code: str) -> Dict[str, Any]:
        """
        Execute Python code in the sandbox.

        Args:
            code: Python code to execute

        Returns:
            Dict with keys:
                - success: bool
                - output: captured stdout
                - error: error message if failed
                - result: last expression value (if any)
                - variables: dict of new/modified variables
        """
        result = {
            "success": False,
            "output": "",
            "error": None,
            "result": None,
            "variables": {}
        }

        # Validate code syntax
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            result["error"] = f"SyntaxError: {e}"
            return result

        # Check for dangerous operations
        danger_check = self._check_dangerous(tree)
        if danger_check:
            result["error"] = f"Blocked: {danger_check}"
            return result

        # Capture output
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        # Track variables before execution
        vars_before = set(self.namespace.keys())

        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # If last statement is an expression, capture its value
                if tree.body and isinstance(tree.body[-1], ast.Expr):
                    # Execute all but last statement
                    if len(tree.body) > 1:
                        module = ast.Module(body=tree.body[:-1], type_ignores=[])
                        exec(compile(module, '<rlm>', 'exec'), self.namespace)

                    # Evaluate last expression
                    last_expr = ast.Expression(body=tree.body[-1].value)
                    result["result"] = eval(
                        compile(last_expr, '<rlm>', 'eval'),
                        self.namespace
                    )
                else:
                    exec(compile(tree, '<rlm>', 'exec'), self.namespace)

            result["success"] = True
            result["output"] = stdout_capture.getvalue()[:self.max_output]

            # Track new/modified variables
            vars_after = set(self.namespace.keys())
            new_vars = vars_after - vars_before - {'__builtins__', '__name__'}
            result["variables"] = {
                k: self._safe_repr(self.namespace[k])
                for k in new_vars
            }

        except Exception as e:
            result["error"] = f"{type(e).__name__}: {e}"
            result["output"] = stdout_capture.getvalue()[:self.max_output]

        return result

    def _check_dangerous(self, tree: ast.AST) -> Optional[str]:
        """Check for dangerous operations in AST."""
        for node in ast.walk(tree):
            # Block file operations
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in ('open', 'exec', 'eval', 'compile'):
                        return f"Function '{node.func.id}' is not allowed"
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in ('system', 'popen', 'spawn'):
                        return f"Method '{node.func.attr}' is not allowed"

            # Block dangerous imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split('.')[0] not in self.ALLOWED_MODULES:
                        return f"Import '{alias.name}' is not allowed"

            if isinstance(node, ast.ImportFrom):
                if node.module and node.module.split('.')[0] not in self.ALLOWED_MODULES:
                    return f"Import from '{node.module}' is not allowed"

        return None

    def _safe_repr(self, obj: Any, max_len: int = 200) -> str:
        """Safe string representation of object."""
        try:
            r = repr(obj)
            if len(r) > max_len:
                return r[:max_len] + "..."
            return r
        except Exception:
            return f"<{type(obj).__name__}>"

    def get_variable(self, name: str) -> Any:
        """Get a variable from the namespace."""
        return self.namespace.get(name)

    def set_variable(self, name: str, value: Any):
        """Set a variable in the namespace."""
        self.namespace[name] = value

    def list_variables(self) -> Dict[str, str]:
        """List all user variables with their repr."""
        excluded = {'__builtins__', '__name__', 'print', 'math', 'json', 're', 'datetime'}
        return {
            k: self._safe_repr(v)
            for k, v in self.namespace.items()
            if k not in excluded and not k.startswith('_')
        }

    def reset(self):
        """Reset the REPL to initial state."""
        self._setup_namespace()
```

### 4.4 Module: context.py

Context and document management with chunking.

```python
"""
rlm/context.py
Context management for RLM - handles documents, chunking, and retrieval.
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import re


@dataclass
class Chunk:
    """A chunk of text with metadata."""
    id: int
    content: str
    start_char: int
    end_char: int
    metadata: Dict = field(default_factory=dict)


@dataclass
class Document:
    """A document that can be chunked and searched."""
    id: str
    content: str
    chunks: List[Chunk] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)


class ContextManager:
    """
    Manages context/documents for RLM processing.

    Provides:
    - Document storage
    - Chunking with overlap
    - Chunk retrieval by index or search
    - Token counting estimation
    """

    # Rough estimate: 1 token ≈ 4 characters for English
    CHARS_PER_TOKEN = 4

    def __init__(
        self,
        chunk_size: int = 4000,
        chunk_overlap: int = 200,
        max_chunks_per_query: int = 5
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.max_chunks_per_query = max_chunks_per_query
        self.documents: Dict[str, Document] = {}

    def add_document(self, doc_id: str, content: str, metadata: Optional[Dict] = None) -> Document:
        """
        Add a document and chunk it.

        Args:
            doc_id: Unique identifier for the document
            content: Full text content
            metadata: Optional metadata dict

        Returns:
            Document object with chunks
        """
        doc = Document(
            id=doc_id,
            content=content,
            metadata=metadata or {}
        )

        # Chunk the content
        doc.chunks = self._chunk_text(content)

        self.documents[doc_id] = doc
        return doc

    def _chunk_text(self, text: str) -> List[Chunk]:
        """
        Split text into overlapping chunks.

        Tries to split on paragraph/sentence boundaries when possible.
        """
        chunks = []
        start = 0
        chunk_id = 0

        while start < len(text):
            end = start + self.chunk_size

            # If not at the end, try to find a good break point
            if end < len(text):
                # Look for paragraph break
                para_break = text.rfind('\n\n', start + self.chunk_size // 2, end)
                if para_break != -1:
                    end = para_break + 2
                else:
                    # Look for sentence break
                    sentence_break = text.rfind('. ', start + self.chunk_size // 2, end)
                    if sentence_break != -1:
                        end = sentence_break + 2

            chunk_content = text[start:end].strip()

            if chunk_content:
                chunks.append(Chunk(
                    id=chunk_id,
                    content=chunk_content,
                    start_char=start,
                    end_char=end
                ))
                chunk_id += 1

            # Move start with overlap
            start = end - self.chunk_overlap
            if start <= chunks[-1].start_char if chunks else 0:
                start = end  # Prevent infinite loop

        return chunks

    def get_chunk(self, doc_id: str, chunk_id: int) -> Optional[Chunk]:
        """Get a specific chunk by document and chunk ID."""
        doc = self.documents.get(doc_id)
        if doc and 0 <= chunk_id < len(doc.chunks):
            return doc.chunks[chunk_id]
        return None

    def get_chunks_range(self, doc_id: str, start: int, end: int) -> List[Chunk]:
        """Get a range of chunks."""
        doc = self.documents.get(doc_id)
        if doc:
            return doc.chunks[start:end]
        return []

    def search_chunks(self, doc_id: str, query: str, top_k: int = 5) -> List[Tuple[Chunk, float]]:
        """
        Simple keyword search in chunks.

        Returns chunks with relevance scores.
        For production, replace with embedding-based search.
        """
        doc = self.documents.get(doc_id)
        if not doc:
            return []

        query_terms = set(query.lower().split())
        results = []

        for chunk in doc.chunks:
            chunk_lower = chunk.content.lower()
            # Simple term frequency scoring
            score = sum(1 for term in query_terms if term in chunk_lower)
            if score > 0:
                results.append((chunk, score))

        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        return len(text) // self.CHARS_PER_TOKEN

    def get_document_info(self, doc_id: str) -> Optional[Dict]:
        """Get document metadata and stats."""
        doc = self.documents.get(doc_id)
        if not doc:
            return None

        return {
            "id": doc.id,
            "total_chars": len(doc.content),
            "estimated_tokens": self.estimate_tokens(doc.content),
            "num_chunks": len(doc.chunks),
            "metadata": doc.metadata
        }

    def list_documents(self) -> List[Dict]:
        """List all documents with basic info."""
        return [
            self.get_document_info(doc_id)
            for doc_id in self.documents
        ]

    def remove_document(self, doc_id: str) -> bool:
        """Remove a document."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            return True
        return False

    def clear(self):
        """Clear all documents."""
        self.documents.clear()
```

### 4.5 Module: complexity.py

Analyzes whether a query needs RLM or can be handled directly.

```python
"""
rlm/complexity.py
Complexity analyzer - determines if a query needs RLM processing.
"""

from typing import Dict, Optional
from dataclasses import dataclass
from enum import Enum


class Complexity(Enum):
    SIMPLE = "simple"      # Direct LLM call
    MODERATE = "moderate"  # May benefit from RLM
    COMPLEX = "complex"    # Requires full RLM


@dataclass
class ComplexityResult:
    level: Complexity
    reason: str
    estimated_steps: int
    suggested_model: str


class ComplexityAnalyzer:
    """
    Analyzes query complexity to determine processing path.

    Factors considered:
    - Query length
    - Context size
    - Keywords indicating complexity
    - Question structure
    """

    # Keywords suggesting complex tasks
    COMPLEX_KEYWORDS = {
        'analyze', 'compare', 'summarize', 'explain in detail',
        'step by step', 'break down', 'evaluate', 'comprehensive',
        'all', 'every', 'entire', 'complete', 'thorough'
    }

    # Keywords suggesting simple tasks
    SIMPLE_KEYWORDS = {
        'what is', 'define', 'who is', 'when', 'where',
        'yes or no', 'true or false', 'quick', 'brief'
    }

    def __init__(
        self,
        simple_threshold: int = 100,  # chars
        complex_threshold: int = 500,  # chars
        context_threshold: int = 8000  # chars
    ):
        self.simple_threshold = simple_threshold
        self.complex_threshold = complex_threshold
        self.context_threshold = context_threshold

    def analyze(
        self,
        query: str,
        context: Optional[str] = None,
        context_tokens: int = 0
    ) -> ComplexityResult:
        """
        Analyze complexity of a query.

        Args:
            query: User's query text
            context: Optional context/document text
            context_tokens: Estimated token count of context

        Returns:
            ComplexityResult with classification and reasoning
        """
        query_lower = query.lower()
        query_len = len(query)
        context_len = len(context) if context else 0

        reasons = []
        score = 0  # Higher = more complex

        # Check query length
        if query_len < self.simple_threshold:
            score -= 1
            reasons.append("short query")
        elif query_len > self.complex_threshold:
            score += 1
            reasons.append("long query")

        # Check context size
        if context_len > self.context_threshold:
            score += 2
            reasons.append(f"large context ({context_tokens} tokens)")

        # Check for complex keywords
        complex_matches = [kw for kw in self.COMPLEX_KEYWORDS if kw in query_lower]
        if complex_matches:
            score += len(complex_matches)
            reasons.append(f"complex keywords: {complex_matches[:3]}")

        # Check for simple keywords
        simple_matches = [kw for kw in self.SIMPLE_KEYWORDS if kw in query_lower]
        if simple_matches:
            score -= len(simple_matches)
            reasons.append(f"simple keywords: {simple_matches[:3]}")

        # Check for multiple questions
        question_count = query.count('?')
        if question_count > 1:
            score += question_count
            reasons.append(f"{question_count} questions")

        # Check for code-related tasks
        if any(kw in query_lower for kw in ['code', 'function', 'implement', 'debug', 'fix']):
            if 'simple' not in query_lower:
                score += 1
                reasons.append("code task")

        # Determine complexity level
        if score <= 0:
            level = Complexity.SIMPLE
            model = "qwen3:8b"
            steps = 1
        elif score <= 2:
            level = Complexity.MODERATE
            model = "qwen3:8b"
            steps = 2
        else:
            level = Complexity.COMPLEX
            model = "glm-z1:9b"  # Tool model for decomposition
            steps = max(3, min(score, 10))

        return ComplexityResult(
            level=level,
            reason="; ".join(reasons) if reasons else "default classification",
            estimated_steps=steps,
            suggested_model=model
        )

    def should_use_rlm(self, result: ComplexityResult) -> bool:
        """Determine if RLM should be used based on complexity."""
        return result.level in (Complexity.MODERATE, Complexity.COMPLEX)
```

### 4.6 Module: decomposer.py

Breaks complex tasks into sub-tasks.

```python
"""
rlm/decomposer.py
Task decomposition for RLM - breaks complex tasks into sub-tasks.
"""

from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import json
import re

from .ollama_client import OllamaClient


class TaskType(Enum):
    LLM_CALL = "llm_call"           # Call LLM with sub-prompt
    PYTHON_EXEC = "python_exec"     # Execute Python code
    CONTEXT_READ = "context_read"   # Read chunk of context
    CONTEXT_SEARCH = "context_search"  # Search context


@dataclass
class SubTask:
    """A single sub-task in the decomposition."""
    id: int
    task_type: TaskType
    description: str
    input_data: Any
    depends_on: List[int] = field(default_factory=list)
    result: Optional[Any] = None
    completed: bool = False


@dataclass
class DecompositionPlan:
    """Complete plan for handling a complex query."""
    original_query: str
    sub_tasks: List[SubTask]
    synthesis_strategy: str
    estimated_calls: int


class Decomposer:
    """
    Decomposes complex queries into sub-tasks.

    Uses an LLM to analyze the query and generate a plan.
    """

    DECOMPOSITION_PROMPT = '''You are an expert at breaking down complex tasks into smaller sub-tasks.

Given a user query, analyze it and create a plan of sub-tasks.

Available sub-task types:
1. llm_call: Ask the LLM a focused sub-question
2. python_exec: Write Python code to process/analyze data
3. context_read: Read a specific portion of the provided context
4. context_search: Search the context for relevant information

User Query: {query}

Context Available: {has_context}
Context Size: {context_size} tokens

Generate a JSON plan with this structure:
{{
  "analysis": "Brief analysis of why this is complex",
  "sub_tasks": [
    {{
      "id": 1,
      "type": "llm_call|python_exec|context_read|context_search",
      "description": "What this sub-task accomplishes",
      "input": "The specific prompt/code/search query",
      "depends_on": []
    }}
  ],
  "synthesis": "How to combine sub-task results into final answer"
}}

Rules:
- Keep sub-tasks focused and independent when possible
- Use python_exec for calculations, data processing, or analysis
- Use context_read/search when specific parts of context are needed
- Order sub-tasks logically with dependencies
- Aim for 3-7 sub-tasks for most queries

Respond ONLY with valid JSON.'''

    def __init__(self, ollama_client: OllamaClient, model: str = "glm-z1:9b"):
        self.client = ollama_client
        self.model = model

    def decompose(
        self,
        query: str,
        context_tokens: int = 0
    ) -> DecompositionPlan:
        """
        Decompose a query into sub-tasks.

        Args:
            query: The complex query to decompose
            context_tokens: Size of available context

        Returns:
            DecompositionPlan with sub-tasks
        """
        prompt = self.DECOMPOSITION_PROMPT.format(
            query=query,
            has_context="Yes" if context_tokens > 0 else "No",
            context_size=context_tokens
        )

        response = self.client.generate(
            model=self.model,
            prompt=prompt,
            temperature=0.3  # Lower temp for structured output
        )

        # Parse JSON response
        plan_data = self._parse_json_response(response)

        # Convert to SubTask objects
        sub_tasks = []
        for task_data in plan_data.get("sub_tasks", []):
            task_type = TaskType(task_data.get("type", "llm_call"))
            sub_tasks.append(SubTask(
                id=task_data.get("id", len(sub_tasks) + 1),
                task_type=task_type,
                description=task_data.get("description", ""),
                input_data=task_data.get("input", ""),
                depends_on=task_data.get("depends_on", [])
            ))

        # Ensure at least one sub-task
        if not sub_tasks:
            sub_tasks.append(SubTask(
                id=1,
                task_type=TaskType.LLM_CALL,
                description="Answer the query directly",
                input_data=query
            ))

        return DecompositionPlan(
            original_query=query,
            sub_tasks=sub_tasks,
            synthesis_strategy=plan_data.get("synthesis", "Combine all results"),
            estimated_calls=len(sub_tasks) + 1  # +1 for synthesis
        )

    def _parse_json_response(self, response: str) -> Dict:
        """Extract JSON from LLM response."""
        # Try to find JSON block
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Fallback: return empty plan
        return {"sub_tasks": [], "synthesis": "Direct answer"}

    def create_simple_plan(self, query: str) -> DecompositionPlan:
        """Create a minimal plan for simple queries (bypass decomposition)."""
        return DecompositionPlan(
            original_query=query,
            sub_tasks=[
                SubTask(
                    id=1,
                    task_type=TaskType.LLM_CALL,
                    description="Direct answer",
                    input_data=query
                )
            ],
            synthesis_strategy="Return directly",
            estimated_calls=1
        )
```

### 4.7 Module: synthesizer.py

Combines sub-task results into coherent response.

```python
"""
rlm/synthesizer.py
Result synthesis for RLM - combines sub-task results into final response.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .ollama_client import OllamaClient
from .decomposer import SubTask, DecompositionPlan


@dataclass
class SynthesisResult:
    """Result of synthesis."""
    response: str
    sources_used: List[int]  # Sub-task IDs that contributed
    confidence: float


class Synthesizer:
    """
    Synthesizes sub-task results into a coherent final response.
    """

    SYNTHESIS_PROMPT = '''You are synthesizing results from multiple sub-tasks into a coherent answer.

Original Question: {query}

Sub-task Results:
{results}

Synthesis Strategy: {strategy}

Instructions:
1. Review all sub-task results
2. Identify key information from each
3. Combine into a coherent, complete answer
4. Ensure the answer directly addresses the original question
5. If sub-tasks conflict, note the discrepancy
6. Be concise but thorough

Provide your synthesized answer:'''

    def __init__(
        self,
        ollama_client: OllamaClient,
        model: str = "qwen3:30b-a3b"  # Quality model for synthesis
    ):
        self.client = ollama_client
        self.model = model

    def synthesize(
        self,
        plan: DecompositionPlan,
        sub_task_results: Dict[int, Any]
    ) -> SynthesisResult:
        """
        Synthesize sub-task results into final response.

        Args:
            plan: The original decomposition plan
            sub_task_results: Dict mapping sub-task ID to result

        Returns:
            SynthesisResult with final response
        """
        # Format results for prompt
        results_text = self._format_results(plan.sub_tasks, sub_task_results)

        # If only one result and it's an LLM call, might not need synthesis
        if len(sub_task_results) == 1 and plan.synthesis_strategy == "Return directly":
            result = list(sub_task_results.values())[0]
            if isinstance(result, str):
                return SynthesisResult(
                    response=result,
                    sources_used=list(sub_task_results.keys()),
                    confidence=1.0
                )

        # Full synthesis
        prompt = self.SYNTHESIS_PROMPT.format(
            query=plan.original_query,
            results=results_text,
            strategy=plan.synthesis_strategy
        )

        response = self.client.generate(
            model=self.model,
            prompt=prompt,
            temperature=0.5
        )

        return SynthesisResult(
            response=response,
            sources_used=list(sub_task_results.keys()),
            confidence=self._estimate_confidence(sub_task_results)
        )

    def _format_results(
        self,
        sub_tasks: List[SubTask],
        results: Dict[int, Any]
    ) -> str:
        """Format sub-task results for the synthesis prompt."""
        formatted = []

        for task in sub_tasks:
            result = results.get(task.id, "[No result]")

            # Truncate very long results
            result_str = str(result)
            if len(result_str) > 2000:
                result_str = result_str[:2000] + "... [truncated]"

            formatted.append(
                f"Sub-task {task.id}: {task.description}\n"
                f"Type: {task.task_type.value}\n"
                f"Result: {result_str}\n"
            )

        return "\n---\n".join(formatted)

    def _estimate_confidence(self, results: Dict[int, Any]) -> float:
        """Estimate confidence based on result quality."""
        if not results:
            return 0.0

        # Simple heuristic: more completed results = higher confidence
        non_empty = sum(1 for r in results.values() if r)
        return non_empty / len(results)

    def quick_combine(self, results: List[str]) -> str:
        """Quick combination without LLM call (for simple cases)."""
        if len(results) == 1:
            return results[0]

        return "\n\n".join(f"**Part {i+1}:**\n{r}" for i, r in enumerate(results))
```

### 4.8 Module: engine.py

The main RLM engine that orchestrates everything.

```python
"""
rlm/engine.py
Main RLM Engine - orchestrates all RLM components.

This is the heart of the system. Every user message flows through here.
"""

from typing import Dict, Any, Optional, Generator, List
from dataclasses import dataclass, field
import logging
import json

from .ollama_client import OllamaClient
from .complexity import ComplexityAnalyzer, Complexity, ComplexityResult
from .decomposer import Decomposer, DecompositionPlan, SubTask, TaskType
from .synthesizer import Synthesizer
from .repl import PythonREPL
from .context import ContextManager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class RLMConfig:
    """Configuration for RLM Engine."""
    ollama_host: str = "http://localhost:11434"
    primary_model: str = "qwen3:8b"
    tools_model: str = "glm-z1:9b"
    quality_model: str = "qwen3:30b-a3b"
    max_recursion_depth: int = 5
    temperature: float = 0.7
    num_ctx: int = 8192


@dataclass
class RLMResponse:
    """Response from RLM processing."""
    content: str
    complexity: str
    steps_taken: int
    model_used: str
    repl_outputs: List[Dict] = field(default_factory=list)
    debug_info: Dict = field(default_factory=dict)


class RLMEngine:
    """
    Recursive Language Model Engine.

    Processes ALL user messages through complexity analysis,
    decomposition, execution, and synthesis.

    This is the core of the system - not an optional feature.
    """

    def __init__(self, config: Optional[RLMConfig] = None):
        self.config = config or RLMConfig()

        # Initialize components
        self.client = OllamaClient(
            host=self.config.ollama_host,
            timeout=120.0
        )
        self.complexity_analyzer = ComplexityAnalyzer()
        self.decomposer = Decomposer(self.client, self.config.tools_model)
        self.synthesizer = Synthesizer(self.client, self.config.quality_model)
        self.repl = PythonREPL()
        self.context_manager = ContextManager()

        # Session state
        self.conversation_history: List[Dict[str, str]] = []
        self.current_recursion_depth = 0

    def process_message(
        self,
        user_message: str,
        context: Optional[str] = None,
        stream: bool = False
    ) -> RLMResponse | Generator[str, None, RLMResponse]:
        """
        Process a user message through the RLM pipeline.

        This is the main entry point - ALL messages go through here.

        Args:
            user_message: The user's input
            context: Optional document/context to analyze
            stream: Whether to stream the response

        Returns:
            RLMResponse with the final answer and metadata
        """
        logger.info(f"Processing message: {user_message[:100]}...")

        # Add context to manager if provided
        context_tokens = 0
        if context:
            doc = self.context_manager.add_document("current", context)
            context_tokens = self.context_manager.estimate_tokens(context)
            logger.info(f"Added context: {context_tokens} estimated tokens")

        # Step 1: Analyze complexity
        complexity_result = self.complexity_analyzer.analyze(
            user_message,
            context=context,
            context_tokens=context_tokens
        )
        logger.info(f"Complexity: {complexity_result.level.value} - {complexity_result.reason}")

        # Step 2: Route based on complexity
        if complexity_result.level == Complexity.SIMPLE:
            return self._handle_simple(user_message, complexity_result, stream)
        else:
            return self._handle_complex(user_message, complexity_result, context_tokens, stream)

    def _handle_simple(
        self,
        message: str,
        complexity: ComplexityResult,
        stream: bool
    ) -> RLMResponse | Generator[str, None, RLMResponse]:
        """Handle simple queries with direct LLM call."""
        logger.info("Using simple path (direct LLM call)")

        # Build messages with history
        messages = self.conversation_history.copy()
        messages.append({"role": "user", "content": message})

        if stream:
            return self._stream_simple(messages, complexity)

        response = self.client.chat(
            model=self.config.primary_model,
            messages=messages,
            temperature=self.config.temperature,
            num_ctx=self.config.num_ctx
        )

        # Update history
        self.conversation_history.append({"role": "user", "content": message})
        self.conversation_history.append({"role": "assistant", "content": response})

        return RLMResponse(
            content=response,
            complexity=complexity.level.value,
            steps_taken=1,
            model_used=self.config.primary_model
        )

    def _stream_simple(
        self,
        messages: List[Dict],
        complexity: ComplexityResult
    ) -> Generator[str, None, RLMResponse]:
        """Stream simple response."""
        full_response = ""

        for token in self.client.chat(
            model=self.config.primary_model,
            messages=messages,
            temperature=self.config.temperature,
            stream=True
        ):
            full_response += token
            yield token

        # Update history after streaming
        self.conversation_history.append(messages[-1])  # User message
        self.conversation_history.append({"role": "assistant", "content": full_response})

        return RLMResponse(
            content=full_response,
            complexity=complexity.level.value,
            steps_taken=1,
            model_used=self.config.primary_model
        )

    def _handle_complex(
        self,
        message: str,
        complexity: ComplexityResult,
        context_tokens: int,
        stream: bool
    ) -> RLMResponse | Generator[str, None, RLMResponse]:
        """Handle complex queries with full RLM pipeline."""
        logger.info("Using RLM path (decompose → execute → synthesize)")

        # Step 1: Decompose into sub-tasks
        plan = self.decomposer.decompose(message, context_tokens)
        logger.info(f"Decomposed into {len(plan.sub_tasks)} sub-tasks")

        # Step 2: Execute sub-tasks
        results = {}
        repl_outputs = []

        for task in plan.sub_tasks:
            # Check dependencies
            deps_met = all(
                dep_id in results
                for dep_id in task.depends_on
            )

            if not deps_met:
                logger.warning(f"Skipping task {task.id}: dependencies not met")
                continue

            logger.info(f"Executing task {task.id}: {task.task_type.value}")

            # Execute based on type
            if task.task_type == TaskType.LLM_CALL:
                results[task.id] = self._execute_llm_call(task, results)

            elif task.task_type == TaskType.PYTHON_EXEC:
                exec_result = self._execute_python(task)
                results[task.id] = exec_result
                repl_outputs.append({
                    "task_id": task.id,
                    "code": task.input_data,
                    "result": exec_result
                })

            elif task.task_type == TaskType.CONTEXT_READ:
                results[task.id] = self._execute_context_read(task)

            elif task.task_type == TaskType.CONTEXT_SEARCH:
                results[task.id] = self._execute_context_search(task)

        # Step 3: Synthesize results
        synthesis = self.synthesizer.synthesize(plan, results)

        # Update history
        self.conversation_history.append({"role": "user", "content": message})
        self.conversation_history.append({"role": "assistant", "content": synthesis.response})

        return RLMResponse(
            content=synthesis.response,
            complexity=complexity.level.value,
            steps_taken=len(plan.sub_tasks) + 1,
            model_used=f"{self.config.tools_model} + {self.config.quality_model}",
            repl_outputs=repl_outputs,
            debug_info={
                "plan": {
                    "sub_tasks": [
                        {"id": t.id, "type": t.task_type.value, "desc": t.description}
                        for t in plan.sub_tasks
                    ],
                    "synthesis_strategy": plan.synthesis_strategy
                },
                "results": {str(k): str(v)[:200] for k, v in results.items()}
            }
        )

    def _execute_llm_call(self, task: SubTask, previous_results: Dict) -> str:
        """Execute an LLM sub-call."""
        # Inject previous results into prompt if needed
        prompt = task.input_data
        for dep_id in task.depends_on:
            if dep_id in previous_results:
                prompt = f"Previous result ({dep_id}): {previous_results[dep_id]}\n\n{prompt}"

        return self.client.generate(
            model=self.config.tools_model,
            prompt=prompt,
            temperature=self.config.temperature
        )

    def _execute_python(self, task: SubTask) -> Dict:
        """Execute Python code in REPL."""
        return self.repl.execute(task.input_data)

    def _execute_context_read(self, task: SubTask) -> str:
        """Read from context."""
        # Parse chunk range from input (e.g., "0-3" or "5")
        input_str = str(task.input_data)

        if "-" in input_str:
            start, end = map(int, input_str.split("-"))
        else:
            start = int(input_str)
            end = start + 1

        chunks = self.context_manager.get_chunks_range("current", start, end)
        return "\n\n".join(c.content for c in chunks)

    def _execute_context_search(self, task: SubTask) -> str:
        """Search context."""
        results = self.context_manager.search_chunks(
            "current",
            str(task.input_data)
        )

        if not results:
            return "No relevant sections found."

        return "\n\n---\n\n".join(
            f"[Chunk {chunk.id}, relevance {score}]\n{chunk.content}"
            for chunk, score in results
        )

    def add_document(self, doc_id: str, content: str) -> Dict:
        """Add a document for analysis."""
        doc = self.context_manager.add_document(doc_id, content)
        return self.context_manager.get_document_info(doc_id)

    def get_repl_variables(self) -> Dict[str, str]:
        """Get current REPL variables."""
        return self.repl.list_variables()

    def reset_session(self):
        """Reset conversation and REPL state."""
        self.conversation_history.clear()
        self.repl.reset()
        self.context_manager.clear()
        logger.info("Session reset")

    def is_available(self) -> bool:
        """Check if Ollama is available."""
        return self.client.is_available()

    def get_status(self) -> Dict:
        """Get engine status."""
        return {
            "ollama_available": self.is_available(),
            "conversation_length": len(self.conversation_history),
            "documents_loaded": len(self.context_manager.documents),
            "repl_variables": len(self.repl.list_variables()),
            "config": {
                "primary_model": self.config.primary_model,
                "tools_model": self.config.tools_model,
                "quality_model": self.config.quality_model
            }
        }
```

### 4.9 Module: __init__.py

Package initialization and exports.

```python
"""
rlm - Recursive Language Model Engine

A local implementation of RLM for offline LLM processing.
Based on: https://arxiv.org/abs/2512.24601
"""

from .engine import RLMEngine, RLMConfig, RLMResponse
from .ollama_client import OllamaClient
from .repl import PythonREPL
from .context import ContextManager
from .complexity import ComplexityAnalyzer, Complexity
from .decomposer import Decomposer, TaskType
from .synthesizer import Synthesizer

__version__ = "0.1.0"
__all__ = [
    "RLMEngine",
    "RLMConfig",
    "RLMResponse",
    "OllamaClient",
    "PythonREPL",
    "ContextManager",
    "ComplexityAnalyzer",
    "Complexity",
    "Decomposer",
    "TaskType",
    "Synthesizer",
]
```

---

## Chapter 5: Memory System

### 5.1 Overview

The Memory System provides the agent with **persistent, searchable memory** that extends beyond the LLM's context window. This is critical for long conversations and multi-session continuity.

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │            WORKING MEMORY (Hot)                     │   │
│   │                                                     │   │
│   │  • Last N messages (configurable, default 10)       │   │
│   │  • Always included in LLM context                   │   │
│   │  • Fast, no retrieval needed                        │   │
│   │  • ~2000-4000 tokens                                │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│          Automatic archival when threshold reached          │
│                          │                                  │
│                          ▼                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           LONG-TERM MEMORY (Cold)                   │   │
│   │                                                     │   │
│   │  • All archived messages                            │   │
│   │  • Searchable by content/keywords                   │   │
│   │  • Retrieved on demand based on relevance           │   │
│   │  • Persisted to disk (survives restarts)            │   │
│   │  • Unlimited size                                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Module: memory.py

```python
"""
rlm/memory.py
Memory system for RLM - provides working and long-term memory.

This gives the agent persistent, searchable memory across conversations.
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field, asdict
from pathlib import Path
import re


@dataclass
class MemoryEntry:
    """A single memory entry (message or event)."""
    id: int
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: str
    metadata: Dict = field(default_factory=dict)

    # For search scoring
    keywords: List[str] = field(default_factory=list)

    def to_message(self) -> Dict[str, str]:
        """Convert to LLM message format."""
        return {"role": self.role, "content": self.content}


@dataclass
class MemorySearchResult:
    """Result from memory search."""
    entry: MemoryEntry
    relevance_score: float
    match_reason: str


class MemoryManager:
    """
    Manages working memory and long-term memory for the agent.

    Working Memory: Recent messages always in context
    Long-term Memory: Archived messages, searchable and retrievable
    """

    def __init__(
        self,
        working_memory_size: int = 10,
        archive_threshold: int = 15,
        storage_path: Optional[str] = None,
        max_retrieval: int = 5
    ):
        """
        Initialize memory manager.

        Args:
            working_memory_size: Number of recent messages to keep in context
            archive_threshold: When total messages exceed this, archive oldest
            storage_path: Path to persist memory (None = no persistence)
            max_retrieval: Max memories to retrieve per query
        """
        self.working_memory_size = working_memory_size
        self.archive_threshold = archive_threshold
        self.storage_path = storage_path
        self.max_retrieval = max_retrieval

        # Memory stores
        self.working_memory: List[MemoryEntry] = []
        self.long_term_memory: List[MemoryEntry] = []
        self.next_id = 1

        # Load persisted memory if exists
        if storage_path:
            self._load_from_disk()

    def add(self, content: str, role: str = "user", metadata: Optional[Dict] = None) -> MemoryEntry:
        """
        Add a new memory entry.

        Automatically archives to long-term memory when working memory is full.
        """
        entry = MemoryEntry(
            id=self.next_id,
            role=role,
            content=content,
            timestamp=datetime.now().isoformat(),
            metadata=metadata or {},
            keywords=self._extract_keywords(content)
        )
        self.next_id += 1

        # Add to working memory
        self.working_memory.append(entry)

        # Check if we need to archive
        if len(self.working_memory) > self.archive_threshold:
            self._archive_oldest()

        # Persist if enabled
        if self.storage_path:
            self._save_to_disk()

        return entry

    def _archive_oldest(self):
        """Move oldest messages from working memory to long-term memory."""
        # Keep only the most recent `working_memory_size` messages
        to_archive = len(self.working_memory) - self.working_memory_size

        if to_archive > 0:
            # Move to long-term memory
            archived = self.working_memory[:to_archive]
            self.long_term_memory.extend(archived)

            # Keep recent in working memory
            self.working_memory = self.working_memory[to_archive:]

    def get_context_messages(self, include_retrieved: bool = True, query: Optional[str] = None) -> List[Dict]:
        """
        Get messages to include in LLM context.

        Args:
            include_retrieved: Whether to search and include relevant long-term memories
            query: The current query (used for relevance search)

        Returns:
            List of message dicts ready for LLM
        """
        messages = []

        # Optionally retrieve relevant long-term memories
        if include_retrieved and query and self.long_term_memory:
            retrieved = self.search(query, top_k=self.max_retrieval)

            if retrieved:
                # Add a system message indicating these are past memories
                memory_context = self._format_retrieved_memories(retrieved)
                messages.append({
                    "role": "system",
                    "content": f"Relevant context from previous conversations:\n{memory_context}"
                })

        # Add working memory (recent messages)
        for entry in self.working_memory:
            messages.append(entry.to_message())

        return messages

    def search(self, query: str, top_k: int = 5) -> List[MemorySearchResult]:
        """
        Search long-term memory for relevant entries.

        Uses keyword matching and recency scoring.
        For production, replace with embedding-based search.
        """
        if not self.long_term_memory:
            return []

        query_keywords = set(self._extract_keywords(query))
        results = []

        for entry in self.long_term_memory:
            # Keyword overlap score
            entry_keywords = set(entry.keywords)
            overlap = query_keywords & entry_keywords

            if overlap:
                # Calculate relevance score
                keyword_score = len(overlap) / max(len(query_keywords), 1)

                # Recency bonus (more recent = higher score)
                recency_score = entry.id / self.next_id  # 0 to 1

                # Combined score (keyword match is more important)
                score = (keyword_score * 0.7) + (recency_score * 0.3)

                results.append(MemorySearchResult(
                    entry=entry,
                    relevance_score=score,
                    match_reason=f"Keywords: {', '.join(overlap)}"
                ))

        # Sort by relevance
        results.sort(key=lambda x: x.relevance_score, reverse=True)

        return results[:top_k]

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract keywords from text for search indexing."""
        # Simple keyword extraction
        # For production, use TF-IDF or embeddings

        # Lowercase and split
        words = re.findall(r'\b\w+\b', text.lower())

        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
            'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
            'through', 'during', 'before', 'after', 'above', 'below',
            'between', 'under', 'again', 'further', 'then', 'once',
            'here', 'there', 'when', 'where', 'why', 'how', 'all',
            'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
            'until', 'while', 'this', 'that', 'these', 'those', 'i',
            'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
            'who', 'whom', 'its', 'his', 'her', 'their', 'my', 'your'
        }

        # Filter and keep meaningful words (3+ chars, not stop words)
        keywords = [
            w for w in words
            if len(w) >= 3 and w not in stop_words
        ]

        # Return unique keywords
        return list(set(keywords))

    def _format_retrieved_memories(self, results: List[MemorySearchResult]) -> str:
        """Format retrieved memories for inclusion in context."""
        formatted = []

        for result in results:
            entry = result.entry
            time_str = entry.timestamp[:10]  # Just the date
            formatted.append(
                f"[{time_str}] {entry.role}: {entry.content[:500]}"
                + ("..." if len(entry.content) > 500 else "")
            )

        return "\n\n".join(formatted)

    def get_stats(self) -> Dict:
        """Get memory statistics."""
        return {
            "working_memory_count": len(self.working_memory),
            "long_term_memory_count": len(self.long_term_memory),
            "total_memories": len(self.working_memory) + len(self.long_term_memory),
            "working_memory_limit": self.working_memory_size,
            "archive_threshold": self.archive_threshold
        }

    def clear_working_memory(self):
        """Clear working memory (archive everything first)."""
        self.long_term_memory.extend(self.working_memory)
        self.working_memory = []

        if self.storage_path:
            self._save_to_disk()

    def clear_all(self):
        """Clear all memory (working and long-term)."""
        self.working_memory = []
        self.long_term_memory = []
        self.next_id = 1

        if self.storage_path:
            self._save_to_disk()

    def _save_to_disk(self):
        """Persist memory to disk."""
        if not self.storage_path:
            return

        path = Path(self.storage_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "next_id": self.next_id,
            "working_memory": [asdict(e) for e in self.working_memory],
            "long_term_memory": [asdict(e) for e in self.long_term_memory]
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _load_from_disk(self):
        """Load memory from disk."""
        if not self.storage_path:
            return

        path = Path(self.storage_path)
        if not path.exists():
            return

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            self.next_id = data.get("next_id", 1)
            self.working_memory = [
                MemoryEntry(**e) for e in data.get("working_memory", [])
            ]
            self.long_term_memory = [
                MemoryEntry(**e) for e in data.get("long_term_memory", [])
            ]
        except Exception as e:
            print(f"Warning: Could not load memory from disk: {e}")

    def export_conversation(self, include_long_term: bool = True) -> List[Dict]:
        """Export full conversation history."""
        entries = []

        if include_long_term:
            entries.extend(self.long_term_memory)

        entries.extend(self.working_memory)

        # Sort by ID (chronological)
        entries.sort(key=lambda x: x.id)

        return [
            {
                "id": e.id,
                "role": e.role,
                "content": e.content,
                "timestamp": e.timestamp
            }
            for e in entries
        ]
```

### 5.3 Updated Engine with Memory

Update `engine.py` to use the memory system:

```python
"""
rlm/engine.py (Updated with Memory System)
"""

from .memory import MemoryManager

class RLMEngine:
    """RLM Engine with integrated memory system."""

    def __init__(self, config: Optional[RLMConfig] = None):
        self.config = config or RLMConfig()

        # ... existing initialization ...

        # Initialize memory system
        self.memory = MemoryManager(
            working_memory_size=10,      # Keep last 10 messages in context
            archive_threshold=15,         # Archive when >15 messages
            storage_path="data/memory.json",  # Persist to disk
            max_retrieval=5               # Retrieve up to 5 relevant memories
        )

    def process_message(
        self,
        user_message: str,
        context: Optional[str] = None,
        stream: bool = False
    ) -> RLMResponse:
        """Process message with memory-aware context."""

        # Add user message to memory
        self.memory.add(user_message, role="user")

        # ... existing complexity analysis ...

        # Get context-aware message history
        messages = self.memory.get_context_messages(
            include_retrieved=True,
            query=user_message  # Search for relevant past conversations
        )

        # ... rest of processing ...

        # Add assistant response to memory
        self.memory.add(response_content, role="assistant")

        return result

    def _handle_simple(self, message: str, complexity: ComplexityResult, stream: bool):
        """Handle simple queries with memory-aware context."""

        # Get messages including relevant long-term memories
        messages = self.memory.get_context_messages(
            include_retrieved=True,
            query=message
        )

        response = self.client.chat(
            model=self.config.primary_model,
            messages=messages,
            temperature=self.config.temperature,
            num_ctx=self.config.num_ctx
        )

        # Add response to memory
        self.memory.add(response, role="assistant")

        return RLMResponse(
            content=response,
            complexity=complexity.level.value,
            steps_taken=1,
            model_used=self.config.primary_model
        )

    def get_memory_stats(self) -> Dict:
        """Get memory statistics."""
        return self.memory.get_stats()

    def export_conversation(self) -> List[Dict]:
        """Export full conversation history."""
        return self.memory.export_conversation()

    def reset_session(self):
        """Reset working memory (long-term persists)."""
        self.memory.clear_working_memory()
        self.repl.reset()
        self.context_manager.clear()

    def full_reset(self):
        """Reset all memory including long-term."""
        self.memory.clear_all()
        self.repl.reset()
        self.context_manager.clear()
```

### 5.4 Configuration Options

Add to `config/settings.json`:

```json
{
  "memory": {
    "working_memory_size": 10,
    "archive_threshold": 15,
    "max_retrieval": 5,
    "persist_to_disk": true,
    "storage_path": "data/memory.json"
  }
}
```

### 5.5 How Memory Flows

```
Conversation starts
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Message #1: User asks about Python                          │
│  → Added to working memory                                   │
│  → Context: [Message #1]                                     │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Messages #2-10: Conversation continues                      │
│  → All in working memory                                     │
│  → Context: [Messages #1-10]                                 │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Message #11: Threshold exceeded!                            │
│  → Messages #1-5 archived to long-term memory                │
│  → Working memory: [Messages #6-11]                          │
│  → Context: [Messages #6-11]                                 │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Message #50: User asks "What was that Python bug?"          │
│  → Search long-term memory for "Python" + "bug"              │
│  → Found: Messages #3, #7 are relevant                       │
│  → Context: [Retrieved #3, #7] + [Working #45-50]            │
│  → Agent remembers the old conversation!                     │
└──────────────────────────────────────────────────────────────┘
```

### 5.6 Memory Persistence

Memory survives restarts:

```
Session 1 (Monday):
  → Discuss Python project
  → 50 messages exchanged
  → Saved to data/memory.json

Session 2 (Tuesday):
  → Load memory from disk
  → Ask "What were we working on yesterday?"
  → Agent retrieves Monday's conversation
  → Continues seamlessly
```

---

## Chapter 6: Python Backend

### 5.1 server.py - FastAPI Backend

```python
"""
server.py
FastAPI backend that exposes the RLM engine via REST API.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
import asyncio

from rlm import RLMEngine, RLMConfig

# Initialize app
app = FastAPI(
    title="Local LLM with RLM",
    description="100% offline LLM with Recursive Language Model processing",
    version="0.1.0"
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load config
CONFIG_PATH = "config/settings.json"
if os.path.exists(CONFIG_PATH):
    with open(CONFIG_PATH) as f:
        config_data = json.load(f)
else:
    config_data = {}

# Initialize RLM Engine
rlm_config = RLMConfig(
    ollama_host=config_data.get("ollama", {}).get("host", "http://localhost:11434"),
    primary_model=config_data.get("models", {}).get("primary", "qwen3:8b"),
    tools_model=config_data.get("models", {}).get("tools", "glm-z1:9b"),
    quality_model=config_data.get("models", {}).get("quality", "qwen3:30b-a3b"),
)

engine = RLMEngine(config=rlm_config)


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    stream: bool = False


class ChatResponse(BaseModel):
    response: str
    complexity: str
    steps_taken: int
    model_used: str
    repl_outputs: List[Dict] = []


class DocumentRequest(BaseModel):
    doc_id: str
    content: str


class SettingsUpdate(BaseModel):
    temperature: Optional[float] = None
    primary_model: Optional[str] = None
    tools_model: Optional[str] = None
    quality_model: Optional[str] = None


# Routes
@app.get("/")
async def root():
    """Serve the web UI."""
    return FileResponse("index.html")


@app.get("/api/status")
async def get_status():
    """Get system status."""
    return engine.get_status()


@app.get("/api/models")
async def list_models():
    """List available Ollama models."""
    if not engine.is_available():
        raise HTTPException(status_code=503, detail="Ollama service not available")

    models = engine.client.list_models()
    return {"models": models}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the RLM engine.

    Every message is processed through RLM:
    - Simple queries: fast direct response
    - Complex queries: decompose → execute → synthesize
    """
    if not engine.is_available():
        raise HTTPException(status_code=503, detail="Ollama service not available")

    try:
        result = engine.process_message(
            user_message=request.message,
            context=request.context,
            stream=False
        )

        return ChatResponse(
            response=result.content,
            complexity=result.complexity,
            steps_taken=result.steps_taken,
            model_used=result.model_used,
            repl_outputs=result.repl_outputs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat."""
    await websocket.accept()

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            message = data.get("message", "")
            context = data.get("context")

            # Process with streaming
            result = engine.process_message(
                user_message=message,
                context=context,
                stream=True
            )

            # Stream tokens
            if hasattr(result, '__iter__'):
                for token in result:
                    await websocket.send_json({"type": "token", "content": token})

                # Send final metadata
                await websocket.send_json({
                    "type": "done",
                    "complexity": result.complexity if hasattr(result, 'complexity') else "unknown",
                    "steps_taken": result.steps_taken if hasattr(result, 'steps_taken') else 1
                })
            else:
                # Non-streaming fallback
                await websocket.send_json({
                    "type": "complete",
                    "content": result.content,
                    "complexity": result.complexity,
                    "steps_taken": result.steps_taken
                })

    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()


@app.post("/api/document")
async def add_document(request: DocumentRequest):
    """Add a document for analysis."""
    info = engine.add_document(request.doc_id, request.content)
    return {"success": True, "document": info}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file for analysis."""
    content = await file.read()

    # Try to decode as text
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except:
            raise HTTPException(status_code=400, detail="Could not decode file")

    info = engine.add_document(file.filename, text)
    return {"success": True, "document": info}


@app.get("/api/repl/variables")
async def get_repl_variables():
    """Get current REPL variables."""
    return {"variables": engine.get_repl_variables()}


@app.post("/api/reset")
async def reset_session():
    """Reset conversation and REPL state."""
    engine.reset_session()
    return {"success": True, "message": "Session reset"}


@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    """Update engine settings."""
    if settings.temperature is not None:
        engine.config.temperature = settings.temperature
    if settings.primary_model:
        engine.config.primary_model = settings.primary_model
    if settings.tools_model:
        engine.config.tools_model = settings.tools_model
    if settings.quality_model:
        engine.config.quality_model = settings.quality_model

    return {"success": True, "config": engine.config.__dict__}


# Run with: uvicorn server:app --host 127.0.0.1 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

### 5.2 Running the Backend

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run the server
python server.py

# Or with uvicorn directly (better for development)
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

---

## Chapter 7: Web UI Implementation

### 7.1 index.html - Complete Self-Contained UI

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Local LLM + RLM</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-tertiary: #0f3460;
            --text-primary: #e8e8e8;
            --text-secondary: #a0a0a0;
            --accent: #e94560;
            --accent-hover: #ff6b6b;
            --success: #4ade80;
            --warning: #fbbf24;
            --border: #2d3748;
        }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header */
        header {
            background: var(--bg-secondary);
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent);
        }

        .status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--warning);
        }

        .status-dot.online {
            background: var(--success);
        }

        .status-dot.offline {
            background: var(--accent);
        }

        /* Main container */
        main {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Chat area */
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 900px;
            margin: 0 auto;
            width: 100%;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .message {
            max-width: 80%;
            padding: 1rem;
            border-radius: 12px;
            line-height: 1.5;
        }

        .message.user {
            align-self: flex-end;
            background: var(--bg-tertiary);
            border-bottom-right-radius: 4px;
        }

        .message.assistant {
            align-self: flex-start;
            background: var(--bg-secondary);
            border-bottom-left-radius: 4px;
        }

        .message-meta {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
        }

        .message pre {
            background: var(--bg-primary);
            padding: 0.75rem;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0.5rem 0;
        }

        .message code {
            font-family: 'Cascadia Code', 'Fira Code', monospace;
            font-size: 0.9rem;
        }

        /* Input area */
        .input-container {
            padding: 1rem 1.5rem;
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
        }

        .input-wrapper {
            display: flex;
            gap: 0.75rem;
            align-items: flex-end;
        }

        textarea {
            flex: 1;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 0.75rem;
            color: var(--text-primary);
            font-size: 1rem;
            resize: none;
            min-height: 50px;
            max-height: 200px;
            font-family: inherit;
        }

        textarea:focus {
            outline: none;
            border-color: var(--accent);
        }

        button {
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
        }

        button:hover {
            background: var(--accent-hover);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Sidebar */
        .sidebar {
            width: 280px;
            background: var(--bg-secondary);
            border-left: 1px solid var(--border);
            padding: 1rem;
            overflow-y: auto;
        }

        .sidebar h3 {
            font-size: 0.875rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 0.75rem;
        }

        .sidebar-section {
            margin-bottom: 1.5rem;
        }

        select {
            width: 100%;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 0.5rem;
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        select:focus {
            outline: none;
            border-color: var(--accent);
        }

        .slider-container {
            margin-top: 0.5rem;
        }

        .slider-container label {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem;
            margin-bottom: 0.25rem;
        }

        input[type="range"] {
            width: 100%;
            accent-color: var(--accent);
        }

        .info-box {
            background: var(--bg-primary);
            border-radius: 6px;
            padding: 0.75rem;
            font-size: 0.85rem;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.25rem;
        }

        .info-row:last-child {
            margin-bottom: 0;
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            width: 100%;
            margin-top: 0.5rem;
        }

        /* Loading indicator */
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 1rem;
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--text-secondary);
            border-radius: 50%;
            animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }

        /* Complexity badge */
        .complexity-badge {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            text-transform: uppercase;
            font-weight: 600;
        }

        .complexity-badge.simple {
            background: var(--success);
            color: black;
        }

        .complexity-badge.moderate {
            background: var(--warning);
            color: black;
        }

        .complexity-badge.complex {
            background: var(--accent);
            color: white;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .sidebar {
                display: none;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">Local LLM + RLM</div>
        <div class="status">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">Checking...</span>
        </div>
    </header>

    <main>
        <div class="chat-container">
            <div class="messages" id="messages">
                <div class="message assistant">
                    <p>Hello! I'm your local AI assistant powered by RLM (Recursive Language Model).</p>
                    <p>Every message you send is analyzed for complexity:</p>
                    <ul style="margin: 0.5rem 0 0 1.5rem;">
                        <li><strong>Simple</strong> queries get fast, direct responses</li>
                        <li><strong>Complex</strong> queries are decomposed, processed, and synthesized</li>
                    </ul>
                    <p style="margin-top: 0.5rem;">Try asking me something!</p>
                </div>
            </div>

            <div class="input-container">
                <div class="input-wrapper">
                    <textarea
                        id="userInput"
                        placeholder="Type your message..."
                        rows="1"
                        onkeydown="handleKeyDown(event)"
                    ></textarea>
                    <button id="sendBtn" onclick="sendMessage()">Send</button>
                </div>
            </div>
        </div>

        <aside class="sidebar">
            <div class="sidebar-section">
                <h3>Model</h3>
                <select id="modelSelect">
                    <option value="qwen3:8b">Qwen3-8B (Fast)</option>
                    <option value="glm-z1:9b">GLM-Z1-9B (Tools)</option>
                    <option value="qwen3:30b-a3b">Qwen3-30B-A3B (Quality)</option>
                </select>
            </div>

            <div class="sidebar-section">
                <h3>Settings</h3>
                <div class="slider-container">
                    <label>
                        <span>Temperature</span>
                        <span id="tempValue">0.7</span>
                    </label>
                    <input
                        type="range"
                        id="temperature"
                        min="0"
                        max="1"
                        step="0.1"
                        value="0.7"
                        oninput="updateTemp()"
                    >
                </div>
            </div>

            <div class="sidebar-section">
                <h3>Session Info</h3>
                <div class="info-box">
                    <div class="info-row">
                        <span>Messages:</span>
                        <span id="msgCount">0</span>
                    </div>
                    <div class="info-row">
                        <span>Last Complexity:</span>
                        <span id="lastComplexity">-</span>
                    </div>
                    <div class="info-row">
                        <span>Steps Taken:</span>
                        <span id="stepsTaken">-</span>
                    </div>
                </div>
                <button class="btn-secondary" onclick="resetSession()">Reset Session</button>
            </div>

            <div class="sidebar-section">
                <h3>Upload Document</h3>
                <input type="file" id="fileInput" accept=".txt,.md,.json,.py,.js" onchange="uploadFile()">
            </div>
        </aside>
    </main>

    <script>
        const API_BASE = 'http://127.0.0.1:8000';
        let messageCount = 0;

        // Check status on load
        checkStatus();
        setInterval(checkStatus, 30000);

        async function checkStatus() {
            try {
                const response = await fetch(`${API_BASE}/api/status`);
                const data = await response.json();

                const dot = document.getElementById('statusDot');
                const text = document.getElementById('statusText');

                if (data.ollama_available) {
                    dot.className = 'status-dot online';
                    text.textContent = 'Online';
                } else {
                    dot.className = 'status-dot offline';
                    text.textContent = 'Ollama Offline';
                }
            } catch (e) {
                document.getElementById('statusDot').className = 'status-dot offline';
                document.getElementById('statusText').textContent = 'Server Offline';
            }
        }

        function handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }

        async function sendMessage() {
            const input = document.getElementById('userInput');
            const message = input.value.trim();

            if (!message) return;

            // Add user message to UI
            addMessage(message, 'user');
            input.value = '';
            input.style.height = 'auto';

            // Show typing indicator
            const typingId = showTyping();

            // Disable send button
            const sendBtn = document.getElementById('sendBtn');
            sendBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        stream: false
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                // Remove typing indicator
                hideTyping(typingId);

                // Add assistant message
                addMessage(data.response, 'assistant', {
                    complexity: data.complexity,
                    steps: data.steps_taken,
                    model: data.model_used
                });

                // Update session info
                document.getElementById('lastComplexity').textContent = data.complexity;
                document.getElementById('stepsTaken').textContent = data.steps_taken;

            } catch (error) {
                hideTyping(typingId);
                addMessage(`Error: ${error.message}`, 'assistant');
            }

            sendBtn.disabled = false;
        }

        function addMessage(content, role, meta = null) {
            const container = document.getElementById('messages');
            const div = document.createElement('div');
            div.className = `message ${role}`;

            // Format content (basic markdown)
            let formatted = content
                .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            div.innerHTML = formatted;

            if (meta) {
                const metaDiv = document.createElement('div');
                metaDiv.className = 'message-meta';
                metaDiv.innerHTML = `
                    <span class="complexity-badge ${meta.complexity}">${meta.complexity}</span>
                    ${meta.steps} step${meta.steps > 1 ? 's' : ''} · ${meta.model}
                `;
                div.appendChild(metaDiv);
            }

            container.appendChild(div);
            container.scrollTop = container.scrollHeight;

            messageCount++;
            document.getElementById('msgCount').textContent = messageCount;
        }

        function showTyping() {
            const container = document.getElementById('messages');
            const div = document.createElement('div');
            div.className = 'message assistant typing-indicator';
            div.id = 'typing-' + Date.now();
            div.innerHTML = '<span></span><span></span><span></span>';
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            return div.id;
        }

        function hideTyping(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }

        function updateTemp() {
            const value = document.getElementById('temperature').value;
            document.getElementById('tempValue').textContent = value;

            // Update server settings
            fetch(`${API_BASE}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temperature: parseFloat(value) })
            });
        }

        async function resetSession() {
            try {
                await fetch(`${API_BASE}/api/reset`, { method: 'POST' });

                // Clear UI
                const container = document.getElementById('messages');
                container.innerHTML = '';
                messageCount = 0;
                document.getElementById('msgCount').textContent = '0';
                document.getElementById('lastComplexity').textContent = '-';
                document.getElementById('stepsTaken').textContent = '-';

                addMessage('Session reset. How can I help you?', 'assistant');
            } catch (e) {
                console.error('Reset failed:', e);
            }
        }

        async function uploadFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];

            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`${API_BASE}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    addMessage(
                        `Document uploaded: ${data.document.id}\n` +
                        `Size: ${data.document.estimated_tokens} tokens\n` +
                        `Chunks: ${data.document.num_chunks}\n\n` +
                        `You can now ask questions about this document.`,
                        'assistant'
                    );
                }
            } catch (e) {
                addMessage(`Upload failed: ${e.message}`, 'assistant');
            }

            fileInput.value = '';
        }

        // Auto-resize textarea
        document.getElementById('userInput').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    </script>
</body>
</html>
```

---

## Chapter 8: System Integration

### 8.1 start.bat - Launch Everything

```batch
@echo off
title Local LLM + RLM Launcher
echo ========================================
echo   Local LLM + RLM System Launcher
echo ========================================
echo.

REM Check if Ollama is running
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Ollama is already running
) else (
    echo [..] Starting Ollama...
    start "" "ollama" serve
    timeout /t 3 /nobreak >NUL
    echo [OK] Ollama started
)

REM Activate virtual environment and start server
echo [..] Starting Python backend...
cd /d "%~dp0"
call venv\Scripts\activate.bat

REM Start server in background
start "" python server.py
timeout /t 2 /nobreak >NUL
echo [OK] Backend started on http://127.0.0.1:8000

REM Open browser
echo [..] Opening browser...
start http://127.0.0.1:8000

echo.
echo ========================================
echo   System is running!
echo   Press any key to stop all services
echo ========================================
pause >NUL

REM Cleanup
echo.
echo Stopping services...
taskkill /F /IM python.exe /T 2>NUL
echo Done.
```

### 8.2 stop.bat - Stop Everything

```batch
@echo off
title Stop Local LLM
echo Stopping Local LLM services...

REM Stop Python server
taskkill /F /IM python.exe /T 2>NUL

REM Optionally stop Ollama (uncomment if desired)
REM taskkill /F /IM ollama.exe /T 2>NUL

echo Services stopped.
pause
```

### 8.3 config/settings.json

```json
{
  "ollama": {
    "host": "http://localhost:11434",
    "timeout": 120
  },
  "models": {
    "primary": "qwen3:8b",
    "tools": "glm-z1:9b",
    "quality": "qwen3:30b-a3b"
  },
  "rlm": {
    "complexity_threshold": 100,
    "max_recursion_depth": 5,
    "chunk_size": 4000,
    "chunk_overlap": 200
  },
  "server": {
    "host": "127.0.0.1",
    "port": 8000
  },
  "repl": {
    "timeout": 30,
    "max_output_length": 10000,
    "allowed_modules": [
      "math", "statistics", "random", "datetime", "json",
      "re", "collections", "itertools", "functools"
    ]
  }
}
```

---

## Chapter 9: Testing & Verification

### 9.1 Pre-flight Checklist

Before testing, verify:

- [ ] NVIDIA drivers installed (`nvidia-smi` works)
- [ ] Ollama installed and running (`ollama --version`)
- [ ] All models pulled (`ollama list` shows 3 models)
- [ ] Python 3.12+ installed (`python --version`)
- [ ] Virtual environment created and activated
- [ ] All dependencies installed (`pip list | grep fastapi`)

### 9.2 Component Tests

**Test 1: Ollama Direct**

```powershell
ollama run qwen3:8b "Say hello"
```

Expected: Quick response with greeting

**Test 2: Python Backend**

```powershell
# Start server
python server.py

# In another terminal:
curl http://127.0.0.1:8000/api/status
```

Expected: JSON with `ollama_available: true`

**Test 3: Simple Query (Fast Path)**

```powershell
curl -X POST http://127.0.0.1:8000/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message": "What is 2+2?"}'
```

Expected:
- `complexity: "simple"`
- `steps_taken: 1`
- Fast response (<3 seconds)

**Test 4: Complex Query (RLM Path)**

```powershell
curl -X POST http://127.0.0.1:8000/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message": "Analyze the pros and cons of Python vs JavaScript for web development, compare their ecosystems, and provide a recommendation based on different use cases."}'
```

Expected:
- `complexity: "complex"`
- `steps_taken: 3+`
- Detailed, structured response

**Test 5: Document Analysis**

```powershell
# Upload a document
curl -X POST http://127.0.0.1:8000/api/document `
  -H "Content-Type: application/json" `
  -d '{"doc_id": "test", "content": "This is a long document... (add 5000+ chars)"}'

# Ask about it
curl -X POST http://127.0.0.1:8000/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message": "Summarize the document", "context": "test"}'
```

Expected: RLM processes with chunking, summary returned

### 9.3 Performance Benchmarks

| Query Type | Expected Time | Expected Steps |
|------------|---------------|----------------|
| Simple (1 sentence) | <3s | 1 |
| Moderate (multi-part) | 5-10s | 2-3 |
| Complex (analysis) | 15-30s | 4-7 |
| Document (10K tokens) | 30-60s | 5-10 |

### 9.4 GPU Monitoring

While running queries, monitor GPU:

```powershell
# One-time check
nvidia-smi

# Continuous monitoring (every 1 second)
nvidia-smi -l 1
```

Expected during inference:
- GPU Memory: 5-7GB used
- GPU Utilization: 80-100%
- Temperature: <80°C

### 9.5 Common Issues & Solutions

**Issue: "Ollama not available"**
```powershell
# Check if running
Get-Process ollama

# Start if needed
ollama serve
```

**Issue: "Model not found"**
```powershell
# List available models
ollama list

# Pull missing model
ollama pull qwen3:8b
```

**Issue: "Out of memory"**
```powershell
# Check what's using GPU
nvidia-smi

# Unload models
ollama stop qwen3:8b
ollama stop glm-z1:9b
```

**Issue: "Python module not found"**
```powershell
# Ensure venv is activated
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt
```

**Issue: "CORS error in browser"**
- Ensure server is running on 127.0.0.1:8000
- Check browser console for specific error
- Verify CORS middleware in server.py

**Issue: "Slow responses"**
- Check GPU utilization (should be high)
- Verify model fits in VRAM
- Reduce context length in settings
- Use faster model (qwen3:8b) for testing

### 9.6 Verification Checklist

After full setup, verify:

- [ ] `start.bat` launches everything correctly
- [ ] Web UI opens in browser
- [ ] Status shows "Online"
- [ ] Simple message gets fast response
- [ ] Complex message shows "complex" complexity
- [ ] Document upload works
- [ ] Model selector changes behavior
- [ ] Temperature slider updates settings
- [ ] Reset session clears history
- [ ] GPU shows utilization during inference
- [ ] System runs stable for 10+ minutes

---

## Appendix A: Quick Reference

### Ollama Commands

```powershell
ollama serve              # Start service
ollama list               # List models
ollama pull <model>       # Download model
ollama run <model>        # Interactive chat
ollama stop <model>       # Unload from memory
ollama rm <model>         # Delete model
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve Web UI |
| `/api/status` | GET | System status |
| `/api/models` | GET | List models |
| `/api/chat` | POST | Send message |
| `/ws/chat` | WS | Streaming chat |
| `/api/document` | POST | Add document |
| `/api/upload` | POST | Upload file |
| `/api/reset` | POST | Reset session |
| `/api/settings` | POST | Update settings |

### File Locations

```
C:\Users\Poxxxx\Downloads\Peixoto\Image DeMosaique\LocalLLM\
├── Plan.md               # Implementation plan
├── LOCAL_LLM_SETUP.md    # This document
├── server.py             # Backend server
├── index.html            # Web UI
├── start.bat             # Launcher
├── stop.bat              # Stopper
├── requirements.txt      # Python deps
├── venv/                 # Virtual env
├── rlm/                  # RLM package
├── config/settings.json  # Configuration
├── logs/                 # Log files
└── data/                 # User documents
```

---

## Appendix B: RLM Deep Dive

For implementing agents, understand these core RLM concepts:

### The Recursive Loop

```
1. Receive input
2. Is input manageable?
   - Yes → Process directly
   - No → Decompose into sub-problems
3. For each sub-problem:
   - Recurse to step 1
4. Synthesize all results
5. Return final answer
```

### Python REPL Integration

The REPL is central to RLM. It allows:
- Data inspection without loading into context
- Calculations and transformations
- Variable storage across recursion
- Code execution for complex logic

Example flow:
```python
# User asks about a 50K token document
# RLM decomposes:

# Sub-task 1: Load and inspect
repl.execute("""
with open('doc.txt') as f:
    text = f.read()
print(f"Document length: {len(text)}")
""")

# Sub-task 2: Find sections
repl.execute("""
sections = text.split('\\n\\n')
print(f"Found {len(sections)} sections")
for i, s in enumerate(sections[:5]):
    print(f"{i}: {s[:100]}...")
""")

# Sub-task 3: LLM analyzes specific sections
llm_call("Summarize: " + sections[0])
llm_call("Summarize: " + sections[1])
# ...

# Synthesis: Combine summaries
```

### When to Recurse

RLM should recurse when:
- Input exceeds context window
- Task has clear sub-components
- Different parts need different handling
- Intermediate computation is needed

RLM should NOT recurse when:
- Simple factual questions
- Short, focused queries
- No benefit from decomposition

---

*Document Version: 1.0*
*Created: 2026-01-27*
*Target: 100% Offline Local LLM with RLM-First Architecture*
