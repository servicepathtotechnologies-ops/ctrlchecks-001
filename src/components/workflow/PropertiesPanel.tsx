import { useWorkflowStore } from '@/stores/workflowStore';
import { useState, useCallback, useEffect } from 'react';
import { getNodeDefinition, ConfigField } from './nodeTypes';
import { NODE_USAGE_GUIDES } from './nodeUsageGuides';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import NodeUsageCard from './NodeUsageCard';
import GoogleSheetsSettings from './GoogleSheetsSettings';
import {
  Trash2, X, Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link,
  GitBranch, GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table,
  Type, Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput, HelpCircle,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput,
  XCircle, Layers, Edit, Edit3, Tag, Function: Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss
};

export default function PropertiesPanel() {
  const { selectedNode, selectNode, updateNodeConfig, deleteSelectedNode } = useWorkflowStore();

  // Resizable sidebar state
  const [width, setWidth] = useState(400); // Increased default width from 320px (w-80) to 400px
  const [isResizing, setIsResizing] = useState(false);

  // Resize handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Calculate new width relative to window right edge
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        // Constraints: Min 300px, Max 800px (or window width - 100px)
        const constrainedWidth = Math.max(300, Math.min(newWidth, 800));
        setWidth(constrainedWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (!selectedNode) {
    return (
      <div
        className="border-l border-border bg-card h-full flex items-center justify-center p-6 transition-all duration-75 relative"
        style={{ width: width, flexShrink: 0 }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-50"
          onMouseDown={startResizing}
        />

        <div className="text-center text-muted-foreground">
          <HelpCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No node selected</p>
          <p className="text-xs mt-1">Click on a node to view its properties and usage guide</p>
        </div>
      </div>
    );
  }

  const nodeDefinition = getNodeDefinition(selectedNode.data.type);
  const IconComponent = iconMap[selectedNode.data.icon] || Box;

  const handleConfigChange = (key: string, value: unknown) => {
    // Prevent focus loss by using stopPropagation on the update
    updateNodeConfig(selectedNode.id, { [key]: value });
  };

  // Stop event propagation to prevent ReactFlow from stealing focus
  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const renderField = (field: ConfigField) => {
    const value = selectedNode.data.config[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'text':
      case 'cron':
        return (
          <Input
            id={field.key}
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'time':
        return (
          <Input
            id={field.key}
            type="time"
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder || '09:00'}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'textarea':
      case 'json':
        return (
          <Textarea
            id={field.key}
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="min-h-[100px] font-mono text-xs"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'number':
        return (
          <Input
            id={field.key}
            type="number"
            value={value as number}
            onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value))}
            placeholder={field.placeholder}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(val) => handleConfigChange(field.key, val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'boolean':
        return (
          <Switch
            id={field.key}
            checked={value as boolean}
            onCheckedChange={(checked) => handleConfigChange(field.key, checked)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="border-l border-border bg-card h-full flex flex-col relative transition-all duration-75"
      style={{ width: width, flexShrink: 0 }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-50 ${isResizing ? 'bg-primary' : ''}`}
        onMouseDown={startResizing}
      />

      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Node Properties</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => selectNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Usage Guide Card */}
          {NODE_USAGE_GUIDES[selectedNode.data.type] && (
            <NodeUsageCard
              guide={NODE_USAGE_GUIDES[selectedNode.data.type]}
              nodeLabel={selectedNode.data.label}
            />
          )}

          {/* Node Info */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <p className="text-sm font-medium">{selectedNode.data.label}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm text-muted-foreground">{nodeDefinition?.description}</p>
            </div>
          </div>

          {/* Config Fields */}
          {nodeDefinition && (
            <>
              {/* Custom Google Sheets Settings */}
              {selectedNode.data.type === 'google_sheets' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Configuration
                  </h3>
                  <GoogleSheetsSettings
                    config={selectedNode.data.config}
                    onConfigChange={(newConfig) => {
                      updateNodeConfig(selectedNode.id, newConfig);
                    }}
                  />
                </div>
              ) : nodeDefinition.configFields.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Configuration
                  </h3>
                  {nodeDefinition.configFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={field.key} className="text-sm flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-destructive">*</span>}
                        </Label>
                      </div>
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {/* Node ID */}
          <div>
            <Label className="text-xs text-muted-foreground">Node ID</Label>
            <p className="text-xs font-mono text-muted-foreground">{selectedNode.id}</p>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={deleteSelectedNode}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
