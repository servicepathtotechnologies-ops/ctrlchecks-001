"""
CtrlChecks Multimodal AI Backend
FastAPI server for all AI/ML processing using LOCAL models

CRITICAL: All AI processing happens here using BLIP and FLAN-T5 (local CPU models)
Matches the Streamlit implementation exactly
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging
import sys
import base64
import io
from pathlib import Path

# Add services to path
sys.path.append(str(Path(__file__).parent))

from services.image_processor import ImageProcessor
from services.text_processor import TextProcessor
from services.text_to_image_processor import TextToImageProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="CtrlChecks Multimodal AI Backend",
    description="AI/ML processing backend using local BLIP and FLAN-T5 models",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processors (lazy loading - models load on first use)
_image_processor = None
_text_processor = None
_text_to_image_processor = None

def get_image_processor():
    """Lazy load image processor"""
    global _image_processor
    if _image_processor is None:
        logger.info("Initializing ImageProcessor (will load BLIP model)...")
        _image_processor = ImageProcessor()
    return _image_processor

def get_text_processor():
    """Lazy load text processor"""
    global _text_processor
    if _text_processor is None:
        logger.info("Initializing TextProcessor (will load FLAN-T5 model)...")
        _text_processor = TextProcessor()
    return _text_processor

def get_text_to_image_processor():
    """Lazy load text-to-image processor"""
    global _text_to_image_processor
    if _text_to_image_processor is None:
        logger.info("Initializing TextToImageProcessor (will load Stable Diffusion model)...")
        _text_to_image_processor = TextToImageProcessor()
    return _text_to_image_processor


# Request/Response Schemas
class ProcessRequest(BaseModel):
    """Request schema for /process endpoint"""
    task: str = Field(..., description="Task type: image_caption, story, image_prompt, text_to_image, summarize, translate, extract, sentiment, generate, qa, chat")
    image: Optional[str] = Field(None, description="Base64 encoded image for image tasks")
    input: Optional[str] = Field(None, description="Input text for text tasks")
    sentence_count: Optional[int] = Field(5, description="Number of sentences for story mode (2-10)")
    target_language: Optional[str] = Field(None, description="Target language for translation")
    question: Optional[str] = Field(None, description="Question for QA task")
    context: Optional[str] = Field(None, description="Context for QA task")
    steps: Optional[int] = Field(2, description="Number of inference steps for text_to_image (1-4)")
    guidance_scale: Optional[float] = Field(1.0, description="Guidance scale for text_to_image (0.0-1.5)")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional options")


class ProcessResponse(BaseModel):
    """Response schema for /process endpoint"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    processing_time: Optional[float] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "CtrlChecks Multimodal AI Backend",
        "version": "1.0.0",
        "models": "BLIP (local), FLAN-T5 (local), Stable Diffusion Turbo (local)"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "models_loaded": {
            "blip": _image_processor is not None,
            "flan_t5": _text_processor is not None,
            "stable_diffusion": _text_to_image_processor is not None
        },
        "available_tasks": [
            "image_caption",
            "story",
            "image_prompt",
            "text_to_image",
            "summarize",
            "translate",
            "extract",
            "sentiment",
            "generate",
            "qa"
        ]
    }


@app.post("/process", response_model=ProcessResponse)
async def process_task(request: ProcessRequest):
    """
    Main processing endpoint
    
    Routes requests to appropriate processor based on task type.
    All AI/ML processing happens here using LOCAL models (BLIP, FLAN-T5).
    """
    import time
    start_time = time.time()
    
    try:
        logger.info(f"Processing task: {request.task}")
        
        # Validate request based on task type
        if request.task in ["image_caption", "story", "image_prompt"]:
            if not request.image:
                raise HTTPException(status_code=400, detail="Image is required for image tasks")
        
        if request.task == "text_to_image":
            if not request.input:
                raise HTTPException(status_code=400, detail="Input text (prompt) is required for text_to_image task")
        
        if request.task in ["summarize", "translate", "extract", "sentiment", "generate", "qa"]:
            if not request.input:
                raise HTTPException(status_code=400, detail="Input text is required for text tasks")
        
        # Route to appropriate handler
        result = None
        model_used = None
        
        if request.task == "image_caption":
            processor = get_image_processor()
            result, model_used = await processor.caption_image(request.image, mode="short-note")
        
        elif request.task == "story":
            processor = get_image_processor()
            result, model_used = await processor.generate_story(request.image, request.sentence_count or 5)
        
        elif request.task == "image_prompt":
            processor = get_image_processor()
            result, model_used = await processor.generate_prompt(request.image)
        
        elif request.task == "text_to_image":
            processor = get_text_to_image_processor()
            result, model_used = await processor.generate_image(
                request.input,
                request.steps or 2,
                request.guidance_scale or 1.0
            )
        
        elif request.task == "summarize":
            processor = get_text_processor()
            result, model_used = await processor.summarize(request.input)
        
        elif request.task == "translate":
            processor = get_text_processor()
            result, model_used = await processor.translate(request.input, request.target_language or "es")
        
        elif request.task == "extract":
            processor = get_text_processor()
            result, model_used = await processor.extract(request.input)
        
        elif request.task == "sentiment":
            processor = get_text_processor()
            result, model_used = await processor.analyze_sentiment(request.input)
        
        elif request.task == "generate":
            processor = get_text_processor()
            result, model_used = await processor.generate(request.input)
        
        elif request.task == "qa":
            if not request.question:
                raise HTTPException(status_code=400, detail="Question is required for QA task")
            processor = get_text_processor()
            result, model_used = await processor.answer_question(request.question, request.context or request.input)
            
        elif request.task == "chat":
            if not request.input:
                raise HTTPException(status_code=400, detail="Input text is required for chat task")
            processor = get_text_processor()
            result, model_used = await processor.chat(request.input)
        
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown task: {request.task}"
            )
        
        processing_time = time.time() - start_time
        
        return ProcessResponse(
            success=True,
            output=result,
            model_used=model_used,
            processing_time=round(processing_time, 2)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing task {request.task}: {str(e)}", exc_info=True)
        processing_time = time.time() - start_time
        
        return ProcessResponse(
            success=False,
            error=str(e),
            processing_time=round(processing_time, 2)
        )


@app.post("/api/agent/execute", response_model=ProcessResponse)
async def execute_agent_tool(request: ProcessRequest):
    """
    Unified entry point for Multi-Agent Tools.
    Routes to /process logic.
    """
    return await process_task(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8501)
