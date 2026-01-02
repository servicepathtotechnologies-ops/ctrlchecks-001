import streamlit as st
import torch
from diffusers import StableDiffusionPipeline
import os

st.set_page_config(page_title="Fast Text to Image", layout="centered")
st.title("⚡ Fast Text to Image (CPU)")

@st.cache_resource
def load_model():
    pipe = StableDiffusionPipeline.from_pretrained(
        "stabilityai/sd-turbo",
        torch_dtype=torch.float32,
        safety_checker=None,
        token=os.getenv("HUGGING_FACE_TOKEN")
    )
    pipe = pipe.to("cpu")
    pipe.enable_attention_slicing()
    return pipe

pipe = load_model()

prompt = st.text_area("Prompt", "A cyberpunk city at night", height=100)

steps = st.slider("Steps (1 = fastest)", 1, 4, 2)
guidance = st.slider("Guidance Scale", 0.0, 1.5, 1.0)

if st.button("Generate 🚀"):
    with st.spinner("Generating..."):
        image = pipe(
            prompt,
            num_inference_steps=steps,
            guidance_scale=guidance
        ).images[0]

        st.image(image, use_container_width=True)
