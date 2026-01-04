import streamlit as st
from huggingface_hub import InferenceClient
import sys
import os

# File processing libraries
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None
    st.warning("⚠️ Install pypdf for PDF support: pip install pypdf")

try:
    from docx import Document
except ImportError:
    Document = None
    st.warning("⚠️ Install python-docx for DOCX support: pip install python-docx")

# Clear Streamlit cache if needed
if hasattr(st, 'cache_data'):
    st.cache_data.clear()
if hasattr(st, 'cache_resource'):
    st.cache_resource.clear()

# ---------------- CONFIG ----------------
st.set_page_config("Advanced Text AI", layout="wide")
st.title("🧠 Advanced Text Processing AI")
st.caption("Chat • Describe • Q&A • Summarize • Translate")

HF_API_KEY = os.getenv("HF_API_KEY") or "your_huggingface_api_key_here"

# ---------------- HELPER FUNCTIONS ----------------
def chunk_text(text, max_chars=800):
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

# ---------------- CLIENTS ----------------
# Chat/Describe models - use chat_completion()
chat_client = InferenceClient(
    model="mistralai/Mistral-7B-Instruct-v0.2",  # Conversational model - use chat_completion()
    token=HF_API_KEY
)

qa_client = InferenceClient(
    model="deepset/roberta-base-squad2",
    token=HF_API_KEY
)

summarizer = InferenceClient(
    model="facebook/bart-large-cnn",
    token=HF_API_KEY
)

translator = InferenceClient(
    model="facebook/nllb-200-distilled-600M",
    token=HF_API_KEY
)

language_map = {
    "Hindi": "hin_Deva",
    "Tamil": "tam_Taml",
    "Telugu": "tel_Telu",
    "Kannada": "kan_Knda",
    "Malayalam": "mal_Mlym",
    "French": "fra_Latn",
    "German": "deu_Latn",
    "Spanish": "spa_Latn"
}

# ---------------- UI ----------------
# File uploader
uploaded_file = st.file_uploader(
    "Upload a file (TXT, PDF, DOCX)",
    type=["txt", "pdf", "docx"]
)

file_text = ""

if uploaded_file:
    try:
        if uploaded_file.type == "text/plain":
            file_text = uploaded_file.read().decode("utf-8")
        elif uploaded_file.type == "application/pdf":
            if PdfReader is None:
                st.error("⚠️ PDF support requires: pip install pypdf")
            else:
                reader = PdfReader(uploaded_file)
                file_text = "\n".join([page.extract_text() for page in reader.pages])
        elif uploaded_file.type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            if Document is None:
                st.error("⚠️ DOCX support requires: pip install python-docx")
            else:
                doc = Document(uploaded_file)
                file_text = "\n".join([para.text for para in doc.paragraphs])
        
        if file_text:
            st.success(f"✅ File loaded: {uploaded_file.name} ({len(file_text)} characters)")
    except Exception as e:
        st.error(f"Error reading file: {str(e)}")

text = st.text_area(
    "Enter text / document",
    value=file_text,
    height=250
)

task = st.selectbox(
    "Select Task",
    [
        "Chat Bot",
        "Describe Topic",
        "Document Q&A",
        "Summarize Large Text",
        "Translate Text"
    ]
)

if task == "Translate Text":
    target_lang = st.selectbox(
        "Select Target Language",
        list(language_map.keys())
    )

if task == "Document Q&A":
    question = st.text_input("Ask a question from the document")

