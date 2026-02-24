import { useQuery } from '@tanstack/react-query';
import { BarChart3, Clock, DollarSign, Zap, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { formatStageName } from '@/lib/telemetry.utils';
import { trpc } from '@/main';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface MessageTelemetryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	messageId: string;
}

export function MessageTelemetryDialog({ open, onOpenChange, messageId }: MessageTelemetryDialogProps) {
	const telemetryQuery = useQuery(
		trpc.telemetry.getMessageTelemetry.queryOptions({
			messageId,
		}),
	);

	const telemetry = telemetryQuery.data;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-3xl max-h-[80vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<BarChart3 className='h-5 w-5' />
						Message Telemetry
					</DialogTitle>
					<DialogDescription>Detailed performance and execution data for this message</DialogDescription>
				</DialogHeader>

				{telemetryQuery.isLoading ? (
					<div className='space-y-4'>
						<Skeleton className='h-20 w-full' />
						<Skeleton className='h-40 w-full' />
					</div>
				) : telemetryQuery.isError || !telemetry ? (
					<div className='flex flex-col items-center justify-center py-8 text-muted-foreground'>
						<AlertCircle className='h-12 w-12 mb-2' />
						<p>Failed to load telemetry data</p>
					</div>
				) : (
					<div className='space-y-6'>
						{/* Message-level Metrics */}
						<div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
							<div className='flex items-center gap-3 rounded-lg border p-3'>
								<div className='p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg'>
									<Zap className='h-4 w-4 text-blue-600 dark:text-blue-400' />
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>TTFT</p>
									<p className='text-lg font-semibold'>{telemetry.telemetry.ttftMs ?? 'N/A'}ms</p>
								</div>
							</div>
							<div className='flex items-center gap-3 rounded-lg border p-3'>
								<div className='p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg'>
									<Clock className='h-4 w-4 text-purple-600 dark:text-purple-400' />
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>Latency</p>
									<p className='text-lg font-semibold'>
										{telemetry.telemetry.totalLatencyMs ?? 'N/A'}ms
									</p>
								</div>
							</div>
							<div className='flex items-center gap-3 rounded-lg border p-3'>
								<div className='p-2 bg-green-100 dark:bg-green-900/20 rounded-lg'>
									<DollarSign className='h-4 w-4 text-green-600 dark:text-green-400' />
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>Cost</p>
									<p className='text-lg font-semibold'>
										{telemetry.telemetry.estimatedCost
											? `$${telemetry.telemetry.estimatedCost.toFixed(4)}`
											: 'N/A'}
									</p>
								</div>
							</div>
							<div className='flex items-center gap-3 rounded-lg border p-3'>
								<div className='p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg'>
									<BarChart3 className='h-4 w-4 text-orange-600 dark:text-orange-400' />
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>Stages</p>
									<p className='text-lg font-semibold'>{telemetry.stages.length}</p>
								</div>
							</div>
						</div>

						{/* Token Usage */}
						{telemetry.tokenUsage && (
							<div className='rounded-lg border p-4'>
								<h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
									<BarChart3 className='h-4 w-4' />
									Token Usage
								</h3>
								<div className='grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm'>
									<div>
										<p className='text-muted-foreground'>Total Input</p>
										<p className='font-semibold'>
											{telemetry.tokenUsage.inputTotalTokens?.toLocaleString() ?? 'N/A'}
										</p>
									</div>
									<div>
										<p className='text-muted-foreground'>Cache Read</p>
										<p className='font-semibold'>
											{telemetry.tokenUsage.inputCacheReadTokens?.toLocaleString() ?? '0'}
										</p>
									</div>
									<div>
										<p className='text-muted-foreground'>Total Output</p>
										<p className='font-semibold'>
											{telemetry.tokenUsage.outputTotalTokens?.toLocaleString() ?? 'N/A'}
										</p>
									</div>
									<div>
										<p className='text-muted-foreground'>Total Tokens</p>
										<p className='font-semibold'>
											{telemetry.tokenUsage.totalTokens?.toLocaleString() ?? 'N/A'}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Stage Breakdown */}
						<div className='rounded-lg border p-4'>
							<h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
								<BarChart3 className='h-4 w-4' />
								Stage Breakdown
							</h3>
							{telemetry.stages.length === 0 ? (
								<p className='text-sm text-muted-foreground'>No stage data available</p>
							) : (
								<div className='overflow-x-auto -mx-2'>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Stage</TableHead>
												<TableHead>Status</TableHead>
												<TableHead className='text-right'>Duration</TableHead>
												<TableHead>Error</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{telemetry.stages.map((stage) => (
												<TableRow key={stage.id}>
													<TableCell className='font-medium'>
														{formatStageName(stage.stage)}
													</TableCell>
													<TableCell>
														{stage.status === 'success' ? (
															<Badge
																variant='outline'
																className='gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
															>
																<CheckCircle2 className='h-3 w-3' />
																Success
															</Badge>
														) : (
															<Badge
																variant='outline'
																className='gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
															>
																<XCircle className='h-3 w-3' />
																Failure
															</Badge>
														)}
													</TableCell>
													<TableCell className='text-right'>
														{stage.durationMs ? `${stage.durationMs}ms` : 'N/A'}
													</TableCell>
													<TableCell className='text-muted-foreground text-sm max-w-md truncate'>
														{stage.errorMessage || '-'}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</div>

						{/* Stage Metadata */}
						{telemetry.stages.some((s) => s.metadata && Object.keys(s.metadata).length > 0) && (
							<div className='rounded-lg border p-4'>
								<h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
									<BarChart3 className='h-4 w-4' />
									Stage Metadata
								</h3>
								<div className='space-y-3'>
									{telemetry.stages
										.filter((s) => s.metadata && Object.keys(s.metadata).length > 0)
										.map((stage) => (
											<div key={stage.id} className='border rounded p-3'>
												<p className='text-sm font-medium mb-2'>
													{formatStageName(stage.stage)}
												</p>
												<div className='grid grid-cols-2 gap-2 text-xs'>
													{Object.entries(stage.metadata ?? {}).map(([key, value]) => (
														<div key={key} className='text-muted-foreground'>
															<span className='font-medium text-foreground'>{key}:</span>{' '}
															{typeof value === 'object'
																? JSON.stringify(value, null, 2)
																: String(value)}
														</div>
													))}
												</div>
											</div>
										))}
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
