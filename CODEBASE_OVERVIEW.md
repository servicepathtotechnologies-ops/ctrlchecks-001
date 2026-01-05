# Flow Genius AI - Comprehensive Codebase Overview

## 🎯 Project Overview

**Flow Genius AI** is a comprehensive workflow automation platform that allows users to create, execute, and manage complex automated workflows through a visual interface. The platform supports multiple creation methods including visual drag-and-drop, AI-powered generation, and multimodal agent builders.

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- **React 18** with **TypeScript**
- **Vite** for build tooling
- **React Flow (xyflow)** for visual workflow canvas
- **Zustand** for state management
- **React Router** for routing
- **TanStack Query** for data fetching
- **Shadcn/ui** + **Radix UI** for components
- **Tailwind CSS** for styling
- **Framer Motion** for animations

**Backend:**
- **Supabase** (PostgreSQL database + Edge Functions)
- **Supabase Edge Functions** (Deno/TypeScript) for serverless functions
- **Supabase Auth** for authentication
- **Python FastAPI** backend (optional, for legacy multimodal processing)

**AI/ML:**
- **HuggingFace Inference API** (free models)
- **Groq API** (fast inference)
- **Replicate** (image generation)
- **OpenAI/Anthropic/Google Gemini** (via LLM adapter)

## 📁 Project Structure

```
flow-genius-ai-main/
├── src/                          # React frontend source
│   ├── components/              # React components
│   │   ├── workflow/           # Workflow builder components
│   │   ├── multimodal/         # Multimodal agent components
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── landing/            # Landing page components
│   │   └── admin/              # Admin components
│   ├── pages/                  # Route pages
│   │   ├── WorkflowBuilder.tsx    # Visual workflow editor
│   │   ├── AIWorkflowBuilder.tsx  # AI workflow generator
│   │   ├── MultimodalBuilder.tsx  # Multimodal agent builder
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   └── admin/                 # Admin pages
│   ├── stores/                 # Zustand stores
│   │   └── workflowStore.ts    # Workflow state management
│   ├── lib/                    # Utilities and helpers
│   │   ├── auth.tsx            # Authentication context
│   │   └── utils.ts            # Utility functions
│   └── integrations/           # External integrations
│       └── supabase/           # Supabase client & types
│
├── supabase/                   # Supabase backend
│   ├── functions/              # Edge Functions (Deno)
│   │   ├── execute-workflow/      # Workflow execution engine
│   │   ├── generate-workflow/     # AI workflow generation
│   │   ├── execute-agent/         # Agent execution
│   │   ├── build-multimodal-agent/ # Multimodal agent builder
│   │   ├── form-trigger/          # Form submission handler
│   │   ├── webhook-trigger/       # Webhook handler
│   │   └── _shared/               # Shared utilities
│   ├── migrations/             # Database migrations
│   └── config.toml             # Supabase config
│
├── sql_migrations/             # SQL migration files
│   ├── 01_database_setup.sql      # Core schema
│   ├── 02_agent_memory_tables.sql # Agent/memory tables
│   ├── 03_google_oauth_tokens.sql # Google OAuth
│   ├── 04_form_trigger_setup.sql  # Form triggers
│   └── 05_role_based_templates.sql # Template system
│
├── AI_Agent/                   # Legacy Python backend (optional)
│   └── multimodal_backend/     # FastAPI backend
│
└── Debugging/                  # Documentation & guides
    ├── 01-Setup-Configuration/
    ├── 02-Deployment/
    ├── 03-Node-Implementation/
    └── 04-Features/
```

## 🔑 Core Features

### 1. Visual Workflow Builder
- **Drag-and-drop interface** using React Flow
- **Node library** with 100+ node types organized by category:
  - Triggers (Manual, Webhook, Schedule, Form, Chat, etc.)
  - AI (OpenAI, Claude, Gemini, HuggingFace, etc.)
  - Logic (If/Else, Switch, Loop, Wait, etc.)
  - Data (JavaScript, JSON, CSV, Text formatting, etc.)
  - Database (PostgreSQL, MySQL, MongoDB, Redis, etc.)
  - Google Services (Sheets, Docs, Drive, Calendar, Gmail, etc.)
  - Output (Slack, Discord, Telegram, Email, etc.)
  - CRM (HubSpot, Salesforce, Zoho, etc.)
  - And many more...
- **Properties panel** for node configuration
- **Real-time execution** with visual status indicators
- **Undo/Redo** functionality
- **Copy/Paste** nodes

