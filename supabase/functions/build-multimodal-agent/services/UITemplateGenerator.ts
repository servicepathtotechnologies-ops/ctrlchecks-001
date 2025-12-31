export class UITemplateGenerator {
  generateTemplate(pipeline: any): any {
    const template = {
      layout: "vertical",
      sections: [] as any[],
    };

    // Input Section
    const inputStep = pipeline.steps.find((s: any) => s.type === "input");
    if (inputStep) {
      template.sections.push({
        type: "input_section",
        title: this.getInputTitle(inputStep.modality),
        components: this.generateInputComponents(inputStep),
      });
    }

    // Processing Controls
    template.sections.push({
      type: "control_section",
      components: [
        {
          type: "button",
          id: "process_button",
          label: "🚀 Process",
          variant: "primary",
          size: "large",
        },
        {
          type: "button",
          id: "settings_button",
          label: "⚙️ Options",
          variant: "secondary",
        },
      ],
    });

    // Output Section
    const outputStep = pipeline.steps.find((s: any) => s.type === "output");
    if (outputStep) {
      template.sections.push({
        type: "output_section",
        title: this.getOutputTitle(outputStep.modality),
        components: this.generateOutputComponents(outputStep),
      });
    }

    // Status Area
    template.sections.push({
      type: "status_section",
      components: [
        {
          type: "progress",
          id: "progress_bar",
          label: "Processing Status",
        },
        {
          type: "logs",
          id: "live_logs",
          max_lines: 10,
        },
      ],
    });

    return template;
  }

  private getInputTitle(modality: string): string {
    const titles: Record<string, string> = {
      text: "Enter Your Text",
      image: "Upload Image",
      audio: "Upload Audio",
      file: "Upload File",
      code: "Enter Code",
    };
    return titles[modality] || "Input";
  }

  private getOutputTitle(modality: string): string {
    const titles: Record<string, string> = {
      text: "Generated Text",
      image: "Generated Image",
      audio: "Generated Audio",
      file: "Generated File",
      code: "Generated Code",
    };
    return titles[modality] || "Output";
  }

  private generateInputComponents(inputStep: any): any[] {
    const components: any[] = [];

    if (inputStep.modality === "file") {
      components.push({
        type: "file_upload",
        accept: [".pdf", ".docx", ".txt", ".jpg", ".png", ".mp3", ".wav"],
        multiple: false,
        max_size: "10MB",
      });
    } else if (inputStep.modality === "text") {
      components.push({
        type: "textarea",
        placeholder: "Enter your text here...",
        rows: 5,
      });
    } else if (inputStep.modality === "image") {
      components.push({
        type: "image_upload",
        accept: [".jpg", ".jpeg", ".png", ".gif"],
      });
    } else if (inputStep.modality === "audio") {
      components.push({
        type: "audio_upload",
        accept: [".mp3", ".wav", ".m4a"],
      });
    } else if (inputStep.modality === "code") {
      components.push({
        type: "code_editor",
        placeholder: "Enter your code here...",
        language: "auto",
      });
    }

    return components;
  }

  private generateOutputComponents(outputStep: any): any[] {
    if (outputStep.modality === "text") {
      return [
        {
          type: "text_display",
          editable: true,
          copyable: true,
        },
      ];
    } else if (outputStep.modality === "image") {
      return [
        {
          type: "image_display",
          zoomable: true,
        },
      ];
    } else if (outputStep.modality === "audio") {
      return [
        {
          type: "audio_player",
          downloadable: true,
          format: "mp3",
        },
      ];
    } else if (outputStep.modality === "code") {
      return [
        {
          type: "code_editor",
          language: "auto",
          theme: "github-dark",
        },
      ];
    } else if (outputStep.modality === "file") {
      return [
        {
          type: "file_download",
          formats: ["pdf", "docx", "txt", "json"],
        },
      ];
    }

    return [
      {
        type: "text_display",
        editable: false,
      },
    ];
  }
}

