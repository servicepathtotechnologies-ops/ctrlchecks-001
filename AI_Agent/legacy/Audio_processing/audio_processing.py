import streamlit as st
import soundfile as sf
import tempfile
import librosa
import numpy as np
from transformers import pipeline

st.set_page_config(page_title="Audio Processing", layout="centered")
st.title("🎧 Audio Processing – Intel i7 (CPU Only)")

# ---------------- LOAD MODELS ----------------
@st.cache_resource
def load_asr():
    return pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-tiny",
        device=-1
    )

@st.cache_resource
def load_tts():
    return pipeline(
        "text-to-speech",
        model="facebook/mms-tts-eng",
        device=-1
    )

asr = load_asr()
tts = load_tts()

tab1, tab2 = st.tabs(["🎙 Audio → Text", "📝 Text → Audio"])

# ---------------- AUDIO → TEXT ----------------
with tab1:
    audio_file = st.file_uploader(
        "Upload audio",
        type=["wav", "mp3", "m4a"]
    )

    if audio_file:
        st.audio(audio_file)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(audio_file.read())
            path = tmp.name

        if st.button("Transcribe"):
            audio, sr = sf.read(path)
            result = asr({"array": audio, "sampling_rate": sr})
            st.text_area("Transcription", result["text"], height=120)

# ---------------- TEXT → AUDIO ----------------
with tab2:
    st.subheader("Voice Controls")

    text = st.text_area("Enter text")

    speed = st.slider("Speed", 0.8, 1.3, 1.0, 0.05)
    pitch = st.slider("Pitch (semitones)", -3, 3, 0)
    volume = st.slider("Volume", 0.8, 1.5, 1.0, 0.1)

    if st.button("Generate Speech"):
        if not text.strip():
            st.warning("Enter text")
        else:
            out = tts(text)
            audio = out["audio"]
            sr = out["sampling_rate"]

            # Speed
            if speed != 1.0:
                audio = librosa.effects.time_stretch(audio, rate=speed)

            # Pitch
            if pitch != 0:
                audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=pitch)

            # Volume
            audio = np.clip(audio * volume, -1.0, 1.0)

            st.audio(audio, sample_rate=sr)

