import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Zap, Clock, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StageTimeline } from './stage-timeline';
import { trpc } from '@/main';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageTelemetryProps {
	messageId: string;
	className?: string;
}

export function ChatMessageTelemetry({ messageId, className }: MessageTelemetryProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { data, isLoading, error } = useQuery(
		trpc.telemetry.getMessageTelemetry.queryOptions({
			messageId,
		}),
	);

	if (isLoading) {
		return (
			<div className={cn('text-xs text-muted-foreground', className)}>
				<span className='inline-flex items-center gap-1'>
					<BarChart3 className='size-3 animate-pulse' />
					Loading telemetry...
				</span>
			</div>
		);
	}

	if (error || !data) {
		return null;
	}

	const { telemetry, tokenUsage, stages } = data;

	return (
		<div className={cn('border rounded-lg overflow-hidden', className)}>
			<Button
				variant='ghost'
				size='sm'
				onClick={() => setIsExpanded(!isExpanded)}
				className='w-full flex items-center justify-between px-3 py-2 h-auto hover:bg-muted/50'
			>
				<span className='flex items-center gap-2 text-xs font-medium'>
					<BarChart3 className='size-4' />
					Telemetry
				</span>
				{isExpanded ? (
					<ChevronDown className='size-4 text-muted-foreground' />
				) : (
					<ChevronRight className='size-4 text-muted-foreground' />
				)}
			</Button>

			{isExpanded && (
				<div className='px-3 py-2 space-y-3 border-t bg-muted/30'>
					{/* Timing Metrics */}
					{telemetry && (
						<div className='space-y-2'>
							<div className='text-xs font-semibold text-muted-foreground'>Performance</div>
							<div className='grid grid-cols-2 gap-2'>
								{telemetry.ttftMs !== null && telemetry.ttftMs !== undefined && (
									<MetricRow
										icon={<Zap className='size-3 text-yellow-500' />}
										label='Time to First Token'
										value={`${telemetry.ttftMs}ms`}
									/>
								)}
								{telemetry.totalLatencyMs !== null && telemetry.totalLatencyMs !== undefined && (
									<MetricRow
										icon={<Clock className='size-3 text-blue-500' />}
										label='Total Latency'
										value={`${(telemetry.totalLatencyMs / 1000).toFixed(2)}s`}
									/>
								)}
							</div>
						</div>
					)}

					{/* Token Usage */}
					{tokenUsage && (
						<div className='space-y-2'>
							<div className='text-xs font-semibold text-muted-foreground'>Token Usage</div>
							<div className='grid grid-cols-2 gap-2'>
								<MetricRow label='Input Tokens' value={tokenUsage.inputTotalTokens?.toLocaleString()} />
								<MetricRow
									label='Output Tokens'
									value={tokenUsage.outputTotalTokens?.toLocaleString()}
								/>
								{tokenUsage.totalTokens && (
									<MetricRow label='Total Tokens' value={tokenUsage.totalTokens.toLocaleString()} />
								)}
							</div>
							{tokenUsage.inputCacheReadTokens !== undefined &&
								tokenUsage.inputCacheReadTokens !== null &&
								tokenUsage.inputCacheReadTokens > 0 && (
									<div className='text-xs text-muted-foreground mt-1'>
										Cache read: {tokenUsage.inputCacheReadTokens.toLocaleString()} tokens
									</div>
								)}
						</div>
					)}

					{/* Cost */}
					{telemetry && telemetry.estimatedCost !== undefined && telemetry.estimatedCost !== null && (
						<div className='space-y-2'>
							<div className='text-xs font-semibold text-muted-foreground'>Cost</div>
							<MetricRow
								icon={<DollarSign className='size-3 text-green-500' />}
								label='Estimated Cost'
								value={`$${telemetry.estimatedCost.toFixed(4)}`}
							/>
						</div>
					)}

					{/* Stage Timeline */}
					{stages && stages.length > 0 && <StageTimeline stages={stages} />}
				</div>
			)}
		</div>
	);
}

interface MetricRowProps {
	icon?: React.ReactNode;
	label: string;
	value: string | number | undefined;
}

function MetricRow({ icon, label, value }: MetricRowProps) {
	if (value === undefined || value === null) {
		return null;
	}

	return (
		<div className='flex items-center justify-between text-xs'>
			<span className='flex items-center gap-1.5 text-muted-foreground'>
				{icon}
				{label}
			</span>
			<span className='font-mono font-medium'>{value}</span>
		</div>
	);
}
