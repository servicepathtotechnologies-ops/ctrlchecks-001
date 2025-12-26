import { useState } from 'react';
import { Search } from 'lucide-react';
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
  Calculator, Lock, Rss
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput,
  Calendar, CheckCircle, Users,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss
};

interface NodeLibraryProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeTypeDefinition) => void;
}

export default function NodeLibrary({ onDragStart }: NodeLibraryProps) {
  const [search, setSearch] = useState('');

  const filteredNodes = search
    ? NODE_TYPES.filter(
        (node) =>
          node.label.toLowerCase().includes(search.toLowerCase()) ||
          node.description.toLowerCase().includes(search.toLowerCase())
      )
    : NODE_TYPES;

  const getNodesByCategory = (categoryId: string) =>
    filteredNodes.filter((node) => node.category === categoryId);

  return (
    <div className="w-72 border-r border-border bg-card h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold mb-3">Node Library</h2>
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
        <Accordion type="multiple" defaultValue={NODE_CATEGORIES.map((c) => c.id)} className="px-2">
          {NODE_CATEGORIES.map((category) => {
            const nodes = getNodesByCategory(category.id);
            if (nodes.length === 0) return null;

            return (
              <AccordionItem key={category.id} value={category.id} className="border-b-0">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium">{category.label}</span>
                    <span className="text-xs text-muted-foreground">({nodes.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-1">
                    {nodes.map((node) => {
                      const IconComponent = iconMap[node.icon] || Box;
                      
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, node)}
                          className="flex items-center gap-2 p-2 rounded-md cursor-grab hover:bg-muted transition-colors active:cursor-grabbing"
                        >
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded"
                            style={{ backgroundColor: category.color + '20', color: category.color }}
                          >
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{node.label}</div>
                            <div className="text-xs text-muted-foreground truncate">{node.description}</div>
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
