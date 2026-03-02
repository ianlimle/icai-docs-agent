import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, AlertCircle, Loader2, Play, RefreshCw, Settings, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { trpc } from '@/main';
import { useActiveProject } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { InitWizard } from '@/components/workflow/init-wizard';

export const Route = createFileRoute('/_sidebar-layout/settings/project/workflow')({
	component: WorkflowPage,
});

type StepStatus = 'pending' | 'in-progress' | 'completed' | 'error';

interface WorkflowStep {
	id: 'init' | 'debug' | 'sync';
	title: string;
	description: string;
	status: StepStatus;
	error?: string | null;
	completedAt?: Date | null;
}

function WorkflowPage() {
	const [runningStep, setRunningStep] = useState<'init' | 'debug' | 'sync' | null>(null);
	const [openModal, setOpenModal] = useState<'init' | 'debug' | 'sync' | null>(null);
	const [errorModal, setErrorModal] = useState<{
		title: string;
		message: string;
		suggestions: string[];
	} | null>(null);

	// Get active project to load project name
	const { data: activeProject } = useActiveProject();

	// Init configuration state - now handled by InitWizard
	const [projectName, setProjectName] = useState('');
	const [forceInit, setForceInit] = useState(false);

	const queryClient = useQueryClient();

	// Load project name from active project
	useEffect(() => {
		if (activeProject?.name) {
			setProjectName(activeProject.name);
		}
	}, [activeProject?.name]);

	// Refresh workflow status when active project changes
	useEffect(() => {
		if (activeProject?.id) {
			// Invalidate and refetch workflow status when switching projects
			queryClient.invalidateQueries({
				queryKey: trpc.workflow.getStatus.queryKey(),
			});
		}
	}, [activeProject?.id, queryClient]);

	// Sync configuration state
	const [selectedProviders, setSelectedProviders] = useState<string[]>(['databases', 'repos', 'docs', 'semantics']);

	const { data: workflowStatus, isLoading } = useQuery({
		...trpc.workflow.getStatus.queryOptions(),
		refetchInterval: runningStep ? 2000 : 5000, // Always refresh every 5 seconds, more frequently when running
	});

	const runInitMutation = useMutation(
		trpc.workflow.runInit.mutationOptions({
			onMutate: () => setRunningStep('init'),
			onSuccess: () => {
				setRunningStep(null);
				setOpenModal(null);
			},
			onError: (error) => {
				setRunningStep(null);
				handleMutationError(error, 'Initialize Project');
			},
		}),
	);

	const runDebugMutation = useMutation(
		trpc.workflow.runDebug.mutationOptions({
			onMutate: () => setRunningStep('debug'),
			onSuccess: () => {
				setRunningStep(null);
				setOpenModal(null);
			},
			onError: (error) => {
				setRunningStep(null);
				handleMutationError(error, 'Verify Setup');
			},
		}),
	);

	const runSyncMutation = useMutation(
		trpc.workflow.runSync.mutationOptions({
			onMutate: () => setRunningStep('sync'),
			onSuccess: () => {
				setRunningStep(null);
				setOpenModal(null);
			},
			onError: (error) => {
				setRunningStep(null);
				handleMutationError(error, 'Synchronize Context');
			},
		}),
	);

	const getStepStatus = (step: 'init' | 'debug' | 'sync'): StepStatus => {
		if (runningStep === step) {
			return 'in-progress';
		}
		if (step === 'init' && workflowStatus?.initCompleted) {
			return 'completed';
		}
		if (step === 'debug' && workflowStatus?.debugCompleted) {
			return 'completed';
		}
		if (step === 'sync' && workflowStatus?.syncCompleted) {
			return 'completed';
		}
		return 'pending';
	};

	const getStepIcon = (status: StepStatus) => {
		switch (status) {
			case 'completed':
				return <CheckCircle2 className='size-5 text-green-500' />;
			case 'in-progress':
				return <Loader2 className='size-5 text-blue-500 animate-spin' />;
			case 'error':
				return <AlertCircle className='size-5 text-red-500' />;
			default:
				return <Circle className='size-5 text-muted-foreground' />;
		}
	};

	const canRunStep = (step: 'init' | 'debug' | 'sync'): boolean => {
		if (runningStep) {
			return false;
		}
		if (step === 'init') {
			return true;
		}
		if (step === 'debug') {
			return workflowStatus?.initCompleted ?? false;
		}
		if (step === 'sync') {
			return workflowStatus?.debugCompleted ?? false;
		}
		return false;
	};

	const steps: WorkflowStep[] = [
		{
			id: 'init',
			title: '1. Initialize Project',
			description:
				'Set up the project configuration. This creates the necessary configuration files for your analytics project.',
			status: getStepStatus('init'),
			error: workflowStatus?.lastError,
			completedAt: workflowStatus?.initCompletedAt,
		},
		{
			id: 'debug',
			title: '2. Verify Setup',
			description:
				'Validate your project configuration and dependencies. This checks that all required tools and configurations are properly set up.',
			status: getStepStatus('debug'),
			error: workflowStatus?.lastError,
			completedAt: workflowStatus?.debugCompletedAt,
		},
		{
			id: 'sync',
			title: '3. Synchronize Context',
			description:
				'Load your data sources and metadata into the project context. This enables the AI to query and analyze your data.',
			status: getStepStatus('sync'),
			error: workflowStatus?.lastError,
			completedAt: workflowStatus?.syncCompletedAt,
		},
	];

	const handleOpenModal = (step: 'init' | 'debug' | 'sync') => {
		setOpenModal(step);
	};

	const handleMutationError = (error: unknown, operation: string) => {
		console.error('Mutation error:', error);

		// Check for HTTP 413 error (Request body too large)
		if (error && typeof error === 'object' && 'data' in error) {
			const errorData = error.data as { code?: number; httpStatus?: number };
			if (errorData.code === 413 || errorData.httpStatus === 413) {
				setErrorModal({
					title: 'File Upload Too Large',
					message: `The ${operation} operation failed because the total size of uploaded files is too large.`,
					suggestions: [
						'Try uploading fewer files at once',
						'Compress large files (PDF, images) before uploading',
						'Consider using external storage (like S3) and provide URLs instead',
						'Maximum recommended upload size is 75 MB per operation',
					],
				});
				return;
			}
		}

		// Generic error for other cases
		const errorMessage =
			error && typeof error === 'object' && 'message' in error
				? (error.message as string)
				: 'An unexpected error occurred';

		setErrorModal({
			title: `${operation} Failed`,
			message: errorMessage,
			suggestions: [
				'Check your network connection',
				'Try again in a moment',
				'If the problem persists, contact support',
			],
		});
	};

	const handleRunInit = (databases: any[], repos: any[], docFiles: any[], confluence: any[]) => {
		// Run the mutation with the configuration data
		runInitMutation.mutate({
			projectName: projectName || undefined,
			databases,
			repos,
			docFiles,
			confluence,
		});
	};

	const handleRunDebug = () => {
		runDebugMutation.mutate();
	};

	const handleRunSync = () => {
		// For now, sync doesn't take parameters in the backend
		// But we could extend it to pass selected providers
		runSyncMutation.mutate();
	};

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-col gap-2'>
				<h2 className='text-xl font-semibold text-foreground'>Workflow Setup</h2>
				<p className='text-sm text-muted-foreground'>
					Complete these steps to set up your analytics project. All steps must be completed before you can
					start a chat.
				</p>
			</div>

			{workflowStatus?.allCompleted ? (
				<SettingsCard className='bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'>
					<div className='flex items-start gap-3'>
						<CheckCircle2 className='size-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5' />
						<div className='flex flex-col gap-1'>
							<div className='font-semibold text-green-900 dark:text-green-100'>Workflow Complete!</div>
							<p className='text-sm text-green-700 dark:text-green-300'>
								Your project is fully configured and ready to use. You can now start chatting with your
								data.
							</p>
						</div>
					</div>
				</SettingsCard>
			) : (
				<SettingsCard className='bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'>
					<div className='flex items-start gap-3'>
						<AlertCircle className='size-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
						<div className='flex flex-col gap-1'>
							<div className='font-semibold text-amber-900 dark:text-amber-100'>Setup Required</div>
							<p className='text-sm text-amber-700 dark:text-amber-300'>
								Complete all workflow steps below before starting a chat. This ensures your project is
								properly configured.
							</p>
						</div>
					</div>
				</SettingsCard>
			)}

			<div className='flex flex-col gap-4'>
				{steps.map((step) => (
					<SettingsCard
						key={step.id}
						className={cn(
							'transition-all',
							step.status === 'completed' && 'border-green-200 dark:border-green-900',
						)}
					>
						<div className='flex flex-col gap-4'>
							<div className='flex items-start gap-4'>
								<div className='mt-0.5'>{getStepIcon(step.status)}</div>
								<div className='flex flex-col gap-2 flex-1'>
									<div>
										<h3
											className={cn(
												'font-semibold text-base',
												step.status === 'completed' && 'text-green-700 dark:text-green-300',
											)}
										>
											{step.title}
										</h3>
										<p className='text-sm text-muted-foreground mt-1'>{step.description}</p>
									</div>

									{step.error && step.status === 'error' && (
										<div className='p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md'>
											<p className='text-sm text-red-700 dark:text-red-300 font-medium'>Error:</p>
											<p className='text-sm text-red-600 dark:text-red-400 mt-1 font-mono text-xs whitespace-pre-wrap'>
												{step.error}
											</p>
										</div>
									)}

									{step.completedAt && step.status === 'completed' && (
										<p className='text-xs text-muted-foreground'>
											Completed {new Date(step.completedAt).toLocaleString()}
										</p>
									)}

									<div className='flex items-center gap-2'>
										{step.status === 'completed' ? (
											<>
												<Button
													size='sm'
													variant='outline'
													onClick={() => handleOpenModal(step.id)}
													disabled={!!runningStep}
												>
													<Settings className='size-4 mr-2' />
													Configure
												</Button>
												<Button
													size='sm'
													variant='ghost'
													onClick={() => handleOpenModal(step.id)}
													disabled={!!runningStep}
												>
													<RefreshCw className='size-4 mr-2' />
													Re-run
												</Button>
											</>
										) : (
											<Button
												size='sm'
												onClick={() => handleOpenModal(step.id)}
												disabled={!canRunStep(step.id) || runningStep !== null}
											>
												{runningStep === step.id ? (
													<>
														<Loader2 className='size-4 mr-2 animate-spin' />
														Running...
													</>
												) : (
													<>
														<Play className='size-4 mr-2' />
														Configure & Run
													</>
												)}
											</Button>
										)}
									</div>
								</div>
							</div>
						</div>
					</SettingsCard>
				))}
			</div>

			{/* Init Configuration Modal - Using InitWizard */}
			<Dialog open={openModal === 'init'} onOpenChange={(open) => setOpenModal(open ? 'init' : null)}>
				<DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>Initialize Project</DialogTitle>
						<DialogDescription>
							Set up your project configuration with databases, repositories, and documentation files.
						</DialogDescription>
					</DialogHeader>

					<InitWizard
						projectName={projectName}
						forceInit={forceInit}
						onProjectNameChange={setProjectName}
						onForceInitChange={setForceInit}
						onInit={handleRunInit}
						isPending={runInitMutation.isPending}
					/>
				</DialogContent>
			</Dialog>

			{/* Debug Modal */}
			<Dialog open={openModal === 'debug'} onOpenChange={(open) => setOpenModal(open ? 'debug' : null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Verify Setup</DialogTitle>
						<DialogDescription>
							Validate your project configuration and test connections to databases and LLM providers.
						</DialogDescription>
					</DialogHeader>

					<div className='flex flex-col gap-4 py-4'>
						<div className='p-4 bg-muted rounded-md'>
							<p className='text-sm font-medium mb-2'>This will verify:</p>
							<ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside'>
								<li>Configuration file validity</li>
								<li>Database connections</li>
								<li>LLM provider connectivity</li>
								<li>Required dependencies</li>
							</ul>
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setOpenModal(null)}>
							Cancel
						</Button>
						<Button onClick={handleRunDebug} disabled={runDebugMutation.isPending}>
							{runDebugMutation.isPending ? (
								<>
									<Loader2 className='size-4 mr-2 animate-spin' />
									Verifying...
								</>
							) : (
								<>
									<Play className='size-4 mr-2' />
									Verify Setup
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Sync Configuration Modal */}
			<Dialog open={openModal === 'sync'} onOpenChange={(open) => setOpenModal(open ? 'sync' : null)}>
				<DialogContent className='max-w-md'>
					<DialogHeader>
						<DialogTitle>Synchronize Context</DialogTitle>
						<DialogDescription>
							Load your data sources and metadata into the project context for AI analysis.
						</DialogDescription>
					</DialogHeader>

					<div className='flex flex-col gap-4 py-4'>
						<div className='flex flex-col gap-2'>
							<Label>Select Providers to Sync</Label>
							<div className='flex flex-col gap-3'>
								{['databases', 'repos', 'docs', 'semantics'].map((provider) => (
									<div key={provider} className='flex items-center justify-between'>
										<span className='text-sm'>
											{provider.charAt(0).toUpperCase() + provider.slice(1)}
										</span>
										<Switch
											id={`provider-${provider}`}
											checked={selectedProviders.includes(provider)}
											onCheckedChange={(checked) => {
												if (checked) {
													setSelectedProviders([...selectedProviders, provider]);
												} else {
													setSelectedProviders(
														selectedProviders.filter((p) => p !== provider),
													);
												}
											}}
										/>
									</div>
								))}
							</div>
							<p className='text-xs text-muted-foreground'>
								Select which resources to sync. Databases and repos are recommended for most use cases.
							</p>
						</div>

						<div className='p-4 bg-muted rounded-md'>
							<p className='text-sm font-medium mb-2'>This will:</p>
							<ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside'>
								<li>Connect to configured data sources</li>
								<li>Extract schema and metadata</li>
								<li>Create documentation files</li>
								<li>Load context for AI queries</li>
							</ul>
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setOpenModal(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleRunSync}
							disabled={runSyncMutation.isPending || selectedProviders.length === 0}
						>
							{runSyncMutation.isPending ? (
								<>
									<Loader2 className='size-4 mr-2 animate-spin' />
									Syncing...
								</>
							) : (
								<>
									<Play className='size-4 mr-2' />
									Synchronize Context
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Error Modal */}
			<Dialog open={errorModal !== null} onOpenChange={(open) => !open && setErrorModal(null)}>
				<DialogContent className='max-w-lg'>
					<DialogHeader>
						<DialogTitle className='flex items-center gap-2'>
							<AlertTriangle className='size-5 text-amber-500' />
							{errorModal?.title}
						</DialogTitle>
					</DialogHeader>

					<div className='flex flex-col gap-4 py-4'>
						<p className='text-sm text-muted-foreground'>{errorModal?.message}</p>

						<div className='p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md'>
							<p className='text-sm font-medium mb-2 text-amber-900 dark:text-amber-100'>Suggestions:</p>
							<ul className='text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside'>
								{errorModal?.suggestions.map((suggestion, index) => (
									<li key={index}>{suggestion}</li>
								))}
							</ul>
						</div>
					</div>

					<DialogFooter>
						<Button onClick={() => setErrorModal(null)}>Got it</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{isLoading && (
				<div className='flex items-center justify-center p-8'>
					<Loader2 className='size-6 animate-spin text-muted-foreground' />
				</div>
			)}
		</div>
	);
}
