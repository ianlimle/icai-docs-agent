import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/main';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsCard } from '@/components/ui/settings-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export const Route = createFileRoute('/_sidebar-layout/settings/project/guardrails')({
	component: GuardrailsSettingsPage,
});

function GuardrailsSettingsPage() {
	const [showPatternDialog, setShowPatternDialog] = useState(false);
	const [activeTab, setActiveTab] = useState('limits');
	const [editingPattern, setEditingPattern] = useState<
		| { id?: string; name: string; pattern: string; isAllowed: boolean; isEnabled: boolean; description?: string }
		| undefined
	>(undefined);
	const queryClient = useQueryClient();

	const { data: settings, isLoading } = useQuery({
		...trpc.guardrails.getSettings.queryOptions(),
	});

	const { data: stats } = useQuery({
		...trpc.guardrails.getStats.queryOptions(),
		refetchInterval: 30000, // Refresh every 30s
	});

	const updateSettingsMutation = useMutation(
		trpc.guardrails.updateSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.guardrails.getSettings.queryOptions());
			},
		}),
	);

	const addPatternMutation = useMutation(
		trpc.guardrails.addCustomPattern.mutationOptions({
			onSuccess: () => {
				setShowPatternDialog(false);
				setEditingPattern(undefined);
				queryClient.invalidateQueries(trpc.guardrails.getSettings.queryOptions());
			},
		}),
	);

	const removePatternMutation = useMutation(
		trpc.guardrails.removeCustomPattern.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.guardrails.getSettings.queryOptions());
			},
		}),
	);

	const resetSettingsMutation = useMutation(
		trpc.guardrails.resetSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.guardrails.getSettings.queryOptions());
			},
		}),
	);

	if (isLoading || !settings) {
		return <div className='flex items-center justify-center p-8'>Loading...</div>;
	}

	const handleSaveSettings = (newSettings: typeof settings) => {
		updateSettingsMutation.mutate(newSettings);
	};

	const handleAddPattern = (pattern: typeof editingPattern) => {
		if (!pattern) {
			return;
		}

		if (pattern.id) {
			// Edit existing pattern
			const updatedPatterns = settings.customPatterns.map((p) =>
				p.id === pattern.id ? { ...p, ...pattern, updatedAt: Date.now() } : p,
			);
			handleSaveSettings({ ...settings, customPatterns: updatedPatterns as any });
		} else {
			// Add new pattern
			addPatternMutation.mutate(pattern as any);
		}
		setShowPatternDialog(false);
		setEditingPattern(undefined);
	};

	const handleRemovePattern = (id: string) => {
		if (confirm('Are you sure you want to remove this pattern?')) {
			removePatternMutation.mutate({ id });
		}
	};

	const handleResetSettings = () => {
		if (confirm('Are you sure you want to reset all guardrails settings to defaults?')) {
			resetSettingsMutation.mutate();
		}
	};

	const activePatterns = settings.customPatterns?.filter((p) => p.isEnabled) || [];
	const blockPatterns = activePatterns.filter((p) => !p.isAllowed);
	const allowPatterns = activePatterns.filter((p) => p.isAllowed);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-col gap-2'>
				<h2 className='text-xl font-semibold text-foreground'>Guardrails Settings</h2>
				<p className='text-sm text-muted-foreground'>
					Configure query validation, rate limiting, and content safety for your project.
				</p>
			</div>

			{/* Stats Overview */}
			{stats && (
				<SettingsCard>
					<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
						<div className='flex flex-col gap-1'>
							<div className='text-sm text-muted-foreground'>Active Rate Limits</div>
							<div className='text-2xl font-semibold'>{stats.rateLimitEntries}</div>
						</div>
						<div className='flex flex-col gap-1'>
							<div className='text-sm text-muted-foreground'>Configured Projects</div>
							<div className='text-2xl font-semibold'>{stats.projectsConfigured}</div>
						</div>
						<div className='flex flex-col gap-1'>
							<div className='text-sm text-muted-foreground'>Audit Retention</div>
							<div className='text-2xl font-semibold'>{stats.auditLogRetentionDays} days</div>
						</div>
						<div className='flex flex-col gap-1'>
							<div className='text-sm text-muted-foreground'>Custom Patterns</div>
							<div className='text-2xl font-semibold'>{activePatterns.length}</div>
						</div>
					</div>
				</SettingsCard>
			)}

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className='grid w-full grid-cols-4'>
					<TabsTrigger value='limits'>Query Limits</TabsTrigger>
					<TabsTrigger value='safety'>Content Safety</TabsTrigger>
					<TabsTrigger value='patterns'>Custom Patterns</TabsTrigger>
					<TabsTrigger value='audit'>Audit & Logging</TabsTrigger>
				</TabsList>

				{/* Query Limits Tab */}
				<TabsContent value='limits'>
					<div className='flex flex-col gap-4'>
						<SettingsCard>
							<div className='flex flex-col gap-4'>
								<div>
									<h3 className='text-lg font-semibold mb-4'>Query Validation</h3>
									<div className='space-y-4'>
										<div className='flex flex-col gap-2'>
											<Label htmlFor='maxQueryLength'>Max Query Length (characters)</Label>
											<Input
												id='maxQueryLength'
												type='number'
												value={settings.maxQueryLength}
												onChange={(e) =>
													handleSaveSettings({
														...settings,
														maxQueryLength: parseInt(e.target.value) || 5000,
													})
												}
												min={100}
												max={50000}
											/>
											<p className='text-xs text-muted-foreground'>
												Maximum allowed length for user queries (100-50000)
											</p>
										</div>

										<div className='flex flex-col gap-2'>
											<Label htmlFor='maxQueryComplexity'>Max Query Complexity Score</Label>
											<Input
												id='maxQueryComplexity'
												type='number'
												value={settings.maxQueryComplexity}
												onChange={(e) =>
													handleSaveSettings({
														...settings,
														maxQueryComplexity: parseInt(e.target.value) || 100,
													})
												}
												min={10}
												max={1000}
											/>
											<p className='text-xs text-muted-foreground'>
												Complexity score based on special characters, patterns, and nesting
												(10-1000)
											</p>
										</div>
									</div>
								</div>

								<hr />

								<div>
									<h3 className='text-lg font-semibold mb-4'>Rate Limiting</h3>
									<div className='flex items-center justify-between mb-4'>
										<div className='space-y-0.5'>
											<Label>Enable Rate Limiting</Label>
											<p className='text-xs text-muted-foreground'>
												Limit the number of queries per user
											</p>
										</div>
										<Switch
											checked={settings.enableRateLimiting}
											onCheckedChange={(checked) =>
												handleSaveSettings({ ...settings, enableRateLimiting: checked })
											}
										/>
									</div>

									{settings.enableRateLimiting && (
										<div className='space-y-4'>
											<div className='flex flex-col gap-2'>
												<Label htmlFor='maxRequestsPerMinute'>Max Requests Per Minute</Label>
												<Input
													id='maxRequestsPerMinute'
													type='number'
													value={settings.rateLimitConfig.maxRequestsPerMinute}
													onChange={(e) =>
														handleSaveSettings({
															...settings,
															rateLimitConfig: {
																...settings.rateLimitConfig,
																maxRequestsPerMinute: parseInt(e.target.value) || 10,
															},
														})
													}
													min={1}
													max={100}
												/>
											</div>

											<div className='flex flex-col gap-2'>
												<Label htmlFor='maxRequestsPerHour'>Max Requests Per Hour</Label>
												<Input
													id='maxRequestsPerHour'
													type='number'
													value={settings.rateLimitConfig.maxRequestsPerHour}
													onChange={(e) =>
														handleSaveSettings({
															...settings,
															rateLimitConfig: {
																...settings.rateLimitConfig,
																maxRequestsPerHour: parseInt(e.target.value) || 100,
															},
														})
													}
													min={10}
													max={1000}
												/>
											</div>

											<div className='flex flex-col gap-2'>
												<Label htmlFor='burstAllowance'>Burst Allowance</Label>
												<Input
													id='burstAllowance'
													type='number'
													value={settings.rateLimitConfig.burstAllowance}
													onChange={(e) =>
														handleSaveSettings({
															...settings,
															rateLimitConfig: {
																...settings.rateLimitConfig,
																burstAllowance: parseInt(e.target.value) || 5,
															},
														})
													}
													min={0}
													max={20}
												/>
												<p className='text-xs text-muted-foreground'>
													Allow short bursts above the normal rate limit
												</p>
											</div>
										</div>
									)}
								</div>
							</div>
						</SettingsCard>
					</div>
				</TabsContent>

				{/* Content Safety Tab */}
				<TabsContent value='safety'>
					<div className='flex flex-col gap-4'>
						<SettingsCard>
							<div className='flex flex-col gap-6'>
								<div>
									<h3 className='text-lg font-semibold mb-4'>Prompt Injection Detection</h3>
									<div className='space-y-4'>
										<div className='flex items-center justify-between'>
											<div className='space-y-0.5'>
												<Label>Enable Detection</Label>
												<p className='text-xs text-muted-foreground'>
													Detect attempts to manipulate system prompts
												</p>
											</div>
											<Switch
												checked={settings.enablePromptInjectionDetection}
												onCheckedChange={(checked) =>
													handleSaveSettings({
														...settings,
														enablePromptInjectionDetection: checked,
													})
												}
											/>
										</div>

										{settings.enablePromptInjectionDetection && (
											<div className='flex flex-col gap-2'>
												<Label htmlFor='strictness'>Detection Strictness</Label>
												<Select
													value={settings.promptInjectionStrictness}
													onValueChange={(value: 'low' | 'medium' | 'high') =>
														handleSaveSettings({
															...settings,
															promptInjectionStrictness: value,
														})
													}
												>
													<SelectTrigger id='strictness'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='low'>
															Low - Minimal false positives
														</SelectItem>
														<SelectItem value='medium'>Medium - Balanced</SelectItem>
														<SelectItem value='high'>High - Maximum protection</SelectItem>
													</SelectContent>
												</Select>
												<p className='text-xs text-muted-foreground'>
													Higher strictness may result in more false positives
												</p>
											</div>
										)}
									</div>
								</div>

								<hr />

								<div>
									<h3 className='text-lg font-semibold mb-4'>PII Detection & Redaction</h3>
									<div className='space-y-4'>
										<div className='flex items-center justify-between'>
											<div className='space-y-0.5'>
												<Label>Enable PII Detection</Label>
												<p className='text-xs text-muted-foreground'>
													Detect emails, phones, API keys, and other sensitive data
												</p>
											</div>
											<Switch
												checked={settings.enablePIIDetection}
												onCheckedChange={(checked) =>
													handleSaveSettings({ ...settings, enablePIIDetection: checked })
												}
											/>
										</div>

										{settings.enablePIIDetection && (
											<div className='flex items-center justify-between'>
												<div className='space-y-0.5'>
													<Label>Auto-Redact PII</Label>
													<p className='text-xs text-muted-foreground'>
														Automatically redact detected PII with [REDACTED]
													</p>
												</div>
												<Switch
													checked={settings.enablePIIRedaction}
													onCheckedChange={(checked) =>
														handleSaveSettings({ ...settings, enablePIIRedaction: checked })
													}
												/>
											</div>
										)}
									</div>
								</div>

								<hr />

								<div>
									<h3 className='text-lg font-semibold mb-4'>General Settings</h3>
									<div className='space-y-4'>
										<div className='flex items-center justify-between'>
											<div className='space-y-0.5'>
												<Label>Block Queries on Violation</Label>
												<p className='text-xs text-muted-foreground'>
													Block queries that violate guardrails (vs. warning only)
												</p>
											</div>
											<Switch
												checked={settings.blockOnError}
												onCheckedChange={(checked) =>
													handleSaveSettings({ ...settings, blockOnError: checked })
												}
											/>
										</div>

										<div className='flex items-center justify-between'>
											<div className='space-y-0.5'>
												<Label>Show Error to User</Label>
												<p className='text-xs text-muted-foreground'>
													Display specific error messages for blocked queries
												</p>
											</div>
											<Switch
												checked={settings.showErrorToUser}
												onCheckedChange={(checked) =>
													handleSaveSettings({ ...settings, showErrorToUser: checked })
												}
											/>
										</div>
									</div>
								</div>
							</div>
						</SettingsCard>
					</div>
				</TabsContent>

				{/* Custom Patterns Tab */}
				<TabsContent value='patterns'>
					<div className='flex flex-col gap-4'>
						<SettingsCard>
							<div className='flex items-center justify-between mb-4'>
								<div>
									<h3 className='text-lg font-semibold'>Custom Patterns</h3>
									<p className='text-sm text-muted-foreground'>
										Add custom regex patterns to allow or block specific content
									</p>
								</div>
								<Button
									onClick={() => {
										setEditingPattern({
											name: '',
											pattern: '',
											isAllowed: false,
											isEnabled: true,
											description: '',
										});
										setShowPatternDialog(true);
									}}
								>
									<Plus className='size-4 mr-2' />
									Add Pattern
								</Button>
							</div>

							{settings.customPatterns && settings.customPatterns.length > 0 ? (
								<div className='space-y-3'>
									{settings.customPatterns.map((pattern) => (
										<div
											key={pattern.id}
											className='flex items-center justify-between p-4 border rounded-lg bg-background'
										>
											<div className='flex flex-col gap-2 flex-1'>
												<div className='flex items-center gap-2'>
													<span className='font-medium'>{pattern.name}</span>
													<Badge variant={pattern.isAllowed ? 'default' : 'destructive'}>
														{pattern.isAllowed ? 'Allow' : 'Block'}
													</Badge>
													{!pattern.isEnabled && <Badge variant='secondary'>Disabled</Badge>}
												</div>
												<code className='text-xs bg-muted px-2 py-1 rounded'>
													{pattern.pattern}
												</code>
												{pattern.description && (
													<p className='text-xs text-muted-foreground'>
														{pattern.description}
													</p>
												)}
											</div>
											<div className='flex items-center gap-2'>
												<Button
													variant='ghost'
													size='sm'
													onClick={() => {
														setEditingPattern(pattern);
														setShowPatternDialog(true);
													}}
												>
													Edit
												</Button>
												<Button
													variant='ghost'
													size='icon-sm'
													onClick={() => handleRemovePattern(pattern.id)}
												>
													<Trash2 className='size-4' />
												</Button>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className='text-center py-8 text-muted-foreground'>
									No custom patterns configured. Click "Add Pattern" to create one.
								</div>
							)}
						</SettingsCard>

						{/* Pattern Summary */}
						{activePatterns.length > 0 && (
							<SettingsCard>
								<h3 className='text-lg font-semibold mb-4'>Pattern Summary</h3>
								<div className='grid grid-cols-2 gap-4'>
									<div className='p-4 border rounded-lg'>
										<div className='text-sm text-muted-foreground'>Block Patterns</div>
										<div className='text-2xl font-semibold text-red-600'>
											{blockPatterns.length}
										</div>
										<p className='text-xs text-muted-foreground mt-1'>
											Queries matching these patterns will be blocked
										</p>
									</div>
									<div className='p-4 border rounded-lg'>
										<div className='text-sm text-muted-foreground'>Allow Patterns</div>
										<div className='text-2xl font-semibold text-green-600'>
											{allowPatterns.length}
										</div>
										<p className='text-xs text-muted-foreground mt-1'>
											Explicitly allowed content patterns
										</p>
									</div>
								</div>
							</SettingsCard>
						)}
					</div>
				</TabsContent>

				{/* Audit & Logging Tab */}
				<TabsContent value='audit'>
					<div className='flex flex-col gap-4'>
						<SettingsCard>
							<div className='flex flex-col gap-4'>
								<div>
									<h3 className='text-lg font-semibold mb-4'>Audit Logging</h3>
									<div className='space-y-4'>
										<div className='flex items-center justify-between'>
											<div className='space-y-0.5'>
												<Label>Enable Audit Logging</Label>
												<p className='text-xs text-muted-foreground'>
													Log all guardrails violations and actions
												</p>
											</div>
											<Switch
												checked={settings.enableAuditLogging}
												onCheckedChange={(checked) =>
													handleSaveSettings({ ...settings, enableAuditLogging: checked })
												}
											/>
										</div>

										{settings.enableAuditLogging && (
											<div className='flex flex-col gap-2'>
												<Label htmlFor='retention'>Log Retention (days)</Label>
												<Input
													id='retention'
													type='number'
													value={settings.auditLogRetentionDays}
													onChange={(e) =>
														handleSaveSettings({
															...settings,
															auditLogRetentionDays: parseInt(e.target.value) || 7,
														})
													}
													min={1}
													max={365}
												/>
												<p className='text-xs text-muted-foreground'>
													Audit logs older than this will be automatically deleted
												</p>
											</div>
										)}
									</div>
								</div>

								<hr />

								<div className='flex justify-between'>
									<div className='space-y-0.5'>
										<div className='text-sm font-medium'>Reset All Settings</div>
										<p className='text-xs text-muted-foreground'>
											Revert all guardrails settings to default values
										</p>
									</div>
									<Button variant='destructive' onClick={handleResetSettings}>
										<RotateCcw className='size-4 mr-2' />
										Reset to Defaults
									</Button>
								</div>
							</div>
						</SettingsCard>
					</div>
				</TabsContent>
			</Tabs>

			{/* Pattern Dialog */}
			<Dialog open={showPatternDialog} onOpenChange={setShowPatternDialog}>
				<DialogContent className='max-w-md'>
					<DialogHeader>
						<DialogTitle>{editingPattern?.id ? 'Edit Pattern' : 'Add Pattern'}</DialogTitle>
						<DialogDescription>
							{editingPattern?.id
								? 'Update the custom pattern configuration'
								: 'Add a new custom allow or block pattern'}
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-4'>
						<div className='flex flex-col gap-2'>
							<Label htmlFor='patternName'>Pattern Name</Label>
							<Input
								id='patternName'
								placeholder='e.g., Block SQL Keywords'
								value={editingPattern?.name || ''}
								onChange={(e) => setEditingPattern({ ...editingPattern!, name: e.target.value })}
							/>
						</div>

						<div className='flex flex-col gap-2'>
							<Label htmlFor='patternRegex'>Regex Pattern</Label>
							<Textarea
								id='patternRegex'
								placeholder='e.g., \b(DROP|DELETE|TRUNCATE)\b'
								value={editingPattern?.pattern || ''}
								onChange={(e) => setEditingPattern({ ...editingPattern!, pattern: e.target.value })}
								className='font-mono text-sm'
								rows={3}
							/>
							<p className='text-xs text-muted-foreground'>
								Enter a valid regex pattern to match against queries
							</p>
						</div>

						<div className='flex flex-col gap-2'>
							<Label htmlFor='patternDesc'>Description (Optional)</Label>
							<Input
								id='patternDesc'
								placeholder='What this pattern matches'
								value={editingPattern?.description || ''}
								onChange={(e) => setEditingPattern({ ...editingPattern!, description: e.target.value })}
							/>
						</div>

						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Pattern Type</Label>
								<p className='text-xs text-muted-foreground'>
									Block: Reject matching queries | Allow: Explicitly permit
								</p>
							</div>
							<Select
								value={editingPattern?.isAllowed ? 'allow' : 'block'}
								onValueChange={(value) =>
									setEditingPattern({ ...editingPattern!, isAllowed: value === 'allow' })
								}
							>
								<SelectTrigger className='w-[180px]'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='block'>Block Pattern</SelectItem>
									<SelectItem value='allow'>Allow Pattern</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Enabled</Label>
								<p className='text-xs text-muted-foreground'>
									Whether this pattern is currently active
								</p>
							</div>
							<Switch
								checked={editingPattern?.isEnabled ?? true}
								onCheckedChange={(checked) =>
									setEditingPattern({ ...editingPattern!, isEnabled: checked })
								}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setShowPatternDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => handleAddPattern(editingPattern)}
							disabled={!editingPattern?.name || !editingPattern?.pattern}
						>
							{editingPattern?.id ? 'Update' : 'Add'} Pattern
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
