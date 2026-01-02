import streamlit as st
from PIL import Image
import torch
from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
    AutoTokenizer,
    AutoModelForSeq2SeqLM
)

# --------------------------------------------------
# Page Config
# --------------------------------------------------
st.set_page_config(page_title="Image to Text AI Studio", layout="centered")
st.title("🖼️ Image to Text AI Studio (CPU)")
st.caption("Short Note • Story • Image Prompt | Intel UHD Optimized")

# --------------------------------------------------
# Load Models (Cached)
# --------------------------------------------------
@st.cache_resource
def load_models():
    # Vision model (Fast)
    blip_processor = BlipProcessor.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    )
    blip_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    ).to("cpu")

    # Text model for story expansion
    story_tokenizer = AutoTokenizer.from_pretrained(
        "google/flan-t5-base"
    )
    story_model = AutoModelForSeq2SeqLM.from_pretrained(
        "google/flan-t5-base"
    ).to("cpu")

    return blip_processor, blip_model, story_tokenizer, story_model

blip_processor, blip_model, story_tokenizer, story_model = load_models()

# --------------------------------------------------
# UI Inputs
# --------------------------------------------------
uploaded_file = st.file_uploader(
    "Upload an image", type=["jpg", "jpeg", "png"]
)

sentence_count = st.slider(
    "Number of sentences (Story & Prompt)",
    min_value=2,
    max_value=10,
    value=5
)

# --------------------------------------------------
# Main Logic
# --------------------------------------------------
if uploaded_file:
    image = Image.open(uploaded_file).convert("RGB")
    st.image(image, caption="Uploaded Image", use_container_width=True)

    col1, col2, col3 = st.columns(3)

    # --------------------------------------------------
    # 1️⃣ Short Note (ONE sentence)
    # --------------------------------------------------
    with col1:
        if st.button("📝 Short Note"):
            with st.spinner("Generating short note..."):
                inputs = blip_processor(image, return_tensors="pt").to("cpu")
                output = blip_model.generate(
                    **inputs,
                    max_length=30,
                    num_beams=3,
                    do_sample=True,
                    temperature=0.7,
                    repetition_penalty=1.5,
                    no_repeat_ngram_size=2
                )
                short_note = blip_processor.decode(
                    output[0], skip_special_tokens=True
                )
                st.subheader("Short Note")
                st.write(short_note)

    # --------------------------------------------------
    # 2️⃣ Story Description (LONG)
    # --------------------------------------------------
    with col2:
        if st.button("📖 Story Description"):
            with st.spinner("Creating story..."):
                # Step 1: Image → Caption
                inputs = blip_processor(image, return_tensors="pt").to("cpu")
                output = blip_model.generate(
                    **inputs,
                    max_length=50,
                    num_beams=5,
                    do_sample=True,
                    temperature=0.8
                )
                base_caption = blip_processor.decode(
                    output[0], skip_special_tokens=True
                )

                # Step 2: Caption → Story (using FLAN-T5 with better prompt)
                # FLAN-T5 works better with instruction-style prompts
                prompt = (
                    f"Write a creative and detailed description of this scene: {base_caption}. "
                    f"Describe what you see, the mood, colors, and atmosphere. "
                    f"Use exactly {sentence_count} different sentences. "
                    f"Each sentence should describe a different aspect of the scene."
                )

                tokens = story_tokenizer(
                    prompt,
                    return_tensors="pt",
                    truncation=True,
                    max_length=512
                ).to("cpu")

                story_ids = story_model.generate(
                    tokens.input_ids,
                    attention_mask=tokens.attention_mask,
                    max_length=sentence_count * 50,
                    min_length=sentence_count * 20,
                    num_beams=4,
                    do_sample=True,
                    temperature=0.9,
                    top_p=0.95,
                    top_k=50,
                    repetition_penalty=2.5,  # Increased to prevent repetition
                    no_repeat_ngram_size=3,  # Prevent 3-gram repetition
                    early_stopping=True
                )

                story = story_tokenizer.decode(
                    story_ids[0], skip_special_tokens=True
                )
                
                # Post-process to remove any remaining repetition
                # Split by sentences and remove duplicates
                sentences = [s.strip() for s in story.split('.') if s.strip()]
                unique_sentences = []
                seen = set()
                for sent in sentences:
                    # Normalize and check for similarity
                    sent_lower = sent.lower()[:50]  # Check first 50 chars
                    if sent_lower not in seen and len(sent) > 10:
                        unique_sentences.append(sent)
                        seen.add(sent_lower)
                
                # If we removed too many, keep original but limit length
                if len(unique_sentences) < sentence_count // 2:
                    # Fallback: just limit the original text
                    story = '. '.join(sentences[:sentence_count]) + '.'
                else:
                    story = '. '.join(unique_sentences[:sentence_count]) + '.'

                st.subheader("Story Description")
                st.write(story)

    # --------------------------------------------------
    # 3️⃣ Image → Prompt
    # --------------------------------------------------
    with col3:
        if st.button("🎨 Image to Prompt"):
            with st.spinner("Generating prompt..."):
                inputs = blip_processor(image, return_tensors="pt").to("cpu")
                output = blip_model.generate(
                    **inputs,
                    max_length=sentence_count * 25,
                    num_beams=5,
                    do_sample=True,
                    temperature=0.7
                )
                base_prompt = blip_processor.decode(
                    output[0], skip_special_tokens=True
                )

                final_prompt = (
                    f"{base_prompt}, ultra realistic, cinematic lighting, "
                    f"high detail, sharp focus, 4k, professional photography"
                )

                st.subheader("Stable Diffusion Prompt")
                st.code(final_prompt)
