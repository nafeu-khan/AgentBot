#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import chromadb
import uvicorn
import os
from datetime import datetime
import uuid

app = FastAPI(title="ChromaDB Server for TaskJS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chroma_client = chromadb.PersistentClient(path="./chroma_data")

chat_collection = None

class StoreMessageRequest(BaseModel):
    session_id: str
    message: str
    role: str
    metadata: Optional[Dict[str, Any]] = {}

class SearchMessagesRequest(BaseModel):
    query: str
    session_id: str
    limit: Optional[int] = 5

class StoreToolUsageRequest(BaseModel):
    session_id: str
    tool_name: str
    args: Dict[str, Any]
    result: Dict[str, Any]
    success: Optional[bool] = True

class SearchToolUsageRequest(BaseModel):
    query: str
    tool_name: str
    limit: Optional[int] = 3

@app.on_event("startup")
async def startup_event():
    """Initialize ChromaDB collection on startup"""
    global chat_collection
    try:
        # Try to get existing collection
        chat_collection = chroma_client.get_collection("chat_memory")
        print("ChromaDB collection 'chat_memory' found")
    except:
        # Create new collection if it doesn't exist
        chat_collection = chroma_client.create_collection(
            name="chat_memory",
            metadata={"description": "Chat conversation memory with embeddings"}
        )
        print("ChromaDB collection 'chat_memory' created")

    print(f"ChromaDB Server started successfully")
    print(f"Data directory: ./chroma_data")

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "ChromaDB Server for TaskJS",
        "timestamp": datetime.now().isoformat(),
        "collection": "chat_memory" if chat_collection else None
    }

@app.get("/health")
async def health_check():
    try:
        count = chat_collection.count() if chat_collection else 0
        return {
            "status": "healthy",
            "collection_name": "chat_memory",
            "document_count": count,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.post("/store-message")
async def store_message(request: StoreMessageRequest):
    """Store a chat message with embeddings"""
    try:
        if not chat_collection:
            raise HTTPException(status_code=500, detail="Collection not initialized")
        
        message_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        full_metadata = {
            "session_id": request.session_id,
            "role": request.role,
            "timestamp": timestamp,
            "message_length": len(request.message),
            **request.metadata
        }
        
        chat_collection.add(
            ids=[message_id],
            documents=[request.message],
            metadatas=[full_metadata]
        )
        
        return {
            "success": True,
            "message_id": message_id,
            "timestamp": timestamp
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store message: {str(e)}")

@app.post("/search-messages")
async def search_similar_messages(request: SearchMessagesRequest):
    """Search for similar messages using vector similarity"""
    try:
        if not chat_collection:
            raise HTTPException(status_code=500, detail="Collection not initialized")
        
        results = chat_collection.query(
            query_texts=[request.query],
            n_results=request.limit,
            where={"session_id": request.session_id}
        )
        
        formatted_results = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                formatted_results.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                    "id": results["ids"][0][i]
                })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search messages: {str(e)}")

@app.post("/store-tool-usage")
async def store_tool_usage(request: StoreToolUsageRequest):
    """Store tool usage for learning patterns"""
    try:
        if not chat_collection:
            raise HTTPException(status_code=500, detail="Collection not initialized")
        
        tool_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        tool_document = f"Tool: {request.tool_name} | Args: {request.args} | Result: {request.result}"
        
        metadata = {
            "session_id": request.session_id,
            "type": "tool_usage",
            "tool_name": request.tool_name,
            "success": request.success,
            "timestamp": timestamp,
            "args": str(request.args),
            "result_length": len(str(request.result))
        }
        
        # Add to ChromaDB
        chat_collection.add(
            ids=[tool_id],
            documents=[tool_document],
            metadatas=[metadata]
        )
        
        return {
            "success": True,
            "tool_id": tool_id,
            "timestamp": timestamp
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store tool usage: {str(e)}")

@app.post("/search-tool-usage")
async def search_similar_tool_usage(request: SearchToolUsageRequest):
    """Search for similar tool usage patterns"""
    try:
        if not chat_collection:
            raise HTTPException(status_code=500, detail="Collection not initialized")
        
        results = chat_collection.query(
            query_texts=[request.query],
            n_results=request.limit,
            where={
                "type": "tool_usage",
                "tool_name": request.tool_name,
                "success": True
            }
        )
        
        # Format results
        formatted_results = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                formatted_results.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                    "id": results["ids"][0][i]
                })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search tool usage: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get collection statistics"""
    try:
        if not chat_collection:
            raise HTTPException(status_code=500, detail="Collection not initialized")
        
        count = chat_collection.count()
        
        return {
            "success": True,
            "total_documents": count,
            "collection_name": "chat_memory",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@app.post("/reset")
async def reset_collection():
    """Reset the collection (use with caution)"""
    try:
        global chat_collection
        
        # Delete existing collection
        if chat_collection:
            chroma_client.delete_collection("chat_memory")
        
        # Create new collection
        chat_collection = chroma_client.create_collection(
            name="chat_memory",
            metadata={"description": "Chat conversation memory with embeddings"}
        )
        
        return {
            "success": True,
            "message": "Collection reset successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset collection: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f" Starting ChromaDB Server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
