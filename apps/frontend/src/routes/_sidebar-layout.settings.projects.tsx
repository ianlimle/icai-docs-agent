import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	MessageSquare,
	Plus,
	Shield,
	Trash2,
	ShieldCheck,
	Settings,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { EnrichedProject } from '@/hooks/use-projects';
import { trpc } from '@/main';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '@/components/ui/settings-card';
import { useCreateProject, useDeleteProject, useProjectsList, useSwitchProject } from '@/hooks/use-projects';

export const Route = createFileRoute('/_sidebar-layout/settings/projects')({
	component: ProjectsPage,
});

function ProjectsPage() {
	const { data: projects, isLoading } = useProjectsList();
	const switchProject = useSwitchProject();
	const createProject = useCreateProject();
	const deleteProject = useDeleteProject();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState('');

	const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
	const [deleteConfirmName, setDeleteConfirmName] = useState('');

	const handleCreateProject = async () => {
		if (!newProjectName.trim()) {
			return;
		}

		// Create project - backend will handle directory creation
		await createProject.mutateAsync({
			name: newProjectName.trim(),
		});

		setNewProjectName('');
		setIsCreateDialogOpen(false);

		// Invalidate workflow status to ensure fresh data
		queryClient.invalidateQueries({
			queryKey: trpc.workflow.getStatus.queryKey(),
		});

		// Navigate to workflow page to complete setup
		navigate({ to: '/settings/project/workflow' });
	};

	const handleDeleteProject = async () => {
		if (!deleteProjectId) {
			return;
		}

		await deleteProject.mutateAsync({ projectId: deleteProjectId });

		setDeleteProjectId(null);
		setDeleteConfirmName('');
	};

	const handleSetAsDefault = async (projectId: string) => {
		await switchProject.mutate({ projectId });
	};

	const handleViewSettings = (projectId: string) => {
		// First set as active project, then navigate
		switchProject.mutate({ projectId });
		navigate({ to: '/settings/project' });
	};

	return (
		<>
			<SettingsCard
				title='Projects'
				titleSize='lg'
				action={
					<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
						<DialogTrigger asChild>
							<Button variant='default' size='sm'>
								<Plus className='size-4' />
								New Project
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Project</DialogTitle>
								<DialogDescription>
									Enter a name for your new project. The system will create the project directory
									automatically.
								</DialogDescription>
							</DialogHeader>
							<div className='grid gap-4 py-4'>
								<div className='grid gap-2'>
									<Label htmlFor='project-name'>Project Name</Label>
									<Input
										id='project-name'
										value={newProjectName}
										onChange={(e) => setNewProjectName(e.target.value)}
										placeholder='My Analytics Project'
									/>
									<p className='text-xs text-muted-foreground'>
										A new directory will be created for your project automatically.
									</p>
								</div>
							</div>
							<DialogFooter>
								<Button variant='outline' onClick={() => setIsCreateDialogOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={handleCreateProject}
									disabled={createProject.isPending || !newProjectName.trim()}
								>
									{createProject.isPending ? (
										<Loader2 className='size-4 animate-spin' />
									) : (
										'Create & Setup Project'
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				}
			>
				{isLoading ? (
					<div className='flex items-center justify-center py-12'>
						<Loader2 className='size-6 animate-spin text-muted-foreground' />
					</div>
				) : !projects || projects.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-12 text-center'>
						<Shield className='size-12 text-muted-foreground mb-4' />
						<h3 className='text-lg font-semibold mb-2'>No projects yet</h3>
						<p className='text-sm text-muted-foreground mb-4'>
							Create your first project to start analyzing your data.
						</p>
						<Button onClick={() => setIsCreateDialogOpen(true)}>
							<Plus className='size-4' />
							Create Project
						</Button>
					</div>
				) : (
					<div className='grid gap-3'>
						{projects.map((project) => (
							<div
								key={project.id}
								className='flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
							>
								<div className='flex-1 min-w-0'>
									<div className='flex items-center gap-2'>
										<h3 className='font-semibold text-foreground truncate'>{project.name}</h3>
										{project.isActive && (
											<span className='flex items-center gap-1 text-xs text-green-600 dark:text-green-400'>
												<CheckCircle2 className='size-3' />
												Default
											</span>
										)}
									</div>
								</div>

								<div className='flex items-center gap-4 text-sm text-muted-foreground'>
									<div className='flex items-center gap-1' title='Chats'>
										<MessageSquare className='size-4' />
										<span>{project.chatCount}</span>
									</div>
									<div className='flex items-center gap-1' title='Your role'>
										<ShieldCheck className='size-4' />
										<span className='capitalize'>{project.role}</span>
									</div>
								</div>

								<div className='flex items-center gap-2'>
									<Button
										variant='outline'
										size='icon-sm'
										onClick={() => handleViewSettings(project.id)}
										title='View project settings'
									>
										<Settings className='size-4' />
									</Button>

									{!project.isActive && (
										<Button
											variant='outline'
											size='sm'
											onClick={() => handleSetAsDefault(project.id)}
											disabled={switchProject.isPending}
										>
											{switchProject.isPending ? (
												<Loader2 className='size-4 animate-spin' />
											) : (
												'Set as Default'
											)}
										</Button>
									)}

									{project.role === 'admin' && projects.length > 1 && (
										<Button
											variant='ghost-muted'
											size='icon-sm'
											onClick={() => setDeleteProjectId(project.id)}
											title='Delete project'
										>
											<Trash2 className='size-4' />
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</SettingsCard>

			<AlertDialog
				open={deleteProjectId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteProjectId(null);
						setDeleteConfirmName('');
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<AlertTriangle className='size-8 text-destructive' />
						</AlertDialogMedia>
						<AlertDialogTitle>Delete Project?</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteProjectId && (
								<>
									This will permanently delete{' '}
									<strong>
										{projects?.find((p: EnrichedProject) => p.id === deleteProjectId)?.name}
									</strong>
									{', '}
									including all chats and associated data. This action cannot be undone.
								</>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className='py-2'>
						<Label htmlFor='delete-confirm'>Type project name to confirm</Label>
						<Input
							id='delete-confirm'
							value={deleteConfirmName}
							onChange={(e) => setDeleteConfirmName(e.target.value)}
							placeholder={
								deleteProjectId
									? (projects?.find((p: EnrichedProject) => p.id === deleteProjectId)?.name ?? '')
									: ''
							}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant='destructive'
							onClick={handleDeleteProject}
							disabled={
								deleteProjectId === null ||
								deleteConfirmName !==
									(projects?.find((p: EnrichedProject) => p.id === deleteProjectId)?.name ?? '') ||
								deleteProject.isPending
							}
						>
							{deleteProject.isPending ? <Loader2 className='size-4 animate-spin' /> : 'Delete Project'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={`${className} bg-muted mb-2 inline-flex size-12 items-center justify-center rounded-md`}
			{...props}
		/>
	);
}
