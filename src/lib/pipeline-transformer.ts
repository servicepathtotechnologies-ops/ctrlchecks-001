/**
 * Pipeline Transformer
 * 
 * Transforms backend pipeline data into frontend format
 */

import { PipelineStep, StepStatus } from '@/components/multimodal/PipelineBuilderView';
import { TOOLS_REGISTRY, getCapabilityByTask } from './tools-registry';

/**
 * Transform backend pipeline steps to frontend PipelineStep format
 */
export function transformPipelineSteps(
  backendPipeline: any,
  selectedModels: any[],
  stepStatuses: Record<string, StepStatus> = {}
): PipelineStep[] {
  if (!backendPipeline?.steps) return [];

  const steps: PipelineStep[] = [];
  let stepNumber = 1;

  backendPipeline.steps.forEach((backendStep: any, index: number) => {
    const stepId = backendStep.id || `step_${index}`;
    const status = stepStatuses[stepId] || 'pending';

    // Find corresponding tool and model
    let toolId: string | undefined;
    let toolName: string | undefined;
    let task: string | undefined;
    let modelName: string | undefined;
    let modelProvider: string | undefined;

    // For transformation steps, try to match with tools
    if (backendStep.type === 'transformation') {
      // Try to infer task from description
      const description = backendStep.description?.toLowerCase() || '';
      const capability = getCapabilityByTask(description);
      
      if (capability) {
        toolId = capability.tool.id;
        toolName = capability.tool.name;
        task = capability.capability.task;
        modelName = backendStep.model?.name || capability.capability.model;
        modelProvider = backendStep.model?.provider || 'huggingface';
      } else if (backendStep.model) {
        modelName = backendStep.model.name;
        modelProvider = backendStep.model.provider;
      }
    }

    const step: PipelineStep = {
      id: stepId,
      stepNumber: stepNumber++,
      type: backendStep.type || 'transformation',
      description: backendStep.description || backendStep.modality || 'Processing step',
      toolId,
      toolName,
      task,
      modelName,
      modelProvider,
      inputSchema: backendStep.inputSchema || {},
      outputSchema: backendStep.outputSchema || {},
      status,
      error: backendStep.error,
      result: backendStep.result,
      executionTime: backendStep.executionTime || backendStep.estimated_duration,
    };

    steps.push(step);
  });

  return steps;
}

/**
 * Enhance intent with required tools and models
 */
export function enhanceIntent(intent: any, selectedModels: any[]): any {
  const enhanced = { ...intent };

  // Map processing steps to tools
  const requiredTools: Array<{ id: string; name: string; task: string }> = [];
  
  if (intent.processing_steps) {
    intent.processing_steps.forEach((step: string) => {
      const stepLower = step.toLowerCase();
      
      // Try to match with tool capabilities
      TOOLS_REGISTRY.forEach(tool => {
        tool.capabilities.forEach(cap => {
          if (stepLower.includes(cap.task.toLowerCase()) || cap.task.toLowerCase().includes(stepLower)) {
            if (!requiredTools.find(t => t.id === tool.id && t.task === cap.task)) {
              requiredTools.push({
                id: tool.id,
                name: tool.name,
                task: cap.task,
              });
            }
          }
        });
      });
    });
  }

  enhanced.required_tools = requiredTools.length > 0 ? requiredTools : undefined;

  // Map selected models
  enhanced.required_models = selectedModels.map((model: any) => ({
    name: model.name || model.model || 'Unknown',
    provider: model.provider || 'unknown',
  }));

  return enhanced;
}

