import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    MessageSquare,
    FileText,
    Languages,
    HelpCircle,
    Loader2,
    CheckCircle2,
    XCircle,
    Upload,
    BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Python backend URL (reusing logic from ImageProcessing)
const PYTHON_BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8501';
const USE_DIRECT_BACKEND = import.meta.env.VITE_USE_DIRECT_BACKEND === 'true' ||
    import.meta.env.DEV ||
    !import.meta.env.VITE_SUPABASE_URL;

interface TextProcessingResult {
    mode: 'chat' | 'summarize' | 'translate' | 'qa';
    success: boolean;
    output?: string;
    error?: string;
    duration?: number;
}

export default function TextProcessing() {
    const [inputText, setInputText] = useState('');
    const [question, setQuestion] = useState('');
    const [targetLang, setTargetLang] = useState('Spanish');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<TextProcessingResult[]>([]);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'text/plain') {
            const text = await file.text();
            setInputText(text);
        } else {
            toast({
                title: 'Unsupported file',
                description: 'Please upload a .txt file. For PDF/DOCX, please copy-paste the text for now.',
                variant: 'destructive'
            });
        }
    };

    const processText = async (mode: 'chat' | 'summarize' | 'translate' | 'qa') => {
        if (!inputText.trim()) {
            toast({
                title: 'No text provided',
                description: 'Please enter some text to process',
                variant: 'destructive'
            });
            return;
        }

        if (mode === 'qa' && !question.trim()) {
            toast({
                title: 'Question required',
                description: 'Please ask a question about the text',
                variant: 'destructive'
            });
            return;
        }

        const startTime = Date.now();
        setIsProcessing(true);
        setProgress(0);

        try {
            setProgress(20);

            const payload: any = {
                task: mode,
                input: inputText
            };

            if (mode === 'translate') {
                payload.target_language = targetLang;
            } else if (mode === 'qa') {
                payload.question = question;
                payload.context = inputText; // Use input text as context
            }

            setProgress(40);

            let data: any;
            let error: any = null;

            if (USE_DIRECT_BACKEND) {
                try {
                    // Use the NEW unified endpoint if possible, or fallback to /process
                    // We implemented /api/agent/execute in Python, let's try to use it to be consistent with prompt
                    // But since it's same host, we can just use /process or /api/agent/execute
                    // Let's use /api/agent/execute as requested
                    const response = await fetch(`${PYTHON_BACKEND_URL}/api/agent/execute`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });

                    const responseText = await response.text();
                    if (!response.ok) throw new Error(`Backend error ${response.status}: ${responseText}`);
                    data = JSON.parse(responseText);

                    if (!data.success) error = { message: data.error };

                } catch (err: any) {
                    console.error('Direct backend error', err);
                    error = { message: err.message || 'Failed to connect to backend' };
                }
            } else {
                // Production via Edge Function
                // We need to ensure the edge function calls the right python endpoint. 
                // Assuming existing edge function calls /process, which is fine as /api/agent/execute is just an alias/router to process_task.
                const result = await supabase.functions.invoke('execute-multimodal-agent', {
                    body: payload
                });
                data = result.data;
                error = result.error;
            }

            setProgress(90);

            if (error || !data?.success) {
                throw new Error(error?.message || data?.error || 'Unknown error');
            }

            const result: TextProcessingResult = {
                mode,
                success: true,
                output: data.output,
                duration: Date.now() - startTime
            };

            setResults(prev => [result, ...prev]);
            toast({ title: 'Success', description: 'Text processed successfully' });
            setProgress(100);

        } catch (err: any) {
            console.error('Processing error:', err);
            setResults(prev => [{
                mode,
                success: false,
                error: err.message,
                duration: Date.now() - startTime
            }, ...prev]);

            toast({
                title: 'Error',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Text Processing Studio
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* Input Area */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium">Input Text / Context</label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Load .txt File
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                        <Textarea
                            placeholder="Enter text to process here..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            rows={8}
                            className="font-mono text-sm"
                            disabled={isProcessing}
                        />
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Chat */}
                        <Button
                            onClick={() => processText('chat')}
                            disabled={isProcessing || !inputText.trim()}
                            variant="outline"
                            className="flex flex-col h-auto py-4"
                        >
                            <MessageSquare className="h-5 w-5 mb-2" />
                            <span>Chat / Generate</span>
                            <span className="text-xs text-muted-foreground">Continue the text</span>
                        </Button>

                        {/* Summarize */}
                        <Button
                            onClick={() => processText('summarize')}
                            disabled={isProcessing || !inputText.trim()}
                            variant="outline"
                            className="flex flex-col h-auto py-4"
                        >
                            <FileText className="h-5 w-5 mb-2" />
                            <span>Summarize</span>
                            <span className="text-xs text-muted-foreground">Shorten content</span>
                        </Button>

                        {/* Translate */}
                        <div className="flex flex-col gap-2">
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                disabled={isProcessing}
                            >
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Tamil">Tamil</option>
                                <option value="Telugu">Telugu</option>
                                <option value="Kannada">Kannada</option>
                                <option value="Malayalam">Malayalam</option>
                                <option value="Italian">Italian</option>
                                <option value="Portuguese">Portuguese</option>
                            </select>
                            <Button
                                onClick={() => processText('translate')}
                                disabled={isProcessing || !inputText.trim()}
                                variant="outline"
                                className="w-full"
                            >
                                <Languages className="h-4 w-4 mr-2" />
                                Translate
                            </Button>
                        </div>

                        {/* QA */}
                        <div className="flex flex-col gap-2">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                placeholder="Ask a question..."
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                disabled={isProcessing}
                            />
                            <Button
                                onClick={() => processText('qa')}
                                disabled={isProcessing || !inputText.trim() || !question.trim()}
                                variant="outline"
                                className="w-full"
                            >
                                <HelpCircle className="h-4 w-4 mr-2" />
                                Ask Question
                            </Button>
                        </div>

                    </div>

                    {/* Progress */}
                    {isProcessing && (
                        <div className="space-y-2">
                            <Progress value={progress} />
                            <p className="text-xs text-center text-muted-foreground">Processing...</p>
                        </div>
                    )}

                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-4">
                    {results.map((result, idx) => (
                        <Card key={idx} className={result.success ? 'border-green-500' : 'border-red-500'}>
                            <CardHeader className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {result.success ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-red-500 h-5 w-5" />}
                                        <span className="font-semibold capitalize">{result.mode} Result</span>
                                    </div>
                                    {result.duration && <Badge variant="outline">{result.duration}ms</Badge>}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {result.error ? (
                                    <p className="text-red-500 text-sm">{result.error}</p>
                                ) : (
                                    <Textarea readOnly value={result.output} className="bg-muted" rows={4} />
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