# ---------------- RUN ----------------
if st.button("🚀 Run"):

    if not text.strip():
        st.warning("Please enter text")
        st.stop()

    with st.spinner("Processing..."):

        # 1️⃣ CHAT BOT
        if task == "Chat Bot":
            try:
                response = chat_client.chat_completion(
                    messages=[
                        {"role": "system", "content": "You are a helpful AI assistant."},
                        {"role": "user", "content": text}
                    ],
                    max_tokens=300
                )
                st.subheader("Chat Response")
                st.write(response.choices[0].message.content)
            except Exception as e:
                st.error(f"Error: {str(e)}")
                st.info("Make sure you're using a conversational model with chat_completion()")

        # 2️⃣ DESCRIBE TOPIC
        elif task == "Describe Topic":
            try:
                response = chat_client.chat_completion(
                    messages=[
                        {"role": "system", "content": "Explain topics clearly and simply."},
                        {"role": "user", "content": f"Explain this topic:\n{text}"}
                    ],
                    max_tokens=400
                )
                st.subheader("Description")
                st.write(response.choices[0].message.content)
            except Exception as e:
                st.error(f"Error: {str(e)}")
                st.info("Make sure you're using a conversational model with chat_completion()")

        # 3️⃣ DOCUMENT Q&A
        elif task == "Document Q&A":
            if not question.strip():
                st.warning("Enter a question")
                st.stop()

            result = qa_client.question_answering(
                question=question,
                context=text
            )
            st.subheader("Answer")
            st.write(result["answer"])

        # 4️⃣ SUMMARIZATION
        elif task == "Summarize Large Text":
            try:
                # Chunk text for large documents (BART has ~1024 token limit)
                chunks = chunk_text(text)
                
                if not chunks:
                    st.error("No valid text found to summarize.")
                    st.stop()
                
                summaries = []
                progress_bar = st.progress(0)
                
                # Summarize each chunk (silently, no status messages)
                for i, chunk in enumerate(chunks):
                    try:
                        result = summarizer.summarization(chunk)
                        
                        # Safety check (VERY IMPORTANT - prevents index out of range)
                        if result and isinstance(result, list) and len(result) > 0:
                            if isinstance(result[0], dict) and "summary_text" in result[0]:
                                summaries.append(result[0]["summary_text"])
                            elif isinstance(result[0], str):
                                summaries.append(result[0])
                        elif isinstance(result, dict) and "summary_text" in result:
                            summaries.append(result["summary_text"])
                    except Exception:
                        # Silently skip failed chunks
                        continue
                    
                    progress_bar.progress((i + 1) / len(chunks))
                
                progress_bar.empty()
                
                if not summaries:
                    st.error("Summarization failed for all chunks. The text might be too large or invalid.")
                    st.stop()
                
                # Combine summaries
                final_summary = "\n\n".join(summaries)
                
                # Optional: Two-stage summary for very long documents (compress final summary)
                if len(summaries) > 3:
                    try:
                        combined = " ".join(summaries)
                        # Limit combined text to avoid token limit
                        if len(combined) > 2000:
                            combined = combined[:2000] + "..."
                        final_result = summarizer.summarization(combined)
                        if final_result and isinstance(final_result, list) and len(final_result) > 0:
                            if isinstance(final_result[0], dict) and "summary_text" in final_result[0]:
                                final_summary = final_result[0]["summary_text"]
                            elif isinstance(final_result[0], str):
                                final_summary = final_result[0]
                    except:
                        # If compression fails, use the merged summary
                        pass
                
                st.subheader("Summary")
                st.write(final_summary)
                
            except Exception as e:
                st.error(f"Summarization failed: {str(e)}")
                st.info("Large documents require chunked summarization (now enabled).")

        # 5️⃣ TRANSLATION
        elif task == "Translate Text":
            try:
                chunks = chunk_text(text)

                if not chunks:
                    st.error("Nothing to translate.")
                    st.stop()

                translated_chunks = []
                progress = st.progress(0)

                for i, chunk in enumerate(chunks):
                    try:
                        # Primary: NLLB translation API
                        result = translator.translation(
                            chunk,
                            src_lang="eng_Latn",
                            tgt_lang=language_map[target_lang]
                        )

                        if (
                            isinstance(result, list)
                            and len(result) > 0
                            and "translation_text" in result[0]
                            and result[0]["translation_text"].strip()
                            and result[0]["translation_text"] != chunk # Check if it actually translated
                        ):
                            translated_chunks.append(result[0]["translation_text"])
                        else:
                            # FALLBACK: Use Mistral (chat_client) for translation if NLLB is flaky or returns same text
                            fallback_resp = chat_client.chat_completion(
                                messages=[
                                    {"role": "system", "content": f"You are a professional translator. Translate the following English text to {target_lang}. Only provide the translation, no extra text."},
                                    {"role": "user", "content": chunk}
                                ],
                                max_tokens=600
                            )
                            translated_chunks.append(fallback_resp.choices[0].message.content)

                    except Exception as e:
                        # Final Fallback: use Mistral if NLLB is down/erroring
                        try:
                            fallback_resp = chat_client.chat_completion(
                                messages=[
                                    {"role": "system", "content": f"Translate to {target_lang}:"},
                                    {"role": "user", "content": chunk}
                                ],
                                max_tokens=600
                            )
                            translated_chunks.append(fallback_resp.choices[0].message.content)
                        except:
                            translated_chunks.append(f"[Translation Failed: {chunk}]")

                    progress.progress((i + 1) / len(chunks))

                final_translation = "\n\n".join(translated_chunks)

                st.subheader("Translated Text")
                st.write(final_translation)

            except Exception as e:
                st.error(f"Translation failed unexpectedly: {str(e)}")
