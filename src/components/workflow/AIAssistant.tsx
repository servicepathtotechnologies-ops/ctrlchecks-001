import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { validateAndFixWorkflow } from '@/lib/workflowValidation';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hi! I can help you edit this workflow. Try saying "Add a Slack node after success" or "Change the trigger to a schedule".',
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const { nodes, edges, setNodes, setEdges } = useWorkflowStore();

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Clean unnecessary data from nodes/edges to reduce payload size
            const currentWorkflow = {
                nodes: nodes.map(n => ({
                    id: n.id,
                    type: n.type,
                    position: n.position,
                    data: {
                        ...n.data,
                        // Strip UI-only properties if any
                        selected: undefined,
                    }
                })),
                edges: edges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle,
                }))
            };

            const { data, error } = await supabase.functions.invoke('generate-workflow', {
                body: {
                    prompt: userMessage.content,
                    mode: 'edit',
                    currentWorkflow: currentWorkflow,
                },
            });

            if (error) throw error;

            if (data && data.nodes && data.edges) {
                // Validate before applying
                const validated = validateAndFixWorkflow(data); // Reuse existing client-side validation if available or rely on basic checks

                // TODO: ideally validateAndFixWorkflow should be imported from a shared lib or utility
                // For now, let's assume the backend did a good job or we use basic structural checks

                setNodes(data.nodes);
                setEdges(data.edges);

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: data.explanation || `I've updated the workflow based on your request.`,
                    timestamp: new Date(),
                }]);
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('AI Edit Error:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                timestamp: new Date(),
            }]);
            toast({
                title: 'Error',
                description: 'Failed to update workflow',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="border-l border-border bg-card h-full flex flex-col relative w-80 md:w-96 flex-shrink-0 transition-all duration-300">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-sm">AI Editor Assistant</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col gap-1 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "p-3 rounded-lg text-sm",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-muted text-foreground rounded-tl-none border border-border"
                                    )}
                                >
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex flex-col gap-1 mr-auto items-start max-w-[85%]">
                                <div className="bg-muted text-foreground p-3 rounded-lg rounded-tl-none border border-border flex items-center gap-2">
                                    <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                                    <span className="text-xs">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-background/50">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Describe your change..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
