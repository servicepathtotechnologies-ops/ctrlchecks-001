"""
Text Processor Service
Handles text processing using Hugging Face Inference API
Models: Mistral-7B, BART, NLLB, RoBERTa
"""

import logging
from typing import Tuple, List, Dict, Any
from huggingface_hub import InferenceClient
import os
import time

logger = logging.getLogger(__name__)

# Configuration
HF_API_KEY = os.getenv("HF_API_KEY")

class TextProcessor:
    """
    Processes text using Hugging Face Inference API
    Matches the provided Streamlit logic exactly but adapted for an API backend.
    """
    
    def __init__(self):
        """Initialize Inference Clients"""
        self.chat_client = InferenceClient(
            model="mistralai/Mistral-7B-Instruct-v0.2",
            token=HF_API_KEY
        )
        
        self.qa_client = InferenceClient(
            model="deepset/roberta-base-squad2",
            token=HF_API_KEY
        )
        
        self.summarizer = InferenceClient(
            model="facebook/bart-large-cnn",
            token=HF_API_KEY
        )
        
        self.translator = InferenceClient(
            model="facebook/nllb-200-distilled-600M",
            token=HF_API_KEY
        )
        
        self.language_map = {
            "Hindi": "hin_Deva",
            "Tamil": "tam_Taml",
            "Telugu": "tel_Telu",
            "Kannada": "kan_Knda",
            "Malayalam": "mal_Mlym",
            "French": "fra_Latn",
            "German": "deu_Latn",
            "Spanish": "spa_Latn",
            # Add reverse mapping support or common codes
            "es": "spa_Latn",
            "fr": "fra_Latn",
            "de": "deu_Latn",
            "it": "ita_Latn", # NLLB code assumption, check map if needed
            "pt": "por_Latn"
        }

    def _chunk_text(self, text: str, max_chars: int = 800) -> List[str]:
        """
        Helper function to chunk text
        Matches user's implementation exactly
        """
        chunks = []
        current = ""

        for line in text.splitlines():
            line = line.strip()

            if not line or len(line) < 3:
                continue

            # Remove URLs & emails (NLLB hates them)
            if "http" in line or "www" in line or "@" in line:
                chunks.append(line)
                continue

            if len(current) + len(line) <= max_chars:
                current += line + " "
            else:
                chunks.append(current.strip())
                current = line + " "

        if current.strip():
            chunks.append(current.strip())

        return chunks

    async def chat(self, prompt: str) -> Tuple[str, str]:
        """Chat Bot Task"""
        try:
            response = self.chat_client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300
            )
            return response.choices[0].message.content, "mistralai/Mistral-7B-Instruct-v0.2"
        except Exception as e:
            logger.error(f"Chat error: {e}")
            raise

    async def generate(self, prompt: str, sentence_count: int = 5) -> Tuple[str, str]:
        """Describe Topic (used for Story/Generate)"""
        try:
            # If it's a story generation request (from image processor), the prompt might differ
            # But here we implement the 'Describe Topic' logic from user code
            response = self.chat_client.chat_completion(
                messages=[
                    {"role": "system", "content": "Explain topics clearly and simply."},
                    {"role": "user", "content": f"Explain this topic:\n{prompt}"}
                ],
                max_tokens=400
            )
            return response.choices[0].message.content, "mistralai/Mistral-7B-Instruct-v0.2"
        except Exception as e:
            logger.error(f"Generate/Describe error: {e}")
            raise

    async def answer_question(self, question: str, context: str) -> Tuple[str, str]:
        """Document Q&A"""
        try:
            result = self.qa_client.question_answering(
                question=question,
                context=context
            )
            # Result is dict {'score':.., 'start':.., 'end':.., 'answer':..}
            return result["answer"], "deepset/roberta-base-squad2"
        except Exception as e:
            logger.error(f"QA error: {e}")
            raise

    async def summarize(self, text: str) -> Tuple[str, str]:
        """Summarize Large Text"""
        try:
            chunks = self._chunk_text(text)
            if not chunks:
                return "No valid text found to summarize.", "facebook/bart-large-cnn"
            
            summaries = []
            
            for chunk in chunks:
                try:
                    result = self.summarizer.summarization(chunk)
                    # Handle varying response formats
                    if isinstance(result, list) and len(result) > 0:
                        if isinstance(result[0], dict) and "summary_text" in result[0]:
                            summaries.append(result[0]["summary_text"])
                        elif isinstance(result[0], str):
                            summaries.append(result[0])
                    elif isinstance(result, dict) and "summary_text" in result:
                        summaries.append(result["summary_text"])
                except Exception as e:
                    logger.warning(f"Chunk summary failed: {e}")
                    continue
            
            if not summaries:
                raise ValueError("Summarization failed for all chunks.")
            
            final_summary = "\n\n".join(summaries)
            
            # Optional two-stage summary (logic from user code)
            if len(summaries) > 3:
                try:
                    combined = " ".join(summaries)
                    if len(combined) > 2000:
                        combined = combined[:2000] + "..."
                    
                    final_result = self.summarizer.summarization(combined)
                    if final_result and isinstance(final_result, list) and len(final_result) > 0:
                         final_summary = final_result[0].get("summary_text", final_result[0])
                except Exception:
                    pass

            return final_summary, "facebook/bart-large-cnn"

        except Exception as e:
            logger.error(f"Summarization error: {e}")
            raise

    async def translate(self, text: str, target_language: str = "es") -> Tuple[str, str]:
        """Translate Text"""
        try:
            # Map standard codes to NLLB codes if needed, or use name map
            # User provided map:
            # "Hindi": "hin_Deva", etc.
            # But the input `target_language` might be "es", "fr" from frontend
            # We need to map "es" -> "spa_Latn"
            
            target_lang_code = self.language_map.get(target_language)
            # If not found, try to find by key (e.g. if user passed "Spanish")
            if not target_lang_code:
                 # Fallback/Default
                 target_lang_code = "spa_Latn" 

            chunks = self._chunk_text(text)
            if not chunks:
                 return "Nothing to translate.", "facebook/nllb-200-distilled-600M"

            translated_chunks = []

            for chunk in chunks:
                try:
                    # Primary: NLLB
                    result = self.translator.translation(
                        chunk,
                        src_lang="eng_Latn",
                        tgt_lang=target_lang_code
                    )
                    
                    if (isinstance(result, list) and len(result) > 0 
                        and "translation_text" in result[0] 
                        and result[0]["translation_text"].strip()
                        and result[0]["translation_text"] != chunk):
                        translated_chunks.append(result[0]["translation_text"])
                    else:
                        raise ValueError("NLLB empty/same result")
                        
                except Exception as e:
                    # Fallback: Mistral
                    try:
                        fallback_resp = self.chat_client.chat_completion(
                            messages=[
                                {"role": "system", "content": f"You are a professional translator. Translate the following English text to {target_language}. Only provide the translation, no extra text."},
                                {"role": "user", "content": chunk}
                            ],
                            max_tokens=600
                        )
                        translated_chunks.append(fallback_resp.choices[0].message.content)
                    except Exception as e2:
                        translated_chunks.append(f"[Translation Failed: {chunk}]")

            return "\n\n".join(translated_chunks), "facebook/nllb-200-distilled-600M"

        except Exception as e:
            logger.error(f"Translation error: {e}")
            raise

    async def extract(self, text: str) -> Tuple[str, str]:
        """Extract information (using Mistral as generic extraction tool)"""
        try:
            response = self.chat_client.chat_completion(
                messages=[
                    {"role": "system", "content": "Extract key information, entities, and main points."},
                    {"role": "user", "content": text}
                ],
                max_tokens=500
            )
            return response.choices[0].message.content, "mistralai/Mistral-7B-Instruct-v0.2"
        except Exception as e:
            logger.error(f"Extraction error: {e}")
            raise

    async def analyze_sentiment(self, text: str) -> Tuple[str, str]:
        """Analyze Sentiment (using Mistral)"""
        try:
            # Use chunks if text is long, but sentiment is usually whole-text. 
            # We'll truncate to fit if needed or use the first chunk.
            chunk = self._chunk_text(text, max_chars=1000)[0]
            
            response = self.chat_client.chat_completion(
                messages=[
                    {"role": "system", "content": "Analyze the sentiment. Respond with 'positive', 'negative', or 'neutral' and a brief reason."},
                    {"role": "user", "content": chunk}
                ],
                max_tokens=100
            )
            return response.choices[0].message.content, "mistralai/Mistral-7B-Instruct-v0.2"
        except Exception as e:
            logger.error(f"Sentiment error: {e}")
            raise