### 2. AI Workflow Generation
- **Autonomous Agent System** that converts natural language prompts into complete workflows
- **7-phase execution process**:
  1. Understand & Summarize
  2. Planning (Goal Decomposition)
  3. Workflow Construction
  4. Validation & Simulation
  5. Error Handling & Self-Healing
  6. Optimization
  7. Final Generation
- **Self-healing** - automatically fixes errors
- **Memory-driven** - learns from past experiences
- **Template-based generation** for common patterns (reduces API calls)

### 3. Multimodal Agent Builder
- **Prompt-driven system** that converts natural language descriptions into working AI agents
- **5-phase orchestration process**:
  1. **Intent Analysis** - Parses user prompt to extract goals, input/output modalities, and processing requirements
  2. **Model Selection** - Automatically selects optimal free AI models from HuggingFace, Groq, and Replicate based on task requirements
  3. **Pipeline Construction** - Builds processing pipelines with input handling, transformation steps, and output formatting
  4. **UI Template Generation** - Creates dynamic user interfaces tailored to the agent's functionality
  5. **Confidence Logging** - Generates progress logs that build user confidence during creation
- **Multi-modal support**:
  - **Text Processing** - Summarization, translation, Q&A, sentiment analysis, code generation
  - **Image Processing** - Captioning, generation, manipulation, OCR, object detection
  - **Audio Processing** - Speech-to-text, text-to-speech, audio analysis
- **Free model ecosystem** - Uses 100% free APIs (HuggingFace Inference, Groq, Replicate)
- **Dynamic UI rendering** - Automatically generates custom interfaces based on agent capabilities
- **Pipeline visualization** - Visual representation of the processing pipeline
- **Model testing dashboard** - Test and validate models before deployment
- **Real-time progress tracking** - Live logs showing agent creation process
- **File upload support** - Handles PDFs, images, audio files, and documents

### 4. Workflow Execution Engine
- **Topological sorting** for correct execution order
- **Template variable system** (`{{input.property}}`)
- **Error handling** with error trigger nodes
- **Form triggers** (blocking workflows that wait for user input)
- **Execution logging** and tracking
- **Real-time status updates** on canvas

### 5. Template System
- **Role-based templates** (user/admin/moderator)
- **Template versioning**
- **Copy from template** functionality
- **Template management** (admin-only)
- **Featured templates**

### 6. Authentication & Authorization
- **Supabase Auth** integration
- **Google OAuth** support
- **Role-based access control** (admin, moderator, user)
- **Team management** (future feature)
- **RLS policies** for data security

### 7. Form Triggers
- **Interactive forms** that block workflow execution
- **Custom form fields** (text, email, tel, textarea, etc.)
- **Form submission** handling
- **Idempotency** to prevent duplicate submissions
- **Audit trail**

### 8. Execution Tracking
- **Execution history** with logs
- **Status tracking** (pending, running, success, failed, waiting)
- **Input/Output** storage
- **Error messages** and stack traces
- **Duration tracking**

## 🗄️ Database Schema

### Core Tables

**profiles** - User profiles linked to Supabase Auth
**user_roles** - Role assignments (admin, moderator, user)
**teams** - Team management (future)
**workflows** - Workflow definitions (nodes, edges stored as JSONB)
**workflow_versions** - Version history
**executions** - Execution records with logs
**templates** - Global workflow templates
**form_submissions** - Form submission tracking
**google_oauth_tokens** - Google OAuth token storage
**agent_executions** - Agent execution records
**memory_sessions** - Conversation memory sessions
**memory_messages** - Conversation messages

### Key Design Patterns

- **JSONB storage** for nodes/edges (flexible schema)
- **Row Level Security (RLS)** policies on all tables
- **Enum types** for status fields
- **Triggers** for automatic updates (timestamps, user creation)
- **Indexes** for performance optimization

## 🔧 Key Components

### Frontend Components

**WorkflowBuilder.tsx** - Main workflow editor page
- Manages workflow state via Zustand store
- Handles save/load operations
- Real-time execution with status updates
- Node library and properties panel

**WorkflowCanvas.tsx** - React Flow canvas
- Node rendering and interactions
- Edge connections
- Keyboard shortcuts
- Zoom/pan controls

**WorkflowNode.tsx** - Individual node component
- Visual representation with icons
- Status indicators (idle, running, success, error)
- Handles for connections (If/Else, Switch have multiple outputs)

