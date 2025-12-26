import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Save, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import WebhookSettings from './WebhookSettings';
import ScheduleSettings from './ScheduleSettings';
import AgentSettings from './AgentSettings';

interface WorkflowHeaderProps {
  onSave: () => void;
  onRun: () => void;
  isSaving?: boolean;
  isRunning?: boolean;
  showAI?: boolean;
  onToggleAI?: () => void;
}

export default function WorkflowHeader({ onSave, onRun, isSaving, isRunning, showAI, onToggleAI }: WorkflowHeaderProps) {
  const navigate = useNavigate();
  const { workflowId, workflowName, setWorkflowName, isDirty } = useWorkflowStore();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              className="h-8 w-64"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-lg font-semibold hover:text-primary transition-colors"
            >
              {workflowName}
            </button>
          )}
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ScheduleSettings workflowId={workflowId} />
        <WebhookSettings workflowId={workflowId} />
        <AgentSettings workflowId={workflowId} />


        <Button
          variant={showAI ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleAI}
          className={cn("gap-2", showAI && "bg-primary/10 text-primary hover:bg-primary/20")}
        >
          <Sparkles className="h-4 w-4" />
          AI Editor
        </Button>

        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving || !isDirty}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>

        <Button size="sm" className="gradient-primary text-primary-foreground" onClick={onRun} disabled={isRunning}>
          <Play className="mr-2 h-4 w-4" />
          {isRunning ? 'Running...' : 'Run'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Workflow Settings</DropdownMenuItem>
            <DropdownMenuItem>Version History</DropdownMenuItem>
            <DropdownMenuItem>Export as JSON</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete Workflow</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}