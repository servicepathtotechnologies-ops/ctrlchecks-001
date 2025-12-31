export class PipelineBuilder {
  buildPipeline(intent: any, selectedModels: any[]): any {
    const pipeline = {
      id: `pipeline_${Date.now()}`,
      name: intent.goal,
      steps: [] as any[],
      ui_schema: {},
      estimated_time: 0,
    };

    // STEP 1: Input handling
    const inputModality = Array.isArray(intent.input_modality)
      ? intent.input_modality[0]
      : intent.input_modality || "text";

    pipeline.steps.push({
      id: "input_handler",
      type: "input",
      modality: inputModality,
      handler: this.getInputHandler(inputModality),
      ui_component: this.getUIComponentForInput(inputModality),
    });

    // STEP 2: Processing steps
    const processingSteps = Array.isArray(intent.processing_steps)
      ? intent.processing_steps
      : ["process"];

    processingSteps.forEach((step: string, index: number) => {
      const model = selectedModels.find((m) =>
        m.capabilities?.some((cap: string) =>
          step.toLowerCase().includes(cap.toLowerCase())
        )
      ) || selectedModels[0];

      if (model) {
        pipeline.steps.push({
          id: `process_${index}`,
          type: "transformation",
          description: step,
          model: model,
          processor: this.getProcessorForModel(model),
          estimated_duration: this.estimateDuration(model, intent),
        });
      }
    });

    // STEP 3: Output handling
    const outputModality = Array.isArray(intent.output_modality)
      ? intent.output_modality[0]
      : intent.output_modality || "text";

    pipeline.steps.push({
      id: "output_handler",
      type: "output",
      modality: outputModality,
      formatter: this.getOutputFormatter(outputModality),
      ui_component: this.getUIComponentForOutput(outputModality),
    });

    // Generate UI schema
    pipeline.ui_schema = this.generateUISchema(pipeline.steps);

    // Estimate time
    pipeline.estimated_time = pipeline.steps.reduce(
      (sum, step) => sum + (step.estimated_duration || 5),
      0
    );

    return pipeline;
  }

  private getInputHandler(modality: string): string {
    const handlers: Record<string, string> = {
      text: "text_input",
      image: "image_upload",
      audio: "audio_upload",
      file: "file_upload",
      code: "code_input",
    };
    return handlers[modality] || "text_input";
  }

  private getUIComponentForInput(modality: string): string {
    const components: Record<string, string> = {
      text: "textarea",
      image: "image_upload",
      audio: "audio_upload",
      file: "file_upload",
      code: "code_editor",
    };
    return components[modality] || "textarea";
  }

  private getProcessorForModel(model: any): string {
    if (model.provider === "huggingface") {
      return "huggingface_processor";
    } else if (model.provider === "groq") {
      return "groq_processor";
    } else if (model.provider === "replicate") {
      return "replicate_processor";
    }
    return "default_processor";
  }

  private estimateDuration(model: any, intent: any): number {
    // Rough estimates in seconds
    if (model.provider === "groq") {
      return 2; // Very fast
    } else if (model.provider === "huggingface") {
      return intent.complexity === "high" ? 15 : 8;
    } else if (model.provider === "replicate") {
      return 20; // Image generation takes longer
    }
    return 10;
  }

  private getOutputFormatter(modality: string): string {
    const formatters: Record<string, string> = {
      text: "text_formatter",
      image: "image_formatter",
      audio: "audio_formatter",
      file: "file_formatter",
      code: "code_formatter",
    };
    return formatters[modality] || "text_formatter";
  }

  private getUIComponentForOutput(modality: string): string {
    const components: Record<string, string> = {
      text: "text_display",
      image: "image_display",
      audio: "audio_player",
      file: "file_download",
      code: "code_editor",
    };
    return components[modality] || "text_display";
  }

  private generateUISchema(steps: any[]): any {
    const inputStep = steps.find((s) => s.type === "input");
    const outputStep = steps.find((s) => s.type === "output");

    return {
      input: {
        type: inputStep?.modality || "text",
        component: inputStep?.ui_component || "textarea",
      },
      output: {
        type: outputStep?.modality || "text",
        component: outputStep?.ui_component || "text_display",
      },
    };
  }
}

