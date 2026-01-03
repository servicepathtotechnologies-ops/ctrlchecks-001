import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
    Bot, ArrowRight, AlertCircle,
    Settings2, CheckCircle2, Play, RefreshCw, Layers, Sparkles, Loader2, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkflowStore } from '@/stores/workflowStore';
import { motion, AnimatePresence } from 'framer-motion';

type WizardStep = 'idle' | 'analyzing' | 'questioning' | 'refining' | 'confirmation' | 'building' | 'complete';

interface AgentQuestion {
    id: string;
    text: string;
    options: string[];
}

interface AnalysisResult {
    summary: string;
    questions: AgentQuestion[];
    clarifiedPromptPreview: string;
    predictedStepCount: number;
}

interface RefinementResult {
    refinedPrompt: string;
    requirements: Array<{
        key: string;
        label: string;
        type: string;
        description: string;
    }>;
}

export function AutonomousAgentWizard() {
    const [step, setStep] = useState<WizardStep>('idle');
    const [prompt, setPrompt] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [refinement, setRefinement] = useState<RefinementResult | null>(null);
    const [requirementsMode, setRequirementsMode] = useState<'ai' | 'manual'>('ai');
    const [requirementValues, setRequirementValues] = useState<Record<string, string>>({});
    const [buildingLogs, setBuildingLogs] = useState<string[]>([]);
    const [generatedWorkflowId, setGeneratedWorkflowId] = useState<string | null>(null);
    const { toast } = useToast();
    const { setNodes, setEdges } = useWorkflowStore();
    const navigate = useNavigate();

    const handleAnalyze = async () => {
        if (!prompt.trim()) return;
        setStep('analyzing');

        try {
            const { data, error } = await supabase.functions.invoke('generate-workflow', {
                body: { prompt, mode: 'analyze' }
            });

            if (error) throw error;

            setAnalysis(data);
            const initialAnswers: Record<string, string> = {};
            data.questions.forEach((q: AgentQuestion) => {
                if (q.options.length > 0) initialAnswers[q.id] = q.options[0];
            });
            setAnswers(initialAnswers);
            setStep('questioning');
        } catch (err: any) {
            console.error(err);
            toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
            setStep('idle');
        }
    };

    const handleRefine = async () => {
        setStep('refining');
        const fa = analysis?.questions.map(q => ({
            question: q.text,
            answer: answers[q.id]
        })) || [];

        try {
            const { data, error } = await supabase.functions.invoke('generate-workflow', {
                body: { prompt, mode: 'refine', answers: fa }
            });

            if (error) throw error;

            setRefinement(data);
            setStep('confirmation');
        } catch (err: any) {
            console.error(err);
            toast({ title: 'Refinement Failed', description: err.message, variant: 'destructive' });
            setStep('questioning');
        }
    };

    const handleBuild = async () => {
        setStep('building');
        setBuildingLogs(['Initializing Autonomous Agent...', 'Loading Node Library...', 'Synthesizing Requirements...']);

        setTimeout(() => setBuildingLogs(prev => [...prev, 'Constructing Workflow Graph...']), 1500);
        setTimeout(() => setBuildingLogs(prev => [...prev, 'Validating Node Connections...']), 3000);

        try {
            const config = { ...requirementValues };

            const { data, error } = await supabase.functions.invoke('generate-workflow', {
                body: {
                    prompt: refinement?.refinedPrompt,
                    mode: 'create',
                    config: config
                }
            });

            if (error) throw error;

            // Save to DB
            const { data: { user } } = await supabase.auth.getUser();
            const workflowData = {
                name: analysis?.summary.substring(0, 50) || 'AI Generated Workflow',
                nodes: data.nodes,
                edges: data.edges,
                user_id: user?.id,
                updated_at: new Date().toISOString(),
            };

            const { data: savedWorkflow, error: saveError } = await supabase
                .from('workflows')
                .insert(workflowData)
                .select()
                .single();

            if (saveError) throw saveError;

            setGeneratedWorkflowId(savedWorkflow.id);
            setNodes(data.nodes);
            setEdges(data.edges);

            setTimeout(() => {
                setBuildingLogs(prev => [...prev, 'Workflow Generated Successfully!', 'Verifying Logic...']);
                setStep('complete');
            }, 4000);

        } catch (err: any) {
            console.error(err);
            toast({ title: 'Build Failed', description: err.message, variant: 'destructive' });
            setStep('confirmation');
        }
    };

    const reset = () => {
        setStep('idle');
        setPrompt('');
        setAnalysis(null);
        setRefinement(null);
        setAnswers({});
        setBuildingLogs([]);
        setGeneratedWorkflowId(null);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#0F1117] text-slate-100 font-sans flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-[#161922] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
                        <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Autonomous Workflow Agent
                        </h2>
                        <p className="text-xs text-slate-400">Multi-Agent System • v2.5</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-400 h-8 px-3">
                        {step === 'idle' ? 'Ready' : step === 'complete' ? 'Completed' : 'Processing'}
                    </Badge>
                    <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => navigate('/workflows')}>Close</Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
                <AnimatePresence mode="wait">

                    {/* STEP 1: IDLE */}
                    {step === 'idle' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-6 max-w-2xl mx-auto mt-10"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-bold bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">What would you like to automate?</h3>
                                <p className="text-slate-400 text-lg">Describe your task in natural language. The agents will handle the rest.</p>
                            </div>
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <Textarea
                                    placeholder="e.g. Post to Instagram every morning at 9 AM with a tech tip..."
                                    className="relative min-h-[150px] bg-slate-900 border-slate-700 resize-none p-6 text-lg focus-visible:ring-indigo-500 rounded-lg shadow-xl"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                                <Button
                                    className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                                    onClick={handleAnalyze}
                                    disabled={!prompt.trim()}
                                >
                                    Analyze Prompts <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-8">
                                {['Social Media Automation', 'Data Syncing', 'Report Generation'].map((i) => (
                                    <div key={i} className="p-4 rounded-lg border border-slate-800 bg-slate-900/30 hover:bg-slate-800/50 cursor-pointer transition-all hover:border-indigo-500/50 hover:scale-[1.02] text-center text-sm text-slate-400" onClick={() => setPrompt(`Create a workflow for ${i.toLowerCase()}`)}>
                                        {i}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: ANALYZING */}
                    {step === 'analyzing' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-[50vh] gap-6"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full" />
                                <Loader2 className="h-16 w-16 text-indigo-400 animate-spin relative z-10" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-medium">Analyzing Requirements...</h3>
                                <p className="text-slate-500 text-sm max-w-md mx-auto">
                                    Decomposing your request into logical steps and identifying necessary integrations.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: QUESTIONING */}
                    {step === 'questioning' && analysis && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col gap-6 max-w-3xl mx-auto pb-10"
                        >
                            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-indigo-400">
                                        <Layers className="h-5 w-5" /> Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-300 leading-relaxed text-lg">{analysis.summary}</p>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                                    <AlertCircle className="h-5 w-5" />
                                    Clarifying Questions
                                </h3>
                                <div className="grid gap-4">
                                    {analysis.questions.map((q) => (
                                        <Card key={q.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base text-slate-200">{q.text}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <RadioGroup
                                                    value={answers[q.id]}
                                                    onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                                                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                                                >
                                                    {q.options.map((opt) => (
                                                        <div key={opt} className={`group flex items-center space-x-2 border p-3 rounded-md transition-all cursor-pointer ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-700'}`}>
                                                            <RadioGroupItem value={opt} id={`${q.id}-${opt}`} className="border-slate-500 text-indigo-500" />
                                                            <Label htmlFor={`${q.id}-${opt}`} className="cursor-pointer flex-1 text-slate-300 group-hover:text-white transition-colors">{opt}</Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            <Button onClick={handleRefine} className="self-end bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 px-8 py-6 text-lg" size="lg">
                                Submit Answers <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </motion.div>
                    )}

                    {/* STEP 4: REFINING */}
                    {step === 'refining' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-[50vh] gap-6"
                        >
                            <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
                            <h3 className="text-xl font-medium">Refining Workflow Plan...</h3>
                        </motion.div>
                    )}

                    {/* STEP 5: CONFIRMATION */}
                    {step === 'confirmation' && refinement && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col gap-6 max-w-5xl mx-auto pb-10"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <Card className="bg-slate-900 border-indigo-500/30 shadow-lg">
                                        <CardHeader>
                                            <CardTitle className="text-indigo-400">Final Execution Plan</CardTitle>
                                            <CardDescription>Based on your requirements</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-black/40 p-6 rounded-md text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed border border-white/5">
                                                {refinement.refinedPrompt}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {refinement.requirements.length > 0 && (
                                        <Card className="bg-slate-900 border-amber-500/20 shadow-lg">
                                            <CardHeader>
                                                <CardTitle className="text-amber-400 flex items-center gap-2">
                                                    <Settings2 className="h-5 w-5" /> Logic Config
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <RadioGroup value={requirementsMode} onValueChange={(v: any) => setRequirementsMode(v)} className="flex flex-wrap gap-4 p-1">
                                                    <div className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all cursor-pointer ${requirementsMode === 'ai' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                                                        <RadioGroupItem value="ai" id="mode-ai" className="text-indigo-500" />
                                                        <Label htmlFor="mode-ai" className="cursor-pointer font-medium">Let AI handle everything (Auto)</Label>
                                                    </div>
                                                    <div className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all cursor-pointer ${requirementsMode === 'manual' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                                                        <RadioGroupItem value="manual" id="mode-manual" className="text-indigo-500" />
                                                        <Label htmlFor="mode-manual" className="cursor-pointer font-medium">I'll Configure (Manual)</Label>
                                                    </div>
                                                </RadioGroup>

                                                {requirementsMode === 'manual' && (
                                                    <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-2">
                                                        {refinement.requirements.map(req => (
                                                            <div key={req.key} className="gap-2 grid">
                                                                <Label className="text-slate-300">{req.label}</Label>
                                                                <Input
                                                                    placeholder={req.description}
                                                                    className="bg-slate-950 border-slate-700 h-10"
                                                                    value={requirementValues[req.key] || ''}
                                                                    onChange={(e) => setRequirementValues({ ...requirementValues, [req.key]: e.target.value })}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                <div className="space-y-6 h-fit sticky top-6">
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-teal-500/10 border border-green-500/20 backdrop-blur-sm">
                                        <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5" /> Ready to Build
                                        </h4>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            The agent has all necessary information.
                                            {requirementsMode === 'ai' ? ' Credentials and URLs will be inferred or set to intelligent defaults.' : ' Using provided configuration.'}
                                        </p>
                                    </div>
                                    <Button onClick={handleBuild} className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02]">
                                        <Play className="mr-2 h-5 w-5 fill-current" /> Start Building
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 6: BUILDING */}
                    {step === 'building' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-[60vh] max-w-2xl mx-auto w-full gap-8"
                        >
                            <div className="w-full space-y-4">
                                <div className="flex justify-between text-sm font-medium text-slate-400">
                                    <span>Workflow Generation Progress</span>
                                    <span className="text-indigo-400">{Math.min(100, buildingLogs.length * 25)}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${Math.min(100, buildingLogs.length * 25)}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>

                            <Card className="w-full bg-black/40 border-slate-800 font-mono text-xs h-80 overflow-hidden flex flex-col shadow-2xl">
                                <div className="p-3 border-b border-slate-800 text-slate-500 bg-slate-900/50 flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                                    </div>
                                    <span className="ml-2">System Logs</span>
                                </div>
                                <ScrollArea className="flex-1 p-4">
                                    <div className="space-y-3">
                                        {buildingLogs.map((log, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex items-start gap-3 border-l-2 border-slate-800 pl-3 py-0.5"
                                            >
                                                <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                                                <span className={log.includes('Success') ? 'text-green-400' : 'text-slate-300'}>{log}</span>
                                            </motion.div>
                                        ))}
                                        <div className="pl-3 animate-pulse text-indigo-400">_</div>
                                    </div>
                                </ScrollArea>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 7: COMPLETE */}
                    {step === 'complete' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-[60vh] gap-8 text-center"
                        >
                            <div className="h-32 w-32 rounded-full bg-green-500/10 flex items-center justify-center mb-4 relative">
                                <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                                <Check className="h-16 w-16 text-green-500 relative z-10" />
                            </div>
                            <div>
                                <h2 className="text-4xl font-bold text-white mb-4">Workflow Created!</h2>
                                <p className="text-slate-400 max-w-md mx-auto text-lg">
                                    Your autonomous agent has successfully built and validated the workflow.
                                </p>
                            </div>
                            <div className="flex gap-4 mt-4">
                                <Button variant="outline" onClick={reset} className="border-slate-700 hover:bg-slate-800 h-12 px-6">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Create Another
                                </Button>
                                <Button
                                    onClick={() => generatedWorkflowId && navigate(`/workflow/${generatedWorkflowId}`)}
                                    className="bg-white text-black hover:bg-slate-200 h-12 px-8 font-semibold shadow-xl shadow-white/10"
                                >
                                    View Workflow <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
}