**NodeLibrary.tsx** - Node selection panel
- Categorized node list
- Search functionality
- Drag-and-drop to canvas

**PropertiesPanel.tsx** - Node configuration
- Dynamic form fields based on node type
- Template variable support
- Validation

**ExecutionConsole.tsx** - Execution logs
- Real-time log streaming
- Node-by-node execution tracking
- Error display

### Backend Functions

**execute-workflow/index.ts** - Core execution engine (~14K lines)
- Topological sort for execution order
- Node execution with type-specific handlers
- Template variable replacement
- Error handling and logging
- Form trigger support
- Google services integration
- AI model integration

**generate-workflow/index.ts** - AI workflow generation
- Autonomous agent implementation
- LLM-based generation
- Validation and self-healing
- Template-based optimization

**build-multimodal-agent/index.ts** - Multimodal agent builder
- Intent analysis
- Model selection
- Pipeline building
- UI template generation

**form-trigger/index.ts** - Form submission handler
- Form data validation
- Idempotency checks
- Execution resumption

## 🔄 Data Flow

### Workflow Execution Flow

1. **Trigger** (Manual/Webhook/Schedule/Form)
2. **Create Execution Record** in database
3. **Topological Sort** to determine execution order
4. **Execute Nodes** sequentially:
   - Replace template variables
   - Execute node-specific logic
   - Pass output to next node
   - Update execution logs
5. **Handle Errors** (error trigger nodes)
6. **Update Execution Status** (success/failed)
7. **Return Results**

### Template Variable System

Variables are replaced using `{{input.property}}` syntax:
- `{{input.fieldName}}` - Access input properties
- `{{input.formData.field}}` - Form data (aliased to `{{input.data.field}}`)
- `{{property}}` - Direct property access
- Supports nested paths: `{{input.user.name}}`
- JSON parsing for string values

## 🎨 State Management

**Zustand Store** (`workflowStore.ts`):
- Nodes and edges arrays
- Selected node/edge
- Workflow metadata (id, name, dirty state)
- Undo/Redo stacks
- Clipboard for copy/paste
- Node status updates

## 🔐 Security

- **Row Level Security (RLS)** on all database tables
- **JWT authentication** via Supabase Auth
- **Role-based access control**
- **API key management** (future)
- **CORS configuration** for Edge Functions
- **Input validation** and sanitization

## 🚀 Deployment

- **Frontend**: Vercel/Netlify (static hosting)
- **Backend**: Supabase (hosted PostgreSQL + Edge Functions)
- **Python Backend**: Optional, for local model processing
- **Environment Variables**: 
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `HUGGINGFACE_API_KEY` (Edge Functions)
  - `GROQ_API_KEY` (Edge Functions)
  - Various OAuth keys

## 📝 Key Concepts

### Node Types
Each node type has:
- **Type identifier** (e.g., `google_sheets`, `if_else`)
- **Category** (triggers, ai, logic, data, etc.)
- **Icon** (Lucide icon name)
- **Default config** (configuration schema)
- **Config fields** (form fields for properties panel)
- **Execution handler** (in execute-workflow function)

### Workflow Structure
- **Nodes**: Array of node objects with id, type, position, data
- **Edges**: Array of edge objects with id, source, target, handles
- **Stored as JSONB** in database for flexibility

### Execution Model
- **Sequential execution** based on topological sort
- **Data flows** through edges from source to target
- **Each node receives** accumulated input from previous nodes
- **Template variables** allow accessing any previous node's output

## 🔮 Future Features (Based on Code Structure)

- Team collaboration
- Workflow versioning UI
- API key management
- More integrations (CRM, ecommerce, etc.)
- Advanced scheduling
- Workflow analytics
- Webhook management UI
- Template marketplace

## 📚 Documentation

Extensive documentation in `Debugging/` folder:
- Setup guides
- Deployment guides
- Node implementation guides
- Feature documentation
- Testing guides
- Database migration guides

## 🛠️ Development

**To run locally:**
1. Install dependencies: `npm install`
2. Set up Supabase project
3. Run migrations from `sql_migrations/`
4. Configure environment variables
5. Start dev server: `npm run dev`
6. Deploy Edge Functions: `npm run deploy:all`

**Key scripts:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run deploy:all` - Deploy all Edge Functions
- Individual deploy scripts for each function

---

This codebase represents a sophisticated workflow automation platform with AI capabilities, extensive integrations, and a user-friendly visual interface. The architecture is scalable, modular, and designed for extensibility.

