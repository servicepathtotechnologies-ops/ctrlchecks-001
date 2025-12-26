import { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleSettingsProps {
  workflowId: string | null;
}

type SchedulePreset = 'custom' | 'every-minute' | 'every-5-minutes' | 'every-hour' | 'every-day' | 'every-week';

const presets: Record<SchedulePreset, { label: string; cron: string }> = {
  'custom': { label: 'Custom', cron: '' },
  'every-minute': { label: 'Every minute', cron: '* * * * *' },
  'every-5-minutes': { label: 'Every 5 minutes', cron: '*/5 * * * *' },
  'every-hour': { label: 'Every hour', cron: '0 * * * *' },
  'every-day': { label: 'Every day at midnight', cron: '0 0 * * *' },
  'every-week': { label: 'Every Monday at midnight', cron: '0 0 * * 1' },
};

export default function ScheduleSettings({ workflowId }: ScheduleSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState('0 * * * *');
  const [selectedPreset, setSelectedPreset] = useState<SchedulePreset>('every-hour');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (workflowId && workflowId !== 'new' && isOpen) {
      loadSchedule();
    }
  }, [workflowId, isOpen]);

  const loadSchedule = async () => {
    if (!workflowId || workflowId === 'new') return;

    const { data, error } = await supabase
      .from('workflows')
      .select('cron_expression')
      .eq('id', workflowId)
      .single();

    if (error) {
      console.error('Error loading schedule:', error);
      return;
    }

    if (data?.cron_expression) {
      setEnabled(true);
      setCronExpression(data.cron_expression);
      
      // Match to preset if possible
      const matchedPreset = Object.entries(presets).find(
        ([_, preset]) => preset.cron === data.cron_expression
      );
      setSelectedPreset(matchedPreset ? matchedPreset[0] as SchedulePreset : 'custom');
    } else {
      setEnabled(false);
    }
  };

  const handlePresetChange = (value: SchedulePreset) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      setCronExpression(presets[value].cron);
    }
  };

  const handleSave = async () => {
    if (!workflowId || workflowId === 'new') {
      toast({
        title: 'Save workflow first',
        description: 'Please save the workflow before enabling a schedule.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('workflows')
      .update({
        cron_expression: enabled ? cronExpression : null,
      })
      .eq('id', workflowId);

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update schedule.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: enabled ? 'Schedule enabled' : 'Schedule disabled',
      description: enabled 
        ? `Workflow will run on schedule: ${cronExpression}` 
        : 'Scheduled execution has been disabled.',
    });

    setIsOpen(false);
  };

  const parseCronDescription = (cron: string): string => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return 'Invalid cron expression';

    const [minute, hour, dayMonth, month, dayWeek] = parts;

    if (cron === '* * * * *') return 'Every minute';
    if (cron === '*/5 * * * *') return 'Every 5 minutes';
    if (cron === '0 * * * *') return 'Every hour';
    if (cron === '0 0 * * *') return 'Every day at midnight';
    if (cron === '0 0 * * 1') return 'Every Monday at midnight';

    // Basic parsing for common patterns
    if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
    if (hour === '*' && minute !== '*') return `Every hour at minute ${minute}`;
    if (hour !== '*' && minute !== '*') return `Daily at ${hour}:${minute.padStart(2, '0')}`;

    return cron;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="mr-2 h-4 w-4" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Settings</DialogTitle>
          <DialogDescription>
            Configure automatic workflow execution on a schedule using cron expressions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Schedule</Label>
              <p className="text-sm text-muted-foreground">
                Run this workflow automatically
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(presets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  value={cronExpression}
                  onChange={(e) => {
                    setCronExpression(e.target.value);
                    setSelectedPreset('custom');
                  }}
                  placeholder="* * * * *"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day-of-month month day-of-week
                </p>
              </div>

              <div className="rounded-lg bg-muted p-3 flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Schedule Preview</p>
                  <p className="text-sm text-muted-foreground">
                    {parseCronDescription(cronExpression)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Scheduled workflows require the workflow to be saved and in an active state.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
