import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stage {
	id: string;
	stage: string;
	status: 'success' | 'failure';
	durationMs: number | null;
	errorMessage: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
}

interface StageTimelineProps {
	stages: Stage[];
	className?: string;
}

export function StageTimeline({ stages, className }: StageTimelineProps) {
	if (stages.length === 0) {
		return null;
	}

	// Format stage name for display
	const formatStageName = (stage: string): string => {
		const stageNames: Record<string, string> = {
			tool_routing: 'Tool Routing',
			query_construction: 'Query Construction',
			tool_execution: 'Tool Execution',
			answer_generation: 'Answer Generation',
			citation: 'Citation',
		};
		return stageNames[stage] || stage;
	};

	return (
		<div className={cn('space-y-2', className)}>
			<div className='text-xs font-semibold text-muted-foreground'>Pipeline Stages</div>
			<div className='space-y-1.5'>
				{stages.map((stage) => (
					<StageRow
						key={stage.id}
						name={formatStageName(stage.stage)}
						status={stage.status}
						duration={stage.durationMs}
						error={stage.errorMessage}
					/>
				))}
			</div>
		</div>
	);
}

interface StageRowProps {
	name: string;
	status: 'success' | 'failure';
	duration: number | null;
	error?: string | null;
}

function StageRow({ name, status, duration, error }: StageRowProps) {
	const isSuccess = status === 'success';

	const formatDuration = (ms: number | null): string => {
		if (ms === null) {
			return 'N/A';
		}
		if (ms < 1000) {
			return `${ms}ms`;
		}
		return `${(ms / 1000).toFixed(2)}s`;
	};

	return (
		<div className='flex items-center justify-between text-xs group'>
			<div className='flex items-center gap-2 flex-1 min-w-0'>
				{isSuccess ? (
					<CheckCircle2 className='size-3.5 text-green-500 shrink-0' />
				) : (
					<XCircle className='size-3.5 text-red-500 shrink-0' />
				)}
				<span className={cn('truncate', !isSuccess && 'text-red-500')}>{name}</span>
			</div>
			<div className='flex items-center gap-2 shrink-0'>
				<span className='font-mono text-muted-foreground'>{formatDuration(duration)}</span>
				{error && (
					<div className='relative group/error'>
						<AlertCircle className='size-3.5 text-red-500 cursor-help' />
						<div className='absolute right-0 bottom-full mb-2 hidden group-hover/error:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-50'>
							{error}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
