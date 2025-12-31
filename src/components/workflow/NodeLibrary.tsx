import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { NODE_CATEGORIES, NODE_TYPES, NodeTypeDefinition } from './nodeTypes';
import { 
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch, 
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type, 
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput,
  Calendar, CheckCircle, Users,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss, Bell, Activity, AlertCircle, Image, Target,
  Key, Shield, CreditCard, ShoppingCart, BarChart, TrendingUp
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput,
  Calendar, CheckCircle, Users,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss, Bell, Activity, AlertCircle, Image, Target,
  Key, Shield, CreditCard, ShoppingCart, BarChart, TrendingUp
};

interface NodeLibraryProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeTypeDefinition) => void;
  onClose?: () => void;
}

export default function NodeLibrary({ onDragStart, onClose }: NodeLibraryProps) {
  const [search, setSearch] = useState('');

  const filteredNodes = useMemo(() => 
    search
      ? NODE_TYPES.filter(
          (node) =>
            node.label.toLowerCase().includes(search.toLowerCase()) ||
            node.description.toLowerCase().includes(search.toLowerCase())
        )
      : NODE_TYPES,
    [search]
  );

  // Sort categories alphabetically
  const sortedCategories = useMemo(() => 
    [...NODE_CATEGORIES].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    []
  );

  const getNodesByCategory = (categoryId: string) =>
    filteredNodes
      .filter((node) => node.category === categoryId)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return (
    <div className="w-72 border-r border-border bg-card h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Node Library</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Close Node Library"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Accordion type="multiple" className="px-3 py-2">
          {sortedCategories.map((category) => {
            const nodes = getNodesByCategory(category.id);
            if (nodes.length === 0) return null;

            return (
              <AccordionItem key={category.id} value={category.id} className="border-b border-border/50 mb-1">
                <AccordionTrigger className="py-2.5 px-1 hover:no-underline hover:bg-muted/50 rounded-md transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium">{category.label}</span>
                    <span className="text-xs text-muted-foreground">({nodes.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-3 px-1">
                  <div className="space-y-1.5">
                    {nodes.map((node) => {
                      const IconComponent = iconMap[node.icon] || Box;
                      
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, node)}
                          className="flex items-start gap-2.5 p-2 rounded-md cursor-grab hover:bg-muted/70 transition-colors active:cursor-grabbing group"
                        >
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: category.color + '20', color: category.color }}
                          >
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="text-sm font-medium truncate leading-tight">{node.label}</div>
                            <div className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{node.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
