import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { subDays, format, formatDistanceToNow } from 'date-fns';
import {
	Clock,
	DollarSign,
	Zap,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Info,
	AlertTriangle,
	Wrench,
	Activity,
	MessageSquare,
	CheckCircle2,
	Star,
} from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SettingsCard } from '@/components/ui/settings-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/main';
import { formatStageName, formatToolName } from '@/lib/telemetry.utils';

export const Route = createFileRoute('/_sidebar-layout/settings/analytics')({
	component: AnalyticsPage,
});

function AnalyticsPage() {
	// Default to last 7 days
	const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
	const [endDate, setEndDate] = useState(() => new Date());

	const summary = useQuery({
		...trpc.analytics.getSummary.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const errorMetrics = useQuery({
		...trpc.analytics.getErrorMetrics.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const detailedStageStats = useQuery({
		...trpc.analytics.getDetailedStageStats.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const topErrors = useQuery({
		...trpc.analytics.getTopErrors.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const toolUsageStats = useQuery({
		...trpc.toolAnalytics.getToolUsageStats.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const toolErrorBreakdown = useQuery({
		...trpc.toolAnalytics.getToolErrorBreakdown.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const conversationMetrics = useQuery({
		...trpc.conversationAnalytics.getConversationMetrics.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		}),
	});

	const conversationStats = useQuery({
		...trpc.conversationAnalytics.getConversationStats.queryOptions({
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			limit: 20,
		}),
	});

	// Filter states
	const [stageFilter, setStageFilter] = useState<string>('all');
	const [toolFilter, setToolFilter] = useState<string>('all');
	const [datePreset, setDatePreset] = useState<string>('7d');

	const handleDatePresetChange = (preset: string) => {
		setDatePreset(preset);
		const now = new Date();
		setEndDate(now);

		switch (preset) {
			case '7d':
				setStartDate(subDays(now, 7));
				break;
			case '30d':
				setStartDate(subDays(now, 30));
				break;
			case '90d':
				setStartDate(subDays(now, 90));
				break;
			case 'custom':
				// Keep current dates
				break;
		}
	};

	const handlePreviousWeek = () => {
		setStartDate((d) => subDays(d, 7));
		setEndDate((d) => subDays(d, 7));
	};

	const handleNextWeek = () => {
		setStartDate((d) => subDays(d, -7));
		setEndDate((d) => subDays(d, -7));
	};

	const handleSetToday = () => {
		setEndDate(new Date());
		setStartDate(subDays(new Date(), 7));
	};

	return (
		<>
			{/* Header with Date Controls */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
				<h1 className='text-2xl font-semibold text-foreground'>Analytics Dashboard</h1>
				<div className='flex flex-wrap items-center gap-2'>
					<Select value={datePreset} onValueChange={handleDatePresetChange}>
						<SelectTrigger size='sm' className='w-[120px]'>
							<SelectValue placeholder='Select range' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='7d'>Last 7 days</SelectItem>
							<SelectItem value='30d'>Last 30 days</SelectItem>
							<SelectItem value='90d'>Last 90 days</SelectItem>
							<SelectItem value='custom'>Custom</SelectItem>
						</SelectContent>
					</Select>
					<Button variant='outline' size='sm' onClick={handlePreviousWeek}>
						<ChevronLeft className='h-4 w-4' />
						<span className='hidden sm:inline'>Previous 7 days</span>
						<span className='sm:hidden'>Prev</span>
					</Button>
					<Button variant='outline' size='sm' onClick={handleSetToday}>
						Today
					</Button>
					<Button variant='outline' size='sm' onClick={handleNextWeek}>
						<span className='hidden sm:inline'>Next 7 days</span>
						<span className='sm:hidden'>Next</span>
						<ChevronRight className='h-4 w-4' />
					</Button>

					{/* Custom Date Range Picker */}
					<Popover>
						<PopoverTrigger asChild>
							<Button variant='outline' size='sm' className='gap-2'>
								<Calendar className='h-4 w-4' />
								<span className='hidden sm:inline'>
									{format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
								</span>
								<span className='sm:hidden'>{format(startDate, 'MMM d')}</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent className='w-auto p-4' align='end'>
							<div className='space-y-3'>
								<div className='space-y-1'>
									<Label htmlFor='start-date'>Start Date</Label>
									<Input
										id='start-date'
										type='date'
										value={format(startDate, 'yyyy-MM-dd')}
										onChange={(e) => {
											const date = new Date(e.target.value);
											if (!isNaN(date.getTime())) {
												setStartDate(date);
											}
										}}
									/>
								</div>
								<div className='space-y-1'>
									<Label htmlFor='end-date'>End Date</Label>
									<Input
										id='end-date'
										type='date'
										value={format(endDate, 'yyyy-MM-dd')}
										onChange={(e) => {
											const date = new Date(e.target.value);
											// Set to end of day
											if (!isNaN(date.getTime())) {
												date.setHours(23, 59, 59, 999);
												setEndDate(date);
											}
										}}
									/>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Summary Metrics */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6'>
				<MetricCard
					title='Total Messages'
					value={summary.data?.totalMessages ?? 0}
					icon={<Clock className='size-4 text-blue-500' />}
					isLoading={summary.isLoading}
				/>
				<MetricCard
					title='Total Cost'
					value={summary.data?.totalCost ? `$${Number(summary.data.totalCost).toFixed(2)}` : '$0.00'}
					icon={<DollarSign className='size-4 text-green-500' />}
					isLoading={summary.isLoading}
				/>
				<MetricCard
					title='Avg TTFT'
					value={`${summary.data?.averageTtftMs ?? 0}ms`}
					icon={<Zap className='size-4 text-yellow-500' />}
					isLoading={summary.isLoading}
				/>
				<MetricCard
					title='Avg Latency'
					value={`${summary.data?.averageLatencyMs ?? 0}ms`}
					icon={<Clock className='size-4 text-purple-500' />}
					isLoading={summary.isLoading}
				/>
			</div>

			{/* Conversation Metrics */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6'>
				<MetricCard
					title='Total Conversations'
					value={conversationMetrics.data?.totalConversations ?? 0}
					icon={<MessageSquare className='size-4 text-indigo-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
				<MetricCard
					title='Completion Rate'
					value={`${((conversationMetrics.data?.completionRate ?? 0) * 100).toFixed(1)}%`}
					icon={<CheckCircle2 className='size-4 text-green-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
				<MetricCard
					title='Avg Messages/Conv'
					value={conversationMetrics.data?.averageMessagesPerConversation ?? 0}
					icon={<MessageSquare className='size-4 text-cyan-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
				<MetricCard
					title='Avg Duration'
					value={`${conversationMetrics.data?.averageDurationSeconds ?? 0}s`}
					icon={<Clock className='size-4 text-orange-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
			</div>

			{/* Additional Conversation Metrics */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4 my-6'>
				<MetricCard
					title='Avg Cost/Conv'
					value={`$${(conversationMetrics.data?.averageCostPerConversation ?? 0).toFixed(2)}`}
					icon={<DollarSign className='size-4 text-emerald-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
				<MetricCard
					title='With Feedback'
					value={conversationMetrics.data?.conversationsWithFeedback ?? 0}
					icon={<Star className='size-4 text-yellow-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
				<MetricCard
					title='Positive Feedback Rate'
					value={`${((conversationMetrics.data?.positiveFeedbackRate ?? 0) * 100).toFixed(1)}%`}
					icon={<Star className='size-4 text-amber-500' />}
					isLoading={conversationMetrics.isLoading}
				/>
			</div>

			{/* Error Rate Metrics */}
			{errorMetrics.data && errorMetrics.data.totalErrors > 0 && (
				<SettingsCard title='Error Tracking' className='my-6'>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-red-100 dark:bg-red-900/20 rounded-lg'>
								<AlertTriangle className='size-4 text-red-600 dark:text-red-400' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Total Errors</p>
								<p className='text-2xl font-semibold'>{errorMetrics.data.totalErrors}</p>
							</div>
						</div>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-red-100 dark:bg-red-900/20 rounded-lg'>
								<AlertTriangle className='size-4 text-red-600 dark:text-red-400' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Critical</p>
								<p className='text-2xl font-semibold text-red-600'>
									{errorMetrics.data.criticalErrors}
								</p>
							</div>
						</div>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg'>
								<AlertTriangle className='size-4 text-orange-600 dark:text-orange-400' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>High</p>
								<p className='text-2xl font-semibold text-orange-600'>{errorMetrics.data.highErrors}</p>
							</div>
						</div>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg'>
								<AlertTriangle className='size-4 text-yellow-600 dark:text-yellow-400' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Medium</p>
								<p className='text-2xl font-semibold text-yellow-600'>
									{errorMetrics.data.mediumErrors}
								</p>
							</div>
						</div>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg'>
								<AlertTriangle className='size-4 text-blue-600 dark:text-blue-400' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Low</p>
								<p className='text-2xl font-semibold text-blue-600'>{errorMetrics.data.lowErrors}</p>
							</div>
						</div>
					</div>
				</SettingsCard>
			)}

			{/* Stage Statistics with Hover Metadata */}
			<SettingsCard
				title='Pipeline Stage Performance'
				icon={<Activity className='h-5 w-5' />}
				badge={
					<Select value={stageFilter} onValueChange={setStageFilter}>
						<SelectTrigger size='sm' className='w-[140px]'>
							<SelectValue placeholder='Filter by stage' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Stages</SelectItem>
							<SelectItem value='tool_routing'>Tool Routing</SelectItem>
							<SelectItem value='query_construction'>Query Construction</SelectItem>
							<SelectItem value='tool_execution'>Tool Execution</SelectItem>
							<SelectItem value='answer_generation'>Answer Generation</SelectItem>
							<SelectItem value='citation'>Citation</SelectItem>
						</SelectContent>
					</Select>
				}
			>
				{detailedStageStats.isLoading ? (
					<p className='text-muted-foreground text-sm'>Loading stage statistics...</p>
				) : detailedStageStats.isError ? (
					<p className='text-destructive text-sm'>Failed to load stage statistics</p>
				) : (
					<div className='overflow-x-auto -mx-4 sm:mx-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Stage</TableHead>
									<TableHead className='text-right'>Total</TableHead>
									<TableHead className='text-right'>Success</TableHead>
									<TableHead className='text-right'>Failure</TableHead>
									<TableHead className='text-right'>Success Rate</TableHead>
									<TableHead className='text-right'>Avg Duration</TableHead>
									<TableHead className='w-8'></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{detailedStageStats.data
									?.filter((stat) => stageFilter === 'all' || stat.stage === stageFilter)
									.map((stat) => (
										<TableRow key={stat.stage}>
											<TableCell className='font-medium'>{formatStageName(stat.stage)}</TableCell>
											<TableCell className='text-right'>{stat.total}</TableCell>
											<TableCell className='text-right text-green-600'>{stat.success}</TableCell>
											<TableCell className='text-right text-red-600'>{stat.failure}</TableCell>
											<TableCell className='text-right'>
												{(stat.successRate * 100).toFixed(1)}%
											</TableCell>
											<TableCell className='text-right'>{stat.averageDurationMs}ms</TableCell>
											<TableCell>
												{stat.sampleMetadata.length > 0 && (
													<HoverCard>
														<HoverCardTrigger asChild>
															<Button variant='ghost' size='icon' className='h-6 w-6'>
																<Info className='h-3 w-3 text-muted-foreground' />
															</Button>
														</HoverCardTrigger>
														<HoverCardContent side='left' className='w-72'>
															<div className='space-y-2'>
																<p className='text-sm font-medium'>Sample Metadata</p>
																<div className='space-y-2 text-xs'>
																	{stat.sampleMetadata
																		.slice(0, 3)
																		.map((meta, idx) => (
																			<div
																				key={idx}
																				className='border rounded p-2 space-y-1'
																			>
																				{meta?.toolName && (
																					<p>
																						<span className='font-medium'>
																							Tool:
																						</span>{' '}
																						{meta.toolName}
																					</p>
																				)}
																				{meta?.modelId && (
																					<p>
																						<span className='font-medium'>
																							Model:
																						</span>{' '}
																						{meta.modelId}
																					</p>
																				)}
																				{meta?.providerId && (
																					<p>
																						<span className='font-medium'>
																							Provider:
																						</span>{' '}
																						{meta.providerId}
																					</p>
																				)}
																				{meta?.outputSize !== undefined && (
																					<p>
																						<span className='font-medium'>
																							Output:
																						</span>{' '}
																						{meta.outputSize.toLocaleString()}{' '}
																						chars
																					</p>
																				)}
																				{meta?.retrievedCount !== undefined && (
																					<p>
																						<span className='font-medium'>
																							Retrieved:
																						</span>{' '}
																						{meta.retrievedCount.toLocaleString()}{' '}
																						items
																					</p>
																				)}
																				{!meta && (
																					<p className='text-muted-foreground'>
																						No metadata
																					</p>
																				)}
																			</div>
																		))}
																</div>
															</div>
														</HoverCardContent>
													</HoverCard>
												)}
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				)}
			</SettingsCard>

			{/* Top Errors */}
			<SettingsCard
				title='Top Errors'
				className='mt-6'
				icon={<AlertTriangle className='h-5 w-5' />}
				badge={
					<Select value={stageFilter} onValueChange={setStageFilter}>
						<SelectTrigger size='sm' className='w-[140px]'>
							<SelectValue placeholder='Filter by stage' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Stages</SelectItem>
							<SelectItem value='tool_routing'>Tool Routing</SelectItem>
							<SelectItem value='query_construction'>Query Construction</SelectItem>
							<SelectItem value='tool_execution'>Tool Execution</SelectItem>
							<SelectItem value='answer_generation'>Answer Generation</SelectItem>
							<SelectItem value='citation'>Citation</SelectItem>
						</SelectContent>
					</Select>
				}
			>
				{topErrors.isLoading ? (
					<p className='text-muted-foreground text-sm'>Loading errors...</p>
				) : topErrors.isError ? (
					<p className='text-destructive text-sm'>Failed to load errors</p>
				) : !topErrors.data?.length ? (
					<p className='text-muted-foreground text-sm'>No errors recorded 🎉</p>
				) : (
					<div className='overflow-x-auto -mx-4 sm:mx-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className='w-[10%]'>Count</TableHead>
									<TableHead className='w-[20%]'>Stage</TableHead>
									<TableHead>Error Message</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{topErrors.data
									.filter((error) => stageFilter === 'all' || error.stage === stageFilter)
									.map((error, idx) => (
										<TableRow key={idx}>
											<TableCell className='font-mono'>{error.count}</TableCell>
											<TableCell>{formatStageName(error.stage)}</TableCell>
											<TableCell
												className='max-w-md truncate text-muted-foreground'
												title={error.errorMessage}
											>
												{error.errorMessage}
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				)}
			</SettingsCard>

			{/* Tool Usage Statistics */}
			<SettingsCard
				title='Tool Usage Statistics'
				className='mt-6'
				icon={<Wrench className='h-5 w-5' />}
				badge={
					<Select value={toolFilter} onValueChange={setToolFilter}>
						<SelectTrigger size='sm' className='w-[140px]'>
							<SelectValue placeholder='Filter by tool' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Tools</SelectItem>
							<SelectItem value='grep'>Grep</SelectItem>
							<SelectItem value='search'>Search</SelectItem>
							<SelectItem value='read'>Read</SelectItem>
							<SelectItem value='execute-sql'>Execute SQL</SelectItem>
							<SelectItem value='execute-python'>Execute Python</SelectItem>
						</SelectContent>
					</Select>
				}
			>
				{toolUsageStats.isLoading ? (
					<p className='text-muted-foreground text-sm'>Loading tool statistics...</p>
				) : toolUsageStats.isError ? (
					<p className='text-destructive text-sm'>Failed to load tool statistics</p>
				) : !toolUsageStats.data?.length ? (
					<p className='text-muted-foreground text-sm'>No tool usage recorded</p>
				) : (
					<div className='overflow-x-auto -mx-4 sm:mx-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tool</TableHead>
									<TableHead className='text-right'>Total Executions</TableHead>
									<TableHead className='text-right'>Success Rate</TableHead>
									<TableHead className='text-right'>Avg Duration</TableHead>
									<TableHead className='text-right'>Avg Output Size</TableHead>
									<TableHead className='text-right'>Error Rate</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{toolUsageStats.data
									.filter((stat) => toolFilter === 'all' || stat.toolName === toolFilter)
									.map((stat) => (
										<TableRow key={stat.toolName}>
											<TableCell className='font-medium'>
												{formatToolName(stat.toolName)}
											</TableCell>
											<TableCell className='text-right'>{stat.totalExecutions}</TableCell>
											<TableCell className='text-right'>
												<span
													className={
														stat.successRate >= 0.9
															? 'text-green-600'
															: stat.successRate >= 0.7
																? 'text-yellow-600'
																: 'text-red-600'
													}
												>
													{(stat.successRate * 100).toFixed(1)}%
												</span>
											</TableCell>
											<TableCell className='text-right'>{stat.averageDurationMs}ms</TableCell>
											<TableCell className='text-right'>
												{stat.averageOutputSize > 0
													? `${Math.round(stat.averageOutputSize).toLocaleString()} chars`
													: 'N/A'}
											</TableCell>
											<TableCell className='text-right'>
												<span
													className={
														stat.errorRate <= 0.05
															? 'text-green-600'
															: stat.errorRate <= 0.15
																? 'text-yellow-600'
																: 'text-red-600'
													}
												>
													{(stat.errorRate * 100).toFixed(1)}%
												</span>
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				)}
			</SettingsCard>

			{/* Tool Error Breakdown */}
			{toolErrorBreakdown.data && toolErrorBreakdown.data.length > 0 && (
				<SettingsCard title='Tool Error Breakdown' className='mt-6' icon={<Activity className='h-5 w-5' />}>
					<div className='space-y-4'>
						{toolErrorBreakdown.data.map((tool) => (
							<div key={tool.toolName} className='border rounded-lg p-4'>
								<div className='flex items-center justify-between mb-3'>
									<h3 className='font-semibold text-lg'>{formatToolName(tool.toolName)}</h3>
									<span className='text-sm text-muted-foreground'>
										{tool.errorCount} error{tool.errorCount !== 1 ? 's' : ''}
									</span>
								</div>
								{tool.mostCommonErrors.length > 0 ? (
									<div className='space-y-2'>
										{tool.mostCommonErrors.map((error, idx) => (
											<div
												key={idx}
												className='flex items-start gap-3 text-sm p-2 bg-muted/50 rounded'
											>
												<span className='font-mono text-muted-foreground shrink-0'>
													{error.count}x
												</span>
												<p
													className='text-muted-foreground line-clamp-2'
													title={error.errorMessage}
												>
													{error.errorMessage}
												</p>
											</div>
										))}
									</div>
								) : (
									<p className='text-sm text-muted-foreground'>No error details available</p>
								)}
							</div>
						))}
					</div>
				</SettingsCard>
			)}

			{/* Conversation Stats Table */}
			<SettingsCard title='Conversation Details' className='mt-6' icon={<MessageSquare className='h-5 w-5' />}>
				{conversationStats.isLoading ? (
					<p className='text-muted-foreground text-sm'>Loading conversations...</p>
				) : conversationStats.isError ? (
					<p className='text-destructive text-sm'>Failed to load conversations</p>
				) : !conversationStats.data?.length ? (
					<p className='text-muted-foreground text-sm'>No conversations recorded</p>
				) : (
					<div className='overflow-x-auto -mx-4 sm:mx-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Conversation</TableHead>
									<TableHead className='text-right'>Messages</TableHead>
									<TableHead className='text-right'>Cost</TableHead>
									<TableHead className='text-right'>Avg TTFT</TableHead>
									<TableHead className='text-right'>Duration</TableHead>
									<TableHead className='text-right'>Rating</TableHead>
									<TableHead>Started</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{conversationStats.data.map((conv) => (
									<TableRow key={conv.chatId}>
										<TableCell className='font-medium'>{conv.chatTitle || 'Untitled'}</TableCell>
										<TableCell className='text-right'>{conv.messageCount}</TableCell>
										<TableCell className='text-right'>${conv.totalCost.toFixed(2)}</TableCell>
										<TableCell className='text-right'>{conv.averageTtftMs}ms</TableCell>
										<TableCell className='text-right'>
											{conv.durationSeconds >= 60
												? `${Math.round(conv.durationSeconds / 60)}m`
												: `${conv.durationSeconds}s`}
										</TableCell>
										<TableCell className='text-right'>
											{conv.hasFeedback ? (
												<div className='flex items-center justify-end gap-1'>
													<Star className='h-3 w-3 fill-yellow-500 text-yellow-500' />
													<span className='text-sm'>
														{conv.positiveFeedbackCount}/{conv.totalFeedbackCount}
													</span>
												</div>
											) : (
												<span className='text-muted-foreground text-sm'>—</span>
											)}
										</TableCell>
										<TableCell className='text-muted-foreground text-sm'>
											{formatDistanceToNow(conv.startedAt, { addSuffix: true })}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</SettingsCard>
		</>
	);
}

interface MetricCardProps {
	title: string;
	value: string | number;
	icon: React.ReactNode;
	isLoading: boolean;
}

function MetricCard({ title, value, icon, isLoading }: MetricCardProps) {
	return (
		<SettingsCard className='p-4'>
			<div className='flex items-center gap-3'>
				<div className='p-2 bg-muted rounded-lg shrink-0'>{icon}</div>
				<div className='min-w-0 flex-1'>
					<p className='text-sm text-muted-foreground truncate'>{title}</p>
					<p className='text-2xl font-semibold truncate'>{isLoading ? '...' : value}</p>
				</div>
			</div>
		</SettingsCard>
	);
}
