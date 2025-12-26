import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeData } from '@/stores/workflowStore';
import { NODE_CATEGORIES } from './nodeTypes';
import {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box,
  CheckCircle, XCircle, Loader2,
  FileText, DatabaseZap, Calendar, Users,
  Layers, Edit, Edit3, Tag, Code2, ListChecks,
  ArrowUpDown, List, Terminal, Calculator, Lock, Rss
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, DatabaseZap,
  Calendar, CheckCircle, Users,
  XCircle, Layers, Edit, Edit3, Tag, Function: Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss
};

type WorkflowNodeProps = Node<NodeData>;

const WorkflowNode = memo(({ data, selected }: NodeProps<WorkflowNodeProps>) => {
  const category = NODE_CATEGORIES.find((c) => c.id === data.category);
  const IconComponent = iconMap[data.icon] || Box;
  const isIfElseNode = data.type === 'if_else';
  const isSwitchNode = data.type === 'switch';

  // Parse Switch cases to create output handles
  // This will automatically update when data.config.cases changes
  let switchCases: Array<{ value: string; label?: string }> = [];
  if (isSwitchNode && data.config?.cases) {
    try {
      const casesConfig = data.config.cases;
      if (typeof casesConfig === 'string') {
        switchCases = JSON.parse(casesConfig);
      } else if (Array.isArray(casesConfig)) {
        switchCases = casesConfig;
      }
    } catch (error) {
      console.error('Failed to parse Switch cases:', error);
    }
  }

  // Create a key based on cases to help React identify when handles need to update
  const switchCasesKey = isSwitchNode
    ? JSON.stringify(switchCases.map(c => c.value).sort())
    : '';

  const status = data.executionStatus || 'idle';

  // Determine border styles based on status
  let borderClass = selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50';

  if (status === 'running') {
    borderClass = 'border-blue-500 border-2 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse';
  } else if (status === 'success') {
    borderClass = 'border-blue-500 border-2';
  } else if (status === 'error') {
    borderClass = 'border-red-500 border-2';
  }

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-card shadow-md min-w-[180px] transition-all relative',
        borderClass
      )}
    >
      {/* Execution Status Indicators */}
      {status === 'running' && (
        <div className="absolute -top-2 -right-2 bg-background rounded-full p-0.5 shadow-sm border border-border z-10">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        </div>
      )}
      {status === 'success' && (
        <div className="absolute -top-2 -right-2 bg-background rounded-full p-0.5 shadow-sm border border-border z-10">
          <CheckCircle className="h-4 w-4 text-green-500" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute -top-2 -right-2 bg-background rounded-full p-0.5 shadow-sm border border-border z-10">
          <XCircle className="h-4 w-4 text-red-500" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: category?.color + '20', color: category?.color }}
        >
          <IconComponent className="h-4 w-4" />
        </div>
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          <div className="text-xs text-muted-foreground capitalize">{data.category}</div>
        </div>
      </div>

      {isIfElseNode ? (
        <div className="relative">
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-8 text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">True</span>
            <span className="text-red-600 font-medium">False</span>
          </div>
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
            style={{ left: '35%' }}
          />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
            style={{ left: '65%' }}
          />
        </div>
      ) : isSwitchNode ? (
        switchCases.length > 0 ? (
          <div key={switchCasesKey} className="relative mt-2 pb-2 min-h-[40px]">
            {/* Output handles - dynamically positioned based on number of cases */}
            {switchCases.map((c, idx) => {
              // Calculate position: evenly distribute handles across the bottom
              // For 1 case: 50% (center)
              // For 2 cases: 30% and 70%
              // For 3+ cases: evenly spaced
              let leftPercent: string;
              if (switchCases.length === 1) {
                leftPercent = '50%';
              } else if (switchCases.length === 2) {
                leftPercent = idx === 0 ? '30%' : '70%';
              } else {
                // For 3+ cases, distribute evenly: 20%, 40%, 60%, 80%, etc.
                const spacing = 60 / (switchCases.length - 1);
                leftPercent = `${20 + (idx * spacing)}%`;
              }

              return (
                <Handle
                  key={`${c.value}-${switchCasesKey}`}
                  type="source"
                  id={c.value}
                  position={Position.Bottom}
                  className="!w-3.5 !h-3.5 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-background !relative z-10"
                  style={{
                    left: leftPercent,
                    transform: 'translateX(-50%)'
                  }}
                />
              );
            })}
            {/* Labels below handles */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-2 text-xs text-muted-foreground flex-wrap px-1">
              {switchCases.map((c, idx) => (
                <span key={`label-${idx}-${c.value}`} className="text-xs font-medium whitespace-nowrap">
                  {c.label || c.value}
                </span>
              ))}
            </div>
          </div>
        ) : (
          // No cases configured yet - show single default handle
          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
          />
        )
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';

export default WorkflowNode;
