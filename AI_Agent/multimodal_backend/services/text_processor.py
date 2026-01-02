"""
Text Processor Service
Handles text processing using FLAN-T5 (local model)
"""

import logging
from typing import Tuple
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

logger = logging.getLogger(__name__)


class TextProcessor:
    """
    Processes text using FLAN-T5 model (local CPU)
    """
    
    def __init__(self):
        """Initialize FLAN-T5 model (lazy loading)"""
        self.tokenizer = None
        self.model = None
        self._load_models()
    
    def _load_models(self):
        """Load FLAN-T5 models"""
        try:
            logger.info("Loading FLAN-T5 model...")
            
            self.tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
            self.model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base").to("cpu")
            
            logger.info("✅ FLAN-T5 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load FLAN-T5 model: {e}")
            raise
    
    async def generate(self, prompt: str, sentence_count: int = 5) -> Tuple[str, str]:
        """
        Generate text using FLAN-T5 (matching Streamlit story expansion)
        
        Args:
            prompt: Input prompt
            sentence_count: Number of sentences to generate
        
        Returns:
            (generated_text, model_name)
        """
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        # Tokenize (matching Streamlit)
        tokens = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to("cpu")
        
        # Generate (matching Streamlit parameters)
        story_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=sentence_count * 50,
            min_length=sentence_count * 20,
            num_beams=4,
            do_sample=True,
            temperature=0.9,
            top_p=0.95,
            top_k=50,
            repetition_penalty=2.5,
            no_repeat_ngram_size=3,
            early_stopping=True
        )
        
        story = self.tokenizer.decode(story_ids[0], skip_special_tokens=True)
        
        # Post-process to remove repetition (matching Streamlit)
        sentences = [s.strip() for s in story.split('.') if s.strip()] if story and story.strip() else []
        unique_sentences = []
        seen = set()
        for sent in sentences:
            sent_lower = sent.lower()[:50]
            if sent_lower not in seen and len(sent) > 10:
                unique_sentences.append(sent)
                seen.add(sent_lower)
        
        if len(unique_sentences) < sentence_count // 2:
            story = '. '.join(sentences[:sentence_count]) + '.' if sentences else story
        else:
            story = '. '.join(unique_sentences[:sentence_count]) + '.'
        
        return story, "google/flan-t5-base"
    
    async def summarize(self, text: str) -> Tuple[str, str]:
        """Summarize text using FLAN-T5"""
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        prompt = f"Summarize the following text:\n\n{text}"
        tokens = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cpu")
        
        summary_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=150,
            num_beams=4,
            do_sample=True,
            temperature=0.7
        )
        
        summary = self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary, "google/flan-t5-base"
    
    async def translate(self, text: str, target_language: str = "es") -> Tuple[str, str]:
        """Translate text using FLAN-T5"""
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        lang_names = {
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "it": "Italian",
            "pt": "Portuguese"
        }
        lang_name = lang_names.get(target_language, "Spanish")
        
        prompt = f"Translate the following text to {lang_name}:\n\n{text}"
        tokens = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cpu")
        
        translation_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=200,
            num_beams=4,
            do_sample=True,
            temperature=0.7
        )
        
        translation = self.tokenizer.decode(translation_ids[0], skip_special_tokens=True)
        return translation, "google/flan-t5-base"
    
    async def extract(self, text: str) -> Tuple[str, str]:
        """Extract key information using FLAN-T5"""
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        prompt = f"Extract the key information, entities, and main points from the following text:\n\n{text}"
        tokens = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cpu")
        
        extract_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=200,
            num_beams=4,
            do_sample=True,
            temperature=0.3
        )
        
        extracted = self.tokenizer.decode(extract_ids[0], skip_special_tokens=True)
        return extracted, "google/flan-t5-base"
    
    async def analyze_sentiment(self, text: str) -> Tuple[str, str]:
        """Analyze sentiment using FLAN-T5"""
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        prompt = f"Analyze the sentiment of the following text. Respond with only 'positive', 'negative', or 'neutral':\n\n{text}"
        tokens = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cpu")
        
        sentiment_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=10,
            num_beams=2,
            do_sample=False,
            temperature=0.1
        )
        
        sentiment = self.tokenizer.decode(sentiment_ids[0], skip_special_tokens=True)
        return sentiment, "google/flan-t5-base"
    
    async def answer_question(self, question: str, context: str) -> Tuple[str, str]:
        """Answer question using FLAN-T5"""
        if not self.tokenizer or not self.model:
            raise ValueError("FLAN-T5 model not loaded")
        
        prompt = f"Based on the following context, answer the question:\n\nContext: {context}\n\nQuestion: {question}\n\nAnswer:"
        tokens = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cpu")
        
        answer_ids = self.model.generate(
            tokens.input_ids,
            attention_mask=tokens.attention_mask,
            max_length=150,
            num_beams=4,
            do_sample=True,
            temperature=0.7
        )
        
        answer = self.tokenizer.decode(answer_ids[0], skip_special_tokens=True)
        return answer, "google/flan-t5-base"

