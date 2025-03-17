from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import os
import json
from dotenv import load_dotenv
import logging
import traceback
from groq import Groq
from constants import SUMMARIZE_MODEL, MCQ_GENERATING_MODEL

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="MCQ Generator API", description="API for generating multiple-choice questions from webpage content")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ideally, this should be restricted to your extension ID in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ContentRequest(BaseModel):
    content: str = Field(..., description="The webpage content to generate MCQs from")

class Option(BaseModel):
    A: str
    B: str
    C: str
    D: str

class Question(BaseModel):
    question: str
    options: Option
    answer: str
    related_sentence: str

class MCQResponse(BaseModel):
    questions: List[Question]

class ErrorResponse(BaseModel):
    error: str

# Endpoints
@app.get("/")
async def root():
    return {"message": "MCQ Generator API is running"}

@app.post("/generate-mcqs", response_model=MCQResponse)
async def generate_mcqs(request: ContentRequest):
    content = request.content
    
    # Validate content
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    
    if len(content) > 10000:
        # Truncate or raise an exception based on your requirements
        content = content[:10000]
    
    try:
        logger.info("Starting MCQ generation process")
        # Step 1: Summarize the content
        logger.info("Calling Groq API for content summarization")
        summary = await call_groq_api_summarize(content)
        logger.info(f"Received summary from Groq API: {summary[:100]}...")
        
        # Step 2: Generate MCQs from the summary
        logger.info("Calling Groq API for generating MCQs")
        mcqs = await call_groq_api_generate_questions(summary)
        logger.info(f"Received {len(mcqs)} MCQs from Groq API")
        
        return {"questions": mcqs}
    
    except Exception as e:
        logger.error(f"Error in generate_mcqs: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating MCQs: {str(e)}")

async def call_groq_api_summarize(content: str) -> str:
    """Call Groq API to summarize the content and extract key sentences."""
    
    summarization_prompt = """
    Task: Information Extraction for Question Generation
    As a highly skilled AI, your expertise lies in meticulously analyzing text to identify and extract pivotal sentences. Your task involves the following steps:
    1. Read the provided text thoroughly.
    2. Identify and extract the most crucial sentences. These sentences should encapsulate the core facts, findings, or themes that are fundamental to the text's overall meaning.
    3. Focus on clarity and conciseness. The extracted sentences should be self-contained and comprehensive, enabling the straightforward formulation of questions.
    4. Ensure accuracy and relevance. The sentences selected should accurately represent the text's main ideas and be directly related to its central discussion.
    5. Present the extracted sentences in a clear, organized manner, suitable for subsequent question development.
    Your role is crucial in distilling the essence of the text into concise, informative segments that can serve as the basis for meaningful and relevant questions.
    
    TEXT TO ANALYZE:
    {content}
    """
    
    try:
        logger.info("Sending request to Groq API for summarization")
        
        completion = groq_client.chat.completions.create(
            model=SUMMARIZE_MODEL,
            messages=[
                {"role": "user", "content": summarization_prompt.format(content=content)}
            ],
            temperature=0.6,
            max_completion_tokens=32000,
            top_p=0.95,
            stream=False,
        )
        
        summary = completion.choices[0].message.content
        logger.info(f"Successfully received summary from Groq API")
        return summary
    except Exception as e:
        logger.error(f"Error in call_groq_api_summarize: {str(e)}")
        logger.error(traceback.format_exc())
        raise

async def call_groq_api_generate_questions(summary: str) -> List[Question]:
    """Call Groq API to generate MCQs from the summary."""
    
    # First we'll try with a simpler prompt that asks for fewer questions
    questions_prompt = """Create 2 multiple choice questions based on this text:

"{summary}"

Format your response as a JSON array of question objects. Each question object should have these fields:
- question: the question text
- options: an object with keys A, B, C, D and their option text values
- answer: the letter of the correct option (A, B, C, or D)
- related_sentence: the sentence from the original text that the question is based on

IMPORTANT: Your entire response must be a valid JSON array that can be parsed by json.loads().
"""
    
    try:
        logger.info("Sending request to Groq API for MCQ generation")
        
        completion = groq_client.chat.completions.create(
            model=MCQ_GENERATING_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates multiple choice questions in perfect JSON format."},
                {"role": "user", "content": questions_prompt.format(summary=summary)}
            ],
            temperature=0.6,
            max_completion_tokens=32000,
            top_p=0.95,
            stream=False,
            response_format={"type": "json_object"},
        )
        
        mcq_json = completion.choices[0].message.content
        logger.info(f"Successfully received MCQs from Groq API: {mcq_json[:100]}...")
        
        # Parse the JSON response
        try:
            # Try to parse the JSON directly
            mcq_data = json.loads(mcq_json)
            
            # Check if the result is a list or a dict with a questions key
            if isinstance(mcq_data, list):
                logger.info("Received a JSON array of questions")
                return mcq_data
            elif isinstance(mcq_data, dict) and "questions" in mcq_data:
                logger.info("Received a JSON object with a 'questions' field")
                return mcq_data["questions"]
            else:
                # If we got a different format than expected, log it and handle accordingly
                logger.info(f"Received unexpected JSON format: {mcq_data.keys() if isinstance(mcq_data, dict) else type(mcq_data)}")
                
                # If there's a single question object instead of an array, wrap it
                if isinstance(mcq_data, dict) and "question" in mcq_data and "options" in mcq_data:
                    logger.info("Received a single question object, wrapping it in an array")
                    return [mcq_data]
                    
                # Fallback: try to extract any question-like structure
                questions = []
                if isinstance(mcq_data, dict):
                    for key, value in mcq_data.items():
                        if isinstance(value, dict) and "question" in value and "options" in value:
                            questions.append(value)
                
                if questions:
                    logger.info(f"Extracted {len(questions)} questions from unexpected format")
                    return questions
                    
                # Last resort: return empty list
                logger.warning("Could not extract any valid questions from the response")
                return []
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse MCQ response: {str(e)}")
            logger.error(f"Raw response: {mcq_json}")
            
            # As a fallback, let's try to clean up the JSON manually
            try:
                # Look for anything that might be a JSON array
                import re
                json_array_match = re.search(r'\[\s*{.+}\s*\]', mcq_json, re.DOTALL)
                if json_array_match:
                    fixed_json = json_array_match.group(0)
                    logger.info(f"Attempting to parse extracted JSON array: {fixed_json[:100]}...")
                    questions = json.loads(fixed_json)
                    if isinstance(questions, list):
                        return questions
            except:
                pass
                
            raise HTTPException(status_code=500, detail="Failed to parse MCQ response")
    except Exception as e:
        logger.error(f"Error in call_groq_api_generate_questions: {str(e)}")
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting MCQ Generator API server")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True) 