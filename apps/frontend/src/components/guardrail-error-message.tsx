import { AlertTriangle, Shield, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GuardrailViolation {
	type: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	message: string;
}

interface GuardrailErrorMessageProps {
	violations: GuardrailViolation[];
	sanitizedQuery?: string;
	onDismiss?: () => void;
}

export function GuardrailErrorMessage({ violations, sanitizedQuery, onDismiss }: GuardrailErrorMessageProps) {
	if (violations.length === 0) return null;

	const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
	const maxSeverity = violations.reduce(
		(max, v) => {
			return severityOrder[v.severity] > severityOrder[max] ? v.severity : max;
		},
		'low' as 'low' | 'medium' | 'high' | 'critical',
	);

	const getIcon = () => {
		switch (maxSeverity) {
			case 'critical':
			case 'high':
				return <AlertTriangle className='h-4 w-4' />;
			case 'medium':
				return <Shield className='h-4 w-4' />;
			default:
				return <Info className='h-4 w-4' />;
		}
	};

	const getVariant = () => {
		switch (maxSeverity) {
			case 'critical':
			case 'high':
				return 'destructive' as const;
			case 'medium':
				return 'default' as const;
			default:
				return 'secondary' as const;
		}
	};

	const getTitle = () => {
		switch (maxSeverity) {
			case 'critical':
			case 'high':
				return 'Query Blocked';
			case 'medium':
				return 'Query Warning';
			default:
				return 'Query Notice';
		}
	};

	return (
		<Alert variant={getVariant()} className='relative'>
			{onDismiss && (
				<button
					onClick={onDismiss}
					className='absolute right-2 top-2 opacity-70 hover:opacity-100'
					aria-label='Dismiss'
				>
					✕
				</button>
			)}
			{getIcon()}
			<AlertTitle>{getTitle()}</AlertTitle>
			<AlertDescription className='mt-2'>
				<ul className='list-disc list-inside space-y-1'>
					{violations.map((violation, idx) => (
						<li key={idx} className='text-sm'>
							{violation.message}
						</li>
					))}
				</ul>
				{sanitizedQuery && (
					<div className='mt-3 p-2 bg-muted rounded text-xs'>
						<p className='font-medium mb-1'>Your query was processed as:</p>
						<p className='italic opacity-80'>{sanitizedQuery}</p>
					</div>
				)}
			</AlertDescription>
		</Alert>
	);
}

interface RateLimitErrorProps {
	retryAfter?: number;
	onDismiss?: () => void;
}

export function RateLimitError({ retryAfter, onDismiss }: RateLimitErrorProps) {
	return (
		<Alert variant='destructive' className='relative'>
			{onDismiss && (
				<button
					onClick={onDismiss}
					className='absolute right-2 top-2 opacity-70 hover:opacity-100'
					aria-label='Dismiss'
				>
					✕
				</button>
			)}
			<AlertTriangle className='h-4 w-4' />
			<AlertTitle>Rate Limit Exceeded</AlertTitle>
			<AlertDescription className='mt-2'>
				<p className='text-sm'>
					You are sending requests too quickly. Please wait a moment before trying again.
					{retryAfter && ` Retry in ${retryAfter} seconds.`}
				</p>
			</AlertDescription>
		</Alert>
	);
}
