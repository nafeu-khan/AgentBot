# AgentBot - Intelligent Energy Grid Analysis Chatbot

An advanced AI-powered chatbot system. that provides real-time energy grid analysis, weather information etc through an intuitive conversational interface.

## Features

- **Real-time Energy Grid Analysis** - Monitor power demand, voltage readings, and grid status
- **Weather Information** - Get current weather data for any location worldwide
- **Tool-Aware AI** - Intelligent tool selection based on user queries
- **Streaming Responses** - Real-time token streaming for enhanced user experience
- **Memory Management** - Contextual conversations with session-based memory


##  Architecture

```
taskjs/
├── client/              # Next.js React frontend
├── server/              # Node.js Express backend
└── api_server/          # Data source API server
```

### Frontend (Next.js + React)
- Modern React 18 with Next.js 14
- Tailwind CSS for responsive design
- Real-time chat interface with streaming support
- TypeScript for type safety

### Backend Options
- **Node.js Backend**: Express.js with LangChain integration
- **Data API**: Separate data service for grid information

### AI Integration
- **LangChain Framework** for AI orchestration
- **Ollama Integration** for local LLM deployment
- **Tool Calling** with function-based capabilities
- **Memory Management** for contextual conversations

##  Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for Python backend as chromadb is used by pip)
- Ollama installed and running
- OpenWeather API key (optional, for weather features)

### Ollama Setup
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the required model:
   ```bash
   ollama pull llama3-groq-tool-use:8b
   # or
   ollama pull llama3.1:latest
   ```
3. Ensure Ollama is running on port 11434

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/nafeu-khan/AgentBot.git
cd agentbot
```

### 2. Setup Environment Variables
Create `.env` files in the `server/` directory:

### 3. Install Dependencies

#### Frontend Setup
```bash
cd client
npm install
```

#### Backend Setup (Node.js)
```bash
cd server
npm install
```


### 4. Start the Services

#### Option A: Node.js Backend
```bash
# Terminal 1: Start the frontend
cd client
npm run dev

# Terminal 2: Start the Node.js backend
cd server
npm run dev

# Terminal 3: Start the data API (optional)
cd api_server
npm run dev
```


### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **Data API**: http://localhost:3001

##  Available Tools

The AI assistant has access to several specialized tools:

### 1. Grid Data Tool (`getGridData`)
- Retrieves real-time energy grid metrics
- Power demand, voltage readings, grid status
- Usage: "What's the current power demand?"

### 2. Weather Tool (`getWeather`)
- Fetches current weather for specified locations
- Requires specific location in the query
- Usage: "What's the weather in London?"

### 3. Company Info Tool (`getCompanyInfo`)
- Provides information 
- Company details, services, contact information
- Usage: "Tell me about your company"

### Model Configuration

The system supports various Ollama models:
- `llama3-groq-tool-use:8b` (recommended for tool calling)
- `llama3.1:latest`
- Any Ollama-compatible model with tool calling support

##  API Endpoints

### Chat API
- `POST /api/chat/` - Send chat message (streaming response)
- `GET /health` - Health check endpoint

### Observability API
- `GET /api/observability/memory/:sessionId` - Get conversation memory
- `GET /api/observability/system` - System metrics

##  Usage Examples

### Energy Grid Queries
```
User: "What's the current power demand?"
AI: [Calls getGridData tool and provides real-time metrics]

User: "Show me the latest voltage readings"
AI: [Retrieves and displays voltage data from grid]
```

### Weather Queries
```
User: "What's the weather in Tokyo?"
AI: [Calls getWeather tool with location "Tokyo"]

User: "How's the weather?"
AI: "I need to know which city or location you'd like the weather for."
```

### Company Information
```
User: "Tell me about your company"
AI: [Calls getCompanyInfo tool and provides company details]
```

##  Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `FRONTEND_URL` matches your client URL
   - Check that both frontend and backend are running

2. **Ollama Connection Issues**
   - Verify Ollama is running: `ollama serve`
   - Check the `OLLAMA_BASE_URL` configuration

3. **Tool Calling Issues**
   - Ensure the model supports tool calling
   - Check that all required environment variables are set( see env.example)

4. **Streaming Not Working**
   - Check browser network tab for SSE connections
