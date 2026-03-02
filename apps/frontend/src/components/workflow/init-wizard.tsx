import { useState } from 'react';
import { Plus, Trash2, Upload as UploadIcon, File, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Database types available in nao_core
const DATABASE_TYPES = [
	{ value: 'postgres', label: 'PostgreSQL' },
	{ value: 'snowflake', label: 'Snowflake' },
	{ value: 'bigquery', label: 'BigQuery' },
	{ value: 'duckdb', label: 'DuckDB' },
	{ value: 'athena', label: 'AWS Athena' },
	{ value: 'redshift', label: 'Redshift' },
	{ value: 'databricks', label: 'Databricks' },
	{ value: 'mssql', label: 'SQL Server' },
];

interface DatabaseConfig {
	id: string;
	type: string;
	name: string;
	connectionString?: string;
	// Add more fields as needed based on database type
}

interface RepoConfig {
	id: string;
	url: string;
	branch?: string;
}

interface DocFile {
	id: string;
	name: string;
	size: number;
	file?: File;
	content?: string; // base64-encoded content
}

interface ConfluenceConfig {
	id: string;
	spaceUrl: string;
	apiToken?: string;
	email?: string;
}

interface InitWizardProps {
	projectName: string;
	forceInit: boolean;
	onProjectNameChange: (name: string) => void;
	onForceInitChange: (force: boolean) => void;
	onInit: (
		databases: DatabaseConfig[],
		repos: RepoConfig[],
		docFiles: Array<{ id: string; name: string; size: number; content: string }>,
		confluence: ConfluenceConfig[],
	) => void;
	isPending?: boolean;
}

export function InitWizard({
	projectName,
	forceInit,
	onProjectNameChange,
	onForceInitChange,
	onInit,
	isPending = false,
}: InitWizardProps) {
	const [activeTab, setActiveTab] = useState<'basic' | 'databases' | 'repos' | 'docs' | 'confluence'>('basic');
	const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
	const [repos, setRepos] = useState<RepoConfig[]>([]);
	const [docFiles, setDocFiles] = useState<DocFile[]>([]);
	const [confluence, setConfluence] = useState<ConfluenceConfig[]>([]);

	// Database state
	const [newDbType, setNewDbType] = useState('postgres');
	const [newDbName, setNewDbName] = useState('');
	const [newDbConnStr, setNewDbConnStr] = useState('');

	// Repo state
	const [newRepoUrl, setNewRepoUrl] = useState('');
	const [newRepoBranch, setNewRepoBranch] = useState('main');

	// Confluence state
	const [newSpaceUrl, setNewSpaceUrl] = useState('');
	const [newApiToken, setNewApiToken] = useState('');
	const [newEmail, setNewEmail] = useState('');

	const handleAddDatabase = () => {
		if (!newDbName.trim()) {
			return;
		}

		const newDb: DatabaseConfig = {
			id: crypto.randomUUID(),
			type: newDbType,
			name: newDbName.trim(),
			connectionString: newDbConnStr || undefined,
		};

		setDatabases([...databases, newDb]);
		setNewDbName('');
		setNewDbConnStr('');
	};

	const handleRemoveDatabase = (id: string) => {
		setDatabases(databases.filter((db) => db.id !== id));
	};

	const handleAddRepo = () => {
		if (!newRepoUrl.trim()) {
			return;
		}

		const newRepo: RepoConfig = {
			id: crypto.randomUUID(),
			url: newRepoUrl.trim(),
			branch: newRepoBranch || 'main',
		};

		setRepos([...repos, newRepo]);
		setNewRepoUrl('');
		setNewRepoBranch('main');
	};

	const handleRemoveRepo = (id: string) => {
		setRepos(repos.filter((repo) => repo.id !== id));
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		const newDocFiles: DocFile[] = files.map((file) => ({
			id: crypto.randomUUID(),
			name: file.name,
			size: file.size,
			file,
		}));

		setDocFiles([...docFiles, ...newDocFiles]);
	};

	const handleRemoveFile = (id: string) => {
		setDocFiles(docFiles.filter((file) => file.id !== id));
	};

	const handleAddConfluence = () => {
		if (!newSpaceUrl.trim()) {
			return;
		}

		const newSpace: ConfluenceConfig = {
			id: crypto.randomUUID(),
			spaceUrl: newSpaceUrl.trim(),
			apiToken: newApiToken || undefined,
			email: newEmail || undefined,
		};

		setConfluence([...confluence, newSpace]);
		setNewSpaceUrl('');
		setNewApiToken('');
		setNewEmail('');
	};

	const handleRemoveConfluence = (id: string) => {
		setConfluence(confluence.filter((space) => space.id !== id));
	};

	const readFileAsBase64 = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				// Remove the data URL prefix (e.g., "data:application/pdf;base64,")
				const base64 = result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	};

	const handleInit = async () => {
		// Convert files to base64 before sending
		const docFilesWithContent = await Promise.all(
			docFiles.map(async (docFile) => {
				if (!docFile.file) {
					return { ...docFile, content: '' };
				}
				const content = await readFileAsBase64(docFile.file);
				return {
					id: docFile.id,
					name: docFile.name,
					size: docFile.size,
					content,
				};
			}),
		);
		onInit(databases, repos, docFilesWithContent, confluence);
	};

	return (
		<div className='flex flex-col gap-6'>
			{/* Progress indicator */}
			<div className='flex items-center gap-2'>
				{['basic', 'databases', 'repos', 'docs', 'confluence'].map((tab) => (
					<div
						key={tab}
						className={cn('h-1 flex-1 rounded-full', tab === activeTab ? 'bg-primary' : 'bg-muted')}
					/>
				))}
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className='w-full'>
				<TabsList className='grid w-full grid-cols-5'>
					<TabsTrigger value='basic'>Basic Info</TabsTrigger>
					<TabsTrigger value='databases'>
						Databases
						{databases.length > 0 && (
							<Badge variant='secondary' className='ml-1'>
								{databases.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value='repos'>
						Repos
						{repos.length > 0 && (
							<Badge variant='secondary' className='ml-1'>
								{repos.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value='docs'>
						Docs
						{docFiles.length > 0 && (
							<Badge variant='secondary' className='ml-1'>
								{docFiles.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value='confluence'>
						Confluence
						{confluence.length > 0 && (
							<Badge variant='secondary' className='ml-1'>
								{confluence.length}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				{/* Basic Info Tab */}
				<TabsContent value='basic' className='mt-4'>
					<div className='flex flex-col gap-4'>
						<div className='flex flex-col gap-2'>
							<Label htmlFor='project-name'>
								Project Name <span className='text-red-500'>*</span>
							</Label>
							<Input
								id='project-name'
								placeholder='my-analytics-project'
								value={projectName}
								onChange={(e) => onProjectNameChange(e.target.value)}
								className='font-mono'
							/>
							<p className='text-xs text-muted-foreground'>
								Enter a name for your project. This will be used to identify your project.
							</p>
						</div>

						<Switch checked={forceInit} onCheckedChange={onForceInitChange}>
							<div className='space-y-0.5'>
								<div className='text-sm font-medium'>Overwrite existing configuration</div>
								<p className='text-xs text-muted-foreground'>
									If a config file already exists, check this to update it instead of creating a new
									one.
								</p>
							</div>
						</Switch>

						<div className='flex justify-end'>
							<Button onClick={() => setActiveTab('databases')} disabled={!projectName.trim()}>
								Next: Add Databases →
							</Button>
						</div>
					</div>
				</TabsContent>

				{/* Databases Tab */}
				<TabsContent value='databases' className='mt-4'>
					<div className='flex flex-col gap-6'>
						{/* Add Database Form */}
						<div className='flex flex-col gap-3 p-4 border rounded-lg bg-muted/30'>
							<h4 className='text-sm font-semibold'>Add Database Connection</h4>

							<div className='grid grid-cols-[150px_1fr] gap-3'>
								<div className='flex flex-col gap-1'>
									<Label htmlFor='db-type'>Database Type</Label>
									<Select value={newDbType} onValueChange={setNewDbType}>
										<SelectTrigger id='db-type'>
											<SelectValue placeholder='Select type' />
										</SelectTrigger>
										<SelectContent>
											{DATABASE_TYPES.map((db) => (
												<SelectItem key={db.value} value={db.value}>
													{db.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className='flex flex-col gap-1'>
									<Label htmlFor='db-name'>Connection Name</Label>
									<Input
										id='db-name'
										placeholder='production_db'
										value={newDbName}
										onChange={(e) => setNewDbName(e.target.value)}
										className='font-mono'
									/>
								</div>
							</div>

							<div className='flex flex-col gap-1'>
								<Label htmlFor='db-conn'>Connection String (Optional)</Label>
								<Input
									id='db-conn'
									placeholder='postgresql://user:password@localhost:5432/db'
									value={newDbConnStr}
									onChange={(e) => setNewDbConnStr(e.target.value)}
									className='font-mono text-xs'
									type='password'
								/>
								<p className='text-xs text-muted-foreground'>
									Leave empty to configure later in nao_config.yaml
								</p>
							</div>

							<Button onClick={handleAddDatabase} disabled={!newDbName.trim()}>
								<Plus className='size-4 mr-2' />
								Add Database
							</Button>
						</div>

						{/* Database List */}
						{databases.length > 0 && (
							<div className='flex flex-col gap-2'>
								<h4 className='text-sm font-semibold'>Configured Databases ({databases.length})</h4>
								<div className='flex flex-col gap-2'>
									{databases.map((db) => (
										<div
											key={db.id}
											className='flex items-center justify-between p-3 border rounded-lg bg-background'
										>
											<div className='flex flex-col gap-1'>
												<div className='flex items-center gap-2'>
													<Badge variant='outline'>{db.type}</Badge>
													<span className='text-sm font-medium'>{db.name}</span>
												</div>
												{db.connectionString && (
													<code className='text-xs text-muted-foreground font-mono truncate max-w-md'>
														{db.connectionString}
													</code>
												)}
											</div>
											<Button
												variant='ghost'
												size='icon-sm'
												onClick={() => handleRemoveDatabase(db.id)}
												className='text-destructive hover:text-destructive'
											>
												<Trash2 className='size-4' />
											</Button>
										</div>
									))}
								</div>
							</div>
						)}

						<div className='flex justify-between'>
							<Button variant='outline' onClick={() => setActiveTab('basic')}>
								← Back
							</Button>
							<Button onClick={() => setActiveTab('repos')}>Next: Add Repos →</Button>
						</div>
					</div>
				</TabsContent>

				{/* Repos Tab */}
				<TabsContent value='repos' className='mt-4'>
					<div className='flex flex-col gap-6'>
						{/* Add Repo Form */}
						<div className='flex flex-col gap-3 p-4 border rounded-lg bg-muted/30'>
							<h4 className='text-sm font-semibold'>Add Git Repository</h4>

							<div className='flex flex-col gap-3'>
								<div className='flex flex-col gap-1'>
									<Label htmlFor='repo-url'>
										Repository URL <span className='text-red-500'>*</span>
									</Label>
									<Input
										id='repo-url'
										placeholder='https://github.com/owner/repo.git'
										value={newRepoUrl}
										onChange={(e) => setNewRepoUrl(e.target.value)}
										className='font-mono text-sm'
									/>
								</div>

								<div className='flex flex-col gap-1'>
									<Label htmlFor='repo-branch'>Branch (Optional)</Label>
									<Input
										id='repo-branch'
										placeholder='main'
										value={newRepoBranch}
										onChange={(e) => setNewRepoBranch(e.target.value)}
										className='font-mono text-sm'
									/>
								</div>

								<Button onClick={handleAddRepo} disabled={!newRepoUrl.trim()}>
									<Plus className='size-4 mr-2' />
									Add Repository
								</Button>
							</div>

							<p className='text-xs text-muted-foreground'>
								Add your Git repositories to provide code context for the AI. Supports GitHub, GitLab,
								and more.
							</p>
						</div>

						{/* Repo List */}
						{repos.length > 0 && (
							<div className='flex flex-col gap-2'>
								<h4 className='text-sm font-semibold'>Configured Repositories ({repos.length})</h4>
								<div className='flex flex-col gap-2'>
									{repos.map((repo) => (
										<div
											key={repo.id}
											className='flex items-center justify-between p-3 border rounded-lg bg-background'
										>
											<div className='flex flex-col gap-1 flex-1 min-w-0'>
												<div className='text-sm font-medium truncate'>{repo.url}</div>
												{repo.branch && repo.branch !== 'main' && (
													<div className='text-xs text-muted-foreground'>
														Branch: {repo.branch}
													</div>
												)}
											</div>
											<Button
												variant='ghost'
												size='icon-sm'
												onClick={() => handleRemoveRepo(repo.id)}
												className='text-destructive hover:text-destructive'
											>
												<Trash2 className='size-4' />
											</Button>
										</div>
									))}
								</div>
							</div>
						)}

						<div className='flex justify-between'>
							<Button variant='outline' onClick={() => setActiveTab('databases')}>
								← Back
							</Button>
							<Button onClick={() => setActiveTab('docs')}>Next: Upload Docs →</Button>
						</div>
					</div>
				</TabsContent>

				{/* Documentation Tab */}
				<TabsContent value='docs' className='mt-4'>
					<div className='flex flex-col gap-6'>
						{/* Upload Area */}
						<div className='flex flex-col gap-3 p-6 border-2 border-dashed rounded-lg bg-muted/30'>
							<div className='flex flex-col items-center justify-center gap-2 text-center'>
								<UploadIcon className='size-8 text-muted-foreground' />
								<div>
									<Label htmlFor='doc-upload' className='cursor-pointer'>
										<span className='text-sm font-medium'>Click to upload or drag and drop</span>
										<Input
											id='doc-upload'
											type='file'
											multiple
											className='hidden'
											onChange={handleFileUpload}
										/>
									</Label>
									<p className='text-xs text-muted-foreground'>
										PDF, MD, TXT, and other documentation files
									</p>
								</div>
							</div>
						</div>

						{/* File List */}
						{docFiles.length > 0 && (
							<div className='flex flex-col gap-2'>
								<h4 className='text-sm font-semibold'>Documentation Files ({docFiles.length})</h4>
								<div className='flex flex-col gap-2'>
									{docFiles.map((file) => (
										<div
											key={file.id}
											className='flex items-center justify-between p-3 border rounded-lg bg-background'
										>
											<div className='flex items-center gap-3 flex-1 min-w-0'>
												<File className='size-4 text-muted-foreground shrink-0' />
												<div className='flex flex-col min-w-0'>
													<span className='text-sm font-medium truncate'>{file.name}</span>
													<span className='text-xs text-muted-foreground'>
														{(file.size / 1024).toFixed(1)} KB
													</span>
												</div>
											</div>
											<Button
												variant='ghost'
												size='icon-sm'
												onClick={() => handleRemoveFile(file.id)}
												className='text-destructive hover:text-destructive'
											>
												<X className='size-4' />
											</Button>
										</div>
									))}
								</div>
							</div>
						)}

						<div className='flex flex-col gap-2'>
							<p className='text-xs text-muted-foreground'>
								Upload documentation files (PDF, Markdown, etc.) to provide additional context to the
								AI. Files will be stored in the{' '}
								<code className='px-1 py-0.5 bg-muted rounded text-xs font-mono'>docs/</code>{' '}
								subdirectory.
							</p>
							<p className='text-xs text-muted-foreground'>
								This step is optional but recommended for better results.
							</p>
						</div>

						<div className='flex justify-between'>
							<Button variant='outline' onClick={() => setActiveTab('repos')}>
								← Back
							</Button>
							<Button onClick={() => setActiveTab('confluence')}>Next: Add Confluence →</Button>
						</div>
					</div>
				</TabsContent>

				{/* Confluence Tab */}
				<TabsContent value='confluence' className='mt-4'>
					<div className='flex flex-col gap-6'>
						{/* Add Confluence Space Form */}
						<div className='flex flex-col gap-3 p-4 border rounded-lg bg-muted/30'>
							<h4 className='text-sm font-semibold'>Add Confluence Space</h4>

							<div className='flex flex-col gap-3'>
								<div className='flex flex-col gap-1'>
									<Label htmlFor='space-url'>
										Space URL <span className='text-red-500'>*</span>
									</Label>
									<Input
										id='space-url'
										placeholder='https://company.atlassian.net/wiki/spaces/TEAM'
										value={newSpaceUrl}
										onChange={(e) => setNewSpaceUrl(e.target.value)}
										className='font-mono text-sm'
									/>
									<p className='text-xs text-muted-foreground'>
										URL to your Confluence space (e.g.,
										https://company.atlassian.net/wiki/spaces/TEAM)
									</p>
								</div>

								<div className='flex flex-col gap-1'>
									<Label htmlFor='api-token'>API Token</Label>
									<Input
										id='api-token'
										placeholder='Your Confluence API token'
										value={newApiToken}
										onChange={(e) => setNewApiToken(e.target.value)}
										className='font-mono text-sm'
										type='password'
									/>
									<p className='text-xs text-muted-foreground'>
										Create at{' '}
										<a
											href='https://id.atlassian.com/manage-profile/security/api-tokens'
											target='_blank'
											rel='noopener noreferrer'
											className='text-primary hover:underline'
										>
											Atlassian Account Settings
										</a>
									</p>
								</div>

								<div className='flex flex-col gap-1'>
									<Label htmlFor='email'>Email</Label>
									<Input
										id='email'
										placeholder='user@company.com'
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										className='font-mono text-sm'
										type='email'
									/>
									<p className='text-xs text-muted-foreground'>
										Email associated with your Atlassian account
									</p>
								</div>

								<Button onClick={handleAddConfluence} disabled={!newSpaceUrl.trim()}>
									<Plus className='size-4 mr-2' />
									Add Confluence Space
								</Button>
							</div>

							<p className='text-xs text-muted-foreground'>
								Add your Confluence spaces to provide documentation context for the AI. All pages in the
								space will be synchronized.
							</p>
						</div>

						{/* Confluence Space List */}
						{confluence.length > 0 && (
							<div className='flex flex-col gap-2'>
								<h4 className='text-sm font-semibold'>
									Configured Confluence Spaces ({confluence.length})
								</h4>
								<div className='flex flex-col gap-2'>
									{confluence.map((space) => (
										<div
											key={space.id}
											className='flex items-center justify-between p-3 border rounded-lg bg-background'
										>
											<div className='flex flex-col gap-1 flex-1 min-w-0'>
												<div className='text-sm font-medium truncate'>{space.spaceUrl}</div>
												{space.email && (
													<div className='text-xs text-muted-foreground'>{space.email}</div>
												)}
											</div>
											<Button
												variant='ghost'
												size='icon-sm'
												onClick={() => handleRemoveConfluence(space.id)}
												className='text-destructive hover:text-destructive'
											>
												<Trash2 className='size-4' />
											</Button>
										</div>
									))}
								</div>
							</div>
						)}

						<div className='flex flex-col gap-2'>
							<p className='text-xs text-muted-foreground'>
								This step is optional. Confluence spaces will be synchronized to the{' '}
								<code className='px-1 py-0.5 bg-muted rounded text-xs font-mono'>confluence/</code>{' '}
								subdirectory during "Synchronize Context".
							</p>
						</div>

						<div className='flex justify-between'>
							<Button variant='outline' onClick={() => setActiveTab('docs')}>
								← Back
							</Button>
							<Button onClick={handleInit} disabled={isPending}>
								{isPending ? (
									<>
										<X className='size-4 mr-2 animate-spin' />
										Initializing...
									</>
								) : (
									<>
										<Play className='size-4 mr-2' />
										Initialize Project
									</>
								)}
							</Button>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
