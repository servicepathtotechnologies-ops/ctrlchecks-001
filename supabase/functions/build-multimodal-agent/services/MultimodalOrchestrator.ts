import { IntentAnalyzer } from "./IntentAnalyzer.ts";
import { ModelSelector } from "./ModelSelector.ts";
import { PipelineBuilder } from "./PipelineBuilder.ts";
import { UITemplateGenerator } from "./UITemplateGenerator.ts";
import { ConfidenceLogger } from "./ConfidenceLogger.ts";

export class MultimodalOrchestrator {
  private intentAnalyzer: IntentAnalyzer;
  private modelSelector: ModelSelector;
  private pipelineBuilder: PipelineBuilder;
  private uiGenerator: UITemplateGenerator;
  private confidenceLogger: ConfidenceLogger;

  constructor() {
    this.intentAnalyzer = new IntentAnalyzer();
    this.modelSelector = new ModelSelector();
    this.pipelineBuilder = new PipelineBuilder();
    this.uiGenerator = new UITemplateGenerator();
    this.confidenceLogger = new ConfidenceLogger();
  }

  async buildAgent(userPrompt: string, files: any[] = []): Promise<any> {
    try {
      // PHASE 1: Analysis
      const intent = await this.intentAnalyzer.analyze(userPrompt, files);

      // PHASE 2: Model Selection
      const selectedModels = this.modelSelector.selectModels(intent);

      // PHASE 3: Pipeline Construction
      const pipeline = this.pipelineBuilder.buildPipeline(intent, selectedModels);

      // PHASE 4: UI Generation
      const uiTemplate = this.uiGenerator.generateTemplate(pipeline);

      // PHASE 5: Confidence Logs
      const confidenceLogs = this.confidenceLogger.generateLogSequence(pipeline);

      // PHASE 6: Prepare Execution Engine
      const executionEngine = {
        pipeline: pipeline,
        models: selectedModels,
        state: "ready",
        created_at: new Date().toISOString(),
      };

      return {
        success: true,
        intent: intent,
        pipeline: pipeline,
        ui_template: uiTemplate,
        logs: confidenceLogs,
        execution_engine: executionEngine,
        metadata: {
          agent_id: `agent_${Date.now()}`,
          estimated_completion: this.estimateCompletionTime(pipeline),
          model_count: selectedModels.length,
          complexity: intent.complexity,
        },
      };
    } catch (error) {
      console.error("Orchestrator error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        logs: [
          "✨ Analyzing your vision...",
          "🔄 Adjusting approach...",
          "❌ " + (error instanceof Error ? error.message : "Failed to build agent"),
        ],
      };
    }
  }

  private estimateCompletionTime(pipeline: any): number {
    return pipeline.estimated_time || 5;
  }
}

